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
    this._scheduler = new WebInspector.AsyncTaskScheduler();

    this.toolbarItem = new WebInspector.NavigationItem("replay-dashboard");
    this._view = new WebInspector.ReplayDashboardView(this);
};

WebInspector.ReplayManager.Event = {
    // These events are associated with capture.
    CaptureStarted: "replay-manager-capture-started",
    CaptureStopped: "replay-manager-capture-stopped",

    // These events are associated with playback.
    PlaybackStarted: "replay-manager-playback-started",
    PlaybackPaused: "replay-manager-playback-paused",
    PlaybackFinished: "replay-manager-playback-finished",

    // fired when activeRecording changes.
    RecordingLoaded: "replay-manager-recording-loaded",
    RecordingUnloaded: "replay-manager-recording-unloaded",
};

WebInspector.ReplayManager.ReplayState = {
    CanCapture: "replay-state-can-capture",
    CanReplay: "replay-state-can-replay",
    Capturing: "replay-state-capturing",
    Replaying: "replay-state-replaying",
    Paused: "replay-state-paused"
};

WebInspector.ReplayManager.prototype = {
    constructor: WebInspector.ReplayManager,
    __proto__: WebInspector.Object.prototype,

    // Public

    get scheduler()
    {
        return this._scheduler;
    },

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

    get createdRecording()
    {
        console.assert(this.isCapturing, "ReplayManager.createdRecording only available when capturing is in progress.");
        return this._activeRecording;
    },

    get loadedRecording()
    {
        console.assert(this.canReplay, "ReplayManager.loadedRecording only available when replay is possible.");
        return this._activeRecording;
    },

    startCaptureSoon: function()
    {
        this.scheduler.enqueue(new WebInspector.ReplayManager.AsyncTasks.StartCapture());
    },

    // Protected (handlers for events from ReplayObserver)

    captureStarted: function()
    {
        this._replayState = WebInspector.ReplayManager.ReplayState.Capturing;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.CaptureStarted);
    },

    captureStopped: function()
    {
        this._replayState = WebInspector.ReplayManager.ReplayState.CanReplay;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.CaptureStopped);
    },

    playbackStarted: function()
    {
        var canReplay = WebInspector.ReplayManager.ReplayState.CanReplay;
        var isPaused = WebInspector.ReplayManager.ReplayState.Paused;
        console.assert(this._replayState === canReplay || this._replayState === isPaused);

        this._replayState = WebInspector.ReplayManager.ReplayState.Replaying;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.PlaybackStarted);
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
    },

    recordingUnloaded: function()
    {
        this._replayState = WebInspector.ReplayManager.ReplayState.CanCapture;

        var unloadedRecording = this._activeRecording;
        delete this._activeRecording;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.RecordingUnloaded, unloadedRecording);
    },

    recordingLoaded: function(uid)
    {
        var setActiveRecording = function() {
            this._replayState = WebInspector.ReplayManager.ReplayState.CanReplay;
            this._activeRecording = WebInspector.recordingsManager.getRecordingWithUID(uid);
            // TODO: set replay cursor to initial position
            this.dispatchEventToListeners(WebInspector.ReplayManager.Event.RecordingLoaded, this.loadedRecording);
        };

        var recording = WebInspector.recordingsManager.getRecordingWithUID(uid);
        console.assert(recording, "Unknown recording loaded!");

        if (recording.dataLoaded())
            setActiveRecording.call(this);
        else
            WebInspector.recordingsManager.addSingleFireEventListener(WebInspector.RecordingsManager.Event.RecordingAdded, setActiveRecording, this);
    },

    // Protected (commands issued by AsyncTasks)

    suppressBreakpoints: function()
    {
        if (this._suppressingBreakpoints)
            return;

        this._suppressingBreakpoints = true;
        this._breakpointsWereEnabled = WebInspector.debuggerManager.breakpointsEnabled;
        WebInspector.debuggerManager.breakpointsEnabled = false;
    },

    unsuppressBreakpoints: function()
    {
        if (!this._suppressingBreakpoints)
            return;

        delete this._suppressingBreakpoints;
        delete this._breakpointsWereEnabled;
        WebInspector.debuggerManager.breakpointsEnabled = this._breakpointsWereEnabled;
    },

    loadRecording: function(recording)
    {
        console.assert(!this._activeRecording, "Can't load recording because one is already loaded:", recording);
        // TODO: receiving !wasAllowed should trigger task error.
        ReplayAgent.loadRecording(recording.uid);
    },

    createRecording: function()
    {
        // we must create recording before receiving CaptureStarted, because
        // the recording needs to listen for that event as well.
        this._activeRecording = new WebInspector.LiveRecordingObject();
        ReplayAgent.startCapture();
    }
};

