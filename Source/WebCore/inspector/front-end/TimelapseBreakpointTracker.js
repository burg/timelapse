/*
 *  Copyright (C) 2013, Brian Burg, Jake Bailey.
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

/**
 * @constructor
 */
WebInspector.TimelapseBreakpointTracker = function(model)
{
    WebInspector.Object.call(this);
    
    this._model = model;
    this._exploredIntervals = new WebInspector.TimelapseIntervalManager();

    var manager = WebInspector.breakpointManager;
    var managerEvents = WebInspector.BreakpointManager.Events;
    this._callbacks = new WebInspector.EventListenerGroup(this, "Static TimelapseBreakpointTracker listeners");
    this._callbacks.register(manager, managerEvents.BreakpointAdded, this._breakpointUpdated);
    this._callbacks.register(manager, managerEvents.BreakpointAddedToStorage,     this._breakpointAddedToStorage);
    this._callbacks.register(manager, managerEvents.BreakpointRemovedFromStorage, this._breakpointRemovedFromStorage);
    this._callbacks.install();

    var replayCallbacks = this._replayCallbacks
                        = new WebInspector.EventListenerGroup(this, "TimelapseBreakpointTracker listeners per TimelapseRecording");
    var replayEvents = WebInspector.TimelapseModel.Events;
    replayCallbacks.register(this._model, replayEvents.PlaybackWillStart, this._playbackWillStart);
    replayCallbacks.register(this._model, replayEvents.PlaybackStopped,   this._endPendingInterval);
    replayCallbacks.register(this._model, replayEvents.InputHit,          this._inputHit);
    replayCallbacks.register(this._model, replayEvents.InputPaused,       this._endPendingInterval);

    var debugEvents = WebInspector.DebuggerModel.Events;
    replayCallbacks.register(WebInspector.debuggerModel, debugEvents.DebuggerPaused, this._debuggerPaused);
    
    // always reset/init data structures, since we track breakpoints even outside of capturing or replaying.
    this._recordingUnloaded();
};

WebInspector.TimelapseBreakpointTracker.Events = {
    BreakpointHit: "BreakpointHit",
    BreakpointAdded: "BreakpointAdded",
    BreakpointRemoved: "BreakpointRemoved",
    IntervalExplored: "IntervalExplored"
};

