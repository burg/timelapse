/*
 *  Copyright (C) 2013, University of Washington. All rights reserved.
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

WebInspector.AsyncTaskStep = function(name, callback, thisObj)
{
    this.name = name;
    this.callback = callback;
    this.thisObj = thisObj;
}

WebInspector.AsyncTask = function(taskName)
{
    this._taskName = taskName;
    this._steps = [];

    this._isRunning = false;
    // Run token exists to guard against the case when the same task is
    // enqueued several times, and the first one is cancelled but has a pending
    // callback. If we couldn't distinguish the two runs, then the cancelled
    // task's callback may mistakenly signal that the second task's step finished.
    this._runToken = 0;
}

// adjust this to debug task actions
WebInspector.AsyncTask.DebugLogging = true;

// A AsyncTask is a sequence of asynchronously-executing task steps.
// This machinery is useful when one needs to chain async round trips
// between the frontend and backend. For example, to unload a recording
// one needs to resume the debugger, pause replay, abort replay, then
// actually unload the recording. Each of these steps is asynchronous.

// Each chained step is given a continuation callback. The AsyncTask
// class strings together the previous task's continuation callback
// with the next task.

// All non-getter methods are designed for this-chaining.
// Below is a sample (fictional) example:

// new WebInspector.AsyncTask("pause recording")
//     .chain("resume debugger", function(cb) {
//         WebInspector.debuggerManger.addSingleFireEventListener("DebuggerResumed", cb);
//         WebInspector.debuggerManager.resume();
//     }, this)
//     .chain("pause replay", function(cb)) {
//         WebInspector.replayManager.addSingleFireEventListener("PlaybackPaused", cb);
//         WebInspector.replayManager.pausePlayback();
//     }, this).orCancel(function(cb) {
//         console.log("pausing failed, better clean up.");
//         cb();
//     }).run(function(cb) {
//         console.log("finished pausing");
//     });
WebInspector.AsyncTask.prototype = {
    constructor: WebInspector.AsyncTask,
    __proto__: WebInspector.Object.prototype,

    // Public

    run: function(cb)
    {
        this._finishCallback = cb;
        this._isRunning = true;
        this._stepIndex = 0;
        this._runToken++;
        var stepNames = this._steps.map(function(step) { return step.name; });
        this._log("Running task with steps: " + stepNames.join(", "));
        this._step(this._runToken);
        return this;
    },

    chain: function(name, callback, thisObj)
    {
        console.assert(!this._isRunning, "Tried to chain new steps after a task has started running.");
        console.assert(typeof name === "string", "Invalid step name not a string: "  + name);
        console.assert(typeof callback === "function", "Invalid step not a function: " + callback);

        this._steps.push(new WebInspector.AsyncTaskStep(name, callback, thisObj));
        return this;
    },

    orCancel: function(callback, thisObj)
    {
        console.assert(!this._isRunning, "Tried to chain new steps after a task has started running.");
        console.assert(typeof callback === "function", "Invalid cancel not a function: " + callback);

        this._cancelStep = new WebInspector.AsyncTaskStep("cancel", callback, thisObj);
        return this;
    },

    cancel: function()
    {
        this._log("Cancelling task.");

        if (this._cancelStep)
            this._cancelStep.callback.call(this._cancelStep.thisObj, this._finish.bind(this, this._runToken));
        else
            this._finish(this._runToken);

        return this;
    },

    // Private

    _log: function(message)
    {
        if (!WebInspector.AsyncTask.DebugLogging)
            return;

        console.assert(!!message, "Must specify a message to log in AsyncTask.");
        console.log(this._taskName + "/" + this._runToken + ": " + message);
    },

    _step: function(runToken)
    {
        // if not running, or if a callback comes back during a different run.
        if (!this._isRunning || this._runToken !== runToken)
            return;

        // stop running.
        if (this._stepIndex == this._steps.length)
            return this._finish(runToken);

        console.assert(this._stepIndex < this._steps.length && this._stepIndex >= 0, "Task step index out of bounds: " + this._stepIndex);

        var index = this._stepIndex++;
        var step = this._steps[index];
        this._log("Running step " + index + ": " + step.name);
        var args = Array.prototype.slice.call(arguments);
        // replace callback arg token with next callback function, and pass
        // all other arguments (typically, WebInspector.Event)
        args.splice(0, 1, this._step.bind(this, runToken));

        step.callback.apply(step.thisObj, args);
    },

    _finish: function(runToken)
    {
        // if not running, or if a callback comes back during a different run.
        if (!this._isRunning || this._runToken != runToken)
            return;

        this._stepIndex = 0;
        this._isRunning = false;
        this._log("Finishing task.");

        var cb = this._finishCallback;
        if (typeof cb === "function")
            cb();
    },
};
