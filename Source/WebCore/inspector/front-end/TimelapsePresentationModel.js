/*
 *  Copyright (C) 2011, Brian Burg.
 *  Copyright (C) 2011, University of Washington. All rights reserved.
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
 * @extends {WebInspector.Object}
 */
WebInspector.TimelapsePresentationModel = function()
{
    WebInspector.Object.call(this);
    this._model = WebInspector.timelapseModel;

    // TODO: we should create TimelapseAnchorDataProvider when recording is done.
    this.anchorManager = new WebInspector.TimelapseAnchorManager();
    this.breakpointLinkifier = new WebInspector.Linkifier();
    this.calculator = new WebInspector.TimelapseCalculator();
    // TODO: eventually this should move to TimelapseOverview or something.
    this.overviewPopover = new WebInspector.TimelapsePopover(this);

    this._providers = [];

    var eventNames = WebInspector.TimelapseModel.EventTypes;
    this._model.addEventListener(eventNames.RecordingDidStart, this._recordingDidStart, this);
    this._model.addEventListener(eventNames.RecordingDidStop, this._recordingDidStop, this);
    this._model.addEventListener(eventNames.RecordAdded, this._recordAdded, this);

    // TODO: move to TimelapseBreakpointDataProvider
    WebInspector.timelapseBreakpointTracker.addEventListener(WebInspector.TimelapseBreakpointTracker.Events.BreakpointAdded, this._replaceBreakpointProvider, this);
    WebInspector.timelapseBreakpointTracker.addEventListener(WebInspector.TimelapseBreakpointTracker.Events.BreakpointRemoved, this._replaceBreakpointProvider, this);

    this.reset();
};

WebInspector.TimelapsePresentationModel.EventTypes = {
    ProviderAdded: "TimelapseProviderAdded",
    // TODO: the following events are details of specific data providers.
    InputSelected: "TimelapseInputSelected",
    PreviewStarted: "TimelapsePreviewStarted",
    PreviewStopped: "TimelapsePreviewStopped",
    PreviewChanged: "TimelapsePreviewChanged",
};

