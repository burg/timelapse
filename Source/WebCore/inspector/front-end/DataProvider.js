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
 * @extends {WebInspector.Object}
 */
WebInspector.DataProvider = function(recording, name, type)
{
    this._name = name;
    this._type = type;
    this._enabled = true;
    this._recording = recording;

    WebInspector.Object.call(this);
};

WebInspector.DataProvider.prototype = {
    get recording()
    {
        return this._recording;
    },

    get name()
    {
        return this._name;
    },

    get type()
    {
        return this._type;
    },

    // Override me!
    get displayName()
    {
        return this._name;
    },

    // Override me!
    get counterNoun()
    {
	return "Records";
    },

    // dummy color
    get color()
    {
	return WebInspector.Color.fromRGB(0,0,0);
    },

    enable: function() {
	this._enabled = true;
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.Enabled, this);
    },

    disable: function() {
	this._enabled = false;
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.Disabled, this);
    },

    toggleEnablement: function() {
        if (this._enabled)
	    this.disable();
	else
	    this.enable();
    },

    isEnabled: function() {
	return this._enabled;
    },

    // This should be used by listeners as an opportunity to remove callbacks
    willRemove: function() {
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.WillRemove, this);
	
	if (this.hasAnyEventListeners()){
	    console.error("Provider still has listeners after dispatching WillRemove event.");
	    console.error(this);
	    console.error(this._listeners);
	}
    },
    
    __proto__: WebInspector.Object.prototype
};

WebInspector.DataProvider.Types = {
    TimelapseInput: "TimelapseInput",
    BreakpointHits: "BreakpointHits",
    ReplaySavepoint: "ReplaySavepoint",
    OverviewPreview: "OverviewPreview",
};

WebInspector.DataProvider.Events = {
    Enabled: "Enabled",
    Disabled: "Disabled",
    Invalidated: "Invalidated",
    WillRemove: "WillRemove",

    // used by all data providers to signal something changed.
    DataChanged: "DataChanged",
    SelectionChanged: "SelectionChanged",

    // used by input data provider to signal incremental addition.
    // this only makes sense for providers that add data monotonically.
    AddedInput: "AddedInput",
};

WebInspector.TimelapseInputDataProvider = function(recording, name, displayName, color)
{
    WebInspector.DataProvider.call(this, recording, name,
				   WebInspector.DataProvider.Types.TimelapseInput);

    this._displayName = displayName;
    this._color = color;
    this._records = [];
    this._resourceUrlById = {};
    this._selectedIndices = [];

    var eventNames = WebInspector.TimelapseRecording.Events;
    recording.addEventListener(eventNames.RecordAdded, this._recordAdded, this);
};

WebInspector.TimelapseInputDataProvider.prototype = {
    get displayName()
    {
	return this._displayName;
    },

    get counterNoun()
    {
	return "Inputs";
    },

    get color()
    {
	if (this.isEnabled())
	    return this._color;
	else // faded color
	    return WebInspector.Color.fromRGB(150, 150, 150);
    },

    get records()
    {
	return this._records;
    },

    get selectedRecords()
    {
	var records = [];

	for (var i = 0; i < this._selectedIndices.length; i++)
	    records.push(this._records[this._selectedIndices[i]]);

	return records;
    },
    
    get selectedIndices()
    {
	return this._selectedIndices.slice();
    },

    set selectedIndices(indices)
    {
        if (!indices || indices.length == 0)
	    return;
	
	for (var i = 0; i < indices.length; i++) {
	    var withinBounds = indices[i] >= 0 && indices[i] < this._records.length;
	    console.assert(withinBounds, "Tried to select record index out of bounds");	    
	    if (!withinBounds)
		return;
	}

	this._selectedIndices = indices.slice();
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.SelectionChanged, this);
    },

    clearSelections: function()
    {
	// more literate API than above; otherwise, the same thing.
	this.selectedIndices = [];
    },

    _recordAdded: function(event)
    {
	var record = event.data;
	var styles = WebInspector.TimelapseInputDataProvider.InputStyles;

	if (styles[record.type].group != this.name)
	    return;

	var recordTypes = WebInspector.TimelapseAgent.RecordType;
	if (record.type == recordTypes.RequestResource
	    || record.type == recordTypes.ReceiveResponse) {
	    this._resourceUrlById[record.data.id] = record.data.url;
	}

	this._records.push(record);

	var eventData = {
            "input": record,
            "provider": this,
	};

	this.dispatchEventToListeners(WebInspector.DataProvider.Events.AddedInput, eventData);
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.DataChanged, this);
    },

    resourceUrlForId: function(id)
    {
	return this._resourceUrlById[id];
    },
    
    __proto__: WebInspector.DataProvider.prototype
};

