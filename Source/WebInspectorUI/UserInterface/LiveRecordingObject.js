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

WebInspector.LiveRecordingObject = function()
{
    WebInspector.RecordingObject.call(this);
    this.uid = -1;
    this._isCapturing = false;
};

WebInspector.LiveRecordingObject.prototype = {
    constructor: WebInspector.LiveRecordingObject,
    __proto__: WebInspector.RecordingObject.prototype,

    // Public

    displayName: function()
    {
        return WebInspector.UIString("(Live Recording)");
    },

    dataLoaded: function()
    {
        return true;
    },

    get isCapturing()
    {
        return this._isCapturing;
    },

    addInput: function(input)
    {
        var inputProvider = this.firstProviderWithConstructor(WebInspector.LiveInputDataProvider);
        inputProvider.addInput(new WebInspector.LiveInputObject(input));
    },

    // Protected

    registerListeners: function(group) {
        group.register(WebInspector.replayManager, WebInspector.ReplayManager.Event.CaptureStarted, this._captureStarted);
        group.register(WebInspector.replayManager, WebInspector.ReplayManager.Event.CaptureStopped, this._captureStopped);

        WebInspector.RecordingObject.prototype.registerListeners.call(this, group);
    },

    // Private

    _captureStarted: function()
    {
        this._isCapturing = true;
        this.addProvider(new WebInspector.LiveInputDataProvider());
    },

    _captureStopped: function()
    {
        this._isCapturing = false;
    },
};

WebInspector.LiveInputObject = function(rawInput)
{
    this.timestamp = rawInput.data.markTimestamp;
}