WebInspector.TimelapseBreakpointTracker.prototype = {

    // Public query API
    get records()
    {
	return this._records;
    },

    get currentBreakpoint()
    {
    return (this._currentBreakpoint && this._debuggerWaitIndex == 1) ? this.precedingBreakpoint
                                                                     : false;
    },

    get precedingBreakpoint()
    {
	return this._currentBreakpoint;
    },

    get breakpointHitIndex()
    {
    return this._breakpointHitIndex;
    },

    get exploredIntervals()
    {
	return this._exploredIntervals.intervals;
    },

    exploredIndex: function(markIndex)
    {
	return this._exploredIntervals.hasIntervalContaining(markIndex);
    },
    
    _recordingLoaded: function()
    {
        this._model.onceEventListener(WebInspector.TimelapseModel.Events.RecordingUnloaded, this._recordingUnloaded, this);
        this._replayCallbacks.install();
        this._resetState();
    },

    _recordingUnloaded: function(event)
    {
        this._model.onceEventListener(WebInspector.TimelapseModel.Events.RecordingLoaded, this._recordingLoaded, this);
        // if this is a synthetic callback from the constructor, don't try to uninstall callbacks.
        if (typeof event !== "undefined")
            this._replayCallbacks.uninstall();
        this._resetState();
    },

    _resetState: function()
    {
        this._records = [];
        // breakpoints are stored using the debuggerID (sourceURL + ":" + lineNumber) as the key
        this._breakpoints = {};
        this._breakpointHitIndex = -1;
        this._debuggerWaitIndex = -1;
        this._exploredIntervals.clear();

        this.dispatchEventToListeners(WebInspector.TimelapseBreakpointTracker.Reset);
    },

    _endPendingInterval: function()
    {
	if (this._exploredIntervals.intervalPending) {
	    this._exploredIntervals.endInterval(this._model.currentMarkIndex);
	    this.dispatchEventToListeners(WebInspector.TimelapseBreakpointTracker.Events.IntervalExplored);
	}
    },

    // Callbacks from TimelapseModel
    _playbackWillStart: function()
    {
        this._endPendingInterval();

        var markIndex = this._model.replayStartMarkIndex;
        var canHitBreakpoints = WebInspector.debuggerModel.debuggerEnabled() && WebInspector.debuggerModel.breakpointsActive();
        if (canHitBreakpoints)
            this._exploredIntervals.startInterval(markIndex);
    },

    _inputHit: function(event)
    {
        this._breakpointHitIndex = -1;
        this._debuggerWaitIndex = -1;
    },

    // Callbacks from DebuggerModel
    _debuggerPaused: function(event)
    {
        // ???: is this actually needed?
        this._endPendingInterval();
    
        var rawLocation = event.data.callFrames[0].location;
        var uiLocation = WebInspector.debuggerModel.rawLocationToUILocation(rawLocation);
        var lineNumber = rawLocation.lineNumber;
        var breakpoint = WebInspector.breakpointManager.findBreakpoint(uiLocation.uiSourceCode, lineNumber);
        
        if (!breakpoint) {
            this._debuggerWaitIndex++;
            return;
        }

        this._debuggerWaitIndex = -1;
        var markIndex = this._model.currentMarkIndex;
        var hitIndex = ++this._breakpointHitIndex;
        var sourceURL = WebInspector.debuggerModel.scriptForId(rawLocation.scriptId).sourceURL;
        var debuggerId = sourceURL + ":" + lineNumber;
    
        // lazily add unknown breakpoints as we hit them
        if (!this._breakpoints[debuggerId])
            this._breakpoints[debuggerId] = new WebInspector.TimelapseBreakpoint(rawLocation);

        this._currentBreakpoint = this._breakpoints[debuggerId];
        var hitRecords = this._records;
        var idx = binarySearch(markIndex, hitRecords, function (index, record) {
            return index - record.mark.index;
        });

        if (idx < 0) {
            idx = -(idx + 1);
            var actionIndex = this._model.loadedRecording.actionIndexFromMarkIndex(markIndex);
            hitRecords.splice(idx, 0, {
            type: WebInspector.TimelapseAgent.RecordType.BreakpointHit,
            mark: this._model.loadedRecording.actions[actionIndex].mark,
            hits: []
            });
        }

        hitRecords[idx].hits[hitIndex] = this._breakpoints[debuggerId];

        this.dispatchEventToListeners(WebInspector.TimelapseBreakpointTracker.Events.BreakpointHit, {
            breakpoint: this._breakpoints[debuggerId],
            mark:       hitRecords[idx].mark,
            type:       WebInspector.TimelapseAgent.RecordType.BreakpointHit,
            hitIndex:   this.breakpointHitIndex
        });
    },


    // Callbacks from BreakpointManager
    _breakpointUpdated: function(event)
    {
    var breakpoint = event.data.breakpoint;
    var uiLocation = event.data.uiLocation;
	var debuggerId = breakpoint._breakpointStorageId();

	if (this._breakpoints[debuggerId]) {
	    var oldBreakpoint = this._breakpoints[debuggerId];
	    var oldCondition = oldBreakpoint.condition();

        oldBreakpoint.updateLink(breakpoint, uiLocation);

	    if (oldCondition != breakpoint.condition()) {
		if (breakpoint.condition() != "")
		    this._breakpointRemovedFromStorage(event);
		this._exploredIntervals.clear();
	    }
	}
    },

    _breakpointAddedToStorage: function()
    {
	this._exploredIntervals.clear();
	this.dispatchEventToListeners(WebInspector.TimelapseBreakpointTracker.Events.BreakpointAdded);
    },

    _breakpointRemovedFromStorage: function(event)
    {
	var debuggerId = event.data.breakpoint._breakpointStorageId();
	var records = this._records;

	for (var i = 0; i < records.length; i++) {
	    var hits = records[i].hits;

	    for (var j = 0; j < hits.length; j++)
		if (typeof hits[j] === "object" && hits[j].debuggerId == debuggerId)
		    hits.splice(j--, 1);

	    if (hits.length == 0)
		records.splice(i--, 1);
	}

	this.dispatchEventToListeners(WebInspector.TimelapseBreakpointTracker.Events.BreakpointRemoved, this._breakpoints[debuggerId]);
	delete this._breakpoints[debuggerId];
    },
    
    __proto__: WebInspector.Object.prototype
};

/**
 * @constructor
 */
WebInspector.TimelapseBreakpoint = function(rawLocation)
{
    WebInspector.Object.call(this);

    this._sourceURL = WebInspector.debuggerModel.scriptForId(rawLocation.scriptId).sourceURL;
    this._lineNumber = rawLocation.lineNumber;

    this.recomputeLink();
};