WebInspector.TimelapseInputDataProvider.InputStyles = (function()
{
    var types = WebInspector.TimelapseAgent.RecordType;
    var styles = {};
    styles[types.MousePress] = { title: WebInspector.UIString("Mouse Press"), group: "userinput" };
    styles[types.MouseRelease] = { title: WebInspector.UIString("Mouse Release"), group: "userinput" };
    styles[types.MouseMove] = { title: WebInspector.UIString("Mouse Move"), group: "userinput" };
    styles[types.MouseWheel] = { title: WebInspector.UIString("Mouse Wheel"), group: "userinput" };
    styles[types.KeyPress] = { title: WebInspector.UIString("Key Press"), group: "userinput" };
    styles[types.Scroll] = { title: WebInspector.UIString("Scroll"), group: "userinput" };
    styles[types.Resize] = { title: WebInspector.UIString("Resize"), group: "userinput" };

    styles[types.WindowActive] = { title: WebInspector.UIString("Window Became Active"), group: "userinput" };
    styles[types.WindowInactive] = { title: WebInspector.UIString("Window Became Inactive"), group: "userinput" };
    styles[types.WindowFocused] = { title: WebInspector.UIString("Window Was Focused"), group: "userinput" };
    styles[types.WindowUnfocused] = { title: WebInspector.UIString("Window Was Unfocused"), group: "userinput" };

    styles[types.RequestResource] = { title: WebInspector.UIString("Requested Resource"), group: "network" };
    styles[types.ReceiveResponse] = { title: WebInspector.UIString("Received Response"), group: "network" };
    styles[types.ReceiveData] = { title: WebInspector.UIString("Received Data"), group: "network" };
    styles[types.ResourceLoaded] = { title: WebInspector.UIString("Resource Loaded"), group: "network" };

    styles[types.TimerFire] = { title: WebInspector.UIString("Timer Fired"), group: "timer" };

    styles[types.FrameNavigated] = { title: WebInspector.UIString("Started Page Load"), group: "system" };
    styles[types.CaptureBegin] = { title: WebInspector.UIString("Capturing Began"), group: "system" };
    styles[types.CaptureEnd] = { title: WebInspector.UIString("Capturing Ended"), group: "system" };
    styles[types.BreakpointHit] = { title: WebInspector.UIString("Hit Breakpoint"), group: "breakpoint" };

    return styles;
})();

// NB. the closure keeps the helper functions from polluting global scope.
WebInspector.TimelapseInputDataProvider.InputPreview = (function(){
    var makeCoords = function(data) {
        return "(" + (data.x || 0) + "," + (data.y || 0) + ")";
    };

    var makeModKeys = function(data) {
	str = "";
	if (data.shiftKey) str += "<SHIFT> ";
	if (data.altKey) str += "<ALT> ";
	if (data.ctrlKey) str += "<CTRL> ";
	if (data.metaKey) str += "<META> ";
	return str;
    };

    var makeButton = function(button) {
	if (button == -1) return ""; // No button
	if (button == 0) return "Left Button";
	if (button == 1) return "Middle Button";
	if (button == 2) return "Right Button";
	return "";
    };

    return {
	MousePress: function(data)
	{
	    return "Coords: " + makeCoords(data) + "; Keys: " + makeModKeys(data) + makeButton(data);
	},
	MouseRelease: function (data)
	{
	    return "Coords: " + makeCoords(data) + "; Keys: " + makeModKeys(data) + makeButton(data);
	},
	MouseMove: function (data)
	{
	    return "Coords: " + makeCoords(data) + "; Keys: " + makeModKeys(data) + makeButton(data);
	},
	MouseWheel: function (data)
	{
	    return "Coords: " + makeCoords(data) + "; Keys: " + makeModKeys(data) + makeButton(data) + "; Scroll: delta of (" + data.deltaX + "," + data.deltaY + "), ticks of (" + data.ticksX + "," + data.ticksY + ")";
	},
	KeyPress: function (data)
	{
	    return "Keys: " + data.text + " and modifiers " + makeModKeys(data);
	},
	Scroll: function (data) { return " "; }, // TODO
	Resize: function (data) {
	    return "Width: " + data.width + "; Height: " + data.height;
	},

	WindowActive: function (data) { return " "; },
	WindowInactive: function (data) { return " "; },
	WindowFocused: function (data) { return " "; },
	WindowUnfocused: function (data) { return " "; },

	RequestResource: function (data) { return data.url; },
	ReceiveResponse: function (data) { return data.url; },
	ReceiveData: function (data, provider) { return provider.resourceUrlForId(data.id); },
	ResourceLoaded: function (data, provider) { return provider.resourceUrlForId(data.id); },

	TimerFire: function (data) { return "Fired"; },

	FrameNavigated: function(data) { return data.url; },
	CaptureBegin: function (data) { return " "; },
	CaptureEnd: function (data) { return " "; }
    };
})();

