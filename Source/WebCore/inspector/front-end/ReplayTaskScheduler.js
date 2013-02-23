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

WebInspector.ReplayTaskScheduler = function()
{
    this._tasks = [];
    this._isRunning = false;
}

WebInspector.ReplayTaskScheduler.prototype = {
    // Public API
    // All non-getter methods are designed for this-chaining.
    enqueue: function(task)
    {
        console.assert(task instanceof WebInspector.ReplayTask,
                       "Tried to schedule object which is not a task.");
        
        console.log("Enqueued task.");
        this._tasks.push(task);
        this._maybeDequeue();
        return this;
    },
    
    run: function()
    {
        console.log("Started scheduler.");
        this._isRunning = true;
        this._maybeDequeue();
        return this;
    },

    get isRunning()
    {
        return this._isRunning;
    },
    
    get isTaskExecuting()
    {
        return !!this._executingTask;
    },
    
    get hasPendingTasks()
    {
        return this._tasks.length > 0 || this.isTaskExecuting;
    },

    cancelExecutingTask: function()
    {
        if (this.isTaskExecuting) {
            this._log("Cancelling the executing task.");
            this._executingTask.cancel();
        }
        
        return this;
    },
    
    cancelAllTasks: function()
    {
        this._log("Clearing " + this._tasks.length + " tasks from the scheduler.");
        this._tasks = [];
    
        return this.cancelExecutingTask();
    },

    // Private API
    _log: function(message)
    {
        if (!WebInspector.ReplayTask.DebugLogging)
            return;
        
        console.assert(!!message, "Must specify a message to log in ReplayTaskScheduler.");
        console.log("ReplayTaskScheduler: " + message);
    },
    
    _taskDidRun: function(task) {
        // unlike ReplayTask, we don't worry about the same task being cancelled
        // and run at the same time. cancellation does not immediately run next task.
        if (!this._executingTask) {
            console.log("Ignoring task finished callback because no task is executing.");
            return;
        
        }
        if (task !== this._executingTask) {
            console.log("Ignoring task finished callback because a different task is executing.");
            return;
        }

        console.log("Heard that executing task finished.");
        delete this._executingTask;
        this._maybeDequeue();
    },
  
    _maybeDequeue: function()
    {
        if (this.isTaskExecuting || !this.hasPendingTasks) {
            console.log("Task executing or nothing to execute; scheduler going to sleep.");
            return;
        }
        
        var task = this._executingTask = this._tasks.shift();
        console.log("Running task.");
        task.run(this._taskDidRun.bind(this, task));
    },

    __proto__: WebInspector.Object.prototype
};
