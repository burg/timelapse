/*
 * Copyright (C) 2011, 2012 Brian J. Burg <burg@cs.washington.edu>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

WebInspector.TimelapseGrid = function(model, recording) {
    /* column definitions */
    var columns = {
	gutter: {},
	index: {},
	group: {},
	type: {},
	timestamp: {},
	preview: {}
    };

    columns.gutter.title = " ";
    columns.gutter.sortable = false;
    columns.gutter.width = "15px";
    columns.gutter.aligned = "center";

    columns.index.title = " ";
    columns.index.sortable = true;
    columns.index.width = "5%";
    columns.index.aligned = "right";
    columns.index.sort = "ascending";

    columns.group.title = " ";
    columns.group.sortable = true;
    columns.group.width = "1%";

    columns.type.title = "What Happened?";
    columns.type.sortable = true;
    columns.type.width = "20%";
    columns.type.aligned = "right";

    columns.timestamp.title = "When?";
    columns.timestamp.sortable = true;
    columns.timestamp.width = "10%";
    
    columns.preview.title = "Input Preview";
    columns.preview.sortable = false;
    columns.preview.width = "auto";

    /* call to super with the constructed columns. */
    WebInspector.DataGrid.call(this, columns);

    this._highlightedNodes = {};
    this._sliders = {};
    this._model = model;
    this._recording = recording;
    this._sortingFunctions = {
	index: WebInspector.TimelapseGridNode.IndexComparator,
	group: WebInspector.TimelapseGridNode.GroupComparator,
	type: WebInspector.TimelapseGridNode.TypeComparator,
	timestamp: WebInspector.TimelapseGridNode.TimestampComparator,
    };
    this.resizeMethod = WebInspector.DataGrid.ResizeMethod.Last;

    this.element.classList.add("timelapse-inputs-grid");

    // TODO: does this comment even make sense? It's copied from DataGrid
    // Event listeners need to be added _after_ we attach to the document, so that owner document is properly update.
    this.addEventListener("sorting changed", this._onSortingChanged, this);
    this.scrollContainer.addEventListener("scroll", this._updateOffscreenRows.bind(this));

    var sliderEventNames = WebInspector.TimelapseGridSlider.Events;
    var playbackSlider = new WebInspector.TimelapseGridSlider(this, "playback", true);
    playbackSlider.addEventListener(sliderEventNames.DragStart, this._onGridDragStart, this);
    playbackSlider.addEventListener(sliderEventNames.DragEnd, this._onGridDragEnd, this);
    playbackSlider.element.addEventListener("contextmenu", this._onPlaybackSliderContextMenu.bind(this));
    this._addSlider(playbackSlider);
    this._addSlider(new WebInspector.TimelapseGridSlider(this, "previous", false));
    this._addSlider(new WebInspector.TimelapseGridSlider(this, "tentative", false));

    var modelEventNames = WebInspector.TimelapseModel.Events;
    this._model.addEventListener(modelEventNames.CaptureDidStart, this._onCaptureDidStart, this);
    this._model.addEventListener(modelEventNames.CaptureDidStop, this._onCaptureDidStop, this);
    this._model.addEventListener(modelEventNames.PlaybackDidStart, this._onPlaybackDidStart, this);
    this._model.addEventListener(modelEventNames.PlaybackStopped, this._onPlaybackStopped, this);
    this._model.addEventListener(modelEventNames.InputPaused, this._onInputPaused, this);
    this._model.addEventListener(modelEventNames.BreakpointPaused, this._onBreakpointPaused, this);

    var recordingEventNames = WebInspector.TimelapseRecording.Events;
    this._recording.addEventListener(recordingEventNames.ProviderAdded, this._onProviderAdded, this);
    this._recording.addEventListener(recordingEventNames.PreviewStarted, this._onPreviewStarted, this);
    this._recording.addEventListener(recordingEventNames.PreviewStopped, this._onPreviewStopped, this);
    this._recording.addEventListener(recordingEventNames.PreviewChanged, this._onPreviewChanged, this);
    this._recording.addEventListener(recordingEventNames.CircleSelected, this._onCircleSelected, this);

    this._recording.calculator.addEventListener(WebInspector.TimelapseCalculator.Events.ZoomChanged, this._onZoomChanged, this);

    this._providers = {};
    this._refreshDelay = WebInspector.TimelapseGrid.DefaultRefreshDelay;
    this._pendingRecords = [];
    this._maxMarkIndex = 0;
    this._recordGridNodes = {};
};

