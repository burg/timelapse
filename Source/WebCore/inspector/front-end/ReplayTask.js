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

WebInspector.ReplayTaskStep = function(name, callback, thisObj)
{
    this.name = name;
    this.callback = callback;
    this.thisObj = thisObj;
}

WebInspector.ReplayTask = function(taskName)
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
    
    chain: function(name, callback, thisObj)
    {
        console.assert(!this._isRunning, "Tried to chain new steps after a task has started running.");
        
        console.assert(typeof name === "string", "Invalid step name not a string: " +name);
        console.assert(typeof callback === "function", "Invalid step not a function: "+callback);
    
        this._log("Appending step " + this._steps.length + ": " + name);
        this._steps.push(new WebInspector.ReplayTaskStep(name, callback, thisObj));
        return this;
    },
    
    orCancel: function(callback, thisObj)
    {
        console.assert(!this._isRunning, "Tried to chain new steps after a task has started running.");
        console.assert(typeof callback === "function", "Invalid cancel not a function: "+callback);

        this._log("Setting cancellation action.");
        this._cancelStep = new WebInspector.ReplayTaskStep("cancel", callback, thisObj);
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

    __proto__: WebInspector.Object.prototype
};
