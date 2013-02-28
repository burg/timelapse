/*
 *  Copyright (C) 2013, Brian Burg.
 *  Copyright (C) 2013, University of Washington. All rights reserved.
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


WebInspector.TimelapseBreakpointScanner = function(model) {
    WebInspector.TimelapseScanner.call(this, model);
};

WebInspector.TimelapseBreakpointScanner.prototype = {
    scanRegion: function(startIndex, endIndex)
    {
        var model = this._model;
        var timelapseEvents = WebInspector.TimelapseModel.Events;
        var scanner = this;
        
        var breakpointAutoResumeCallback = function(event) {
            // prevent debugger wait from propagating; resume.
            event.preventDefault();
            if (model.debuggerPaused)
                DebuggerAgent.resume();
        };
        
        var callbacks = {
            "PreScan": function(cb) {
                scanner._savedDebuggerState = WebInspector.debuggerModel.debuggerEnabled();
                
                if (!WebInspector.debuggerModel.debuggerEnabled())
                    WebInspector.debuggerModel.enableDebugger();
                
                model.addEventListener(timelapseEvents.DebuggerWaiting,
                                       breakpointAutoResumeCallback, model);
                cb();
            },
            "PostScan": function(cb) {
                var savedState = scanner._savedDebuggerState;
                delete scanner._savedDebuggerState;
                
                if (!savedState)
                    WebInspector.debuggerModel.disableDebugger();
                
                model.removeEventListener(timelapseEvents.DebuggerWaiting,
                                          breakpointAutoResumeCallback, model);
                cb();
            },
            "EnterRegion": function(cb) {
                WebInspector.debuggerModel.setBreakpointsActive(true);
                cb();
            },
            "ExitRegion": function(cb) {
                WebInspector.debuggerModel.setBreakpointsActive(false);
                cb();
            }
        };
        
        this.segmentedScanForRegion(startIndex, endIndex, callbacks);
    },

    __proto__: WebInspector.TimelapseScanner.prototype
};

WebInspector.TimelapseBreakpointDataProvider = function(recording, displayName, color)
{
    WebInspector.DataProvider.call(this, recording, "breakpoint",
                                   WebInspector.DataProvider.Types.BreakpointHits);

    var tracker = WebInspector.timelapseModel.breakpointTracker;

    this._displayName = displayName;
    this._color = color;
    this._intervals = tracker.exploredIntervals;
    this._initializeRecords();

    var events = WebInspector.TimelapseBreakpointTracker.Events;
    tracker.addEventListener(events.BreakpointHit,     this._onBreakpointHit, this);
    tracker.addEventListener(events.BreakpointAdded,   this._onBreakpointsInvalidated, this);
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
	var records = WebInspector.timelapseModel.breakpointTracker.records;
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
	var tracker = WebInspector.timelapseModel.breakpointTracker;
	var events = WebInspector.TimelapseBreakpointTracker.Events;
	tracker.removeEventListener(events.BreakpointHit, this._onBreakpointHit, this);
	tracker.removeEventListener(events.BreakpointAdded, this._removeEventListeners, this);
	tracker.removeEventListener(events.BreakpointRemoved, this._removeEventListeners, this);
    },
    
    __proto__: WebInspector.TimelapseInputDataProvider.prototype
};