WebInspector.TimelapseGrid.DefaultRefreshDelay = 150;

WebInspector.TimelapseGrid.prototype = {
    // Public API
    get sliders()
    {
	return this._sliders;
    },

    get providers()
    {
	return this._providers;
    },

    get recording()
    {
        return this._recording;
    },

    wasShown: function()
    {
	this._updateOffscreenRows();
	this._scheduleRefresh();
    },

    refresh: function()
    {
	/* timer management */
	this._needsRefresh = false;
	if (this._refreshTimeout) {
	    clearTimeout(this._refreshTimeout);
	    delete this._refreshTimeout;
	}

	if (this._model.isCapturing)
	    return;

	// save position
        var wasScrolledToLastRow = this.isScrolledToLastRow();

	var newNode;
	// create new rows for pending records, update table.
	for (var i = 0; i < this._pendingRecords.length; i++) {
	    if (this._pendingRecords[i].mark.index > this._maxMarkIndex)
		this._maxMarkIndex = this._pendingRecords[i].mark.index;
	    
	    newNode = this._createRecordGridNode(this._pendingRecords[i]);
	    this.rootNode().appendChild(newNode);
	    newNode.refreshRecord();
	}

	this._pendingRecords = [];
	
	this.updateWidths();
	this._invalidateVisibleRows();

	for (var key in this.sliders) {
	    var slider = this.sliders[key];
	    if (slider)
	    slider.refresh();
	}

	// restore position
	if (wasScrolledToLastRow)
	    this.scrollToLastRow();
    },

    refreshRecordGridNode: function(markIndex)
    {
	var node = this._recordGridNodes[markIndex];
	node.refreshRecord.call(node);
    },

    // These are used by shortcut handlers
    replayToNextNode: function(markIndex)
    {
	if (typeof markIndex != "number")
	    markIndex = this._model.currentMarkIndex;
	var nextIndex = this.nextVisibleIndex(markIndex);
	if (nextIndex)
	    this._replayToIndex(nextIndex);
    },

    replayToPreviousNode: function(markIndex)
    {
	if (typeof markIndex != "number")
	    markIndex = this._model.currentMarkIndex;
	var previousIndex = this.previousVisibleIndex(markIndex);
	if (previousIndex)
	    this._replayToIndex(previousIndex);
    },

    nextVisibleIndex: function(markIndex)
    {
	var nextIndex = markIndex + 1;
	var lastIndex = this._maxMarkIndex;

	while (nextIndex <= lastIndex) {
	    var node = this._recordGridNodes[nextIndex];

	    if (!node || node.isFilteredOut())
		nextIndex++;
	    else
		return nextIndex;
	}
	return null;
    },

    previousVisibleIndex: function(markIndex)
    {
	var previousIndex = markIndex - 1;

	while (previousIndex > 0) {
	    var node = this._recordGridNodes[previousIndex];

	    if (!node || node.isFilteredOut())
		previousIndex--;
	    else
		return previousIndex;
	}
	return null;
    },

    // Private API (helpers)
    _canUseProvider: function(provider)
    {
	var types = WebInspector.DataProvider.Types;
	return provider.type == types.TimelapseInput ||
               provider.type == types.ReplaySavepoint;
    },

    _onProviderAdded: function(event)
    {
	var provider = event.data;
	if (!this._canUseProvider(provider))
	    return;

	console.assert(!this._providers.hasOwnProperty(provider.name),
		       "Provider already added to timeline grid.");

	this._providers[provider.name] = provider;
	this._setupListenersForProvider(provider);

	// set up provider's record filter if it's active.
	if (provider.isEnabled())
	    this.element.classList.add("filter-" + provider.name);

	// TODO: if the provider already has data, we should add it to pendingRecords here.
    },

    _onProviderWillRemove: function(event)
    {
	var provider = event.data;
	if (!this._canUseProvider(provider))
	    return;

	console.assert(this._providers.hasOwnProperty(provider.name),
		       "Can't remove provider not in timeline grid.");

	delete this._providers[provider.name];
	this._teardownListenersForProvider(provider);
    },

    _setupListenersForProvider: function(provider)
    {
	var events = WebInspector.DataProvider.Events;
	var types = WebInspector.DataProvider.Types;
	provider.addEventListener(events.WillRemove, this._onProviderWillRemove, this);

	if (provider.type == types.TimelapseInput) {
	    provider.addEventListener(events.AddedInput, this._onAddedInput, this);
	    provider.addEventListener(events.Enabled, this._onProviderEnabled, this);
	    provider.addEventListener(events.Disabled, this._onProviderDisabled, this);
	}

        if (provider.type == types.ReplaySavepoint) {
	    var savepointEvents = WebInspector.ReplaySavepointProvider.Events;
	    provider.addEventListener(savepointEvents.SavepointSet, this._onSavepointChanged, this);
	    provider.addEventListener(savepointEvents.SavepointRemoved, this._onSavepointChanged, this);
	}
    },

    _teardownListenersForProvider: function(provider)
    {
	var events = WebInspector.DataProvider.Events;
	var types = WebInspector.DataProvider.Types;
	provider.removeEventListener(events.WillRemove, this._onProviderWillRemove, this);

	if (provider.type == types.TimelapseInput) {
	    provider.removeEventListener(events.AddedInput, this._onAddedInput, this);
	    provider.removeEventListener(events.Enabled, this._onProviderEnabled, this);
	    provider.removeEventListener(events.Disabled, this._onProviderDisabled, this);
	}

        if (provider.type == types.ReplaySavepoint) {
	    var savepointEvents = WebInspector.ReplaySavepointProvider.Events;
	    provider.removeEventListener(savepointEvents.SavepointSet, this._onSavepointChanged, this);
	    provider.removeEventListener(savepointEvents.SavepointRemoved, this._onSavepointChanged, this);
	}
    },

    _onAddedInput: function(event)
    {
	var input = event.data.input;

	this._pendingRecords.push(input);
        this._scheduleRefresh();
    },

    _onProviderEnabled: function(event)
    {
	var provider = event.data;

	this.element.classList.add("filter-" + provider.name);

	this._updateOffscreenRows();
	this._scheduleRefresh();
    },

    _onProviderDisabled: function(event)
    {
	var provider = event.data;

	this.element.classList.remove("filter-" + provider.name);

	// if the selected row matches the disabled provider, then deselect it.
	if (this.selected) {
	    var selectedNode = this.selectedNode;
	    var style = WebInspector.TimelapseInputDataProvider.InputStyles[selectedNode.record.type];
	    if (style.group == provider.name)
		selectedNode.deselect();
	}

	this._updateOffscreenRows();
	this._scheduleRefresh();
    },

    _clearHighlight: function(classSuffix)
    {
	var className = "highlight-" + classSuffix;
	if (!this._highlightedNodes[className])
	    return;

	this._highlightedNodes[className]._element.classList.remove(className);
	delete this._highlightedNodes[className];
    },

    _addSlider: function(slider) {
	this._sliders[slider.name] = slider;
	this.scrollContainer.appendChild(slider.element);
    },

    _removeSlider: function(slider) {
	if (this._sliders[slider.name])
	    delete this._sliders[slider.name];

	if (slider.element.parentElement === this.scrollContainer)
	    this.scrollContainer.removeChild(slider.element);
    },

    _onSortingChanged: function()
    {
	this._sortItems();
	this.refresh();
    },

    _sortItems: function()
    {
        var sortingFunction = this._sortingFunctions[this.sortColumnIdentifier];
        if (!sortingFunction)
            return;

        this.sortNodes(sortingFunction, this.sortOrder === "descending");
	this._updateOffscreenRows();
    },

    _createRecordGridNode: function(record)
    {
	var node = new WebInspector.TimelapseGridNode(this, record);
	this._recordGridNodes[record.mark.index] = node;
	return node;
    },

    _scheduleRefresh: function()
    {
	if (this._needsRefresh)
	    return;

	this._needsRefresh = true;

	if (!this._refreshTimeout)
	    this._refreshTimeout = setTimeout(this.refresh.bind(this), this._refreshDelay);
    },

    _refreshIfNeeded: function()
    {
	if (this._needsRefresh)	
	    this.refresh();
    },

    _replayToIndex: function(markIndex)
    {
	this._model.replayUpToMarkIndex(markIndex);
    },

    _updateZoomInterval: function()
    {
	var calculator = this._recording.calculator;
	var startTs = calculator.computeMiniviewTimestamp(calculator.zoomLeft);
	var endTs = calculator.computeMiniviewTimestamp(calculator.zoomRight);

	for (var markIndex in this._recordGridNodes) {
	    var node = this._recordGridNodes[markIndex];
	    var ts = node.record.mark.timestamp;
	    if (ts < startTs || ts > endTs)
		node.element.classList.add("hidden");
	    else
		node.element.classList.remove("hidden");
	}
    },

    // Private API (callbacks)
    _onZoomChanged: function(event)
    {
	this._updateZoomInterval();
	this._updateOffscreenRows();
	this._scheduleRefresh();
    },

    _onCaptureDidStart: function()
    {
	// TODO: make widget lifetime tied to specific recording, rather
	// than record/replay events
	for (var key in this.sliders) {
	    var slider = this.sliders[key];
	    slider.clear();
	}

	this.sliders.playback.disable();
    },

    _onCaptureDidStop: function()
    {
	this._refreshIfNeeded();
	var node = this._recordGridNodes[this._model.currentMarkIndex];
	this.sliders.playback.placeAfter(node);
	this.sliders.playback.enable();
	this.sliders.playback.show();
	node.reveal();
    },

    _onPlaybackDidStart: function()
    {
	this.sliders.playback.hide();
	this.sliders.playback.element.removeStyleClass("breakpoint-slider");

	var startNode = this._recordGridNodes[this._model.replayStartMarkIndex];
	this.sliders.previous.placeBefore(startNode);
	this.sliders.previous.show();

	var finishNode = this._recordGridNodes[this._model.replayFinishMarkIndex];
	this.sliders.tentative.placeBefore(finishNode);
	this.sliders.tentative.show();
    },

    _onInputPaused: function()
    {
	this.sliders.previous.hide();
	this.sliders.tentative.hide();

	var node = this._recordGridNodes[this._model.currentMarkIndex];
	this.sliders.playback.placeBefore(node, true);
	this.sliders.playback.element.removeStyleClass("playback-pulse");
	this.sliders.playback.enable();

	if (!WebInspector.debuggerModel.isPaused())
	    this.sliders.playback.show();
    },

    _onPlaybackStopped: function()
    {
	this.sliders.previous.hide();
	this.sliders.tentative.hide();

	var node = this._recordGridNodes[this._model.currentMarkIndex];
	this.sliders.playback.placeBefore(node, true);
	this.sliders.playback.element.removeStyleClass("playback-pulse");
	this.sliders.playback.enable();

	if (!WebInspector.debuggerModel.isPaused())
	    this.sliders.playback.show();
    },

    _onBreakpointPaused: function(eventData)
    {
	var position = this._recordGridNodes[this._model.currentMarkIndex];

	this.sliders.playback.placeBefore(position);
	this.sliders.playback.element.addStyleClass("breakpoint-slider");
	this.sliders.playback.element.removeStyleClass("playback-pulse");
	this.sliders.playback.show();
	this.sliders.playback.reveal();

	this.sliders.previous.show();
	this.sliders.tentative.show();
    },

    _onCircleSelected: function(event)
    {
	var provider = event.data.provider;
	var recordIndices = event.data.recordIndices;
	var firstRecord = provider.records[recordIndices[0]];
	var lastRecord = provider.records[recordIndices[recordIndices.length-1]];

	// attempt to reveal first and last rows, so it matches the popup
	this._recordGridNodes[firstRecord.mark.index].reveal();
	this._recordGridNodes[lastRecord.mark.index].reveal();
    },

    _onPreviewStarted: function()
    {
	var position = this._recordGridNodes[this._model.currentMarkIndex];

	this.sliders.previous.placeBefore(position);
	this.sliders.previous.show();
	this.sliders.tentative.placeBefore(position);
	this.sliders.tentative.show();
    },

    _onPreviewStopped: function()
    {
	this.sliders.playback.hide();
	this.sliders.previous.hide();
	this.sliders.tentative.hide();
    },

    _onPreviewChanged: function(event)
    {
	var record = event.data;
	var node = this._recordGridNodes[record.mark.index];

	if (!node.isFilteredOut()) {
	    this._sliders.tentative.placeBefore(node);
	    node.reveal();
	    this._invalidateVisibleRows();
	}
    },

    _invalidateVisibleRows: function()
    {
	this._visibleRowsAreStale = true;
    },

    get visibleRows()
    {
	// this has been deoptimized. It used to only ask for nodes matching
	// .revealed:not(.offscreen), but the query returned incorrect results.
	if (this._visibleRowsAreStale) {
	    this._visibleRowsAreStale = false;
	    this._visibleRows = this.scrollContainer.querySelectorAll(".revealed");
	}
	return this._visibleRows;
    },

    _onGridDragStart: function(event)
    {
	this.sliders.playback.element.removeStyleClass("breakpoint-slider");
	this.sliders.playback.addEventListener(WebInspector.TimelapseGridSlider.Events.Dragging,
							 this._onGridDragging, this);

	this._dragStartOffset = event.data;
	this._cancelAutoScroll();

	var position = this.sliders.playback.position;
	// HACK: this will clear any .after-node style.
	this.sliders.playback.placeBefore(position.node);

	this._recording.startPreviewing();
    },

    _onGridDragEnd: function()
    {
	this.sliders.playback.removeEventListener(WebInspector.TimelapseGridSlider.Events.Dragging,
							 this._onGridDragging);

	delete this._dragStartOffset;

	this._cancelAutoScroll();
	var targetRecord = this._recording.previewedRecord;
	this._recording.stopPreviewing();

	var position = this.sliders.playback.position;
	if (position.before)
	    this._replayToIndex(targetRecord.mark.index);
	else
	    this._replayToNextNode(targetRecord.mark.index);
    },

    _onGridDragging: function(eventData)
    {
 	var offsetTop = eventData.data;
	var rows = this.visibleRows;
	var i = 0;

	for (i = 0; i < rows.length; i++) {
	    // check whether dragging slider is within this row,
	    // and if so, reposition tentative slider.
	    var row = rows[i];
	    var node = this.dataGridNodeFromNode(row);
	
	    var isBelowRowTop = (offsetTop >= row.offsetTop);
	    var isAboveRowBottom = (offsetTop <= row.offsetTop + row.offsetHeight);
	    var isAboveRowMidpoint = (offsetTop <= row.offsetTop + row.offsetHeight/2);

	    if (!(isBelowRowTop && isAboveRowBottom))
		continue;

	    var newPosition = {
		node: node,
		before: isAboveRowMidpoint
	    };

	    var currentPosition = this.sliders.tentative.position;

	    if (currentPosition.node != newPosition.node ||
		currentPosition.before != newPosition.before) {		

		if (isAboveRowMidpoint)
		    this._recording.previewRecord(node.record);
		else {
		    var nextMarkIndex = this.nextVisibleIndex(node.record.mark.index);
		    if (!nextMarkIndex)
			return;

		    var nextRecordIndex = this._recording.recordIndexFromMarkIndex(nextMarkIndex);
		    this._recording.previewRecord(this._recordGridNodes[nextMarkIndex].record);
		}
	    }

	    var container = this.scrollContainer;

	    // if positioned within or before first row, then scroll up.
	    var isScrolledToTop = (container.scrollTop == 0);
	    var isScrolledToBottom = (container.scrollHeight == container.scrollTop + container.offsetHeight);
	    var withinFirstVisibleRow = (offsetTop < container.scrollTop + row.offsetHeight);
	    var withinLastVisibleRow = (offsetTop > container.scrollTop + container.clientHeight - row.offsetHeight);
	    var closeToDragStartOffset = (Math.abs(offsetTop - this._dragStartOffset) < 5);
	    var scrollGranularity = row.offsetHeight/2;

	    if (!isScrolledToTop && withinFirstVisibleRow && !closeToDragStartOffset) {
		container.scrollTop -= scrollGranularity;
		this._invalidateVisibleRows();
		this._startAutoScroll(eventData);
	    }

	    // if positioned within or beyond last visible row, then scroll down.
	    if (!isScrolledToBottom && withinLastVisibleRow && !closeToDragStartOffset) {
		container.scrollTop += scrollGranularity;
		this._invalidateVisibleRows();
		this._startAutoScroll(eventData);
	    }

	    // do not inspect any more rows if we found the one which the slider is over.
	    break;
	}
    },

    _onPlaybackSliderContextMenu: function(event)
    {
	if (WebInspector.timelapseModel.breakpointPaused)
	    WebInspector.timelapseBreakpointTracker.currentBreakpoint.contextMenu(event);	
    },

    _autoScrollDelay: 100, /* milliseconds between autoscrolls */

    _cancelAutoScroll: function()
    {
	if (!this._autoScrollTimer)
	    return;

	clearTimeout(this._autoScrollTimer);
	delete this._autoScrollTimer;
    },

    _startAutoScroll: function(eventData)
    {
	this._cancelAutoScroll();
	this._autoScrollTimer = setTimeout(this._onGridDragging.bind(this, eventData), this._autoScrollDelay);
    },

    _updateOffscreenRows: function()
    {
        var dataTableBody = this.dataTableBody;
        var rows = dataTableBody.children;
        var recordsCount = rows.length;
        if (recordsCount < 2)
            return;  // Filler row only.

        var visibleTop = this.scrollContainer.scrollTop;
        var visibleBottom = visibleTop + this.scrollContainer.offsetHeight;

        var rowHeight = 0;

        // Filler is at recordsCount - 1.
        var unfilteredRowIndex = 0;
        for (var i = 0; i < recordsCount - 1; ++i) {
            var row = rows[i];

            var dataGridNode = this.dataGridNodeFromNode(row);
            if (dataGridNode.isFilteredOut()) {
                row.removeStyleClass("offscreen");
                continue;
            }

            if (!rowHeight)
                rowHeight = row.offsetHeight;

            var rowIsVisible = unfilteredRowIndex * rowHeight < visibleBottom && (unfilteredRowIndex + 1) * rowHeight > visibleTop;
            if (rowIsVisible !== row.rowIsVisible) {
                if (rowIsVisible)
                    row.removeStyleClass("offscreen");
                else
                    row.addStyleClass("offscreen");
                row.rowIsVisible = rowIsVisible;
            }
            unfilteredRowIndex++;
        }
    },

    _onSavepointChanged: function(event)
    {
	this.refreshRecordGridNode(event.data.markIndex);
    },
};