WebInspector.TimelapseBreakpoint.prototype = {
    get breakpoint()
    {
	return this._breakpoint;
    },

    get debuggerId()
    {
	return this._sourceURL + ":" + this._lineNumber;
    },

    updateLink: function(breakpoint, uiLocation)
    {
    	console.assert(breakpoint, "Tried to update breakpoint for "+this.debuggerId+", but none provided.");

        this._breakpoint = breakpoint;
        this._condition = this._breakpoint.condition();
    },

    // Don't use this if we received a reference to the actual breakpoint.
    // Looking up breakpoints in this way is known to be flaky at times.
    recomputeLink: function()
    {
        var rawLocation = WebInspector.debuggerModel.createRawLocationByURL(this._sourceURL, this._lineNumber, 0);
        var uiLocation = WebInspector.debuggerModel.rawLocationToUILocation(rawLocation);
        var breakpoint = WebInspector.breakpointManager.findBreakpoint(uiLocation.uiSourceCode, this._lineNumber);

        this.updateLink(breakpoint, uiLocation);
    },

    contextMenu: function(event) {
	var contextMenu = new WebInspector.ContextMenu();

	contextMenu.appendItem(WebInspector.UIString("Show on Sources Panel"), this._showOnScriptsPanel.bind(this));
	if (WebInspector.debuggerModel.isPaused())
	    contextMenu.appendItem(WebInspector.UIString("Continue"), this._resumeDebugging.bind(this));
	contextMenu.appendItem(WebInspector.UIString("Remove Breakpoint"), this._removeBreakpoint.bind(this));

	contextMenu.show(event);
    },

    enabled: function()
    {
	return this.breakpoint ? this.breakpoint.enabled() : null;
    },

    condition: function()
    {
    	return this._condition;
    },

    _showOnScriptsPanel: function()
    {
        WebInspector.inspectorView.setCurrentPanel(WebInspector.panels.scripts);
	WebInspector.panels.scripts._showSourceLine(this.uiSourceCode, this._lineNumber);
    },

    _resumeDebugging: function()
    {
	DebuggerAgent.resume();
    },

    _removeBreakpoint: function()
    {
	this.breakpoint.remove();
    },

    _linkifyLocation: function(linkifier)
    {
        return linkifier.linkifyLocation(this._sourceURL, this._lineNumber, 0, "timelapse-breakpoint-link source-code");
    },
    
    __proto__: WebInspector.Object.prototype
};

/**
 * @constructor
 */
WebInspector.TimelapseIntervalManager = function()
{
    this.clear();
};

WebInspector.TimelapseIntervalManager.prototype = {
    get intervalPending()
    {
	return !(typeof this._pendingIntervalStart === "undefined");
    },

    hasIntervalContaining: function(markIndex)
    {
	var intervals = this.intervals;
	for (var i = 0; i < intervals.length; i++)
	    if (intervals[i].start <= markIndex && markIndex < intervals[i].end)
		return true;

	return false;
    },

    startInterval: function(start)
    {
	console.assert(!this.intervalPending, "In startInterval("+start+"): startInterval already called");
	this._pendingIntervalStart = start;
    },

    endInterval: function(end)
    {
	console.assert(typeof this._pendingIntervalStart === "number", "In endInterval("+end+"): corresponding startInterval never called");
	this.add(this._pendingIntervalStart, end);
	delete this._pendingIntervalStart;
    },

    add: function(start, end)
    {
	console.assert(start <= end, "Intervals must have positive delta from start to end (was: "+start+"--"+end+")");

	function makeInterval(s, e) {
	    return {
		"start": s,
		"end": e
	    };
	}

	// invariant: this.intervals is disjoint and sorted by start time
	var intervals = this.intervals;

	if (start-end == 0)
	    return;

	/* case: first interval */
	if (intervals.length == 0) {
	    intervals.push(makeInterval(start, end));
	    return;
	}

	/* case: interval is before all others */
	if (intervals[0].start > end) {
	    intervals.unshift(makeInterval(start, end));
	    return;
	}
	
	/* case: interval is after all others */
	if (intervals[intervals.length-1].end < start) {
	    intervals.push(makeInterval(start, end));
	    return;
	}

	var i, beginIdx = 0, endIdx = 0;
	/* seek to where new interval fits */
	for (i = 0; i < intervals.length && intervals[i].start <= start; i++)
	    beginIdx = i;

	/* case: new interval is enclosed by intervals[beginIdx], so don't adjust intervals  */
	if (start >= intervals[beginIdx].start && intervals[beginIdx].end >= end)
	    return;

	var curStart, curEnd;

	/* case: new interval overlaps with intervals[beginIdx] */
	if (intervals[beginIdx].end >= start) {
	    curStart = Math.min(start, intervals[beginIdx].start);
	    curEnd = Math.max(end, intervals[beginIdx].end);
	}
	/* case: new interval comes after intervals[beginIdx] but may overlap with following intervals */
	else {
	    beginIdx++;
	    curStart = start;
	    curEnd = end;
	}

	/* try to chunk forwards */
	endIdx = beginIdx;
	while (endIdx < intervals.length) {
	    if (intervals[endIdx].start <= curEnd) {
		curEnd = Math.max(curEnd, intervals[endIdx].end);
		endIdx++;
	    }
	    else
		break;
	}

	var newInterval = makeInterval(curStart, curEnd);
	intervals.splice(beginIdx, endIdx - beginIdx, newInterval);
    },

    clear: function()
    {
	if (this._pendingIntervalStart)
	    delete this._pendingIntervalStart;

	this.intervals = [];
    }
};
