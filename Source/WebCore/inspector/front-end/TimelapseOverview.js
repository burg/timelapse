/*
 *  Copyright (C) 2012, Brian Burg.
 *  Copyright (C) 2012, University of Washington. All rights reserved.
 *
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of the University of Washington nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseOverview = function()
{
    WebInspector.View.call(this);

    this._model = WebInspector.timelapseModel;
    this._presentationModel = WebInspector.timelapsePresentationModel;

    // TODO: the overview should look for new providers and create timelines for
    // them if it knows how to interpret them.

    // TODO: If we have multiple overviews, each with different timelines,
    // then TimelapseReplayingView or something else needs to coordinate which 
    // overviews handle which data providers.

    // TODO: TimelapseOverview should compose a Miniview and several Timelines.
    // The miniview shall be fed a subset of the data providers behind each timeline.
   

    // TODO: being based on DataProviders, the overview should only be
    // listening for events necessary to update overview slider positions.
    //
    // Data changes go through the DataProviders.
    // Zoom changes come from the TimelapsePresentationModel.
    var modelEventNames = WebInspector.TimelapseModel.EventTypes;
    this._model.addEventListener(modelEventNames.RecordingDidStart, this._onRecordingDidStart, this);
    this._model.addEventListener(modelEventNames.RecordingDidStop, this._onRecordingDidStop, this);
    this._model.addEventListener(modelEventNames.PlaybackWillStart, this._onPlaybackWillStart, this);
    this._model.addEventListener(modelEventNames.PlaybackDidStart, this._onPlaybackDidStart, this);
    this._model.addEventListener(modelEventNames.PlaybackStopped, this._onPlaybackStopped, this);
    this._model.addEventListener(modelEventNames.InputPaused, this._onInputPaused, this);
    this._model.addEventListener(modelEventNames.InputHit, this._onInputHit, this);
    this._model.addEventListener(modelEventNames.BreakpointPaused, this._onBreakpointPaused, this);
    this._model.addEventListener(modelEventNames.BreakpointHit, this._onBreakpointRecordsChanged, this);

    // TODO: these should instead listen to specific data provider events.
    var presEventNames = WebInspector.TimelapsePresentationModel.EventTypes;
    this._presentationModel.addEventListener(presEventNames.ProviderAdded, this._onProviderAdded, this);
    this._presentationModel.addEventListener(presEventNames.ProviderRemoved, this._onProviderRemoved, this);
    this._presentationModel.addEventListener(presEventNames.FilterChanged, this._onFilterChanged, this);
    this._presentationModel.addEventListener(presEventNames.PreviewStarted, this._onPreviewStarted, this);
    this._presentationModel.addEventListener(presEventNames.PreviewStopped, this._onPreviewStopped, this);
    this._presentationModel.addEventListener(presEventNames.PreviewChanged, this._onPreviewChanged, this);
    this._presentationModel.addEventListener(presEventNames.CircleMouseOver, this._onCircleMouseOver, this);
    this._presentationModel.addEventListener(presEventNames.CircleMouseOut, this._onCircleMouseOut, this);
    this._presentationModel.addEventListener(presEventNames.CircleSelected, this._onCircleSelected, this);

    this._presentationModel.calculator.addEventListener(WebInspector.TimelapseCalculator.EventTypes.ZoomChanged, this._onZoomChanged, this);

    // TODO: listen to TimelapseAnchorDataProvider instead.
    var anchorManager = WebInspector.timelapsePresentationModel.anchorManager;
    var anchorEventNames = WebInspector.TimelapseAnchorManager.EventTypes;
    anchorManager.addEventListener(anchorEventNames.AnchorSet, this._onAnchorSet, this);
    anchorManager.addEventListener(anchorEventNames.AnchorRemoved, this._onAnchorRemoved, this);

    WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointAdded, this._onBreakpointRecordsChanged, this);
    WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointRemoved, this._onBreakpointRecordsChanged, this);
    WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointRemovedFromStorage, this._onBreakpointRecordsChanged, this);

    this._initializeView();
};

WebInspector.TimelapseOverview.ResizerOffset = 3.5;
WebInspector.TimelapseOverview.MinAnimationDelta = 0.5;
WebInspector.TimelapseOverview.WindowScrollSpeedFactor = 0.001;
WebInspector.TimelapseOverview.WindowZoomSpeedFactor = 0.001;
WebInspector.TimelapseOverview.DefaultRefreshDelay = 30;

WebInspector.TimelapseOverview.prototype = {

    _initializeView: function()
    {
	this.element.className = "timelapse-overview";
	this.element.tabIndex = 0;
	
	this._messagePanel = document.createElement("div");
	this._messagePanel.className = "timelapse-overview-message message-pulse hidden";
	this._messagePanel.addEventListener("click", this._onMessagePanelClicked.bind(this), true);
	this.element.appendChild(this._messagePanel);

	this._timelineContainer = document.createElement("div");
	this._timelineContainer.className = "timelapse-overview-timelines";
	this._timelineContainer.addEventListener("mousedown", this._onTimelineMousedown.bind(this), false);
	this._timelineContainer.addEventListener("mousewheel", this._onTimelineMousewheel.bind(this), true);
	this._timelineContainer.addEventListener("mousemove", this._onTimelineMousemove.bind(this), false);
	this._timelineContainer.addEventListener("mouseout", this._onTimelineMouseout.bind(this), false);
	this._timelineContainer.addEventListener("click", this._onTimelineClicked.bind(this), false);
	this._timelineContainer.addEventListener("dblclick", this._onTimelineDoubleClicked.bind(this), false);

	var playbackSlider = new WebInspector.TimelapseOverviewSlider(this, "playback", true);
	playbackSlider.addEventListener(WebInspector.TimelapseOverviewSlider.EventTypes.DragStart,
					     this._onPlaybackSliderDragStart, this);
	playbackSlider.addEventListener(WebInspector.TimelapseOverviewSlider.EventTypes.DragEnd,
					     this._onPlaybackSliderDragEnd, this);
	playbackSlider.element.addEventListener("contextmenu", this._onPlaybackSliderContextMenu, this);
	this._timelineContainer.appendChild(playbackSlider.element);
	var previousSlider = new WebInspector.TimelapseOverviewSlider(this, "previous", false);
	this._timelineContainer.appendChild(previousSlider.element);
	var tentativeSlider = new WebInspector.TimelapseOverviewSlider(this, "tentative", false);
	this._timelineContainer.appendChild(tentativeSlider.element);
	// TODO: click, contextmenu events for anchor?

	this.sliders = {
	    playback: playbackSlider,
	    previous: previousSlider,
	    tentative: tentativeSlider,
	    anchor: []
	};

	this._timelines = [];

	this.element.appendChild(this._timelineContainer);

	this._dividersElement = document.createElement("div");
	this._dividersElement.className = "resources-dividers";
	this._timelineContainer.appendChild(this._dividersElement);

	this._dividersLabelBarElement = document.createElement("div");
	this._dividersLabelBarElement.className = "resources-dividers-label-bar";
	this._timelineContainer.appendChild(this._dividersLabelBarElement);

	this.reset();
    },

    _timelineForCategory: function(category)
    {
	for (var i = 0; i < this._timelines.length; i++) {
	    if (this._timelines[i].category === category)
		return this._timelines[i];
	}

	return false;
    },

    /* mostly copied from TimelineGrid.js */
    updateDividers: function(force)
    {
	// each label is at least 64 px wide
	var dividerCount = Math.round(this._dividersElement.offsetWidth / 64);
	var calculator = this.calculator;

	// if the there is the same unit time per divider, then don't need to update anything.
	var activeDuration = (calculator.zoomRight - calculator.zoomLeft) * calculator.boundarySpan;
	var timeOffset = calculator.boundarySpan * calculator.zoomLeft;

	var timePerDivider = activeDuration / dividerCount;
	if (!force && this._currentTimePerDivider === timePerDivider && this._currentTimeOffset === timeOffset)
	    return false;
	this._currentTimePerDivider = timePerDivider;
	this._currentTimeOffset = timeOffset;

	var divider = this._dividersElement.firstChild;
	var dividerLabelBar = this._dividersLabelBarElement.firstChild;
	var availWidth = this._dividersLabelBarElement.clientWidth;
	// this may grow as more dividers are added.
	var currentLabelBarWidth = availWidth;	

	for (var i = 1; i < dividerCount; i++) {
	    if (!divider) {
		divider = document.createElement("div");
		divider.className = "resources-divider";
		this._dividersElement.appendChild(divider);

		dividerLabelBar = document.createElement("div");
		dividerLabelBar.className = "resources-divider";

                var label = document.createElement("div");
                label.className = "resources-divider-label";
                dividerLabelBar._labelElement = label;
                dividerLabelBar.appendChild(label);
                this._dividersLabelBarElement.appendChild(dividerLabelBar);
		/* update current width */
		currentLabelBarWidth = this._dividersLabelBarElement.clientWidth;
	    }

	    var left = availWidth * (i / dividerCount);
	    var percentLeft = 100 * left / currentLabelBarWidth;
            this._setDividerAndBarLeft(divider, dividerLabelBar, percentLeft);

            if (!isNaN(timePerDivider))
                dividerLabelBar._labelElement.textContent = Number.secondsToString(timeOffset + timePerDivider * i);
            else
                dividerLabelBar._labelElement.textContent = "";
            divider = divider.nextSibling;
            dividerLabelBar = dividerLabelBar.nextSibling;
        }

        // Remove extras.
        while (divider) {
            var nextDivider = divider.nextSibling;
            this._dividersElement.removeChild(divider);
            divider = nextDivider;
        }
        while (dividerLabelBar) {
            var nextDivider = dividerLabelBar.nextSibling;
            this._dividersLabelBarElement.removeChild(dividerLabelBar);
            dividerLabelBar = nextDivider;
        }
	return true;
    },

    _setDividerAndBarLeft: function(divider, dividerLabelBar, percentLeft)
    {
        var percentStyleLeft = parseFloat(divider.style.left);
        if (!isNaN(percentStyleLeft) && Math.abs(percentStyleLeft - percentLeft) < 0.1)
            return;
        divider.style.left = percentLeft + "%";
        dividerLabelBar.style.left = percentLeft + "%";
    },

    removeEventDividers: function()
    {
        this._eventDividersElement.removeChildren();
    },

    reset: function()
    {
	this.sliders.playback.clear();
	this.sliders.playback.hide();
	this._refreshDelay = WebInspector.TimelapseOverview.DefaultRefreshDelay;

	/* update dividers */
	this.updateDividers(true);

	/* clear all timelines */
	this._timelines.forEach(function(timeline) {
            timeline.reset();
        });

	if (this._hoveredCircle)
	    delete this._hoveredCircle;
	if (this._selectedCircle)
	    delete this._selectedCircle;
    },

    /* Extends View.willHide */
    willHide: function()
    {
	WebInspector.View.prototype.willHide.call(this);

    	this._presentationModel.overviewPopover.hide();
	document.body.removeEventListener("mousemove", this._presentationModel.startHidePopoverTimer.bind(this._presentationModel), false);
    },

    /* Extends View.wasShown */
    wasShown: function()
    {
	// calling the shadowed method first will allow child timelines
	//  to become visible before we try to refresh them.
	WebInspector.View.prototype.wasShown.call(this);

	document.body.addEventListener("mousemove", this._presentationModel.startHidePopoverTimer.bind(this._presentationModel), false);

	this.refresh();
    },

    /* Extends View.onResize */
    onResize: function()
    {
	this.updateDividers(false);
	WebInspector.View.prototype.onResize.call(this);
    },

    get calculator()
    {
	return this._presentationModel.calculator;
    },

    _scheduleRefresh: function()
    {
	if (this._needsRefresh)
	    return;

	if (!this.isShowing())
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

    refresh: function()
    {
	console.assert(this.isShowing(), "refreshing overview which is not visible.");

	/* timer management */
	this._needsRefresh = false;
	if (this._refreshTimeout) {
	    clearTimeout(this._refreshTimeout);
	    delete this._refreshTimeout;
	}

    	/* fix the cursor */
	if (!this._lastPanPosition) {
	    if (this.calculator.zoomInterval == 1.0)
		this._timelineContainer.style.cursor = "default";
	    else
		this._timelineContainer.style.cursor = "-webkit-grab";
	}

	this._updateSliderPositions();
	this.updateDividers(false);
    },

    _updateSliderPositions: function()
    {
	/* reposition the sliders within the overview. */
	var allRecords = this._model.allRecords;

	/* playback cursor */
	var markIdx = this._model.currentMarkIndex;
	var recordIdx = this._model.recordIndexFromMarkIndex(markIdx);
	var percent = (recordIdx != -1) ? this.calculator.computeOverviewPercentage(allRecords[recordIdx].mark.timestamp) : 0.0;

	this.sliders.playback.setPosition(percent, true);

	/* anchor slider */
	var anchorManager = this._presentationModel.anchorManager;
	var anchors = anchorManager.anchors;
	for (var i = 0; i < anchors.length; i++) {
	    var anchor = anchorManager.anchors[i];
	    markIdx = anchor.markIndex;
	    recordIdx = this._model.recordIndexFromMarkIndex(markIdx);
	    percent = (recordIdx != -1) ? this.calculator.computeOverviewPercentage(allRecords[recordIdx].mark.timestamp) : 0.0;
	    this.sliders.anchor[i].setPosition(percent, true);
	    this.sliders.anchor[i].show();
	}

	/* always update the position, but don't necessarily make them visible. */

	/* previous/replay start slider */
	markIdx = this._model.replayStartMarkIndex;
	recordIdx = this._model.recordIndexFromMarkIndex(markIdx);
	percent = (recordIdx != -1) ? this.calculator.computeOverviewPercentage(allRecords[recordIdx].mark.timestamp) : 0.0;
	this.sliders.previous.setPosition(percent, true);

	/* tentative/replay finish slider */
	markIdx = this._model.replayFinishMarkIndex;
	recordIdx = this._model.recordIndexFromMarkIndex(markIdx);
	percent = (recordIdx != -1) ? this.calculator.computeOverviewPercentage(allRecords[recordIdx].mark.timestamp) : 0.0;
	this.sliders.tentative.setPosition(percent, true);
    },

    _removeHighlight: function(circleDesc)
    {
	if (!circleDesc)
	    return;

	circleDesc.timeline.clearCursor();
	circleDesc.timeline.removeHighlight(circleDesc.circleIndex);
	circleDesc.timeline.refresh();
    },

    _canUseProvider: function(provider)
    {
	var types = WebInspector.DataProvider.Types;
	return provider.type == types.TimelapseInput ||
               provider.type == types.BreakpointHits;
    },

    _onProviderAdded: function(event)
    {
	var provider = event.data;

	if (!this._canUseProvider(provider)) {
	    console.warn("Overview ignoring unusable data provider:");
	    console.warn(provider);
	    return;
	}

	// TODO: allow multiple providers/timelines per category
	var existingTimeline = this._timelineForCategory(provider.category);
	// if already a timeline for this category, reset it and set provider
	if (existingTimeline) {
	    console.log("Setting different provider on existing timeline.");
	    existingTimeline.setProvider(provider);
	    return;
	}

	// else, add new timeline to the overview.
	var timeline = new WebInspector.TimelapseCircleTimeline(provider);
	var ordinal = this._timelines.length;
	var height = this._presentationModel.timelineHeight;

	timeline.element.style.setProperty("top", ordinal*height + "px");
	this._timelines.push(timeline);
	timeline.show(this._timelineContainer);
    },

    _onProviderRemoved: function(event)
    {
	var provider = event.data;

	if (!this._canUseProvider(provider))
	    return;

	var existingTimeline = this._timelineForCategory(provider.category);
	if (!existingTimeline)
	    return;

        var i = this._timelines.lastIndexOf[existingTimeline];
	console.assert(i != -1, "Didn't find timeline for some reason.");
	this._timelines.splice(i, 1);

	// detach from DOM
	existingTimeline.detach();
    },

    _onTimelineMousemove: function(event)
    {
	var node = event.target;

	if (node.tagName == "CANVAS")
	    node = node.parentElement;
	else
	    return;

	var timeline = node.timeline;
	console.assert(timeline, "timeline node didn't have attached timeline object.");
	var category = timeline.category;
	var data = this._timelineForCategory(category).data;
	if (data.records.length == 0)
	    return;

	var hoveredCircleIdx = timeline.hitTest(event);

	if (this._hoveredCircle && hoveredCircleIdx != this._hoveredCircle.circleIndex)
	    this._presentationModel.circleMouseOut(category, this._hoveredCircle.circleIndex, data.records[this._hoveredCircle.circleIndex]);

	if (hoveredCircleIdx != -1 && (!this._hoveredCircle || this._hoveredCircle.circleIndex != hoveredCircleIdx))
	    this._presentationModel.circleMouseOver(category, hoveredCircleIdx, data.records[hoveredCircleIdx]);

	if (hoveredCircleIdx != -1)
	    event.stopPropagation();
    },

    _onTimelineMouseout: function(event)
    {
	if (!this._hoveredCircle)
	    return;

	var node = event.target;

	if (node.tagName == "CANVAS")
	    node = node.parentElement;
	else
	    return;

	var timeline = node.timeline;
	// TODO: this seems redundant?
	var category = timeline.category;
	var data = this._timelineForCategory(category).data;
	if (data.records.length == 0)
	    return;

	this._presentationModel.circleMouseOut(category, this._hoveredCircle.circleIndex, data.records[this._hoveredCircle.circleIndex]);
    },

    _onTimelineClicked: function(event)
    {
	var node = event.target;

	if (node.tagName == "CANVAS")
	    node = node.parentElement;
	else
	    return;

	var timeline = node.timeline;
	var category = timeline.category;
	var data = this._timelineForCategory(category).data;
	if (data.records.length == 0)
	    return;

	var clickedCircleIdx = timeline.hitTest(event);
	if (clickedCircleIdx != -1)
	    this._presentationModel.selectCircle(category, clickedCircleIdx, data.records[clickedCircleIdx]);
    },

    _onTimelineDoubleClicked: function(event)
    {
	var node = event.target;

	if (node.tagName == "CANVAS")
	    node = node.parentElement;
	else
	    return;

	var timeline = node.timeline;
	var category = timeline.category;
	var data = this._timelineForCategory(category).data;
	if (data.records.length == 0)
	    return;

	var clickedCircleIdx = timeline.hitTest(event);
	if (clickedCircleIdx != -1)
	    this._model.replayUpToMarkIndex(data.records[clickedCircleIdx][0].mark.index);
    },

    _onCircleSelected: function(event)
    {
	if (this._selectedCircle) {
	    this._removeHighlight(this._selectedCircle);
	    delete this._selectedCircle;
	}

	var category = event.data.category;
	var circleIndex = event.data.index;
	var records = event.data.records;
	var timeline = this._timelineForCategory(category);
	
	this._selectedCircle = {
	    "timeline": timeline,
	    "circleIndex": circleIndex
	};
	
	timeline.addHighlight(circleIndex);
	timeline.refresh();
    },

    _onCircleMouseOut: function(event)
    {
	if (this._hoveredCircle) {
	    this._removeHighlight(this._hoveredCircle);
	    delete this._hoveredCircle;
	}    
    },

    _onCircleMouseOver: function(event)
    {
	var category = event.data.category;
	var circleIndex = event.data.index;
	var records = event.data.records;
	var timeline = this._timelineForCategory(category);
	
	this._hoveredCircle = {
	    "timeline": timeline,
	    "circleIndex": circleIndex
	};
	
	timeline.setCursor("pointer");
	timeline.addHighlight(circleIndex);
	timeline.refresh();

	var highlightCoords = timeline.getCircleGeometry(circleIndex);

	var position = {
	    x: timeline.element.boxInWindow().x + highlightCoords.left,
	    y: timeline.element.boxInWindow().y + highlightCoords.top + highlightCoords.radius + 1
	};

	// TODO: update the size-position when panning
	this._presentationModel.overviewPopover.show(records, position);
    },

    _onTimelineMousedown: function(event)
    {
	if (event.button != 0)
	    return;

	var node = event.target;

        while (node) {
	    if (node === this.sliders.playback.element)
		break;
            else if (node === this.element) {
		if (this.calculator.zoomInterval == 1.0)
		    break;

		this._lastPanPosition = (event.pageX - this.element.offsetLeft) / this.element.clientWidth;
                WebInspector.installDragHandle(this.element, null, this._overviewPanning.bind(this), this._overviewPanningEnd.bind(this), "-webkit-grabbing");
                break;
	    }
            node = node.parentNode;
	}
    },

    _overviewPanning: function(event)
    {
	var position = (event.pageX - this.element.offsetLeft) / this.element.clientWidth;
	var zoomLeft = this.calculator.zoomLeft;
	var zoomRight = this.calculator.zoomRight;
	var zoomInterval = this.calculator.zoomInterval;
	var globalDelta = (position - this._lastPanPosition) * zoomInterval;
	this._lastPanPosition = position;
	this.calculator.setZoomInterval(Number.constrain(zoomLeft - globalDelta, 0, 1.0 - zoomInterval),
					Number.constrain(zoomRight - globalDelta, zoomInterval, 1.0));

	if (this._hoveredCircle) {
	    var timeline = this._hoveredCircle.timeline;
	    var records = timeline.data.records[this._hoveredCircle.circleIndex];
	    var highlightCoords = timeline.getCircleGeometry(this._hoveredCircle.circleIndex);
	    var popupPosition = {
		x: timeline.element.boxInWindow().x + highlightCoords.left,
		y: timeline.element.boxInWindow().y + highlightCoords.top + highlightCoords.radius + 1
	    };
	    this._presentationModel.overviewPopover.show(records, popupPosition);
	}
	else {
	    this._presentationModel.overviewPopover.hide();
	}
    },

    _overviewPanningEnd: function(event)
    {
	delete this._lastPanPosition;
    },

    _onTimelineMousewheel: function(event)
    {
	var zoomLeft = this.calculator.zoomLeft;
	var zoomRight = this.calculator.zoomRight;
	var zoomInterval = this.calculator.zoomInterval;

	/* case: scrolling horizontally = panning */
        if (event.wheelDeltaX && zoomInterval != 1.0) {
	    var delta = event.wheelDeltaX * WebInspector.TimelapseOverview.WindowScrollSpeedFactor;
	    zoomLeft = Number.constrain(zoomLeft - delta, 0.0, 1.0 - zoomInterval);
	    zoomRight = Number.constrain(zoomRight - delta, zoomInterval, 1.0);
        }

	/* case: scrolling vertically = panning */
	else if (event.wheelDeltaY) {
	    var delta = event.wheelDeltaY * WebInspector.TimelapseOverview.WindowScrollSpeedFactor;
	    zoomLeft = Number.constrain(zoomLeft - delta, 0.0, 1.0 - zoomInterval);
	    zoomRight = Number.constrain(zoomRight - delta, zoomInterval, 1.0);
        }

	this.calculator.setZoomInterval(zoomLeft, zoomRight);

	this._presentationModel.overviewPopover.hide();
    },

    _onPlaybackSliderDragStart: function(event)
    {
	this.sliders.playback.addEventListener(WebInspector.TimelapseOverviewSlider.EventTypes.Moved,
					      this._onPlaybackSliderDragged,
					      this);

	this._presentationModel.startPreviewing();
	this._presentationModel.overviewPopover.hide();
    },

    _onPlaybackSliderDragged: function(event)
    {
	function timestampAndRecordComparator(ts, record) {
	    var record_ts = record.mark.timestamp;
	    if (record_ts > ts) return -1;
	    if (record_ts < ts) return 1;
	    return 0;
	}

	function timeDistanceFunction(ts, record) {
	    if (!record)
		return Number.POSITIVE_INFINITY;

	    return Math.abs(ts - record.mark.timestamp);
	}

	var position = this.sliders.playback.position;
    	var timestamp = this.calculator.computeOverviewTimestamp(position);
	var records = this._presentationModel.matchedRecords;
	var idx = records.nearestBinaryIndexOf(timestamp, timestampAndRecordComparator, timeDistanceFunction);

	this._presentationModel.previewRecord(records[idx]);
    },

    _onPlaybackSliderDragEnd: function(event)
    {
	this.sliders.playback.removeEventListener(WebInspector.TimelapseOverviewSlider.EventTypes.Moved,
						 this._onPlaybackSliderDragged,
						 this);

	var targetRecord = this._presentationModel.previewedRecord;
	this._presentationModel.stopPreviewing();
	this._model.replayUpToMarkIndex(targetRecord.mark.index);
    },

    _onPlaybackSliderContextMenu: function(event)
    {
	if (WebInspector.timelapseModel.breakpointPaused)
	    WebInspector.timelapseBreakpointTracker.currentBreakpoint.contextMenu(event);	
    },
    
    _onZoomChanged: function()
    {
	if (!this._currentZoomInterval || this.calculator.zoomInterval != this._currentZoomInterval)
	    this._currentZoomInterval = this.calculator.zoomInterval;

	this._scheduleRefresh();
    },

    _onFilterChanged: function()
    {
	this._scheduleRefresh();
    },

    _onPreviewStarted: function()
    {
	this.sliders.previous.setPosition(this.sliders.playback.position);
	this.sliders.previous.show();
	this.sliders.tentative.setPosition(this.sliders.playback.position);
	this.sliders.tentative.show();
    },

    _onPreviewStopped: function()
    {
	this.sliders.previous.hide();
	this.sliders.tentative.hide();
    },

    _onPreviewChanged: function(event)
    {
	var record = event.data;
	var percent = this.calculator.computeOverviewPercentage(record.mark.timestamp);
	this.sliders.tentative.setPosition(percent, true);
    },

    _onRecordingDidStart: function()
    {
        this.reset();
	this.sliders.playback.disable();
	this.sliders.playback.hide();
    },

    _onRecordingDidStop: function()
    {
	if (this._model.allRecords.length == 0)
	    return;

	this.sliders.playback.setPosition(1.0, true);
	this.sliders.playback.enable();
	this.sliders.playback.show();
    },

    _onPlaybackWillStart: function()
    {
	this._messagePanel.classList.remove("hidden");

	if (this._model.scanningBreakpoints)
	    this._messagePanel.textContent = "Scanning breakpoints...";
	else if (this._model.fastReplaying)
	    this._messagePanel.textContent = "Seeking...";
	else
	    this._messagePanel.textContent = "Replaying... click to cancel.";
    },

    _onPlaybackDidStart: function()
    {
	if (!this._model.scanningBreakpoints)
	    this._messagePanel.classList.remove("hidden");

	var allRecords = this._model.allRecords;
	var startRecord = allRecords[this._model.recordIndexFromMarkIndex(this._model.replayStartMarkIndex)];
	var finishRecord = allRecords[this._model.recordIndexFromMarkIndex(this._model.replayFinishMarkIndex)];
	var currentRecord = allRecords[this._model.recordIndexFromMarkIndex(this._model.currentMarkIndex)];

	this.sliders.playback.element.addStyleClass("playback-slider");
	this.sliders.playback.element.removeStyleClass("breakpoint-slider");

	this.sliders.previous.setPosition(this.calculator.computeOverviewPercentage(startRecord.mark.timestamp), true);
	this.sliders.previous.show();
	this.sliders.tentative.setPosition(this.calculator.computeOverviewPercentage(finishRecord.mark.timestamp), true);
	this.sliders.tentative.show();

	this.sliders.playback.disable();
	this.sliders.playback.setPosition(this.calculator.computeOverviewPercentage(currentRecord.mark.timestamp), true);	
	this.sliders.playback.element.addStyleClass("playback-pulse");
	this.sliders.playback.minimumResolution = (this._model.fastReplaying) ? 10.0 : 1.0;
    },

    _onPlaybackStopped: function()
    {
	this.sliders.previous.hide();
	this.sliders.tentative.hide();

	this.sliders.playback.resetResolution();
	this.sliders.playback.element.removeStyleClass("playback-pulse");
	this.sliders.playback.enable();

	this._messagePanel.classList.add("hidden");

	this._scheduleRefresh();
    },

    _onInputPaused: function()
    {
	var allRecords = this._model.allRecords;
	var recordIndex = this._model.recordIndexFromMarkIndex(this._model.currentMarkIndex);
	
	if (recordIndex != -1) {
	    var percent = this.calculator.computeOverviewPercentage(allRecords[recordIndex].mark.timestamp);
	    this.sliders.playback.setPosition(percent, true);
	}

	// required because setPosition implicitly calls show()
	if (WebInspector.debuggerModel.isPaused())
	    this.sliders.playback.hide(); 

	this.sliders.previous.hide();
	this.sliders.tentative.hide();

	this.sliders.playback.resetResolution();
	this.sliders.playback.element.removeStyleClass("playback-pulse");
	this.sliders.playback.enable();

	if (!this._model.scanningBreakpoints)
	    this._messagePanel.classList.add("hidden");

	this._scheduleRefresh();
    },

    _onInputHit: function(eventData)
    {
	var markIndex = eventData.data;
	var recordIndex = this._model.recordIndexFromMarkIndex(markIndex);

	// don't animate if this mark has no corresponding record (aka, not a user-visible mark)
	if (recordIndex == -1)
	    return;

	var allRecords = this._model.allRecords;
	var percent = 0.0;
	if (markIndex > 0)
	    percent = this.calculator.computeOverviewPercentage(allRecords[recordIndex].mark.timestamp);

	this.sliders.playback.setPosition(percent, true);

	// don't animate if this is close to the beginning/end, or out of view.
	if (percent < 0.0 || percent > 0.99)
	    return;

	var nextRecord = allRecords[recordIndex+1];
	var curRecordTime = (recordIndex > 0) ? allRecords[recordIndex].mark.timestamp 
                                              : this.calculator.minimumBoundary;

	var timeDelta = nextRecord.mark.timestamp - curRecordTime;
	if (timeDelta > WebInspector.TimelapseOverview.MinAnimationDelta) {
	    var nextRecordPosition = this.calculator.computeOverviewPercentage(nextRecord.mark.timestamp);
	    this.sliders.playback.animateTo(nextRecordPosition, timeDelta);
	}

	this._presentationModel.overviewPopover.hide();
    },

    _onBreakpointPaused: function()
    {
	this.sliders.playback.element.addStyleClass("breakpoint-slider");
	this.sliders.playback.element.removeStyleClass("playback-pulse");
	this.sliders.playback.resetPosition();
	this.sliders.playback.enable();

	this._messagePanel.classList.add("hidden");

	var currentMarkIndex = WebInspector.timelapseModel.currentMarkIndex;
	var category = this._presentationModel.categories["breakpoint"];
	this._timelineForCategory(category).showPopoverForMarkIndex(currentMarkIndex);
    },

    _onBreakpointRecordsChanged: function()
    {
	this._scheduleRefresh();
	this._presentationModel.overviewPopover.hide();
    },

    // TODO: message panel (used for "scanning..." etc) should
    // probably belong on TimelapseReplayingView."
    _onMessagePanelClicked: function()
    {
	if (!this._model.replaying)
	    return;

	this._model.pausePlayback();
    },

    _onAnchorSet: function(event)
    {
	var anchorSlider = new WebInspector.TimelapseOverviewSlider(this, "anchor", false);
	this._timelineContainer.appendChild(anchorSlider.element);
	this.sliders.anchor.push(anchorSlider);
	this._updateSliderPositions();

	this._presentationModel.overviewPopover.refresh();
    },

    _onAnchorRemoved: function()
    {
	var anchorSlider = this.sliders.anchor.pop();
	anchorSlider.dispose();
	this._updateSliderPositions();

	this._presentationModel.overviewPopover.refresh();
    }
};