WebInspector.TimelapseGrid.prototype.__proto__ = WebInspector.DataGrid.prototype;

/**
 * @constructor
 * @extends {WebInspector.Object}
 */
WebInspector.TimelapseGridSlider = function(grid, name, adjustable)
{
    WebInspector.Object.call(this);
    this._adjustable = adjustable;
    this.name = name;
    this._position = { node: null, before: true };

    this.element = document.createElement("div");
    this.element.className = "timelapse-grid-slider " + name + "-slider";

    this._horizontalBarElement = document.createElement("div");
    this._horizontalBarElement.className = "timelapse-slider-band";
    this.element.appendChild(this._horizontalBarElement);

    if (this._adjustable) {
	this.element.classList.add("adjustable");
	WebInspector.installDragHandle(this.element, this._startSliderDragging.bind(this), this._sliderDragging.bind(this), this._endSliderDragging.bind(this), "row-resize");
    }

    var wrapper = this._wedgeWrapperElement = document.createElement("div");
    wrapper.className = "timelapse-slider-wedge-wrapper";
    var wedgeBorder = document.createElement("div");
    wedgeBorder.className = "timelapse-slider-wedge-border";
    wrapper.appendChild(wedgeBorder);
    var wedge = document.createElement("div");
    wedge.className = "timelapse-slider-wedge";
    wrapper.appendChild(wedge);
    this.element.appendChild(wrapper);

    this._grid = grid;
    // if the grid is dragged, refresh to make sure snap to first row is accurate
    this._grid.addEventListener("width changed", this.refresh.bind(this));
    this.clear();
    this.enable();
};

