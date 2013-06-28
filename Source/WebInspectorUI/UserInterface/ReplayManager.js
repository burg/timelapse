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
    this._replaySpeed = WebInspector.ReplayManager.ReplaySpeed.Default;

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
    ReplayProgressing: "replay-state-replay-progressing",
    ReplayPausedAtInput: "replay-state-replay-paused-at-input"
};

WebInspector.ReplayManager.ReplaySpeed = {
    Normal: "replay-speed-normal",
    Seeking: "replay-speed-seeking",
};
WebInspector.ReplayManager.ReplaySpeed.Default = WebInspector.ReplayManager.ReplaySpeed.Seeking;

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

    // We consider isReplaying() to be true whenever playback is progressing, or whenever
    // playback is held at an input or paused at a breakpoint.
    get isReplaying()
    {
        var inProgress = WebInspector.ReplayManager.ReplayState.ReplayProgressing;
        var inputPaused = WebInspector.ReplayManager.ReplayState.ReplayPausedAtInput;
        return this._replayState === inProgress || this._replayState === inputPaused;
    },

    get inputPaused()
    {
        return this._replayState === WebInspector.ReplayManager.ReplayState.ReplayPausedAtInput;
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

    get replaySpeed()
    {
        return this._replaySpeed;
    },

    set replaySpeed(value)
    {
        this._replaySpeed = value;
    },

    startCaptureSoon: function()
    {
        this.scheduler.enqueue(new WebInspector.ReplayManager.AsyncTasks.StartCapture());
    },

    stopCaptureSoon: function()
    {
        this.scheduler.enqueue(new WebInspector.ReplayManager.AsyncTasks.StopCapture());
    },

    unloadRecordingSoon: function()
    {
        this.scheduler.enqueue(new WebInspector.ReplayManager.AsyncTasks.UnloadRecording());
    },

    pausePlaybackSoon: function()
    {
        this.scheduler.enqueue(new WebInspector.ReplayManager.AsyncTasks.PausePlayback());
    },

    replayToCompletionSoon: function(allowBreakpoints, replaySpeed)
    {
        this.scheduler.enqueue(new WebInspector.ReplayManager.AsyncTasks.BeginReplayToCompletion(allowBreakpoints, replaySpeed));
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
        delete this._activeRecording;
        this.unsuppressBreakpoints();
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.CaptureStopped);
    },

    playbackStarted: function()
    {
        var canReplay = WebInspector.ReplayManager.ReplayState.CanReplay;
        var inputPaused = WebInspector.ReplayManager.ReplayState.ReplayPausedAtInput;
        console.assert(this._replayState === canReplay || this._replayState === inputPaused,  "Expected replay state=CanReplay|ReplayPausedAtInput, but was: " + this._replayState);

        this._replayState = WebInspector.ReplayManager.ReplayState.ReplayProgressing;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.PlaybackStarted);
    },

    playbackPaused: function(mark)
    {
        console.assert(this._replayState === WebInspector.ReplayManager.ReplayState.ReplayProgressing, "Expected replay state=ReplayProgressing, but was: " + this._replayState);

        this._replayState = WebInspector.ReplayManager.ReplayState.ReplayPausedAtInput;
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.PlaybackPaused);
    },

    playbackFinished: function()
    {
        var replaying = WebInspector.ReplayManager.ReplayState.ReplayProgressing;
        var inputPaused = WebInspector.ReplayManager.ReplayState.ReplayPausedAtInput;
        console.assert(this._replayState === replaying || this._replayState === inputPaused, "Expected replay state=ReplayProgressing|ReplayPausedAtInput, but was: " + this._replayState);

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
        console.assert(recording, "Unknown recording loaded:", recording);

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

    unloadRecording: function()
    {
        console.assert(this.loadedRecording, "Can't unload recording because none is loaded");
        // TODO: receiving !wasAllowed should trigger task error.
        ReplayAgent.unloadRecording();
    },

    createRecording: function()
    {
        // we must create recording before receiving CaptureStarted, because
        // the recording needs to listen for that event as well.
        this._activeRecording = new WebInspector.LiveRecordingObject();
        ReplayAgent.startCapture();
    },

    finishRecording: function()
    {
        console.assert(this.isCapturing, "Can't stop capturing because nothing is being captured.");
        ReplayAgent.stopCapture();
    },

    replayToCompletion: function()
    {
        // TODO: save replay start and end mark indices here
        this.dispatchEventToListeners(WebInspector.ReplayManager.Event.PlaybackWillStart);
        ReplayAgent.replayToCompletion(this.replaySpeed === WebInspector.ReplayManager.ReplaySpeed.Seeking);
    },

    pausePlayback: function()
    {
        console.assert(this.isReplaying && !this.inputPaused, "Can't pause playback because nothing is being replayed or playback is already paused");
        ReplayAgent.pausePlayback();
    },

    stopPlayback: function(shouldUnlock)
    {
        console.assert(this.isReplaying, "Can't stop replaying because nothing is being replayed");
        ReplayAgent.stopPlayback(!!shouldUnlock);
    }
};