WebInspector.TimelapseOverview.prototype.__proto__ = WebInspector.View.prototype;

/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseCircleTimeline = function(provider)
{
    WebInspector.View.call(this);
    this._presentationModel = WebInspector.timelapsePresentationModel;
    this.calculator = this._presentationModel.calculator;
    this._category = provider.category;

    if (!provider)
	console.assert("Tried to instantiate circle timeline without provider :-(");
	
    this.setProvider(provider);

    var events = WebInspector.TimelapsePresentationModel.EventTypes;
    this._presentationModel.addEventListener(events.FilterChanged, this._onFilterChanged, this);
    this.calculator.addEventListener(WebInspector.TimelapseCalculator.EventTypes.ZoomChanged,
				     this._onZoomChanged, this);

    this.element = document.createElement("div");
    this.element.className = "timelapse-overview-timeline timelapse-category-" + this._category.name;
    this.element.timeline = this;
    this._canvas = document.createElement("canvas");
    this.element.appendChild(this._canvas);

    this.reset();
};

WebInspector.TimelapseCircleTimeline.prototype = {
    get category()
    {
	return this._category;
    },

    get data()
    {
	return this._data;
    },

    get provider()
    {
	return this._provider;
    },

    wasShown: function()
    {
	WebInspector.View.prototype.wasShown.call(this);
	this.refresh();
    },

    onResize: function()
    {
	WebInspector.View.prototype.onResize.call(this);

        /* resize timeline */
	this.resize();
	this.refresh();
    },

    reset: function()
    {
	this.resize();
	this._clearTimeline();
	this._dirty = false;
	this._highlights = [];
    },

    resize: function()
    {
	this._canvas.width = this.element.clientWidth;
    	this._canvas.style.width = this.element.clientWidth + 'px';
	this._canvas.height = this.element.clientHeight;
	this._canvas.style.height = this.element.clientHeight + 'px';

	this._dirty = true;
	var fillAlpha = 0.3;
	var fillColor = WebInspector.Color.fromRGBA(this._category.color.rgb[0],
						    this._category.color.rgb[1],
						    this._category.color.rgb[2],
						    fillAlpha).toString();

	this._ctx = this._canvas.getContext("2d");
	this._ctx.fillStyle = fillColor;
    },

    refresh: function()
    {
	this._recomputeTimeline();
	this._drawTimeline();
    },

    // this is called when instantiating a timeline, or changing provider.
    setProvider: function(provider)
    {
	// we are changing provider. detach from old one first.
	if (this._provider)
	    this._onProviderRemoved();

	this._provider = provider;
	var events = WebInspector.DataProvider.Events;
	this._provider.addEventListener(events.DataChanged, this._onDataChanged, this);
	this._provider.addEventListener(events.Enabled, this._onProviderEnabled, this);
	this._provider.addEventListener(events.Disabled, this._onProviderDisabled, this);
	this._provider.addEventListener(events.WillRemove, this._onProviderRemoved, this);

	this._onDataChanged();

	if (this._provider.isEnabled())
	    this._onProviderEnabled();
	else
	    this._onProviderDisabled();
    },

    // this is called before installing a new provider, or when destroying the timeline.
    _onProviderRemoved: function()
    {
	var events = WebInspector.DataProvider.Events;
	this._provider.removeEventListener(events.DataChanged, this._onDataChanged, this);
	this._provider.removeEventListener(events.Enabled, this._onProviderEnabled, this);
	this._provider.removeEventListener(events.Disabled, this._onProviderDisabled, this);
	this._provider.removeEventListener(events.WillRemove, this._onProviderRemoved, this);
	delete this._provider;
    },

    _onDataChanged: function()
    {
	if (this.isShowing())
	    this._recomputeTimeline();

	this.clearHighlights();
	this._dirty = true;
    },

    _onProviderEnabled: function()
    {
	this.element.classList.remove("disabled");
    },

    _onProviderDisabled: function()
    {
	this.element.classList.add("disabled");
    },

    _circleIndexFromMarkIndex: function(markIndex)
    {
	var recordGroups = this._data.records;

	for (var i = 0; i < recordGroups.length; i++) {
	    var records = recordGroups[i];
	    for (var j = 0; j < records.length; j++) {
		if (records[j].mark.index != markIndex)
		    continue;
		else
		    return i;
	    }
	}
	return -1;
    },

    showPopoverForMarkIndex: function(markIndex)
    {
	var circleIndex = this._circleIndexFromMarkIndex(markIndex);

	if (circleIndex == -1)
	    return;

	var records = this._data.records[circleIndex];
	var circleCoords = this.getCircleGeometry(circleIndex);
	var popupPosition = {
	    x: this.element.boxInWindow().x + circleCoords.left,
	    y: this.element.boxInWindow().y + circleCoords.top + circleCoords.radius + 1
	};
	this._presentationModel.overviewPopover.show(records, popupPosition);
    },

    hitTest: function(event)
    {
	function timestampComparator(a, b) {
	    return a - b;
	}
	
	function timeDistanceFunction(a, b) {
	    return Math.abs(a - b);
	}

	if (this._data.centers.length == 0)
	    return -1;

	var x = event.pageX - event.target.totalOffsetLeft();
	var y = event.pageY - event.target.totalOffsetTop();

	var timestamp = this.calculator.computeOverviewTimestamp(x / event.target.offsetWidth);
	var idx = this._data.centers.nearestBinaryIndexOf(timestamp, timestampComparator, timeDistanceFunction);
	if (idx < 0 || idx >= this._data.centers.length)
	    return -1;

	var nearestCenter = this.calculator.computeOverviewPercentage(this._data.centers[idx]) * this.element.clientWidth;
	var midHeight = this.element.clientHeight / 2;
	var radius = this._data.radii[idx];

	if (x < nearestCenter - radius || x > nearestCenter + radius ||
	    y < midHeight - radius || y > midHeight + radius)
	    return -1;

	return idx;
    },

    getCircleGeometry: function(idx)
    {
	var centers = this._data.centers;
	var radii = this._data.radii;
	var percent = this.calculator.computeOverviewPercentage(centers[idx]);
	var availWidth = this.element.clientWidth;
	var availHeight = this.element.clientHeight;

	return { top: availHeight/2,
		 left: percent * availWidth,
		 radius: radii[idx]
	       };
    },

    setCursor: function(shape)
    {
	this.element.style.setProperty("cursor", shape);
    },

    clearCursor: function()
    {
	this.element.style.removeProperty("cursor");
    },

    addHighlight: function(idx)
    {
	/* Note: it's possible to have several highlights per circle. This is how clicking a hovered circle is possible. */
	this._highlights.push(idx);
	this._dirty = true;
    },

    removeHighlight: function(circleIdx)
    {
	var i = this._highlights.indexOf(circleIdx);
	if (i == -1)
	    return;

	this._highlights.splice(i, 1);
	this._dirty = true;
    },

    clearHighlights: function()
    {
	this._highlights = [];
	this._dirty = true;
    },

    _drawHighlights: function()
    {
	var strokeAlpha = 0.7;
	var singleInputStrokeColor = WebInspector.Color.fromRGBA(0, 0, 0, strokeAlpha).toString();
	var defaultStrokeColor = WebInspector.Color.fromRGBA(Math.max(0, this._category.color.rgb[0] - 50),
							     Math.max(0, this._category.color.rgb[1] - 50),
							     Math.max(0, this._category.color.rgb[2] - 50),
							     strokeAlpha).toString();

	for (var i = 0; i < this._highlights.length; i++) {
	    var circleIdx = this._highlights[i];
	    var selectedSingleInput = (this._data.records[circleIdx].length == 1);
	    var newStroke = (selectedSingleInput) ? singleInputStrokeColor : defaultStrokeColor;
	    if (this._ctx.strokeStyle != newStroke)
		this._ctx.strokeStyle = newStroke;

	    var geometry = this.getCircleGeometry(circleIdx);
	    this._ctx.beginPath();
	    this._ctx.arc(geometry.left, geometry.top, geometry.radius, 0, 2*Math.PI, true);
	    this._ctx.closePath();
	    this._ctx.stroke();
	}
    },

    _drawTimeline: function()
    {
	if (this._canvas.width <= 0 || this._canvas.height <= 0)
	    return;

	this._clearTimeline();

	if (this.calculator.zoomInterval == 0)
	    return;

	/* timestamp representing the center of this dot */
	var centers = this._data.centers;
	var radii = this._data.radii;
	var availWidth = this.element.clientWidth;
	var availHeight = this.element.clientHeight;

	/* this is the same computation as getCircleGeometry, but doesn't allocate objects */
	for (var i = 0; i < centers.length; i++) {
	    this._ctx.beginPath();
	    var percent = this.calculator.computeOverviewPercentage(centers[i]);
	    this._ctx.arc(percent * availWidth, availHeight/2, radii[i], 0, 2*Math.PI, true);
	    this._ctx.closePath();
	    this._ctx.fill();
	}

	this._drawHighlights();
	this._dirty = false;

	// Shade unexplored intervals
	if (this._category.name == "breakpoint") {
	    var model = WebInspector.timelapseModel;
	    var intervals = this._provider.exploredIntervals;
	    var ctx = this._ctx;
	    var startPercent = 0, endPercent, widthPercent;

	    var fillColor = ctx.fillStyle;
	    var fogColor = "rgba(0, 0, 0, 0.1)";
	    var transparent = "rgba(0, 0, 0, 0)";

	    function fade(x, width, fadeIn) {
		var gradient = ctx.createLinearGradient(x + width, 0, x, 0);
		var startColor = fadeIn ? fogColor : transparent;
		var endColor = fadeIn ? transparent : fogColor;

		gradient.addColorStop(0.0, startColor);
		gradient.addColorStop(1.0, endColor);
		ctx.fillStyle = gradient;
		ctx.fillRect(x, 0, width, availHeight);
		ctx.fillStyle = fogColor;
	    }

	    ctx.fillStyle = fogColor;

	    for (var i = 0; i < intervals.length; i++) {
		var timestamp = model.timestampFromMarkIndex(intervals[i].start);
		endPercent = this.calculator.computeOverviewPercentage(timestamp);
		widthPercent = endPercent - startPercent;

		var x = Math.round(startPercent * availWidth);
		var width = Math.round(widthPercent * availWidth);

		if (i == 0) {
		    // Paint first unexplored interval (no fade in)
		    var fadeWidth = Math.min(width, 10);
		    if (width - fadeWidth > 0)
			ctx.fillRect(x, 0, width - fadeWidth, availHeight);
		    fade(x + Math.max(width - fadeWidth, 0), fadeWidth);
		}
		else {
		    var fadeWidth = Math.floor(Math.min(width, 20) / 2);
		    fade(x, fadeWidth, true);
		    if (width - fadeWidth * 2 > 0)
			ctx.fillRect(x + fadeWidth, 0, width - fadeWidth * 2, availHeight);
		    fade(x + width - fadeWidth, fadeWidth);
		}

		timestamp = model.timestampFromMarkIndex(intervals[i].end);
		startPercent = this.calculator.computeOverviewPercentage(timestamp);
	    }

	    // Paint last unexplored interval (no fade out)
	    endPercent = 1.0;
	    widthPercent = endPercent - startPercent;

	    var x = Math.round(startPercent * availWidth);
	    var width = Math.round(widthPercent * availWidth);
	    var fadeWidth = Math.min(width, 10);

	    if (x > 0) {
		fade(x, fadeWidth, true);
		if (width - fadeWidth > 0)
		    ctx.fillRect(x + fadeWidth, 0, width - fadeWidth, availHeight);
	    }
	    // Otherwise, there are no explored intervals, so don't fade in either.
	    else
		ctx.fillRect(0, 0, width, availHeight);

	    ctx.fillStyle = fillColor;
	}
    },

    _recomputeTimeline: function()
    {
	// This method assumes this.isShowing(). If it's not, then it can't
	// access clientWidth and do auto-scaling based on available width.
	console.assert(this.isShowing(), "Timeline must be visible before it is recomputed.");

	this._data = { centers: [], radii: [], indexExtents: [], records: [] };

	var category = this._category;
	var data = this._data;
	var records = this._provider.records;
	var minIntervalPx = 4.0; /* distance between adjacent record centers */
	var baseRadius = 3;
	var maxRecordsPerDot = 10;

	var availWidth = this.element.clientWidth;
	var minInterval = minIntervalPx / availWidth * this.calculator.zoomInterval * this.calculator.boundarySpan;

	var pendingRecords = [];

	function flushDot() {
	    if (pendingRecords.length == 0)
		return;

	    var totalTs = 0.0;
	    for (var i = 0; i < pendingRecords.length; i++)
		totalTs += pendingRecords[i].mark.timestamp;

	    var averageTimestamp = totalTs/pendingRecords.length;
	    var radius = baseRadius + pendingRecords.length;

	    data.centers.push(averageTimestamp);
	    data.radii.push(radius);
	    data.records.push(pendingRecords);

	    pendingRecords = [];
	}

	for (i = 0; i < records.length; i++) {
	    var record = records[i];
	    if (pendingRecords.length == maxRecordsPerDot
		|| (i > 0 && record.mark.timestamp - records[i-1].mark.timestamp > minInterval))
		flushDot();

	    pendingRecords.push(record);
	}
	flushDot();
    },

    _clearTimeline: function()
    {
	this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    },

    // TODO: change over to using data provider enabled/disabled
    _onFilterChanged: function()
    {
	if (this._category.disabled)
	    this.element.classList.add("disabled");
	else
	    this.element.classList.remove("disabled");
    },

    _onZoomChanged: function()
    {
	if (this.isShowing())
	    this.refresh();
    }
};