WebInspector.TimelapseGridSlider.Events = {
    Dragging: "TimelapseSliderDragging",
    DragStart: "TimelapseSliderDragStart",
    DragEnd: "TimelapseSliderDragEnd"
};

WebInspector.TimelapseGridSlider.prototype =  {
    clear: function()
    {
	this.element.classList.add("hidden");
	this.disable();
    },

    placeBefore: function(gridNode)
    {
	this.setPosition(gridNode, true);
    },

    placeAfter: function(gridNode)
    {
	this.setPosition(gridNode, false);
    },

    setPosition: function(gridNode, beforeInput)
    {
	this._position.node = gridNode;
	this._position.before = beforeInput;

	if (beforeInput) {
	    this.element.classList.add("before-node");
	    this.element.classList.remove("after-node");
	} else {
	    this.element.classList.remove("before-node");
	    this.element.classList.add("after-node");
	}
	this.refresh();
    },

    get position()
    {
	return this._position;
    },

    show: function()
    {
	this.element.classList.remove("hidden");
	// this will force positioning of wedge/band to be flush with column
	this.refresh();
    },

    hide: function()
    {
	this.element.classList.add("hidden");
	if (this._currentAnimation)
	    this._currentAnimation.cancel();
    },

    disable: function()
    {
	this._enabled = false;
	this.element.classList.add("disabled");
    },

    enable: function()
    {
	this._enabled = true;
	this.element.classList.remove("disabled");
    },

    reveal: function()
    {
	if (this._position && this._position.node)
	    this._position.node.reveal();
    },

    dispose: function()
    {
	this.element.parentElement.removeChild(this.element);
    },

    refresh: function()
    {
	var firstColumnWidth = this._grid.columnPixelWidthsMap["gutter"];
	if (this._wedgeWrapperElement)
	    this._wedgeWrapperElement.style.left = firstColumnWidth - this._wedgeWrapperElement.offsetWidth + "px";

	this._horizontalBarElement.style.left = firstColumnWidth + "px";

	var node = this._position.node;
	if (!node)
	    return;

	/* if the actual row is filtered out, try to set at next/prev visible. 
	 * If that fails, just set at top of table */
	if (node.isFilteredOut()) {
	    var prevMarkIndex = this._grid.previousVisibleIndex(node.record.mark.index);
	    var nextMarkIndex = this._grid.nextVisibleIndex(node.record.mark.index);
	    if (!prevMarkIndex) {
		this.element.style.top = "0px";
		return;
	    } else if (!nextMarkIndex) {
		var prevNode = this._grid._recordGridNodes[prevMarkIndex];
		this.element.style.top = prevNode.element.offsetTop + prevNode.element.offsetHeight + "px";
		return;
	    }

	    node = this._grid._recordGridNodes[prevMarkIndex];
	}

	this.element.style.top = node.element.offsetTop + "px";
    },

    _computeAbsOffsetTop: function(event)
    {
	var parent = this.element.parentElement; // should be data grid
	var dragPoint = event.clientY - parent.totalOffsetTop() - (this.element.offsetHeight/2);
	var topMinimum = parent.clientTop;
	var bottomMaximum = topMinimum + parent.clientHeight - this.element.offsetHeight;
	return parent.scrollTop + Number.constrain(dragPoint, topMinimum, bottomMaximum);
    },

    _startSliderDragging: function(event)
    {
	if (!this._enabled)
	    return false;

	this.element.classList.add("slider-dragging");
	var offsetTop = this._computeAbsOffsetTop(event);

	this.dispatchEventToListeners(WebInspector.TimelapseGridSlider.Events.DragStart, offsetTop);
	return true;
    },

    _sliderDragging: function(event)
    {
	if (!this._enabled)
	    return;
	
	var offsetTop = this._computeAbsOffsetTop(event);
	this.element.style.top = offsetTop + "px";
	this.dispatchEventToListeners(WebInspector.TimelapseGridSlider.Events.Dragging, offsetTop);
	event.preventDefault();
    },

    _endSliderDragging: function(event)
    {	
	if (!this._enabled)
	    return;

	delete this._visibleRows;

	this.element.classList.remove("slider-dragging");
	this.dispatchEventToListeners(WebInspector.TimelapseGridSlider.Events.DragEnd);
    }
};

