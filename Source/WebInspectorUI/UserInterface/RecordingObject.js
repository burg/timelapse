/*
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
 * @extends {WebInspector.Object}
 */
WebInspector.RecordingObject = function()
{
    WebInspector.Object.call(this);

    this._providers = [];

    this._callbacks = new WebInspector.EventListenerGroup(this, "RecordingObject listeners");
    this.registerListeners(this._callbacks);
    this._callbacks.install();
};

WebInspector.RecordingObject.Event = {
    ProviderAdded:  "ProviderAdded",
};

WebInspector.RecordingObject.prototype = {
    constructor: WebInspector.RecordingObject,
    __proto__: WebInspector.Object.prototype,

    // Public

    displayName: function() {},
    filename: function() {},
    dataLoaded: function() {},
    get isCapturing() { return false; },

    addProvider: function(provider)
    {
        console.assert(provider instanceof WebInspector.DataProvider,
                       "Tried to add unknown object as a data provider to a recording:", provider, this);

        if (this._providers.indexOf(provider) != -1)
            return;

        this._providers.push(provider);
        this.dispatchEventToListeners(WebInspector.RecordingObject.Event.ProviderAdded, provider);
    },

    removeProvider: function(provider)
    {
        var idx = this._providers.indexOf(provider);
        if (idx == -1)
            return;

        this._removeProviderAtIndex(idx);
    },

    providersWithConstructor: function(ctor)
    {
        var found = [];
        for (var i = 0; i < this._providers.length; i++) {
            var provider = this._providers[i];
            if (provider.constructor === ctor)
                found.push(provider);
        }

        return found;
    },

    // Protected

    // NB. this is extended by subclasses, so don't inline it into a constructor.
    registerListeners: function(group) {
        group.register(WebInspector.replayManager, WebInspector.ReplayManager.Event.RecordingUnloaded, this._recordingUnloaded);
    },

    // Private

    _recordingUnloaded: function(event)
    {
        var recording = event.data;
        if (recording !== this)
            return;

        this._callbacks.uninstall();
        WebInspector.replayManager.onceEventListener(WebInspector.ReplayManager.Event.RecordingLoaded, this._recordingLoaded, this);
    },

    _recordingLoaded: function()
    {
        if (WebInspector.replayManager.loadedRecording !== this)
            return;

        this._callbacks.install();
    },

    _removeProviderAtIndex: function(idx) {
        console.assert(idx >= 0 && idx < this._providers.length,
                       "Tried to remove provider at invalid index: "+i);

        this._providers[idx].willRemove();
        this._providers.splice(idx, 1);
    },

    _clearProviders: function() {
        while (this._providers.length > 0) {
            this._removeProviderAtIndex(0);
        }
    },
};

WebInspector.SerializedRecordingObject = function(uid)
{
    WebInspector.RecordingObject.call(this);
    this.uid = uid;
    this._dataLoaded = false;
}

WebInspector.SerializedRecordingObject.prototype = {
    constructor: WebInspector.SerializedRecordingObject,
    __proto__: WebInspector.RecordingObject.prototype,

    // Public

    loadData: function(data)
    {
        // TODO: add action data and adjust calculator
        this._dateCreated = new Date(data.dateCreated);
        this._displayName = data.name;
        this._dataLoaded = true;
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

    // Private

};

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

    registerListeners: function(group) {
        group.register(WebInspector.replayManager, WebInspector.ReplayManager.Event.CaptureDidStart, this._captureDidStart);
        group.register(WebInspector.replayManager, WebInspector.ReplayManager.Event.CaptureDidStop,  this._captureDidStop);

        WebInspector.RecordingObject.prototype.registerListeners.call(this, group);
    },

    // Private

    _captureDidStart: function()
    {
        this._isCapturing = true;
    },

    _captureDidStop: function()
    {
        this._isCapturing = false;
    },
};
