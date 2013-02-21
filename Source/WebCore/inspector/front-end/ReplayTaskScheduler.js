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
    enqueue: function(task)
    {
        console.assert(task instanceof WebInspector.ReplayTask,
                       "Tried to schedule object which is not a task.");
        
        this._tasks.push(task);
        this._maybeDequeue();
    },
    
    run: function()
    {
        this._isRunning = true;
        this._maybeDequeue();
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

    // Private API
    _taskDidRun: function(task) {
        console.assert(this._executingTask,
                       "Task finished running but we didn't know it was executing.");
        console.assert(task === this._executingTask,
                       "Task that finished running wasn't the task we expected to finish.");
        
        delete this._executingTask;
        this._maybeDequeue();
    },
  
    _maybeDequeue: function()
    {
        if (this.isTaskExecuting | !this.hasPendingTasks)
            return;
        
        var task = this._executingTask = this._tasks.shift();
        task.run(this._taskDidRun.bind(this, task));
    },

    __proto__: WebInspector.Object.prototype
};
