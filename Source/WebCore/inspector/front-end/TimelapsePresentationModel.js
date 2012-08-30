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
    this.anchor = new WebInspector.TimelapseAnchor();

    this._replayingToAnchor = false;

    this.breakpointLinkifier = new WebInspector.Linkifier();
    this.calculator = new WebInspector.TimelapseCalculator();

    var eventNames = WebInspector.TimelapseModel.EventTypes;
    this._model.addEventListener(eventNames.RecordingDidStart, this._recordingDidStart, this);
    this._model.addEventListener(eventNames.RecordingDidStop, this._recordingDidStop, this);
    this._model.addEventListener(eventNames.RecordAdded, this._recordAdded, this);
    this._model.addEventListener(eventNames.InputPaused, this._inputPaused, this);
    this._model.addEventListener(eventNames.BreakpointPaused, this._breakpointPaused, this);
    this._model.addEventListener(eventNames.BreakpointHit, this._breakpointsChanged, this);

    WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointAdded, this._breakpointsChanged, this);
    WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointRemoved, this._breakpointsChanged, this);
    WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointRemovedFromStorage, this._breakpointsChanged, this);

    this.reset();
};

WebInspector.TimelapsePresentationModel.EventTypes = {
    FilterChanged: "TimelapseFilterChanged",
    InputSelected: "TimelapseInputSelected",
    PreviewStarted: "TimelapsePreviewStarted",
    PreviewStopped: "TimelapsePreviewStopped",
    PreviewChanged: "TimelapsePreviewChanged",
    CircleMouseOver: "TimelapseCircleMouseOver",
    CircleMouseOut: "TimelapseCircleMouseOut",
    CircleSelected: "TimelapseCircleSelected"
};

