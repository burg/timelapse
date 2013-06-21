/*
 * Copyright (C) 2013, University of Washington. All rights reserved.
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

WebInspector.ReplayManager = function()
{
    WebInspector.Object.call(this);

    this._replayState = WebInspector.ReplayManager.ReplayState.CanCapture;
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

WebInspector.ReplayManager.ReplayState = {
    CanCapture: "ReplayStateCanCapture",
    CanReplay: "ReplayStateCanReplay",
    Capturing: "ReplayStateCapturing",
    Replaying: "ReplayStateReplaying",
    Paused: "ReplayStatePaused"
};

WebInspector.ReplayManager.prototype = {
    constructor: WebInspector.ReplayManager,

    // Public

    get replayState()
    {
        return this._replayState;
    },

    get canReplay()
    {
        return this._replayState === WebInspector.ReplayManager.ReplayState.CanReplay;
    },

    get isCapturing()
    {
        return this._replayState === WebInspector.ReplayManager.ReplayState.Capturing;
    },
    
    get isReplaying()
    {
        return this._replayState === WebInspector.ReplayManager.ReplayState.Replaying;
    },
    
    get isPaused()
    {
        return this._replayState === WebInspector.ReplayManager.ReplayState.Paused;
    },

    captureStarted: function()
    {
        this._replayState = WebInspector.ReplayManager.ReplayState.Capturing;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.CaptureDidStart);
    },

    captureStopped: function()
    {
        this._replayState = WebInspector.ReplayManager.ReplayState.CanReplay;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.CaptureDidStop);
    },

    playbackStarted: function()
    {
        var canReplay = WebInspector.ReplayManager.ReplayState.CanReplay;
        var isPaused = WebInspector.ReplayManager.ReplayState.Paused;
        console.assert(this._replayState === canReplay || this._replayState === isPaused);

        this._replayState = WebInspector.ReplayManager.ReplayState.Replaying;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.PlaybackDidStart);
    },

    playbackPaused: function(mark)
    {
        console.assert(this._replayState === WebInspector.ReplayManager.ReplayState.Replaying);

        this._replayState = WebInspector.ReplayManager.ReplayState.Paused;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.PlaybackPaused);
    },

    playbackFinished: function()
    {
        console.assert(this._replayState === WebInspector.ReplayManager.ReplayState.Replaying);

        this._replayState = WebInspector.ReplayManager.ReplayState.CanReplay;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.PlaybackFinished);
    }
};

WebInspector.ReplayManager.prototype.__proto__ = WebInspector.Object.prototype;