WebInspector.TimelapsePresentationModel.prototype = {
    // TODO: most of this state will be moved to providers or timeline widgets
    reset: function() 
    {
	this.anchorManager.reset();
	this.calculator.reset();

	this._clearProviders();
    },

    // Private API (callbacks)
    _recordingDidStart: function()
    {
	this.reset();

	var providerTypes = WebInspector.DataProvider.Types;
	this.addProvider(new WebInspector.TimelapseInputDataProvider(
			     "userinput",
			     WebInspector.UIString("User"),
			     WebInspector.Color.fromRGB(20,170,70)
			));
	this.addProvider(new WebInspector.TimelapseInputDataProvider(
			     "network",
			     WebInspector.UIString("Network"),
			     WebInspector.Color.fromRGB(200,150,0)
			));
	this.addProvider(new WebInspector.TimelapseInputDataProvider(
			     "timer",
			     WebInspector.UIString("Timer"),
			     WebInspector.Color.fromRGB(200,30,30)
			));
    },

    _recordingDidStop: function()
    {
	// TODO: create TimelapseAnchorDataProvider.
	this.calculator.setZoomInterval(0.0, 1.0);
    },

    _recordAdded: function(event)
    {
	var record = event.data;
	this.calculator.updateBoundaries(record);
    },

    _replaceBreakpointProvider: function()
    {
	// TODO: keep old breakpoint providers
	var model = this;
	var breakpointProviders = this._providersWithType(WebInspector.DataProvider.Types.BreakpointHits);
	breakpointProviders.forEach(function(provider) { 
            model.removeProvider(provider);
        });

	this.addProvider(new WebInspector.TimelapseBreakpointDataProvider(
			     WebInspector.UIString("Breakpoint"),
			     WebInspector.Color.fromRGB(10,55,230)
			 ));
    },

    // Public API
    addProvider: function(provider) {
	if (this._providers.indexOf(provider) != -1)
	    return;

	this._providers.push(provider);
    	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.ProviderAdded, provider);
    },

    removeProvider: function(provider) {
	var idx = this._providers.indexOf(provider);
	if (idx == -1)
	    return;

	this._removeProviderAtIndex(idx);
    },

    _providersWithName: function(name)
    {
	var found = [];
	for (var i = 0; i < this._providers.length; i++) {
	    var provider = this._providers[i];
	    if (provider.name === name) {
		found.push(provider);
	    }
	}
	
	return found;
    },

    providersWithType: function(ty)
    {
	var found = [];
	for (var i = 0; i < this._providers.length; i++) {
	    var provider = this._providers[i];
	    if (provider.type === ty) {
		found.push(provider);
	    }
	}
	
	return found;
    },

    _removeProviderAtIndex: function(idx) {
	console.assert(idx >= 0 && idx < this._providers.length, "Tried to remove provider at invalid index.");
	this._providers[idx].willRemove();
	this._providers.splice(idx, 1);
    },

    _clearProviders: function() {
	while (this._providers.length > 0) {
	    this._removeProviderAtIndex(0);
	}
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    get previewModeActive()
    {
	return !!this._previewModeActive;
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    get previewedRecord()
    {
	return this._previewedRecord;
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    startPreviewing: function()
    {
	this._previewModeActive = true;
    	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.PreviewStarted);
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    stopPreviewing: function()
    {
	delete this._previewModeActive;
	delete this._previewedRecord;
    	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.PreviewStopped);
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    previewRecord: function(record)
    {
	console.assert(!!record, "Cannot preview undefined record");

	this._previewedRecord = record;
	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.PreviewChanged, record);
    },

    // TODO: Selection state should live on the specific DataProvider which is being selected.
    selectInput: function(markIndex)
    {
	this._selectedInputIndex = markIndex;
	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.InputSelected, markIndex);
    },

    scanBreakpointsInZoomRegion: function()
    {
    	WebInspector.debuggerModel.enableDebugger();

	var startIndex = this.calculator.computeMarkIndexFromPercentage(this.calculator.zoomLeft);
	var endIndex = this.calculator.computeMarkIndexFromPercentage(this.calculator.zoomRight);

	this._model.scanBreakpointsInRegion(startIndex, endIndex);
    },

    // TODO: Eventually this should live with the TimelapseOverview
    startHidePopoverTimer: function(event)
    {
	if (!WebInspector.Popover._popoverElement || this._hidePopoverTimer)
	    return;

	function doHide() {
	    this.overviewPopover.hide();
	    delete this._hidePopoverTimer;
	}
	this._hidePopoverTimer = setTimeout(doHide.bind(this), 1000);
    },

    // TODO: Eventually this should live with the TimelapseOverview
    killHidePopoverTimer: function(event)
    {
        if (this._hidePopoverTimer) {
            clearTimeout(this._hidePopoverTimer);
            delete this._hidePopoverTimer;
        }
    },

    // TODO: move to specific Timeline subclass (TimelapseInputTimeline, TimelapseBreakpointsTimeline,...)
    generatePopupContent: function(provider, recordIndices) {
	if (!provider || !recordIndices || recordIndices.length == 0)
	    return null;

	var firstRecordType = provider.records[recordIndices[0]].type;
	var group = WebInspector.TimelapseInputDataProvider.InputStyles[firstRecordType].group;
	var table = document.createElement("table");
	table.className = "timelapse-overview-popover-table timelapse-category-" + group;

	function createButtonInTD(styleClass, callback) {
	    var cell = document.createElement("td");
	    cell.setAttribute("width", "20px");
	    var button = document.createElement("div");
	    button.className = "timelapse-button-icon " + styleClass;
	    cell.appendChild(button);
	    button.addEventListener("click", callback);
	    return cell;
	}

	var isBreakpointPopup = (firstRecordType == WebInspector.TimelapseAgent.RecordType.BreakpointHit);

	var firstRow = document.createElement("tr");
	firstRow.className = "header-row";
	var header = document.createElement("th");
	header.textContent = "#";
	firstRow.appendChild(header);
	header = document.createElement("th");
	header.textContent = provider.displayName + " " + provider.counterNoun;
	firstRow.appendChild(header);
	table.appendChild(firstRow);

	for (var i = 0; i < recordIndices.length; i++) {
	    var record = provider.records[recordIndices[i]];

	    if (isBreakpointPopup) {
		header.setAttribute("colspan", 4);
		var row = document.createElement("tr");

		var countCell = document.createElement("td");
		countCell.textContent = record.mark.index;
		row.appendChild(countCell);
		row.classList.add("row-with-count");

		var indexExplored = WebInspector.timelapseBreakpointTracker.exploredIndex(record.mark.index);
		var isAnchoredLocation = WebInspector.timelapsePresentationModel.anchorManager.anchorAtLocation(record.mark.index, record.hitIndex);
		var isCurrentBreakpoint = record.mark.index == WebInspector.timelapseModel.currentMarkIndex
		    && record.hitIndex == WebInspector.timelapseModel.currentHitIndex;

		if (isAnchoredLocation) {
		    var anchorButton = createButtonInTD("timelapse-anchor-button toggled", function(markIndex, hitIndex) {
			WebInspector.timelapsePresentationModel.anchorManager.removeAnchor(markIndex, hitIndex);
		    }.bind(anchorButton, record.mark.index, record.hitIndex));
		    row.appendChild(anchorButton);
		}
		else
		    row.appendChild(document.createElement("td"));

		if (indexExplored && !isCurrentBreakpoint) {
		    var jumpButton = createButtonInTD("timelapse-jump-button", function(markIndex, hitIndex) {
			WebInspector.timelapseModel.replayToBreakpointHit(markIndex, hitIndex);
		    }.bind(jumpButton, record.mark.index, record.hitIndex));
		    row.appendChild(jumpButton);
		}
		else
		    row.appendChild(document.createElement("td"));

		var breakpoint = record.breakpoint;

		var cell = document.createElement("td");
		var sourceLink = breakpoint._linkifyLocation();
		sourceLink.addEventListener("contextmenu", breakpoint.contextMenu.bind(breakpoint), true);
		cell.appendChild(sourceLink);
		cell.addStyleClass("text-cell");
		row.appendChild(cell);

		if (breakpoint.condition()) {
		    cell = document.createElement("td");
		    var conditionText = document.createElement("span");
		    conditionText.textContent = "(" + breakpoint.condition() + ")";
		    conditionText.addStyleClass("source-code");
		    cell.appendChild(conditionText);
		    cell.addStyleClass("text-cell");
		    row.appendChild(cell);
		}

		if (isCurrentBreakpoint)
		    row.addStyleClass("selected");

		table.appendChild(row);
	    }
	    else {
		// display single input
		header.setAttribute("colspan", 2);
		var row = document.createElement("tr");
		row.className = "row-with-count";
		var countCell = document.createElement("td");
		countCell.textContent = record.mark.index;
		row.appendChild(countCell);

		var cell = document.createElement("td");
		var name = WebInspector.TimelapseInputDataProvider.InputStyles[record.type].title;
		cell.setTextAndTitle(name);
		cell.addStyleClass("text-cell");
		row.appendChild(cell);

		if (record.mark.index == WebInspector.timelapseModel.currentMarkIndex)
		    row.addStyleClass("selected");

		row.addEventListener("dblclick", function(markIndex) {
		    this.replayUpToMarkIndex(markIndex);
		}.bind(WebInspector.timelapseModel, record.mark.index));

		table.appendChild(row);
	    }
	}
	return table;
    },
};

