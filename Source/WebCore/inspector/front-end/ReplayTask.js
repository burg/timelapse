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


WebInspector.ReplayTask = function(taskName)
{
    this._taskName = taskName;
    // these two arrays use the same indices.
    this._steps = [];
    this._stepNames = [];
    
    this._isRunning = false;
    // Run token exists to guard against the case when the same task is
    // enqueued several times, and the first one is cancelled but has a pending
    // callback. If we couldn't distinguish the two runs, then the cancelled
    // task's callback may mistakenly signal that the second task's step finished.
    this._runToken = 0;
}

// adjust this to debug task actions
WebInspector.ReplayTask.DebugLogging = false;

WebInspector.ReplayTask.prototype = {
    // Public API
    // All non-getter methods are designed for this-chaining.
    run: function(cb)
    {
        this._finishCallback = cb;
        this._isRunning = true;
        this._stepIndex = 0;
        this._runToken++;
        this._log("Running task.");
        this._step(this._runToken);
        return this;
    },
    
    chain: function(stepName, stepFn)
    {
        console.assert(!this._isRunning, "Tried to chain new steps after a task has started running.");
        
        console.assert(typeof stepName === "string", "Invalid step name not a string: " +stepName);
        console.assert(typeof stepFn === "function", "Invalid step not a function: "+stepFn);

        this._log("Appending step " + this._steps.length + ": " + stepName);
        this._stepNames.push(stepName);
        this._steps.push(stepFn);
        return this;
    },
    
    orCancel: function(cancelFn)
    {
        console.assert(!this._isRunning, "Tried to chain new steps after a task has started running.");
        console.assert(typeof cancelFn === "function", "Invalid cancel not a function: "+cancelFn);

        this._log("Setting cancellation action.");
        this._cancelFn = cancelFn;
        return this;
    },
    
    cancel: function()
    {
        this._log("Cancelling task.");
    
        if (typeof this._cancelFn === "function")
            this._cancelFn(this._finish.bind(this, this._runToken));
        else
            this._finish(this._runToken);
        
        return this;
    },
    
    // Private API
    _log: function(message)
    {
        if (!WebInspector.ReplayTask.DebugLogging)
            return;
        
        console.assert(!!message, "Must specify a message to log in ReplayTask.");
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

        console.assert(this._stepIndex < this._steps.length && this._stepIndex >= 0,
                       "Task step index out of bounds: " + this._stepIndex);

        var index = this._stepIndex++;
        var step = this._steps[index];
        this._log("Running step " + index + ": " + this._stepNames[index]);
        step.call(this, this._step.bind(this, runToken));
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

    __proto__: WebInspector.Object.prototype
};
