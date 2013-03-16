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
WebInspector.SavepointListProvider = function(recording)
{
    WebInspector.DataProvider.call(this, recording, "savepoints",
				                   WebInspector.DataProvider.Types.SavepointList);

    this._model = WebInspector.timelapseModel;
    this._savepoints = [];
};

WebInspector.SavepointListProvider.Events = {
    SavepointAdded: "SavepointAdded",
    SavepointRemoved: "SavepointRemoved"
};

WebInspector.SavepointListProvider.prototype = {
    get savepoints()
    {
        return this._savepoints.slice();
    },

    get length()
    {
        return this._savepoints.length;
    },

    get displayName()
    {
        return "Savepoints";
    },

    get counterNoun()
    {
        return "Savepoints";
    },

    findForMarkIndex: function(markIndex) {
        var index = binarySearch(markIndex, this._savepoints, function(a, b) { return a - b.markIndex; });
        return (index >= 0) ? this._savepoints[index] : false;
    },

    findForBreakpointHit: function(markIndex, hitIndex) {
        var location = {
            markIndex: markIndex,
            hitIndex: hitIndex
        };
        var index = binarySearch(location, this._savepoints, this._locationComparator);
        return (index >= 0) ? this._savepoints[index] : false;
    },

    addSavepoint: function(savepoint)
    {
        console.assert(savepoint && savepoint instanceof WebInspector.ReplaySavepoint,
                       "Tried to add non-savepoint to SavepointList.");
        
        // nearest lesser index; we insert at this index.
        var index = binarySearch(savepoint.location, this._savepoints, this._locationComparator);

        if (index < 0)
            index = -(index + 1);
        else
            return; // don't double-add savepoints.

        this._savepoints.splice(index, 0, savepoint);
        this.dispatchEventToListeners(WebInspector.SavepointListProvider.Events.SavepointAdded, savepoint);
    },

    removeSavepoint: function(savepoint)
    {
        console.assert(savepoint && savepoint instanceof WebInspector.ReplaySavepoint,
                       "Tried to remove non-savepoint to SavepointList.");

        var index = binarySearch(savepoint.location, this._savepoints, this._locationComparator);
        if (index < 0)
            return;
        this._savepoints.splice(index, 1);

        this.dispatchEventToListeners(WebInspector.SavepointListProvider.Events.SavepointRemoved, savepoint);
    },

    _locationComparator: function(a, b)
    {
	if (a.markIndex == b.markIndex)
	    return a.hitIndex - b.hitIndex;
	else
	    return a.markIndex - b.markIndex;
    },
    
    __proto__: WebInspector.DataProvider.prototype
};


WebInspector.ReplaySavepointTracker = function(model)
{
    WebInspector.Object.call(this);
    this._model = model;
    this._debuggerWalkRecord = [];
    
	var bpTrackerEvents = WebInspector.TimelapseBreakpointTracker.Events;
    this._model.breakpointTracker.addEventListener(bpTrackerEvents.BreakpointHit, this._breakpointHit, this);

    var debuggerModel = WebInspector.debuggerModel;
    var debugEvents = WebInspector.DebuggerModel.Events;
    debuggerModel.addEventListener(debugEvents.DebuggerStepOver, this._debuggerStepOver, this);
    debuggerModel.addEventListener(debugEvents.DebuggerStepInto, this._debuggerStepInto, this);
    debuggerModel.addEventListener(debugEvents.DebuggerStepOut,  this._debuggerStepOut,  this);
}

WebInspector.ReplaySavepointTracker.prototype = {
    createSavepoint: function()
    {
        var markIndex = this._model.currentMarkIndex;
        var hitIndex = this._model.breakpointTracker.breakpointHitIndex;
        var debuggerWalk = this._debuggerWalkRecord.slice();
        return new WebInspector.ReplaySavepoint(markIndex, hitIndex, debuggerWalk);
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
    
    __proto__: WebInspector.Object.prototype
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

    _replayDebuggerWalkTask: function(markIndex, hitIndex, debuggerWalk, allowBreakpoints)
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
        
        return task;
    },

    createRestoreTask: function(allowBreakpoints)
    {
        if (typeof allowBreakpoints === "undefined")
            allowBreakpoints = false;
        
        return this._replayDebuggerWalkTask(this._markIndex, this._hitIndex, this._debuggerWalk, allowBreakpoints);
    }
};