WebInspector.ReplayManager.AsyncTasks = {};
WebInspector.ReplayManager.AsyncTasks.StartCapture = function() {
    var task = new WebInspector.AsyncTask("StartCapture")
    // if replaying, stop playback as the first subtask.
    .chain("stopPlaybackIfNeeded", WebInspector.ReplayManager.AsyncTaskSteps.StopPlaybackIfNeeded)
    .chain("unloadRecordingIfNeeded", WebInspector.ReplayManager.AsyncTaskSteps.UnloadRecordingIfNeeded)
    .chain("suppressBreakpoints", WebInspector.ReplayManager.AsyncTaskSteps.SuppressBreakpoints)
    .chain("resumeDebuggerIfPaused", WebInspector.ReplayManager.AsyncTaskSteps.ResumeDebuggerIfPaused)
    .chain("requestStartCapture", function(cb) {
        console.assert(WebInspector.replayManager.replayState === WebInspector.ReplayManager.ReplayState.CanCapture, "Cannot start capture whilst capturing or replaying alreday.");

        WebInspector.replayManager.createRecording();
        WebInspector.replayManager.addSingleFireEventListener(WebInspector.ReplayManager.Event.CaptureStarted, cb);
    });

    return task;
};

WebInspector.ReplayManager.AsyncTasks.StopCapture = function()
{
    if (!WebInspector.replayManager.isCapturing)
        return;

    return new WebInspector.AsyncTask("StopCapture")
    .chain("requestCaptureStop", function(cb) {
        WebInspector.replayManager.addSingleFireEventListener(WebInspector.ReplayManager.Event.CaptureStopped, cb);
        WebInspector.replayManager.finishRecording();
    });
};

WebInspector.ReplayManager.AsyncTasks.LoadRecording = function()
{
    // Not implemented
    return new WebInspector.AsyncTask("not implemented", function(cb) { return cb(); });
};

WebInspector.ReplayManager.AsyncTasks.UnloadRecording = function()
{
    return new WebInspector.AsyncTask("UnloadRecording")
    .chain("stopPlaybackIfNeeded", WebInspector.ReplayManager.AsyncTaskSteps.StopPlaybackIfNeeded)
    .chain("unloadRecordingIfNeeded", WebInspector.ReplayManager.AsyncTaskSteps.UnloadRecordingIfNeeded);
};

WebInspector.ReplayManager.AsyncTasks.ReplayToIndex = function()
{
    // Not implemented
    return new WebInspector.AsyncTask("not implemented", function(cb) { return cb(); });
};