WebInspector.TimelapsePresentationModel.prototype = {

    get replayingToAnchor()
    {
	return this._replayingToAnchor;
    },

    get breakpointRecords()
    {
	/* The presentation model maintains breakpoint records for _enabled_ breakpoints. */

	if (this.categories["breakpoint"].disabled)
	    return [];

	if (!this._breakpointRecordsAreStale)
	    return this._breakpointRecords;

	this._breakpointRecordsAreStale = false;

	var records = WebInspector.timelapseBreakpointTracker.records;
	this._breakpointRecords = [];

	for (var i = 0; i < records.length; i++) {
	    var record = {};
	    record.type = records[i].type;
	    record.mark = records[i].mark;
	    record.hits = [];

	    for (var j = 0; j < records[i].hits.length; j++) {
		var breakpoint = records[i].hits[j];
		if (breakpoint.enabled()) {
		    record.hits.push(breakpoint);
		}
	    }

	    if (record.hits.length > 0)
		this._breakpointRecords.push(record);
	}

	return this._breakpointRecords;
    },

    reset: function() 
    {
	/* matchedRecords are records that pass non-time filters  */
	this._matchedRecords = [];
	this._matchedRecordsAreStale = false;
	this._breakpointRecordsAreStale = true;
	this.calculator.reset();
	this.anchor.removeAnchor();
    },

    // Private API (callbacks)
    _recordingDidStart: function()
    {
	this.reset();
	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.FilterChanged);
    },

    _recordingDidStop: function()
    {
	this._updateMatchingRecords();
	this.calculator.setZoomInterval(0.0, 1.0);
    },

    _recordAdded: function(event)
    {
	var record = event.data;
        if (!this.recordStyles[record.type]) {
	    console.log("Tried to record unknown record type: " + record.type);
	    console.log("record=");
	    console.log(record);
	    return;
	}

	this._matchedRecords.push(record);
	this.calculator.updateBoundaries(record);
    },

    _updateMatchingRecords: function()
    {
	var catEnabledByRecordType = {};
        for (eventType in this.recordStyles) {
            var category = this.recordStyles[eventType].category;
            catEnabledByRecordType[eventType] = !category.disabled;
	}

	var records = this._model.allRecords;
	for (var i = 0; i < records.length; i++)
            records[i].matches = catEnabledByRecordType[records[i].type];

	this._matchedRecordsAreStale = true;
    },

    _inputPaused: function()
    {
	if (!this.anchor._breakpointLocation)
	    this._replayingToAnchor = false;
    },

    _breakpointPaused: function()
    {
	this._replayingToAnchor = false;
    },

    _breakpointsChanged: function()
    {
	this._breakpointRecordsAreStale = true;
    },

    // Public API
    get matchedRecords()
    {
	if (this._matchedRecordsAreStale) {
	    this._matchedRecordsAreStale = false;
	    this._matchedRecords = this._model.allRecords.filter(function(record) { return record.matches; });
	}

	return this._matchedRecords;
    },

    get previewModeActive()
    {
	return !!this._previewModeActive;
    },

    get previewedRecord()
    {
	return this._previewedRecord;
    },

    startPreviewing: function()
    {
	this._previewModeActive = true;
    	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.PreviewStarted);
    },

    stopPreviewing: function()
    {
	delete this._previewModeActive;
	delete this._previewedRecord;
    	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.PreviewStopped);
    },

    previewRecord: function(record)
    {
	console.assert(!!record, "Cannot preview undefined record");

	this._previewedRecord = record;
	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.PreviewChanged, record);
    },

    toggleCategory: function(category)
    {
	category.disabled = !category.disabled;

	if (category.name == "breakpoint")
	    WebInspector.debuggerModel.setBreakpointsActive(!category.disabled);

    	this._updateMatchingRecords();
	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.FilterChanged);
    },

    selectCircle: function(category, circleIndex, records)
    {
	var eventData = {
	    "category": category,
	    "index": circleIndex,
	    "records": records
	};

	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.CircleSelected, eventData);
    },

    circleMouseOver: function(category, circleIndex, records)
    {
	var eventData = {
	    "category": category,
	    "index": circleIndex,
	    "records": records
	};

	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.CircleMouseOver, eventData);
    },

    circleMouseOut: function(category, circleIndex, records)
    {
	var eventData = {
	    "category": category,
	    "index": circleIndex,
	    "records": records
	};

	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.CircleMouseOut, eventData);
    },

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

    generatePopupContent: function(records) {
	if (!records || records.length == 0)
	    return null;

	var table = document.createElement("table");
	table.className = "timelapse-overview-popover-table timelapse-category-" 
	                  + this.recordStyles[records[0].type].category.name;

	function createButtonInTD(styleClass, callback) {
	    var cell = document.createElement("td");
	    cell.setAttribute("width", "20px");
	    var button = document.createElement("div");
	    button.className = "timelapse-button-icon " + styleClass;
	    cell.appendChild(button);
	    button.addEventListener("click", callback);
	    return cell;
	}

	var isBreakpointPopup = (records[0].type == WebInspector.TimelapseAgent.RecordType.BreakpointHit);

	var firstRow = document.createElement("tr");
	firstRow.className = "header-row";
	var header = document.createElement("th");
	header.textContent = "#";
	firstRow.appendChild(header);
	header = document.createElement("th");

	if (isBreakpointPopup)
	    header.textContent = "Breakpoint Hits";
	else
	    header.textContent = this.recordStyles[records[0].type].category.title + " Inputs";

	firstRow.appendChild(header);
	table.appendChild(firstRow);

	for (var i = 0; i < records.length; i++) {
	    var record = records[i];

	    if (isBreakpointPopup) {
		// traverse breakpoint hits
		for (var j = 0; j < record.hits.length; j++) {
		    header.setAttribute("colspan", 4);
		    var row = document.createElement("tr");

		    if (j == 0) {
			var countCell = document.createElement("td");
			countCell.textContent = record.mark.index;
			row.appendChild(countCell);
			row.classList.add("row-with-count");
		    } else 
			row.appendChild(document.createElement("td"));

		    var indexExplored = WebInspector.timelapseBreakpointTracker.exploredIndex(record.mark.index);
		    var anchorLocation = WebInspector.timelapsePresentationModel.anchor.location;
		    var isAnchoredLocation = (anchorLocation && anchorLocation.markIndex == record.mark.index
			&& anchorLocation.hitIndex == j);
		    var isCurrentBreakpoint = record.mark.index == WebInspector.timelapseModel.currentMarkIndex
			&& j == WebInspector.timelapseModel.currentHitIndex;

		    if (isAnchoredLocation) {
			var anchorButton = createButtonInTD("timelapse-anchor-button toggled", function() {
			    WebInspector.timelapsePresentationModel.anchor.removeAnchor();
			});
			row.appendChild(anchorButton);
		    }
		    else
			row.appendChild(document.createElement("td"));

		    if (indexExplored && !isCurrentBreakpoint) {
			var jumpButton = createButtonInTD("timelapse-jump-button", function(markIndex, hitIndex) {
			    WebInspector.timelapseModel.replayToBreakpointHit(markIndex, hitIndex);
			}.bind(jumpButton, record.mark.index, j));
			row.appendChild(jumpButton);
		    }
		    else
			row.appendChild(document.createElement("td"));

		    var breakpoint = record.hits[j];

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
		var type = WebInspector.timelapsePresentationModel.recordStyles[record.type].title;
		cell.setTextAndTitle(type);
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

    get categories()
    {
	if (!this._categories) {
	    this._categories = {
		userinput: new WebInspector.TimelapseCategory("userinput", WebInspector.UIString("User"), WebInspector.Color.fromRGB(20,170,70)),
		network: new WebInspector.TimelapseCategory("network", WebInspector.UIString("Network"), WebInspector.Color.fromRGB(200,150,0)),
		timer: new WebInspector.TimelapseCategory("timer", WebInspector.UIString("Timer"), WebInspector.Color.fromRGB(200,30,30)),
		system: new WebInspector.TimelapseCategory("system", WebInspector.UIString("System"), WebInspector.Color.fromRGB(10,55,230)),
		breakpoint: new WebInspector.TimelapseCategory("breakpoint", WebInspector.UIString("Breakpoint"), WebInspector.Color.fromRGB(10,55,230))
	    };
	}
	return this._categories;
    },

    categoryOrder: ["userinput", "network", "timer", "breakpoint"],
    timelineHeight: 30,

    get recordStyles()
    {
	if (!this._recordStylesArray) {
	    var recordTypes = WebInspector.TimelapseAgent.RecordType;
	    var recordStyles = {};
	    recordStyles[recordTypes.MousePress] = { title: WebInspector.UIString("Mouse Press"), category: this.categories.userinput };
	    recordStyles[recordTypes.MouseRelease] = { title: WebInspector.UIString("Mouse Release"), category: this.categories.userinput };
	    recordStyles[recordTypes.MouseMove] = { title: WebInspector.UIString("Mouse Move"), category: this.categories.userinput };
	    recordStyles[recordTypes.MouseWheel] = { title: WebInspector.UIString("Mouse Wheel"), category: this.categories.userinput };
	    recordStyles[recordTypes.KeyPress] = { title: WebInspector.UIString("Key Press"), category: this.categories.userinput };
	    recordStyles[recordTypes.Scroll] = { title: WebInspector.UIString("Scroll"), category: this.categories.userinput };

	    recordStyles[recordTypes.WindowActive] = { title: WebInspector.UIString("Window Became Active"), category: this.categories.userinput };
	    recordStyles[recordTypes.WindowInactive] = { title: WebInspector.UIString("Window Became Inactive"), category: this.categories.userinput };
	    recordStyles[recordTypes.WindowFocused] = { title: WebInspector.UIString("Window Was Focused"), category: this.categories.userinput };
	    recordStyles[recordTypes.WindowUnfocused] = { title: WebInspector.UIString("Window Was Unfocused"), category: this.categories.userinput };

	    recordStyles[recordTypes.ReceiveResource] = { title: WebInspector.UIString("Received Resource"), category: this.categories.network };

	    recordStyles[recordTypes.TimerFire] = { title: WebInspector.UIString("Timer Fired"), category: this.categories.timer };

	    recordStyles[recordTypes.FrameNavigated] = { title: WebInspector.UIString("Started Page Load"), category: this.categories.system };
	    recordStyles[recordTypes.CaptureBegin] = { title: WebInspector.UIString("Recording Began"), category: this.categories.system };
	    recordStyles[recordTypes.CaptureEnd] = { title: WebInspector.UIString("Recording Ended"), category: this.categories.system };
	    recordStyles[recordTypes.BreakpointHit] = { title: WebInspector.UIString("Hit Breakpoint"), category: this.categories.breakpoint };

	    this._recordStylesArray = recordStyles;
	}
	return this._recordStylesArray;
    }
};

WebInspector.TimelapsePresentationModel.prototype.__proto__ = WebInspector.Object.prototype;


WebInspector.TimelapseAnchor = function()
{
    WebInspector.Object.call(this);

    this._debuggerWalk = [];

    var model = WebInspector.timelapseModel;
    var modelEvents = WebInspector.TimelapseModel.EventTypes;

    model.addEventListener(modelEvents.BreakpointHit, this._breakpointHit, this);
    model.addEventListener(modelEvents.RecordingDidStart, this.removeAnchor, this);

    WebInspector.debuggerModel.addEventListener(WebInspector.DebuggerModel.Events.DebuggerStepOver, this._debuggerStepOver, this);
    WebInspector.debuggerModel.addEventListener(WebInspector.DebuggerModel.Events.DebuggerStepInto, this._debuggerStepInto, this);
    WebInspector.debuggerModel.addEventListener(WebInspector.DebuggerModel.Events.DebuggerStepOut, this._debuggerStepOut, this);
};

WebInspector.TimelapseAnchor.EventTypes = {
    AnchorSet: "TimelapseAnchorSet",
    AnchorRemoved: "TimelapseAnchorRemoved"
};

WebInspector.TimelapseAnchor.prototype = {
    get location()
    {
	return this._location;
    },

    enabled: function()
    {
	return !!this._location;
    },

    setAnchor: function()
    {
	var markIndex = WebInspector.timelapseModel.currentMarkIndex;
	var hitIndex = WebInspector.timelapseModel.currentHitIndex;

	this._debuggerWalk = this._debuggerWalkRecord.slice();

	var oldLocation;
	if (this._location)
	    oldLocation = this._location;

	this._location = {
	    markIndex: markIndex,
	    hitIndex: hitIndex
	};

	var eventData = {
	    oldLocation: oldLocation,
	    newLocation: this._location
	};

	if (oldLocation && oldLocation.markIndex == markIndex
	    && oldLocation.hitIndex == hitIndex)
	    this.removeAnchor();
	else
	    this.dispatchEventToListeners(WebInspector.TimelapseAnchor.EventTypes.AnchorSet, eventData);
    },

    replayToAnchor: function()
    {
	WebInspector.timelapsePresentationModel._replayingToAnchor = true;
	WebInspector.timelapseModel.replayDebuggerWalk(this._location.markIndex, this._location.hitIndex, this._debuggerWalk);
    },

    removeAnchor: function()
    {
	/* removeAnchor should be idempotent until lifetime management is better */
	if (!this._location)
	    return;

	var eventData = { location: this._location };
	this._location = null;
	this._debuggerWalk = [];

	this.dispatchEventToListeners(WebInspector.TimelapseAnchor.EventTypes.AnchorRemoved, eventData);
    },

    _breakpointHit: function()
    {
	this._debuggerWalkRecord = [];
    },

    _debuggerStepOver: function()
    {
	if (!WebInspector.timelapseModel.replaying)
	    return;

	var stepOver = WebInspector.debuggerModel.stepOver.bind(WebInspector.debuggerModel);
	this._debuggerWalkRecord.push(stepOver);
    },

    _debuggerStepInto: function()
    {
	if (!WebInspector.timelapseModel.replaying)
	    return;

	var stepInto = WebInspector.debuggerModel.stepInto.bind(WebInspector.debuggerModel);
	this._debuggerWalkRecord.push(stepInto);
    },

    _debuggerStepOut: function()
    {
	if (!WebInspector.timelapseModel.replaying)
	    return;

	var stepOut = WebInspector.debuggerModel.stepOut.bind(WebInspector.debuggerModel);
	this._debuggerWalkRecord.push(stepOut);
    }
};

WebInspector.TimelapseAnchor.prototype.__proto__ = WebInspector.Object.prototype;


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


/**
 * @constructor
 */
WebInspector.TimelapseCategory = function(name, title, color)
{
    this.name = name;
    this.title = title;
    this.color = color;
    this.disabled = false;
};


WebInspector.timelapsePresentationModel;
