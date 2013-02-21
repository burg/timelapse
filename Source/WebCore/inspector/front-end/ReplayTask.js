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


WebInspector.ReplayTask = function()
{
    this._steps = [];
    this._isRunning = false;
    this._stepIndex = 0;
}

WebInspector.ReplayTask.prototype = {
    // Public API
    run: function(cb)
    {
        this._finishCallback = cb;
        this._step();
    },
    
    chain: function(stepFn)
    {
        console.assert(!this._isRunning, "Tried to chain new steps after a task has started running.");
        
        this._steps.push(stepFn);
        return this;
    },
    
    // Private API

    _step: function(shouldCancel)
    {
        // stop running
        if (this._stepIndex == this._steps.length || shouldCancel)
            return this._finish();

        console.assert(this._stepIndex < this._steps.length && this._stepIndex >= 0,
                       "Task step index out of bounds: " + this._stepIndex);

        var step = this._steps[this._stepIndex++];
        step.call(this, this._step.bind(this));
    },
    
    _finish: function()
    {
        this._stepIndex = 0;
        this._isRunning = false;
        
        var cb = this._finishCallback;
        if (typeof cb === "function")
            cb();
    },

    __proto__: WebInspector.Object.prototype
};
