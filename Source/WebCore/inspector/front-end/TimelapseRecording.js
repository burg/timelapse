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
WebInspector.TimelapseRecording = function(model)
{
    WebInspector.Object.call(this);
    this._model = model;
    this.calculator = new WebInspector.TimelapseCalculator(this);
    this._providers = [];
    this._isCapturing = false;
    //this._records = [];

    var eventNames = WebInspector.TimelapseModel.Events;
    this._model.addEventListener(eventNames.CaptureDidStart, this._captureDidStart, this);
    this._model.addEventListener(eventNames.CaptureDidStop, this._captureDidStop, this);
    this._model.addEventListener(eventNames.BreakpointScanStarted, this._breakpointScanStarted, this);

    this.reset();
};

WebInspector.TimelapseRecording.Events = {
    ProviderAdded:  "TimelapseProviderAdded",
    RecordAdded:    "TimelapseRecordAdded",
    // TODO: the following events are details of specific data providers.
    InputSelected:  "TimelapseInputSelected",
    PreviewStarted: "TimelapsePreviewStarted",
    PreviewStopped: "TimelapsePreviewStopped",
    PreviewChanged: "TimelapsePreviewChanged",
};

WebInspector.TimelapseRecording.prototype = {
    get savepointProvider() {
	var providers = this.providersWithType(WebInspector.DataProvider.Types.ReplaySavepoint);
	console.assert(providers.length == 1, "Expected one savepoint provider, but found "+providers.length);
	return (providers.length) ? providers.pop() : false;
    },

    // TODO: remove; recording should not be reused across captures
    reset: function() 
    {
    this._records = [];
	this.calculator.reset();

	var inputProviders = this.providersWithType(WebInspector.DataProvider.Types.TimelapseInput);
	for (var i = 0; i < inputProviders.length; i++)
	    this.removeProvider(inputProviders[i]);

	var breakpointProviders = this.providersWithType(WebInspector.DataProvider.Types.BreakpointHits);
	for (var i = 0; i < breakpointProviders.length; i++)
	    this.removeProvider(breakpointProviders[i]);

	var savepointProviders = this.providersWithType(WebInspector.DataProvider.Types.ReplaySavepoint);
	for (var i = 0; i < savepointProviders.length; i++)
	    this.removeProvider(savepointProviders[i]);
    },

    // Private API (callbacks)
    _captureDidStart: function()
    {
	this.reset();
    this._isCapturing = true;

	var providerTypes = WebInspector.DataProvider.Types;
	this.addProvider(new WebInspector.TimelapseInputDataProvider(
                 this,
			     "userinput",
			     WebInspector.UIString("User"),
			     WebInspector.Color.fromRGB(20,170,70)
			));
	this.addProvider(new WebInspector.TimelapseInputDataProvider(
                 this,
			     "network",
			     WebInspector.UIString("Network"),
			     WebInspector.Color.fromRGB(200,150,0)
			));
	this.addProvider(new WebInspector.TimelapseInputDataProvider(
                 this,
			     "timer",
			     WebInspector.UIString("Timer"),
			     WebInspector.Color.fromRGB(200,30,30)
			));
    },

    _captureDidStop: function()
    {
    this._isCapturing = false;
	this.addProvider(new WebInspector.ReplaySavepointProvider(this));

	this.calculator.setZoomInterval(0.0, 1.0);
    },

    _breakpointScanStarted: function()
    {
	// TODO: manage multiple breakpoint providers
	var breakpointProviders = this.providersWithType(WebInspector.DataProvider.Types.BreakpointHits);
	if (breakpointProviders.length > 0)
	    return;

	var breakpointProvider = new WebInspector.TimelapseBreakpointDataProvider(
        this,
	    WebInspector.UIString("Breakpoint"),
	    WebInspector.Color.fromRGB(10,55,230)
	);

	breakpointProvider.addEventListener(WebInspector.DataProvider.Events.Invalidated,
					    this.removeProvider.bind(this, breakpointProvider));

	this.addProvider(breakpointProvider);
    },

    // Public API
    addProvider: function(provider) {
	if (this._providers.indexOf(provider) != -1)
	    return;

	this._providers.push(provider);
    	this.dispatchEventToListeners(WebInspector.TimelapseRecording.Events.ProviderAdded, provider);
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

    get isCapturing()
    {
        return this._isCapturing;
    },

    get allRecords()
    {
    return this._records;
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
    	this.dispatchEventToListeners(WebInspector.TimelapseRecording.Events.PreviewStarted);
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    stopPreviewing: function()
    {
	delete this._previewModeActive;
	delete this._previewedRecord;
    	this.dispatchEventToListeners(WebInspector.TimelapseRecording.Events.PreviewStopped);
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    previewRecord: function(record)
    {
	console.assert(!!record, "Cannot preview undefined record");

	this._previewedRecord = record;
	this.dispatchEventToListeners(WebInspector.TimelapseRecording.Events.PreviewChanged, record);
    },

    // TODO: Selection state should live on the specific DataProvider which is being selected.
    selectInput: function(markIndex)
    {
	this._selectedInputIndex = markIndex;
	this.dispatchEventToListeners(WebInspector.TimelapseRecording.Events.InputSelected, markIndex);
    },

    scanBreakpointsInZoomRegion: function()
    {
    	WebInspector.debuggerModel.enableDebugger();

	var startIndex = this.calculator.computeMarkIndexFromPercentage(this.calculator.zoomLeft);
	var endIndex = this.calculator.computeMarkIndexFromPercentage(this.calculator.zoomRight);

	this._model.scanBreakpointsInRegion(startIndex, endIndex);
    },
    
    // Called by WebInspector.TimelapseDispatcher
    _capturedAction: function(record)
    {
    console.assert(this.isCapturing);
	this._records.push(record);
  	this.calculator.updateBoundaries(record);
	this.dispatchEventToListeners(WebInspector.TimelapseRecording.Events.RecordAdded, record);
    },
};

WebInspector.TimelapseRecording.prototype.__proto__ = WebInspector.Object.prototype;

/**
 * @constructor
 */
WebInspector.ReplaySavepointProvider = function(recording)
{
    WebInspector.DataProvider.call(this, recording, "savepoints",
				   WebInspector.DataProvider.Types.ReplaySavepoint);

    this._model = WebInspector.timelapseModel;
    this._savepoints = [];

    var modelEvents = WebInspector.TimelapseModel.Events;
    this._model.addEventListener(modelEvents.BreakpointHit, this._breakpointHit, this);

    var debuggerModel = WebInspector.debuggerModel;
    var debugEvents = WebInspector.DebuggerModel.Events;
    debuggerModel.addEventListener(debugEvents.DebuggerStepOver, this._debuggerStepOver, this);
    debuggerModel.addEventListener(debugEvents.DebuggerStepInto, this._debuggerStepInto, this);
    debuggerModel.addEventListener(debugEvents.DebuggerStepOut, this._debuggerStepOut, this);
};

WebInspector.ReplaySavepointProvider.Events = {
    SavepointSet: "SavepointSet",
    SavepointRemoved: "SavepointRemoved"
};

WebInspector.ReplaySavepointProvider.prototype = {
    get savepoints()
    {
	return this._savepoints;
    },

    get displayName()
    {
	return "Savepoints";
    },

    get counterNoun()
    {
	return "Savepoints";
    },

    savepointAtMarkIndex: function(markIndex) {
	var index = binarySearch(markIndex, this._savepoints, function(a, b) { return a - b.markIndex; });
	return (index >= 0);
    },

    savepointAtLocation: function(markIndex, hitIndex) {
	var location = {
	    markIndex: markIndex,
	    hitIndex: hitIndex
	}
	var index = binarySearch(location, this._savepoints, this._locationComparator);
	return (index >= 0) ? this._savepoints[index] : false;
    },

    hasSavepoint: function()
    {
	return !!this._savepoints.length;
    },

    setSavepoint: function()
    {
	var markIndex = this._model.currentMarkIndex;
	var hitIndex = this._model.currentHitIndex;
	var debuggerWalk = this._debuggerWalkRecord.slice();

	var savepoint = new WebInspector.ReplaySavepoint(markIndex, hitIndex, debuggerWalk);
	var index = binarySearch(savepoint, this._savepoints, this._locationComparator);

	// For now, only maintain one savepoint per breakpoint hit.
	if (index >= 0)
	    this.removeSavepoint(markIndex, hitIndex);
	else
	    index = -(index + 1);

	this._savepoints.splice(index, 0, savepoint);

	this.dispatchEventToListeners(WebInspector.ReplaySavepointProvider.Events.SavepointSet, savepoint.location);
    },

    replayToSavepoint: function()
    {
	// current playback point
	var location = {
	    markIndex: this._model.currentMarkIndex,
	    hitIndex: this._model.currentHitIndex
	}

	var index = binarySearch(location, this._savepoints, this._locationComparator);
	if (index < 0)
	    index = -(index + 1);

	// Since there is currently no easy way to compare debugger walks, the only case where we
	// can replay to an savepoint on the current hit index is if the recorded walk is length 0 and
	// the savepoint's walk is length > 0.
	var savepointAtLocation = this._savepoints[index] && this._locationComparator(location, this._savepoints[index]) == 0;
	var noWalkRecord = this._debuggerWalkRecord.length == 0;
	var nonzeroSavepointWalk = this._savepoints[index] && this._savepoints[index].debuggerWalk.length > 0;

	if (index >= this._savepoints.length)
	    this._savepoints[0].replayToSavepoint();
	else if (!savepointAtLocation || (noWalkRecord && nonzeroSavepointWalk))
	    this._savepoints[index].replayToSavepoint();
	else if (index == this._savepoints.length - 1)
	    this._savepoints[0].replayToSavepoint();
	else
	    this._savepoints[index+1].replayToSavepoint();
    },

    removeSavepoint: function(markIndex, hitIndex)
    {
	var location = {
	    markIndex: markIndex || this._model.currentMarkIndex,
	    hitIndex: hitIndex || this._model.currentHitIndex
	}

	var index = binarySearch(location, this._savepoints, this._locationComparator);
	if (index < 0)
	    return;

	this._savepoints.splice(index, 1);

	this.dispatchEventToListeners(WebInspector.ReplaySavepointProvider.Events.SavepointRemoved, location);
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
	// TODO(Issue #124): this code is never getting called, so later attempts
	// to read debuggerWalkRecord will fail.
	this._debuggerWalkRecord = [];
    },

    _debuggerStepOver: function()
    {
	if (!this._model.isReplaying)
	    return;

	var stepOver = WebInspector.debuggerModel.stepOver.bind(WebInspector.debuggerModel);
	this._debuggerWalkRecord.push(stepOver);
    },

    _debuggerStepInto: function()
    {
	if (!this._model.isReplaying)
	    return;

	var stepInto = WebInspector.debuggerModel.stepInto.bind(WebInspector.debuggerModel);
	this._debuggerWalkRecord.push(stepInto);
    },

    _debuggerStepOut: function()
    {
	if (!this._model.isReplaying)
	    return;

	var stepOut = WebInspector.debuggerModel.stepOut.bind(WebInspector.debuggerModel);
	this._debuggerWalkRecord.push(stepOut);
    }
};

WebInspector.ReplaySavepointProvider.prototype.__proto__ = WebInspector.DataProvider.prototype;

/**
 * @constructor
 */
WebInspector.ReplaySavepoint = function(markIndex, hitIndex, debuggerWalk)
{
    this._markIndex = markIndex;
    this._hitIndex = hitIndex;
    this._debuggerWalk = debuggerWalk;
};

WebInspector.ReplaySavepoint.prototype = {
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

    replayToSavepoint: function()
    {
	WebInspector.timelapseModel.replayDebuggerWalk(this._markIndex, this._hitIndex, this._debuggerWalk);
    }
};

/**
 * @constructor
 */
WebInspector.TimelapseCalculator = function(recording)
{
    this._recording = recording;
    WebInspector.Object.call(this);
};

WebInspector.TimelapseCalculator.Events = {
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
	this.dispatchEventToListeners(WebInspector.TimelapseCalculator.Events.ZoomChanged);
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

	var records = this._recording.allRecords;
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

WebInspector.TimelapseRecording;