WebInspector.TimelapseBreakpointDataProvider = function(recording, displayName, color)
{
    WebInspector.DataProvider.call(this, recording, "breakpoint",
				   WebInspector.DataProvider.Types.BreakpointHits);

    this._displayName = displayName;
    this._color = color;
    this._intervals = WebInspector.timelapseBreakpointTracker.exploredIntervals;
    this._initializeRecords();

    var tracker = WebInspector.timelapseBreakpointTracker;
    var events = WebInspector.TimelapseBreakpointTracker.Events;
    tracker.addEventListener(events.BreakpointHit, this._onBreakpointHit, this);
    tracker.addEventListener(events.BreakpointAdded, this._onBreakpointsInvalidated, this);
    tracker.addEventListener(events.BreakpointRemoved, this._onBreakpointsInvalidated, this);
}

WebInspector.TimelapseBreakpointDataProvider.prototype = {
    get counterNoun()
    {
	return "Hits";
    },

    enable: function()
    {
	WebInspector.debuggerModel.setBreakpointsActive(true);
	WebInspector.DataProvider.prototype.enable.call(this);
    },

    disable: function()
    {
	WebInspector.debuggerModel.setBreakpointsActive(false);
	WebInspector.DataProvider.prototype.disable.call(this);
    },

    get exploredIntervals()
    {
	return this._intervals;
    },

    _initializeRecords: function()
    {
	var records = WebInspector.timelapseBreakpointTracker.records;
	this._records = [];

	// flatten existing records from BreakpointTracker
	for (var i = 0; i < records.length; i++) {
	    var hits = records[i].hits;
	    for (var j = 0; j < hits.length; j++) {
		if (typeof hits[j] === "undefined")
		    continue;
		this._records.push({
		    breakpoint: hits[j],
		    mark: records[i].mark,
		    type: WebInspector.TimelapseAgent.RecordType.BreakpointHit,
		    hitIndex: j
		});
	    }
	}
    },

    _onBreakpointHit: function(event)
    {
	// Breakpoints can be detected in any order, so keep records sorted
	var record = event.data;

	function breakpointRecordComparator(a, b) {
	    if (a.mark.index > b.mark.index) return 1;
	    if (a.mark.index < b.mark.index) return -1;
	    return a.hitIndex - b.hitIndex;
	}

	var idx = binarySearch(record, this._records, breakpointRecordComparator);
	if (idx >= 0)
	    return;
	this._records.splice(-(idx + 1), 0, record);

	this.dispatchEventToListeners(WebInspector.DataProvider.Events.DataChanged, this);
    },

    _onBreakpointsInvalidated: function(event)
    {
	// neutralize ourselves, and notify clients that we became worthless.
	this._removeEventListeners(event);
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.Invalidated, this);
    },

    _removeEventListeners: function(event)
    {
	var tracker = WebInspector.timelapseBreakpointTracker;
	var events = WebInspector.TimelapseBreakpointTracker.Events;
	tracker.removeEventListener(events.BreakpointHit, this._onBreakpointHit, this);
	tracker.removeEventListener(events.BreakpointAdded, this._removeEventListeners, this);
	tracker.removeEventListener(events.BreakpointRemoved, this._removeEventListeners, this);
    },
    
    __proto__: WebInspector.TimelapseInputDataProvider.prototype
};