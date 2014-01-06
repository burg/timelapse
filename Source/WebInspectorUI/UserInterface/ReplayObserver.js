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

WebInspector.ReplayObserver = function()
{
    WebInspector.Object.call(this);
};

WebInspector.ReplayObserver.prototype = {
    constructor: WebInspector.ReplayObserver,
    __proto__: WebInspector.Object.prototype,

    // Events defined by the "Replay" domain (see WebCore/inspector/Inspector.json).

    captureStarted: function()
    {
        WebInspector.replayManager.captureStarted();
    },

    captureStopped: function()
    {
        WebInspector.replayManager.captureStopped();
    },

    capturedInput: function(input)
    {
        WebInspector.replayManager.createdRecording.addInput(input);
    },

    playbackHitLocation: function(recordingIndex, mark)
    {
        WebInspector.replayManager.playbackHitLocation(recordingIndex, mark);
    },

    playbackStarted: function()
    {
        WebInspector.replayManager.playbackStarted();
    },

    playbackPaused: function(recordingIndex, mark)
    {
        WebInspector.replayManager.playbackPaused();
    },

    playbackFinished: function()
    {
        WebInspector.replayManager.playbackFinished();
    },

    playbackError: function(isFatal, error)
    {
        WebInspector.replayManager.playbackError(isFatal, error);
    },

    inputLocked: function()
    {
        // Not handled yet.
    },

    inputUnlocked: function()
    {
        // Not handled yet.
    },

    sessionCreated: function(sessionId)
    {
        WebInspector.recordingsManager.addSession(sessionId);
    },

    sessionRemoved: function(sessionId)
    {
        // Not handled yet.
    },

    sessionLoaded: function(sessionId)
    {
        WebInspector.replayManager.sessionLoaded(sessionId);
    },

    recordingCreated: function(recordingId)
    {
        WebInspector.recordingsManager.addRecording(recordingId);
    },

    recordingRemoved: function(recordingId)
    {
        WebInspector.recordingsManager.removeRecording(recordingId);
    },

    recordingClosed: function(recordingId)
    {
        // Not handled yet.
    },

    recordingAddedToSession: function(sessionId, recordingId, recordingIndex)
    {
        WebInspector.recordingsManager.addRecordingToSession(sessionId, recordingId, recordingIndex);
    },

    recordingRemovedFromSession: function(sessionId, recordingIndex)
    {
        WebInspector.recordingsManager.removeRecordingFromSession(sessionId, recordingIndex);
    },

    recordingLoaded: function(recordingId)
    {
        WebInspector.replayManager.recordingLoaded(recordingId);
    },

    recordingUnloaded: function()
    {
        WebInspector.replayManager.recordingUnloaded();
    }
};