WebInspector.TimelapsePresentationModel.prototype.__proto__ = WebInspector.Object.prototype;

/**
 * @constructor
 */
// TODO: move to TimelapseAnchorDataProvider
WebInspector.TimelapseAnchorManager = function()
{
    WebInspector.Object.call(this);

    this._model = WebInspector.timelapseModel;

    var modelEvents = WebInspector.TimelapseModel.EventTypes;
    this._model.addEventListener(modelEvents.BreakpointHit, this._breakpointHit, this);

    var debuggerModel = WebInspector.debuggerModel;
    var debugEvents = WebInspector.DebuggerModel.Events;
    debuggerModel.addEventListener(debugEvents.DebuggerStepOver, this._debuggerStepOver, this);
    debuggerModel.addEventListener(debugEvents.DebuggerStepInto, this._debuggerStepInto, this);
    debuggerModel.addEventListener(debugEvents.DebuggerStepOut, this._debuggerStepOut, this);

    this.reset();
};

// TODO: move to TimelapseAnchorDataProvider
WebInspector.TimelapseAnchorManager.EventTypes = {
    AnchorSet: "TimelapseAnchorSet",
    AnchorRemoved: "TimelapseAnchorRemoved"
};

// TODO: move to TimelapseAnchorDataProvider
WebInspector.TimelapseAnchorManager.prototype = {
    get anchors()
    {
	return this._anchors;
    },

    anchorAtMarkIndex: function(markIndex) {
	var index = binarySearch(markIndex, this._anchors, function(a, b) { return a - b.markIndex; });
	return (index >= 0);
    },

    anchorAtLocation: function(markIndex, hitIndex) {
	var location = {
	    markIndex: markIndex,
	    hitIndex: hitIndex
	}
	var index = binarySearch(location, this._anchors, this._locationComparator);
	return (index >= 0) ? this._anchors[index] : false;
    },

    hasAnchor: function()
    {
	return !!this._anchors.length;
    },

    setAnchor: function()
    {
	var markIndex = this._model.currentMarkIndex;
	var hitIndex = this._model.currentHitIndex;
	var debuggerWalk = this._debuggerWalkRecord.slice();

	var anchor = new WebInspector.TimelapseAnchor(markIndex, hitIndex, debuggerWalk);
	var index = binarySearch(anchor, this._anchors, this._locationComparator);

	// For now, only maintain one anchor per breakpoint hit.
	if (index >= 0)
	    this.removeAnchor(markIndex, hitIndex);
	else
	    index = -(index + 1);

	this._anchors.splice(index, 0, anchor);

	this.dispatchEventToListeners(WebInspector.TimelapseAnchorManager.EventTypes.AnchorSet, anchor.location);
    },

    replayToAnchor: function()
    {
	// current playback point
	var location = {
	    markIndex: this._model.currentMarkIndex,
	    hitIndex: this._model.currentHitIndex
	}

	var index = binarySearch(location, this._anchors, this._locationComparator);
	if (index < 0)
	    index = -(index + 1);

	// Since there is currently no easy way to compare debugger walks, the only case where we
	// can replay to an anchor on the current hit index is if the recorded walk is length 0 and
	// the anchor's walk is length > 0.
	var anchorAtLocation = this._anchors[index] && this._locationComparator(location, this._anchors[index]) == 0;
	var noWalkRecord = this._debuggerWalkRecord.length == 0;
	var nonzeroAnchorWalk = this._anchors[index] && this._anchors[index].debuggerWalk.length > 0;

	if (index >= this._anchors.length)
	    this._anchors[0].replayToAnchor();
	else if (!anchorAtLocation || (noWalkRecord && nonzeroAnchorWalk))
	    this._anchors[index].replayToAnchor();
	else if (index == this._anchors.length - 1)
	    this._anchors[0].replayToAnchor();
	else
	    this._anchors[index+1].replayToAnchor();
    },

    removeAnchor: function(markIndex, hitIndex)
    {
	var location = {
	    markIndex: markIndex || this._model.currentMarkIndex,
	    hitIndex: hitIndex || this._model.currentHitIndex
	}

	var index = binarySearch(location, this._anchors, this._locationComparator);
	if (index < 0)
	    return;

	this._anchors.splice(index, 1);

	this.dispatchEventToListeners(WebInspector.TimelapseAnchorManager.EventTypes.AnchorRemoved, location);
    },

    reset: function()
    {
	this._anchors = [];
	this._debuggerWalkRecord = [];
    },

    _locationComparator: function(a, b)
    {
	if (a.markIndex == b.markIndex)
	    return a.hitIndex - b.hitIndex;
	else
	    return a.markIndex - b.markIndex;
    },

    _breakpointHit: function()
    {
	this._debuggerWalkRecord = [];
    },

    _debuggerStepOver: function()
    {
	if (!this._model.replaying)
	    return;

	var stepOver = WebInspector.debuggerModel.stepOver.bind(WebInspector.debuggerModel);
	this._debuggerWalkRecord.push(stepOver);
    },

    _debuggerStepInto: function()
    {
	if (!this._model.replaying)
	    return;

	var stepInto = WebInspector.debuggerModel.stepInto.bind(WebInspector.debuggerModel);
	this._debuggerWalkRecord.push(stepInto);
    },

    _debuggerStepOut: function()
    {
	if (!this._model.replaying)
	    return;

	var stepOut = WebInspector.debuggerModel.stepOut.bind(WebInspector.debuggerModel);
	this._debuggerWalkRecord.push(stepOut);
    }
};