WebInspector.ReplayManager.AsyncTasks = {};
WebInspector.ReplayManager.AsyncTasks.StartCapture = function() {
    var task = new WebInspector.AsyncTask("StartCapture")
    // if replaying, stop playback as the first subtask.
    .chain("stopPlaybackIfNeeded", function(cb) {
        if (!WebInspector.replayManager.isReplaying)
            return cb();

        WebInspector.ReplayManager.AsyncTasks.StopPlayback().run(cb);
    })
    .chain("unloadRecordingIfNeeded", function(cb) {
        if (!WebInspector.replayManager.canReplay)
            return cb();

        WebInspector.replayManager.addSingleFireEventListener(WebInspector.ReplayManager.Event.RecordingUnloaded, cb);
        WebInspector.replayManager.unloadRecording();
    })
    .chain("suppressBreakpoints", function(cb) {
        // technically asynchronous, but is ordered before debugger resume command.
        WebInspector.replayManager.suppressBreakpoints();
        cb();
    })
    .chain("resumeDebuggerIfPaused",
           WebInspector.ReplayManager.AsyncTaskSteps.ResumeDebuggerIfPaused)
    .chain("requestStartCapture", function(cb) {
        console.assert(WebInspector.replayManager.replayState === WebInspector.ReplayManager.ReplayState.CanCapture, "Cannot start capture whilst capturing or replaying alreday.");

        WebInspector.replayManager.createRecording();
        WebInspector.replayManager.addSingleFireEventListener(WebInspector.ReplayManager.Event.CaptureStarted, cb, this);
    });

    return task;
};

WebInspector.ReplayManager.AsyncTasks.StopCapture = function()
{
    // Not implemented
    return new WebInspector.AsyncTask("not implemented", function(cb) { return cb(); });
};

WebInspector.ReplayManager.AsyncTasks.LoadRecording = function()
{
    // Not implemented
    return new WebInspector.AsyncTask("not implemented", function(cb) { return cb(); });
};

WebInspector.ReplayManager.AsyncTasks.UnloadRecording = function()
{
    // Not implemented
    return new WebInspector.AsyncTask("not implemented", function(cb) { return cb(); });
};

WebInspector.ReplayManager.AsyncTasks.ReplayToIndex = function()
{
    // Not implemented
    return new WebInspector.AsyncTask("not implemented", function(cb) { return cb(); });
};

WebInspector.ReplayManager.AsyncTasks.ReplayToCompletion = function()
{
    // Not implemented
    return new WebInspector.AsyncTask("not implemented", function(cb) { return cb(); });
};

WebInspector.ReplayManager.AsyncTasks.StopPlayback = function()
{
    // Not implemented
    return new WebInspector.AsyncTask("not implemented", function(cb) { return cb(); });
};

WebInspector.ReplayManager.AsyncTasks.PausePlayback = function()
{
    // Not implemented
    return new WebInspector.AsyncTask("not implemented", function(cb) { return cb(); });
};

WebInspector.ReplayManager.AsyncTaskSteps = {};
WebInspector.ReplayManager.AsyncTaskSteps.ResumeDebuggerIfPaused = function(cb)
{
    if (!WebInspector.debuggerManager.paused)
        return cb();

    WebInspector.debuggerManager.addSingleFireEventListener(WebInspector.DebuggerManager.Event.Resumed, cb, this);
    WebInspector.debuggerManager.resume();
}
