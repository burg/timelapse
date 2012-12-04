/**
 * @constructor
 */
WebInspector.TimelapseBreakpointTracker = function()
{
    this._model = WebInspector.timelapseModel;

    this._exploredIntervals = new WebInspector.TimelapseIntervalManager();

    var eventNames = WebInspector.TimelapseModel.EventTypes;
    this._model.addEventListener(eventNames.RecordingWillStart, this._reset, this);
    this._model.addEventListener(eventNames.PlaybackDidStart, this._playbackDidStart, this);
    this._model.addEventListener(eventNames.PlaybackStopped, this._endPendingInterval, this);
    this._model.addEventListener(eventNames.BreakpointHit, this._breakpointHit, this);
    this._model.addEventListener(eventNames.BreakpointPaused, this._endPendingInterval, this);

    WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointAdded, this._breakpointUpdated, this);
    WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointAddedToStorage, this._breakpointAddedToStorage, this);
    WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointRemovedFromStorage, this._breakpointRemovedFromStorage, this);

    this._reset();
};

WebInspector.TimelapseBreakpointTracker.Events = {
    BreakpointHit: "BreakpointHit",
    BreakpointAdded: "BreakpointAdded",
    BreakpointRemoved: "BreakpointRemoved",
};

WebInspector.TimelapseBreakpointTracker.prototype = {

    // Public query API
    get records()
    {
	return this._records;
    },

    get currentBreakpoint()
    {
	return this._currentBreakpoint;
    },

    get exploredIntervals()
    {
	return this._exploredIntervals.intervals;
    },

    exploredIndex: function(markIndex)
    {
	return this._exploredIntervals.hasIntervalContaining(markIndex);
    },

    // Internal helpers
    _reset: function()
    {
	this._records = [];
	// breakpoints are stored using the debuggerID (sourceURL + ":" + lineNumber) as the key
	this._breakpoints = {};
	this._exploredIntervals.clear();

	this.dispatchEventToListeners(WebInspector.TimelapseBreakpointTracker.Reset);
    },

    _endPendingInterval: function()
    {
	if (this._exploredIntervals.intervalPending)
	    this._exploredIntervals.endInterval(this._model.currentMarkIndex, this._model.currentHitIndex+1);
    },

    // Callbacks from TimelapseModel
    _playbackDidStart: function()
    {
	this._endPendingInterval();

	var markIndex = this._model.replayStartMarkIndex;
	var hitIndex = markIndex == this._model.currentMarkIndex ? this._model.currentHitIndex : -1;
	var canHitBreakpoints = WebInspector.debuggerModel.debuggerEnabled() && WebInspector.debuggerModel.breakpointsActive();
	if (canHitBreakpoints && this._model.scanningBreakpoints)
	    this._exploredIntervals.startInterval(this._model.replayStartMarkIndex);
    },

    _breakpointHit: function(event)
    {
	var markIndex = this._model.currentMarkIndex;
	var hitIndex = this._model.currentHitIndex;
	if (this._exploredIntervals.hasIntervalContaining(markIndex, hitIndex))
	    return;

	var rawLocation = event.data.callFrames[0].location;
	var sourceURL = WebInspector.debuggerModel.scriptForId(rawLocation.scriptId).sourceURL;
	var lineNumber = rawLocation.lineNumber;
	var debuggerId = sourceURL + ":" + lineNumber;

	if (!this._breakpoints[debuggerId])
	    this._breakpoints[debuggerId] = new WebInspector.TimelapseBreakpoint(rawLocation);

	this._currentBreakpoint = this._breakpoints[debuggerId];

	var breakpoints = this._records;

	function markIndexAndRecordComparator(index, record) {
	    return index - record.mark.index;
	}

	var idx = binarySearch(markIndex, breakpoints, markIndexAndRecordComparator);

	if (idx < 0) {
	    idx = -(idx + 1);
	    var recordIndex = this._model.recordIndexFromMarkIndex(markIndex);
	    breakpoints.splice(idx, 0, {
		type: WebInspector.TimelapseAgent.RecordType.BreakpointHit,
		mark: this._model.allRecords[recordIndex].mark,
		hits: []
	    });
	}

	breakpoints[idx].hits[hitIndex] = this._breakpoints[debuggerId];

	var eventData = {
	    breakpoint: this._breakpoints[debuggerId],
	    mark: breakpoints[idx].mark,
	    type: WebInspector.TimelapseAgent.RecordType.BreakpointHit,
	    hitIndex: hitIndex
	}
	this.dispatchEventToListeners(WebInspector.TimelapseBreakpointTracker.Events.BreakpointHit, eventData);
    },

    // Callbacks from BreakpointManager
    _breakpointUpdated: function(event)
    {
	var debuggerId = event.data.breakpoint._breakpointStorageId();

	if (this._breakpoints[debuggerId]) {
	    var breakpoint = this._breakpoints[debuggerId];
	    var oldCondition = breakpoint.condition();

	    breakpoint.recomputeLink();

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
    }
};

WebInspector.TimelapseBreakpointTracker.prototype.__proto__ = WebInspector.Object.prototype;

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

    recomputeLink: function() {
	var rawLocation = WebInspector.debuggerModel.createRawLocationByURL(this._sourceURL, this._lineNumber, 0);
	var uiLocation = WebInspector.debuggerModel.rawLocationToUILocation(rawLocation);
	var breakpoint = WebInspector.breakpointManager.findBreakpoint(uiLocation.uiSourceCode, this._lineNumber);

	console.assert(breakpoint, "Breakpoint for "+this.debuggerId+" not found.");

	this._breakpoint = breakpoint;
	this._condition = this._breakpoint.condition();
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

    _linkifyLocation: function()
    {
        return WebInspector.timelapsePresentationModel.breakpointLinkifier.linkifyLocation(this._sourceURL, this._lineNumber, 0, "timelapse-breakpoint-link source-code");
    }
};

WebInspector.TimelapseBreakpoint.prototype.__proto__ = WebInspector.Object.prototype;

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

    hasIntervalContaining: function(markIndex, hitIndex)
    {
	var location = { markIndex: markIndex, hitIndex: hitIndex || 0 };
	var intervals = this.intervals;
	for (var i = 0; i < intervals.length; i++)
	    if (this._compare(intervals[i].start, location) <= 0
		&& this._compare(location, intervals[i].end) < 0)
		return true;

	return false;
    },

    startInterval: function(markIndex, hitIndex)
    {
	console.assert(!this.intervalPending, "In startInterval("+markIndex+", "+hitIndex+"): startInterval already called");
	this._pendingIntervalStart = { markIndex: markIndex, hitIndex: hitIndex };
    },

    endInterval: function(markIndex, hitIndex)
    {
	console.assert(typeof this._pendingIntervalStart === "object", "In endInterval("+markIndex+", "+hitIndex+"): corresponding startInterval never called");
	this.add(this._pendingIntervalStart, { markIndex: markIndex, hitIndex: hitIndex });
	delete this._pendingIntervalStart;
    },

    add: function(start, end)
    {
	console.assert(start <= end, "Intervals must have positive delta from start to end (was: "+start.markIndex+","+start.hitIndex+"--"+end.markIndex+","+end.hitIndex+")");

	function makeInterval(s, e) {
	    return {
		"start": s,
		"end": e
	    };
	}

	// invariant: this.intervals is disjoint and sorted by start time
	var intervals = this.intervals;

	if (this._compare(start, end) == 0)
	    return;

	/* case: first interval */
	if (intervals.length == 0) {
	    intervals.push(makeInterval(start, end));
	    return;
	}

	/* case: interval is before all others */
	if (this._compare(intervals[0].start, end) > 0) {
	    intervals.unshift(makeInterval(start, end));
	    return;
	}
	
	/* case: interval is after all others */
	if (this._compare(intervals[intervals.length-1].end, start) < 0) {
	    intervals.push(makeInterval(start, end));
	    return;
	}

	var i, beginIdx = 0, endIdx = 0;
	/* seek to where new interval fits */
	for (i = 0; i < intervals.length && this._compare(intervals[i].start, start) <= 0; i++)
	    beginIdx = i;

	/* case: new interval is enclosed by intervals[beginIdx], so don't adjust intervals  */
	if (this._compare(start, intervals[beginIdx].start) >= 0
	    && this._compare(intervals[beginIdx].end, end) >= 0)
	    return;

	var curStart, curEnd;

	/* case: new interval overlaps with intervals[beginIdx] */
	if (this._compare(intervals[beginIdx].end, start) >= 0) {
	    curStart = this._compare(start, intervals[beginIdx].start) < 0 ? start : intervals[beginIdx].start;
	    curEnd = this._compare(end, intervals[beginIdx].end) > 0 ? end : intervals[beginIdx].end;
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
	    if (this._compare(intervals[endIdx].start, curEnd) <= 0) {
		curEnd = this._compare(curEnd, intervals[endIdx].end) > 0 ? curEnd : intervals[endIdx].end;
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
    },

    // Breakpoint hit location comparator
    _compare: function(a, b)
    {
	if (a.markIndex > b.markIndex) return 1;
	if (a.markIndex < b.markIndex) return -1;
	return a.hitIndex - b.hitIndex;
    }
};


WebInspector.timelapseBreakpointTracker;