WebInspector.TimelapseAnchorManager.prototype.__proto__ = WebInspector.Object.prototype;

/**
 * @constructor
 */
// TODO: move to TimelapseAnchorDataProvider
WebInspector.TimelapseAnchor = function(markIndex, hitIndex, debuggerWalk)
{
    this._markIndex = markIndex;
    this._hitIndex = hitIndex;
    this._debuggerWalk = debuggerWalk;
};

// TODO: move to TimelapseAnchorDataProvider
WebInspector.TimelapseAnchor.prototype = {
    get location()
    {
	return {
	    markIndex: this._markIndex,
	    hitIndex: this._hitIndex
	};
    },

    get markIndex()
    {
	return this._markIndex;
    },

    get hitIndex()
    {
	return this._hitIndex;
    },

    get debuggerWalk()
    {
	return this._debuggerWalk;
    },

    replayToAnchor: function()
    {
	WebInspector.timelapseModel.replayDebuggerWalk(this._markIndex, this._hitIndex, this._debuggerWalk);
    }
};

/**
 * @constructor
 */
WebInspector.TimelapseCalculator = function()
{
    WebInspector.Object.call(this);
};

WebInspector.TimelapseCalculator.EventTypes = {
  ZoomChanged: "TimelapseZoomChanged"  
};