WebInspector.ReplayManager.AsyncTasks.BeginReplayToCompletion = function(allowBreakpoints, replaySpeed)
{
    var task = new WebInspector.AsyncTask("ReplayToCompletion");

    if (!allowBreakpoints)
        task.chain("suppressBreakpoints", WebInspector.ReplayManager.AsyncTaskSteps.UnsuppressBreakpoints);
    else
        task.chain("unsuppressBreakpoints", WebInspector.ReplayManager.AsyncTaskSteps.SuppressBreakpoints);
    task.chain("resumeDebuggerIfPaused", WebInspector.ReplayManager.AsyncTaskSteps.ResumeDebuggerIfPaused);
    task.chain("notifyAndRequestReplay", function(cb) {
        WebInspector.replayManager.replaySpeed = replaySpeed;
        WebInspector.replayManager.addSingleFireEventListener(WebInspector.ReplayManager.Event.PlaybackStarted, cb);
        WebInspector.replayManager.replayToCompletion();
    });
    return task;
};

WebInspector.ReplayManager.AsyncTasks.StopPlayback = function(shouldUnlock)
{
    return new WebInspector.AsyncTask("StopPlayback")
    .chain("suppressBreakpoints", WebInspector.ReplayManager.AsyncTaskSteps.SuppressBreakpoints)
    .chain("resumeDebuggerIfPaused", WebInspector.ReplayManager.AsyncTaskSteps.ResumeDebuggerIfPaused)
    .chain("requestPlaybackStop", function(cb) {
        WebInspector.replayManager.addSingleFireEventListener(WebInspector.ReplayManager.Event.PlaybackFinished, cb);
        WebInspector.replayManager.stopPlayback(shouldUnlock);
    });
};

WebInspector.ReplayManager.AsyncTasks.PausePlayback = function()
{
    return new WebInspector.AsyncTask("PausePlayback")
    .chain("suppressBreakpoints", WebInspector.ReplayManager.AsyncTaskSteps.SuppressBreakpoints)
    .chain("resumeDebuggerIfPaused", WebInspector.ReplayManager.AsyncTaskSteps.ResumeDebuggerIfPaused)
    .chain("requestPlaybackPause", function(cb) {
        WebInspector.replayManager.addSingleFireEventListener(WebInspector.ReplayManager.Event.PlaybackPaused, cb);
        WebInspector.replayManager.pausePlayback();
    });
};

WebInspector.ReplayManager.AsyncTaskSteps = {};
WebInspector.ReplayManager.AsyncTaskSteps.ResumeDebuggerIfPaused = function(cb)
{
    if (!WebInspector.debuggerManager.ReplaypausedAtInput)
        return cb();

    WebInspector.debuggerManager.addSingleFireEventListener(WebInspector.DebuggerManager.Event.Resumed, cb, this);
    WebInspector.debuggerManager.resume();
};

WebInspector.ReplayManager.AsyncTaskSteps.StopPlaybackIfNeeded = function(cb)
{
    if (!WebInspector.replayManager.isReplaying)
        return cb();

    new WebInspector.ReplayManager.AsyncTasks.StopPlayback().run(cb);
};

WebInspector.ReplayManager.AsyncTaskSteps.SuppressBreakpoints = function(cb)
{
    // This action is asynchronous. At the time of writing, two commands are sent to
    // backend by DebuggerManager: disable breakpoints, and disable break on exception.
    WebInspector.replayManager.suppressBreakpoints();
    // Running the extra command below forces the task to wait until the above commands
    // have been processed by the debugger agent. The result itself is unimportant.
    DebuggerAgent.causesRecompilation(cb);
};

WebInspector.ReplayManager.AsyncTaskSteps.UnsuppressBreakpoints = function(cb)
{
    // This action is asynchronous. At the time of writing, two commands are sent to
    // backend by DebuggerManager: enable breakpoints, and enable break on exception.
    WebInspector.replayManager.unsuppressBreakpoints();
    // Running the extra command below forces the task to wait until the above commands
    // have been processed by the debugger agent. The result itself is unimportant.
    DebuggerAgent.causesRecompilation(cb);
};

WebInspector.ReplayManager.AsyncTaskSteps.UnloadRecordingIfNeeded = function(cb)
{
    if (!WebInspector.replayManager.canReplay)
        return cb();

    WebInspector.replayManager.addSingleFireEventListener(WebInspector.ReplayManager.Event.RecordingUnloaded, cb);
    WebInspector.replayManager.unloadRecording();
};