WebInspector.TimelapseCircleTimeline.prototype.__proto__ = WebInspector.View.prototype;

/**
 * @constructor
 * @extends {WebInspector.Object}
 */
WebInspector.TimelapseOverviewSlider = function(overview, name, adjustable)
{
    WebInspector.Object.call(this);
    this._adjustable = adjustable;

    this.element = document.createElement("div");
    this.element.className = "timelapse-overview-slider " + name + "-slider";

    if (this._adjustable) {
	this.element.classList.add("adjustable");
	WebInspector.installDragHandle(this.element, this._startSliderDragging.bind(this), this._sliderDragging.bind(this), this._endSliderDragging.bind(this), "col-resize");
    }

    this._verticalBarElement = document.createElement("div");
    this._verticalBarElement.className = "timelapse-slider-band";
    this.element.appendChild(this._verticalBarElement);

    var wrapper = document.createElement("div");
    wrapper.className = "timelapse-slider-wedge-wrapper";
    var wedgeBorder = document.createElement("div");
    wedgeBorder.className = "timelapse-slider-wedge-border";
    wrapper.appendChild(wedgeBorder);
    var wedge = document.createElement("div");
    wedge.className = "timelapse-slider-wedge";
    wrapper.appendChild(wedge);
    this.element.appendChild(wrapper);

    if (name == "anchor") {
	var icon = document.createElement("div");
	icon.className = "timelapse-slider-icon";
	this.element.appendChild(icon);
    }

    this._overview = overview;
    this.clear();
    this.enable();
};

