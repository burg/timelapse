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

WebInspector.SerializedRecordingObject = function(uid)
{
    WebInspector.RecordingObject.call(this);
    this.uid = uid;
    this._dataLoaded = false;
    this._calculator = new WebInspector.RecordingCalculator(this);
}

WebInspector.SerializedRecordingObject.Queue = {
    ScriptMemoizedDataQueue: "ScriptMemoizedDataQueue",
    LoaderMemoizedDataQueue: "LoaderMemoizedDataQueue",
    EventLoopInputQueue: "EventLoopInputQueue"
};

WebInspector.SerializedRecordingObject.prototype = {
    constructor: WebInspector.SerializedRecordingObject,
    __proto__: WebInspector.RecordingObject.prototype,

    // Public

    get calculator()
    {
        return this._calculator;
    },

    loadData: function(data)
    {
        this._dateCreated = new Date(data.dateCreated);
        this._displayName = data.name;
        this._dataLoaded = true;

        var inputProvider = new WebInspector.ReplayInputDataProvider("event-loop-inputs");

        console.assert(data.queues, "Missing input queues in serialized recording.", data);
        for (var i = 0; i < data.queues.length; ++i) {
            var queue = data.queues[i];
            if (queue.type !== WebInspector.SerializedRecordingObject.Queue.EventLoopInputQueue)
                continue;

            for (var j = 0; j < queue.inputs.length; ++j)
                inputProvider.addInput(new WebInspector.SerializedInputObject(queue.inputs[j]));
        }

        this.addProvider(inputProvider);
    },

    dataLoaded: function()
    {
        return this._dataLoaded;
    },

    get dateCreated()
    {
        return this._dateCreated;
    },

    filename: function()
    {
        return "CapturedRecording-" + this.dateCreated.toISO8601Compact() + ".webreplay";
    },

    displayName: function()
    {
        return WebInspector.UIString("Captured Recording %d", this.uid) || WebInspector.UIString("(uninitialized)");
    },
};

WebInspector.SerializedInputObject = function(rawInput)
{
    this.timestamp = rawInput.data.markTimestamp;
    this.markIndex = rawInput.data.markIndex;
};

