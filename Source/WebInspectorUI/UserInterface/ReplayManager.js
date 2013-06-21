/*
 * Copyright (C) 2013 Apple Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
 */

WebInspector.ReplayManager = function()
{
    WebInspector.Object.call(this);

    this._isCapturing = false;
    this._isReplaying = false;
    this._isPaused = false;
};

WebInspector.ReplayManager.Event = {
    // These events are associated with capture.
    CaptureDidStart: "ReplayCaptureDidStart",
    CaptureDidStop: "ReplayCaptureDidStop",

    // These events are associated with playback.
    PlaybackDidStart: "ReplayPlaybackDidStart",
    PlaybackPaused: "ReplayPlaybackPaused",
    PlaybackFinished: "ReplayPlaybackFinished"
};

WebInspector.ReplayManager.prototype = {
    constructor: WebInspector.ReplayManager,

    // Public

    get isCapturing()
    {
        return this._isCapturing;
    },
    
    get isReplaying()
    {
        return this._isReplaying;
    },
    
    get isPaused()
    {
        return this._isPaused;
    },

    captureStarted: function()
    {
        this._isCapturing = true;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.CaptureDidStart);
    },

    captureStopped: function()
    {
        this._isCapturing = false;
        this._isPaused = true;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.CaptureDidStop);
    },

    playbackStarted: function()
    {
        this._isReplaying = true;
        this._isPaused = false;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.PlaybackDidStart);
    },

    playbackPaused: function(mark)
    {
        console.assert(this._isReplaying);
        this._isPaused = true;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.PlaybackPaused);
    },

    playbackFinished: function()
    {
        this._isReplaying = false;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.PlaybackFinished);
    }
};

WebInspector.ReplayManager.prototype.__proto__ = WebInspector.Object.prototype;