WebInspector.TimelapseGridSlider.prototype.__proto__ = WebInspector.Object.prototype;

/**
 * @constructor
 * @extends {WebInspector.DataGridNode}
 */
WebInspector.TimelapseGridNode = function(parentView, record)
{
    WebInspector.DataGridNode.call(this, {});
    this._parentView = parentView;
    this._record = record;
};

WebInspector.TimelapseGridNode.prototype = {
    get record()
    {
	return this._record;
    },

    createCells: function()
    {
	var group = WebInspector.TimelapseInputDataProvider.InputStyles[this._record.type].group;

        // Out of sight, out of mind: create nodes offscreen to save on render tree update times when running updateOffscreenRows()
        this._element.addStyleClass("offscreen");
	this._element.addStyleClass("timelapse-category-" + group);
	this._gutterCell = this._createDivInTD("gutter");
        this._indexCell = this._createDivInTD("index");
	this._groupCell = this._createDivInTD("category");
        this._typeCell = this._createDivInTD("type");
        this._timestampCell = this._createDivInTD("timestamp");
        this._previewCell = this._createDivInTD("preview");
	this._element.addEventListener("dblclick", this._replayToThisNode.bind(this), false);
    },

    isFilteredOut: function()
    {
        return !this._parentView.providers[WebInspector.TimelapseInputDataProvider.InputStyles[this._record.type].group].isEnabled() || this.element.classList.contains("hidden");
    },

    highlight: function(classSuffix)
    {
	var className = "highlight-" + classSuffix;
	if (this._element.classList.contains(className))
	    return;

	this.dataGrid.clearHighlight(classSuffix);
	this.dataGrid._highlightedNodes[className] = this;
	this._element.classList.add(className);
    },

    select: function() {
	if (this.selected)
	    return;
	
	// let the model know that the row is selected, but paint the change immediately.
	this._parentView.recording.selectInput(this._record.mark.index);
        WebInspector.DataGridNode.prototype.select.apply(this, arguments);
    },

    get selectable()
    {
        return !this.isFilteredOut();
    },

    _replayToThisNode: function() {
	WebInspector.timelapseModel.replayUpToMarkIndex(this._record.mark.index);
    },

    _createDivInTD: function(columnIdentifier)
    {
        var td = document.createElement("td");
        td.className = "timelapse-column-" + columnIdentifier;
        var div = document.createElement("div");
        td.appendChild(div);
        this._element.appendChild(td);
        return div;
    },

    refreshRecord: function()
    {
	this._refreshGutterCell();
	this._refreshIndexCell();
	this._refreshGroupCell();
	this._refreshTypeCell();
	this._refreshTimestampCell();
	this._refreshPreviewCell();
	
	this._element.addStyleClass("timelapse-table-item");
	var group = WebInspector.TimelapseInputDataProvider.InputStyles[this._record.type].group;
	if (!this._element.hasStyleClass("timelapse-category-" + group)) {
            this._element.removeMatchingStyleClasses("timelapse-category-\\w+");
            this._element.addStyleClass("timelapse-category-" + group);
        }
    },

    _refreshGutterCell: function()
    {
	this._gutterCell.removeChildren();

	var savepointProvider = this._parentView.recording.savepointProvider;
	var savepoint = savepointProvider.savepointAtMarkIndex(this._record.mark.index);
	if (!savepoint)
	    return;

	var savepointButton = document.createElement("div");
	savepointButton.className = "timelapse-button-icon timelapse-savepoint-button toggled";

	this._gutterCell.appendChild(savepointButton);
    },

    _refreshIndexCell: function()
    {
	this._indexCell.removeChildren();
	this._indexCell.appendChild(document.createTextNode(this._record.mark.index));
	this._indexCell.title = "Input Action #" + this._record.mark.index;
    },

    _refreshGroupCell: function()
    {
	this._groupCell.removeChildren();
	this._groupCell.appendChild(document.createTextNode(" "));
	var group = WebInspector.TimelapseInputDataProvider.InputStyles[this._record.type].group;
	var provider = this._parentView.providers[group];
	this._groupCell.title = "Category: " + provider.displayName;
    },

    _refreshTypeCell: function()
    {
    	this._typeCell.removeChildren();
	this._typeCell.setTextAndTitle(WebInspector.TimelapseInputDataProvider.InputStyles[this._record.type].title);
    },

    _refreshTimestampCell: function()
    {
    	this._timestampCell.removeChildren();
	this._timestampCell.setTextAndTitle(this._parentView.recording.calculator.formatElapsedValue(this._record.mark.timestamp));
    },

    _refreshPreviewCell: function()
    {
    	this._previewCell.removeChildren();
	var group = WebInspector.TimelapseInputDataProvider.InputStyles[this._record.type].group;
	var provider = this._parentView._providers[group];
	var preview = WebInspector.TimelapseInputDataProvider.InputPreview[this._record.type](this._record.data, provider);
	if (group == "network") {
	    var url = preview;
	    var isExternal = !WebInspector.resourceForURL(url);
	    var link = WebInspector.linkifyURLAsNode(url,
						     WebInspector.displayNameForURL(url),
						     "timelapse-html-resource-link",
						     isExternal);
	    this._previewCell.appendChild(link);
	}
	else
	    this._previewCell.setTextAndTitle(preview);
    }
};

