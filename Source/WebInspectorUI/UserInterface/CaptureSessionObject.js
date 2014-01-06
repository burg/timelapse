/*
 * Copyright (C) 2013 University of Washington. All rights reserved.
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

WebInspector.CaptureSessionObject = function(uid)
{
    this.uid = uid;

    this._recordings = [];
    this._dataLoaded = false;
}

WebInspector.CaptureSessionObject.prototype = {
    constructor: WebInspector.CaptureSessionObject,
    __proto__: WebInspector.Object.prototype,

    // Public

    get recordings() {
        return this._recordings.slice();
    },

    append: function(recording)
    {
        this._recordings.push(recording);
    },

    insert: function(position, recording)
    {
        this._recordings.splice(position, 0, recording);
    },

    remove: function(position)
    {
        this._recordings.splice(position, 1);
    },

    loadData: function(data)
    {
        console.assert(this.uid === data.sessionId, "CaptureSessionObject ID doesn't match serialized session ID.", data);

        this._dateCreated = new Date(data.dateCreated);
        this._dataLoaded = true;

        console.assert(data.recordings, "Missing recordings list in serialized recording.", data);
        this._recordings = data.recordings;
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
        return "CaptureSession-" + this.dateCreated.toISO8601Compact() + ".webreplay";
    },

    displayName: function()
    {
        return WebInspector.UIString("Capture Session %d", this.uid) || WebInspector.UIString("(uninitialized)");
    }
};