WebInspector.TimelapseCalculator.prototype = {
    _minimumBoundarySpan: 0.0,

    reset: function()
    {
	this._zoomLeft = 0.0;
	this._zoomRight = 0.0;
        delete this.minimumBoundary;
        delete this.maximumBoundary;
    },


    setZoomInterval: function(left, right)
    {
	this._zoomLeft = Number.constrain(left || 0, 0.0, 1.0);
	this._zoomRight = Number.constrain(right || 1, 0.0, 1.0);
	this.dispatchEventToListeners(WebInspector.TimelapseCalculator.EventTypes.ZoomChanged);
    },

    get zoomLeft()
    {
	return this._zoomLeft;
    },

    get zoomRight()
    {
	return this._zoomRight;
    },

    get zoomInterval()
    {
	return this._zoomRight - this._zoomLeft;
    },

    set zoomLeft(zoom)
    {
	this.setZoomInterval(zoom, this.zoomRight);
    },

    set zoomRight(zoom)
    {
	this.setZoomInterval(this.zoomLeft, zoom);
    },

    get boundarySpan()
    {
	if (typeof this.minimumBoundary === "undefined" || typeof this.maximumBoundary === "undefined")
	    return this._minimumBoundarySpan;

        return (this.maximumBoundary - this.minimumBoundary);
    },

    updateBoundaries: function(record)
    {
	var ts = record.mark.timestamp;
        if (typeof this.minimumBoundary === "undefined" || ts < this.minimumBoundary) {
            this.minimumBoundary = ts;
            return true;
        }
        if (typeof this.maximumBoundary === "undefined" || ts > this.maximumBoundary) {
            this.maximumBoundary = ts;
            return true;
        }
        return false;
    },

    /* computes a timestamp corresponding to a percent position on the overview. */
    computeOverviewTimestamp: function(percent)
    {
	var overallPercent = this.zoomLeft + this.zoomInterval * percent;
	return this.minimumBoundary + this.boundarySpan * overallPercent;
    },

    /* computes a timestamp corresponding to a percent position on the miniview. */
    computeMiniviewTimestamp: function(percent)
    {
	return this.minimumBoundary + this.boundarySpan * percent;
    },

    computeOverviewPercentage: function(ts)
    {
	/* this takes into account the viewable interval, returning the percentage within that region. */
	var overallPercent = (ts - this.minimumBoundary) / this.boundarySpan;
	return (overallPercent - this.zoomLeft) / this.zoomInterval;
    },

    computeMiniviewPercentage: function(ts)
    {
	return (ts - this.minimumBoundary) / this.boundarySpan;
    },

    computeMarkIndexFromPercentage: function(percent)
    {
    	var timestamp = this.minimumBoundary + this.boundarySpan * percent;

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

	var records = WebInspector.timelapseModel.allRecords;
	var idx = records.nearestBinaryIndexOf(timestamp, timestampAndRecordComparator, timeDistanceFunction);
	return records[idx].mark.index;
    },

    formatValue: function(value)
    {
        return Number.secondsToString(value || 0);
    },

    // format this as time since the minimum boundary.
    formatElapsedValue: function(value)
    {
	value = value || 0;
	return this.formatValue(value - this.minimumBoundary);
    }
};

WebInspector.TimelapseCalculator.prototype.__proto__ = WebInspector.Object.prototype;

WebInspector.timelapsePresentationModel;
