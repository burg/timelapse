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
    // TODO: move to TimelapseInputDataProvider
    this._model.addEventListener(eventNames.RecordAdded, this._recordAdded, this);

    // TODO: move to TimelapseBreakpointDataProvider
    WebInspector.timelapseBreakpointTracker.addEventListener(WebInspector.TimelapseBreakpointTracker.Events.BreakpointAdded, this._replaceBreakpointProvider, this);
    WebInspector.timelapseBreakpointTracker.addEventListener(WebInspector.TimelapseBreakpointTracker.Events.BreakpointRemoved, this._replaceBreakpointProvider, this);

    this.reset();
};

WebInspector.TimelapsePresentationModel.EventTypes = {
    ProviderAdded: "TimelapseProviderAdded",
    ProviderRemoved: "TimelapseProviderRemoved",
    // TODO: the following events are details of specific data providers.
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
    // TODO: move to TimelapseBreakpointDataProvider
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

    // TODO: most of this state will be moved to providers or timeline widgets
    reset: function() 
    {
	/* matchedRecords are records that pass non-time filters  */
	this._matchedRecords = [];
	this._matchedRecordsAreStale = false;
	this._breakpointRecordsAreStale = true;
	this._resourceUrlById = [];
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
			     this.categories["userinput"]
			));
	this.addProvider(new WebInspector.TimelapseInputDataProvider(
			     this.categories["network"]
			));
	this.addProvider(new WebInspector.TimelapseInputDataProvider(
			     this.categories["timer"]
			));

	// TODO: remove
	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.FilterChanged);
    },

    _recordingDidStop: function()
    {
	// TODO: create TimelapseAnchorDataProvider.
	// TODO: Remove
	this._updateMatchingRecords();

	this.calculator.setZoomInterval(0.0, 1.0);
    },

    // TODO: disambiguate record type, add to correct TimelapseInputDataProvider.
    // alternatively, each provider listens for RecordAdded itself.
    _recordAdded: function(event)
    {
	var record = event.data;
        if (!this.recordStyles[record.type]) {
	    console.log("Tried to record unknown record type: " + record.type);
	    console.log("record=");
	    console.log(record);
	    return;
	}

	// TODO: This should be moved to TimelapseInputDataProvider.addRecord()
	// ReceiveData and ResourceLoaded records do not include URL data, so store it from request/response records.
	var recordTypes = WebInspector.TimelapseAgent.RecordType;
	if (record.type == recordTypes.RequestResource
	    || record.type == recordTypes.ReceiveResponse) {
	    this._resourceUrlById[record.data.id] = record.data.url;
	}

	// TODO: remove
	this._matchedRecords.push(record);

	this.calculator.updateBoundaries(record);
    },

    // TODO: should be removed
    _updateMatchingRecords: function()
    {
	// TODO: should be tracked by DataProvider.isEnabled() and friends
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

    _replaceBreakpointProvider: function()
    {
	this._breakpointRecordsAreStale = true;

	// TODO: keep old breakpoint providers
	var model = this;
	var breakpointProviders = this._providersWithType(WebInspector.DataProvider.Types.BreakpointHits);
	breakpointProviders.forEach(function(provider) { model.removeProvider(provider); });

	this.addProvider(new WebInspector.TimelapseBreakpointDataProvider(this.categories["breakpoint"]));
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

    _providersWithType: function(ty)
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
	
	var removed = this._providers.splice(idx, 1)[0];
    	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.ProviderRemoved, removed);
    },

    _clearProviders: function() {
	while (this._providers.length > 0) {
	    this._providers[0].willRemove();
	    this._removeProviderAtIndex(0);
	}
    },

    // TODO: eventually, TimelapsePresentationModel shouldn't actually hold any records,
    // just a calculator that's been informed by the incoming events.
    get matchedRecords()
    {
	if (this._matchedRecordsAreStale) {
	    this._matchedRecordsAreStale = false;
	    this._matchedRecords = this._model.allRecords.filter(function(record) { return record.matches; });
	}

	return this._matchedRecords;
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

    // TODO: should be tracked by DataProvider.isEnabled() and friends.
    toggleCategory: function(category)
    {
	category.disabled = !category.disabled;

	if (category.name == "breakpoint")
	    WebInspector.debuggerModel.setBreakpointsActive(!category.disabled);

    	this._updateMatchingRecords();
	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.FilterChanged);
    },

    // TODO: Selection state should live on the specific DataProvider which is being selected.
    selectCircle: function(provider, circleIndex, records)
    {
	var eventData = {
	    "provider": provider,
	    "index": circleIndex,
	    "records": records
	};

	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.CircleSelected, eventData);
    },

    // TODO: Selection state should live on the specific DataProvider which is being selected.
    circleMouseOver: function(provider, circleIndex, records)
    {
	var eventData = {
	    "provider": provider,
	    "index": circleIndex,
	    "records": records
	};

	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.CircleMouseOver, eventData);
    },

    // TODO: Selection state should live on the specific DataProvider which is being selected.
    circleMouseOut: function(provider, circleIndex, records)
    {
	var eventData = {
	    "provider": provider,
	    "index": circleIndex,
	    "records": records
	};

	this.dispatchEventToListeners(WebInspector.TimelapsePresentationModel.EventTypes.CircleMouseOut, eventData);
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

    // TODO: move to TimelapseInputDataProvider
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

    // TODO: move to TimelapseInputDataProvider
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
	    recordStyles[recordTypes.Resize] = { title: WebInspector.UIString("Resize"), category: this.categories.userinput };

	    recordStyles[recordTypes.WindowActive] = { title: WebInspector.UIString("Window Became Active"), category: this.categories.userinput };
	    recordStyles[recordTypes.WindowInactive] = { title: WebInspector.UIString("Window Became Inactive"), category: this.categories.userinput };
	    recordStyles[recordTypes.WindowFocused] = { title: WebInspector.UIString("Window Was Focused"), category: this.categories.userinput };
	    recordStyles[recordTypes.WindowUnfocused] = { title: WebInspector.UIString("Window Was Unfocused"), category: this.categories.userinput };

	    recordStyles[recordTypes.RequestResource] = { title: WebInspector.UIString("Requested Resource"), category: this.categories.network };
	    recordStyles[recordTypes.ReceiveResponse] = { title: WebInspector.UIString("Received Response"), category: this.categories.network };
	    recordStyles[recordTypes.ReceiveData] = { title: WebInspector.UIString("Received Data"), category: this.categories.network };
	    recordStyles[recordTypes.ResourceLoaded] = { title: WebInspector.UIString("Resource Loaded"), category: this.categories.network };

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

/**
 * @constructor
 */
// TODO: move to TimelapseInputDataProvider
WebInspector.TimelapseCategory = function(name, title, color)
{
    this.name = name;
    this.title = title;
    this.color = color;
    this.disabled = false;
};


WebInspector.timelapsePresentationModel;
