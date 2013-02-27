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

/**
 * @constructor
 */
WebInspector.ReplaySavepointProvider = function(recording)
{
    WebInspector.DataProvider.call(this, recording, "savepoints",
				                   WebInspector.DataProvider.Types.ReplaySavepoint);

    this._model = WebInspector.timelapseModel;
    this._savepoints = [];

	var tracker = this._model.breakpointTracker;
	var trackerEvents = WebInspector.TimelapseBreakpointTracker.Events;
    tracker.addEventListener(trackerEvents.BreakpointHit, this._breakpointHit, this);

    var debuggerModel = WebInspector.debuggerModel;
    var debugEvents = WebInspector.DebuggerModel.Events;
    debuggerModel.addEventListener(debugEvents.DebuggerStepOver, this._debuggerStepOver, this);
    debuggerModel.addEventListener(debugEvents.DebuggerStepInto, this._debuggerStepInto, this);
    debuggerModel.addEventListener(debugEvents.DebuggerStepOut,  this._debuggerStepOut,  this);
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
	var hitIndex = this._model.breakpointTracker.breakpointHitIndex;
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
	    hitIndex: this._model.breakpointTracker.breakpointHitIndex
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
	    hitIndex: hitIndex || this._model.breakpointTracker.breakpointHitIndex
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
    },
    
    __proto__: WebInspector.DataProvider.prototype
};

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

    _replayDebuggerWalk: function(markIndex, hitIndex, debuggerWalk, allowBreakpoints)
    {
        var model = WebInspector.timelapseModel;
        if (!model.canReplay)
            return;
        
        var speeds = WebInspector.TimelapseModel.ReplaySpeed;

        var task = new WebInspector.ReplayTask("ReplayDebuggerWalk");
        task.chain("ReplayToWalkStartingBreakpoint", function(cb) {
            var task = model.replayToBreakpointHitTask(markIndex, hitIndex, allowBreakpoints, speeds.Seeking);
            task.run(cb);
        });
        
        for (var i = 0; i < debuggerWalk.length; i++) {
            task.chain("TakeDebuggerWalkStep", function(cb, event) {
                // the first callback will come from previous step, not DebuggerWaiting
                if (typeof event !== "undefined")
                    event.preventDefault(); // stop 

                model.onceEventListener(WebInspector.TimelapseModel.Events.DebuggerWaiting, cb, task);
                debuggerWalk.shift()();
            });
        }
        task.chain("UpdateStatus", function(cb) {
            model.changeStatus("At savepoint.");
            cb();
        });
        
        model.scheduler.cancelAllTasks().enqueue(task);
    },

    replayToSavepoint: function(allowBreakpoints)
    {
        if (typeof allowBreakpoints === "undefined")
            allowBreakpoints = false;
        
        this._replayDebuggerWalk(this._markIndex, this._hitIndex, this._debuggerWalk, allowBreakpoints);
    }
};