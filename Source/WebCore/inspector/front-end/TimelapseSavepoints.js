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
        var desiredPosition = {
            markIndex: markIndex,
            hitIndex: hitIndex
        };
        var index = binarySearch(desiredPosition, this._savepoints, this._positionComparator);
        return (index >= 0) ? this._savepoints[index] : false;
    },

    addSavepoint: function(savepoint)
    {
        console.assert(savepoint && savepoint instanceof WebInspector.ReplaySavepoint,
                       "Tried to add non-savepoint to SavepointList.");
        
        // nearest lesser index; we insert at this index.
        var index = binarySearch(savepoint.getPosition(), this._savepoints, this._positionComparator);

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

        var index = binarySearch(savepoint.getPosition(), this._savepoints, this._positionComparator);
        if (index < 0)
            return;
        this._savepoints.splice(index, 1);

        this.dispatchEventToListeners(WebInspector.SavepointListProvider.Events.SavepointRemoved, savepoint);
    },

    _positionComparator: function(a, b)
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
        /*
        if (debugModel.isPaused()) {
            var rawLocation = WebInspector.debuggerModel.callFrames[0].location;
            var abstractLocation = {
                sourceURL: debugModel.scriptForId(rawLocation.scriptId),
                lineNumber: rawLocation.lineNumber,
                columnNumber: rawLocation.lineNumber,
            };
            var url = uiLocation.url();
            var uiLineNumber = uiLocation.lineNumber;
            var name = url + ":" + uiLineNumber;
        }
        */
        var markIndex = this._model.currentMarkIndex;
        if (this._model.inputPaused)
            return new WebInspector.InputSavepoint(markIndex);

        var hitIndex = this._model.breakpointTracker.breakpointHitIndex;
        if (!this._model.debuggerPaused || hitIndex === -1)
            return;

        var debuggerWalk = this._debuggerWalkRecord.slice();
        if (debuggerWalk.length === 0)
            return new WebInspector.BreakpointSavepoint(markIndex, hitIndex);
        
        return new WebInspector.DebuggerWalkSavepoint(markIndex, hitIndex, debuggerWalk);
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

WebInspector.ReplaySavepoint = function(type) {
    this._type = type;
};

WebInspector.ReplaySavepoint.SavepointTypes = {
    InputPaused: "InputPaused",
    Breakpoint: "Breakpoint",
    DebuggerWalk: "DebuggerWalk"
};


WebInspector.ReplaySavepoint.prototype = {
    get type()
    {
        return this._type;
    },

    getPosition: function()
    {
        return { markIndex: -1, hitIndex: -1 };
    },

    displayName: function()
    {
    },
    
    createRestoreTask: function(allowBreakpoints)
    {
    },
};

WebInspector.InputSavepoint = function(markIndex)
{
    WebInspector.ReplaySavepoint.call(this, WebInspector.ReplaySavepoint.SavepointTypes.InputPaused);
    this._markIndex = markIndex;
};

WebInspector.InputSavepoint.prototype = {

    displayName: function()
    {
        return "Input #" + this._markIndex;
    },
    
    getPosition: function()
    {
        return { markIndex: this._markIndex, hitIndex: -1 };
    },
    
    createRestoreTask: function(allowBreakpoints)
    {
        // FIXME: signals completion on replay start, not finish.
        return WebInspector.timelapseModel.startReplayUpToMarkIndexTask(this._markIndex, !!allowBreakpoints);
    },
    
    __proto__: WebInspector.ReplaySavepoint.prototype,
};

WebInspector.BreakpointSavepoint = function(markIndex, hitIndex)
{
    WebInspector.ReplaySavepoint.call(this, WebInspector.ReplaySavepoint.SavepointTypes.Breakpoint);
    this._markIndex = markIndex;
    this._hitIndex = hitIndex;
};

WebInspector.BreakpointSavepoint.prototype = {

    displayName: function()
    {
        return "BreakpointSavepoint.displayName()"
    },

    getPosition: function()
    {
        return { markIndex: this._markIndex, hitIndex: this._hitIndex };
    },
    
    createRestoreTask: function(allowBreakpoints)
    {
        // FIXME: signals completion on replay start, not finish.
        return WebInspector.timelapseModel.replayToBreakpointHitTask(this._markIndex, this._hitIndex, !!allowBreakpoints);
    },
    
    __proto__: WebInspector.ReplaySavepoint.prototype,
};

/**
 * @constructor
 */
WebInspector.DebuggerWalkSavepoint = function(markIndex, hitIndex, debuggerWalk)
{
    WebInspector.ReplaySavepoint.call(this, WebInspector.ReplaySavepoint.SavepointTypes.DebuggerWalk);
    this._markIndex = markIndex;
    this._hitIndex = hitIndex;
    this._debuggerWalk = debuggerWalk;
};

WebInspector.DebuggerWalkSavepoint.prototype = {

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

    displayName: function()
    {
        return "DebuggerWalkSavepoint.displayName()"
    },

    getPosition: function()
    {
        return { markIndex: this._markIndex, hitIndex: this._hitIndex };
    },

    createRestoreTask: function(allowBreakpoints)
    {
        return this._replayDebuggerWalkTask(this._markIndex,
                                            this._hitIndex,
                                            this._debuggerWalk,
                                            !!allowBreakpoints);
    },
    
    __proto__: WebInspector.ReplaySavepoint.prototype,
};