WebInspector.TimelapseOverviewSlider.EventTypes = {
    Moved: "TimelapseSliderMoved",
    DragStart: "TimelapseSliderDragStart",
    DragEnd: "TimelapseSliderDragEnd"
};

WebInspector.TimelapseOverviewSlider.prototype = {
    clear: function()
    {
	this._lastRefreshedPosition = 0.0;
	this.element.classList.add("hidden");
	this.disable();
    },

    minimumResolution: 1.0, /* in pixels */
    defaultMinimumResolution: 1.0,

    /* percent is a value between 0 and 1. */
    setPosition: function(percent, suppressEvents)
    {
	this._position = Number.constrain(percent, 0.0, 1.0);

	this.cancelAnimation();
	this.refresh();
	
	if (!suppressEvents) {
	    this.dispatchEventToListeners(WebInspector.TimelapseOverviewSlider.EventTypes.Moved);
	}
    },

    resetPosition: function()
    {
	this._lastRefreshedPosition = 0.0;
	this.setPosition(this._position, true);
    },

    resetResolution: function()
    {
	this.minimumResolution = this.defaultMinimumResolution;
    },

    animateTo: function(position, duration)
    {
	animations = [
	    {
		element: this.element, 
		start: {left: this.position * 100.0},
		end: {left: position * 100.0},
		timingFunction: WebInspector.TimingFunctions.Linear
	    }
	];

	this.cancelAnimation();
	this._currentAnimation = WebInspector.animateStyle(animations, duration * 1000.0,
							   this.cancelAnimation.bind(this));
    },

    cancelAnimation: function()
    {
	if (!this._currentAnimation)
	    return;

	this._currentAnimation.cancel();
	delete this._currentAnimation;
    },

    get position()
    {
	return this._position;
    },

    set position(pos)
    {
	this.setPosition(pos, false);
    },

    show: function()
    {
	this.element.classList.remove("hidden");
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

    dispose: function()
    {
	this.element.parentElement.removeChild(this.element);
    },

    refresh: function()
    {
	var parentWidth = this.element.parentElement.clientWidth;
	var rightMaximum = (parentWidth - this._verticalBarElement.offsetWidth) / parentWidth;

	/* if the difference between last painted position and new
	 position is less than the minimum resolution (in pixels),
	 then don't force a refresh. */
	var delta = Math.abs(parentWidth * (this._position - this._lastRefreshedPosition));
	if (delta < this.minimumResolution)
	    return;

	this._lastRefreshedPosition = Number.constrain(this.position, 0.0, rightMaximum);
	this.element.style.left = this._lastRefreshedPosition * 100.0 + "%";
    },

    _startSliderDragging: function(event)
    {
	if (!this._enabled)
	    return false;

	if (this.element.hasStyleClass("breakpoint-slider"))
	    this.element.removeStyleClass("breakpoint-slider");

	this.element.classList.add("slider-dragging");

	this.dispatchEventToListeners(WebInspector.TimelapseOverviewSlider.EventTypes.DragStart);
	return true;
    },

    _sliderDragging: function(event)
    {
	if (!this._enabled)
	    return;

	var parent = this.element.parentElement; // should be timeline container
	var dragPoint = event.clientX - parent.totalOffsetLeft() - (this.element.offsetWidth/2);
	var leftMinimum = parent.clientLeft;
	var rightMaximum = leftMinimum + parent.clientWidth - this.element.offsetWidth;
	dragPoint = Number.constrain(dragPoint, leftMinimum, rightMaximum - this._verticalBarElement.offsetWidth);
	this.setPosition(dragPoint / (rightMaximum - leftMinimum));
	event.preventDefault();
    },

    _endSliderDragging: function(event)
    {	
	if (!this._enabled)
	    return;

	this.element.classList.remove("slider-dragging");
	this.dispatchEventToListeners(WebInspector.TimelapseOverviewSlider.EventTypes.DragEnd);
    }
};

WebInspector.TimelapseOverviewSlider.prototype.__proto__ = WebInspector.Object.prototype;

WebInspector.TimelapsePopover = function(popoverHelper)
{
    WebInspector.Popover.call(this);

    this._popoverHelper = popoverHelper;

    var model = WebInspector.timelapseModel;
    var eventNames = WebInspector.TimelapseModel.EventTypes;

    model.addEventListener(eventNames.Enabled, this.hide, this);
    model.addEventListener(eventNames.Disabled, this.hide, this);
    model.addEventListener(eventNames.RecordingDidStart, this.hide, this);
    model.addEventListener(eventNames.PlaybackStopped, this.hide, this);
}

WebInspector.TimelapsePopover.prototype = {
    show: function(records, position)
    {
	if (this._disposed)
	    return;

	if (!records) {
	    this.hide();
	    return;
	}

	this._records = records;
	this._position = position;
	this.contentElement = WebInspector.timelapsePresentationModel.generatePopupContent(records);

        // This should not happen, but we hide previous popup to be on the safe side.
        if (WebInspector.Popover._popoverElement)
            document.body.removeChild(WebInspector.Popover._popoverElement);
        WebInspector.Popover._popoverElement = this.element;

        // Temporarily attach in order to measure preferred dimensions.
        this.contentElement.positionAt(0, 0);
        document.body.appendChild(this.contentElement);
        var preferredWidth = this.contentElement.offsetWidth;
        var preferredHeight = this.contentElement.offsetHeight;

	this._contentDiv.removeChildren();
	this._contentDiv.appendChild(this.contentElement);
        this.element.appendChild(this._contentDiv);
        document.body.appendChild(this.element);
        this._positionElement(position, preferredWidth, preferredHeight);
        this._visible = true;
	this._popoverHelper.killHidePopoverTimer();
        this.contentElement.addEventListener("mousemove", function(event) {
	    this._popoverHelper.killHidePopoverTimer();
	    event.stopPropagation();
	}.bind(this), true);
    },

    _positionElement: function(anchorPosition, preferredWidth, preferredHeight)
    {
	const borderWidth = 2;
        const scrollerWidth = 11;
        const arrowHeight = 6;
        const arrowOffset = 8;
	const arrowLeft = 12; // default arrow position
	const minArrowPosition = 7;
	const borderRadius = 12;

	var totalWidth = window.innerWidth;
	var totalHeight = window.innerHeight;

        var newElementPosition = {
	    x: 0,
	    y: anchorPosition.y + arrowHeight,
	    width: preferredWidth,
	    height: preferredHeight
	};

        // Positioning below the anchor.
        if (newElementPosition.y + newElementPosition.height + borderWidth * 2 >= totalHeight) {
            newElementPosition.height = totalHeight - anchorPosition.y - arrowHeight - borderWidth * 2;
	    newElementPosition.width += scrollerWidth;
        }

        if (anchorPosition.x + newElementPosition.width + borderWidth - arrowLeft - arrowOffset < totalWidth) {
	    // Touching left or no border.
            newElementPosition.x = Math.max(borderWidth, anchorPosition.x - borderWidth - arrowLeft - arrowOffset);
	    if (newElementPosition.x == borderWidth)
		this._popupArrowElement.style.left = Math.max(minArrowPosition, anchorPosition.x - arrowOffset) + "px";
	    else
		this._popupArrowElement.style.left = arrowLeft + "px";
        }
	else if (newElementPosition.width + borderWidth * 2 < totalWidth) {
	    // Touching right border.
            newElementPosition.x = totalWidth - newElementPosition.width - borderWidth * 2;
            this._popupArrowElement.style.right = Math.max(minArrowPosition, totalWidth - anchorPosition.x - borderWidth - arrowOffset - 1) + "px";
	    this._popupArrowElement.style.left = "auto";
        }
	else {
	    // Touching both borders.
            newElementPosition.x = borderWidth;
            newElementPosition.width = totalWidth - borderWidth * 2;
	    newElementPosition.height += scrollerWidth;
            this._popupArrowElement.style.left = Math.max(0, anchorPosition.x - arrowOffset) + "px";
        }

        this.element.className = "timelapse-popover custom-popup-vertical-scroll custom-popup-horizontal-scroll";
        this.element.positionAt(Math.round(newElementPosition.x), Math.round(newElementPosition.y));
        this.element.style.width = newElementPosition.width + borderWidth * 2 + "px";
        this.element.style.height = newElementPosition.height + borderWidth * 2 + "px";
    },

    refresh: function()
    {
	if (this._visible && this._records && this._position)
	    this.show(this._records, this._position);
    }
};

WebInspector.TimelapsePopover.prototype.__proto__ = WebInspector.Popover.prototype;