WebInspector.TimelapseGridNode.prototype.__proto__ = WebInspector.DataGridNode.prototype;


WebInspector.TimelapseGridNode.GroupComparator = function(a,b)
{
    var aGroup = WebInspector.TimelapseInputDataProvider.InputStyles[a._record.type].group;
    var bGroup = WebInspector.TimelapseInputDataProvider.InputStyles[b._record.type].group;
    if (aGroup > bGroup)
	return 1;
    if (bGroup > aGroup)
	return -1;
    return 0;
};

WebInspector.TimelapseGridNode.TypeComparator = function(a,b)
{
    var aType = a._record.type;
    var bType = b._record.type;
    if (aType > bType)
	return 1;
    if (bType > aType)
	return -1;
    return 0;
};

WebInspector.TimelapseGridNode.IndexComparator = function(a,b)
{
    var aIndex = a._record.mark.index;
    var bIndex = b._record.mark.index;
    if (aIndex > bIndex)
	return 1;
    if (bIndex > aIndex)
	return -1;
    return 0;
};

WebInspector.TimelapseGridNode.TimestampComparator = function(a,b)
{
    var aTimestamp = a._record.mark.timestamp;
    var bTimestamp = b._record.mark.timestamp;
    if (aTimestamp > bTimestamp)
	return 1;
    if (bTimestamp > aTimestamp)
	return -1;
    return 0;
};
