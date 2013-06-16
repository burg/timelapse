/*
 *  Copyright (C) 2011-2013, Brian Burg.
 *  Copyright (C) 2011-2013, University of Washington. All rights reserved.
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
WebInspector.ReplayModel = function()
{
    WebInspector.Object.call(this);
    this._dispatcher = new WebInspector.ReplayDispatcher(this);

    this._scanners = {};
    this._recordingsModel = WebInspector.recordingsModel;
    this._capturing = false;
    this._replaying = false;
    this._inputPaused = false;
    this._canReplay = false;
    this._replaySpeed = WebInspector.ReplayModel.ReplaySpeed.Default;
    this._inputLocked = false;

    this._breakpointTracker = new WebInspector.ReplayBreakpointTracker(this);
    this._savepointTracker = new WebInspector.ReplaySavepointTracker(this);
    this._scanners["breakpoint"] = new WebInspector.BreakpointScanner(this);
    this._scanners["timeline"] = new WebInspector.TimelineScanner(this);
    this._scanners["profile-cpu"] = new WebInspector.ProfilesScanner(this);
    this._breakpointsWereEnabled = WebInspector.debuggerModel.breakpointsActive();
    this._suppressingBreakpoints = false;

    this._scheduler = new WebInspector.ReplayTaskScheduler().run();

    WebInspector.debuggerModel.addEventListener(WebInspector.DebuggerModel.Events.DebuggerPaused,  this._debuggerPaused, this);
    WebInspector.debuggerModel.addEventListener(WebInspector.DebuggerModel.Events.DebuggerResumed, this._debuggerResumed, this);
};

WebInspector.ReplayModel.ReplaySpeed = {
    Normal: "Normal",
    Seeking: "Seeking",
    //-
    Default: "Seeking"
};

WebInspector.ReplayModel.Events = {
    Enabled: "ReplayEnabled",
    Disabled: "ReplayDisabled",
    StatusChanged: "ReplayStatusChanged",

    // Recording* events are coarse-grained, and control switching of entire views.
    // Capture{Will,Did}{Start,Stop} events are fine-grained, suitable for
    // updating capture-specific widget progress but not for creating them.
    //
    // The ordering of these frontend events during capture events is below:
    // RecordingUnloaded (can only capture from here)
    // -> CaptureWillStart -> RecordingCreated -> CaptureDidStart
    // -> CaptureWillStop  -> CaptureDidStop -> [RecordingAdded] -> RecordingLoaded
    //
    // Recordings can be added independently or capture, replay, or load status.
    // A recording can only be loaded or unloaded from the opposite state.
    //
    // The ordering of backend events is different:
    // RecordingUnloaded -> CaptureStarted -> CaptureStopped -> RecordingAdded -> RecordingLoaded
    // InspectorReplayAgent will automatically load the created recording if none is loaded.
    // The frontend RecordingsModel tracks available recordings and fires Recording{Added,Removed}.

    // fires when a new recording is initialized for capturing.
    // this recording object does not exist in the backend.
    RecordingCreated: "ReplayRecordingCreated",

    // fired when activeRecording changes.
    RecordingLoaded: "ReplayRecordingLoaded",
    RecordingUnloaded: "ReplayRecordingUnloaded",

    // These events are associated with capture.
    CaptureWillStart: "ReplayCaptureWillStart",
    CaptureDidStart: "ReplayCaptureDidStart",
    CaptureWillStop: "ReplayCaptureWillStop",
    CaptureDidStop: "ReplayCaptureDidStop",

    // These events are associated with playback.
    PlaybackWillStart: "ReplayPlaybackWillStart",
    PlaybackDidStart: "ReplayPlaybackDidStart",
    PlaybackStopped: "ReplayPlaybackStopped",
    CursorChanged: "ReplayCursorChanged",
    BreakpointHit: "ReplayBreakpointHit",

    // Fired when an image of a DOM node is captured.
    // This may eventually happen when an image probe is triggered during replay,
    // but is currently only fired by hard-coded image capture events in the backend.
    ImageCaptured: "ReplayImageCaptured",

    // Debugger pauses or input pauses are preceded by the *Waiting events.
    // *Waiting events allow listeners to prevent the default actions, in
    // the case that they perform automated steps without user interaction.
    DebuggerWaiting: "ReplayDebuggerWaiting",
    InputWaiting: "ReplayInputWaiting",

    // The default action taken for *Waiting events is to update the status bar
    // and fire the corresponding *Paused event below. These trigger breakpoint
    // sliders, etc. that are present for the user to interact with paused states.
    DebuggerPaused: "ReplayDebuggerPaused",
    InputPaused: "ReplayInputPaused",

    InputLocked: "ReplayInputLocked",
    InputUnlocked: "ReplayInputUnlocked",
};

WebInspector.ReplayModel.prototype = {
    /* ReplayModel represents the state of execution and capture
     * or replay. Clients call methods of ReplayModel to issue
     * commands that affect capture or replay, or to query its state.
     *
     * This model also translates backend->frontend calls into events.
     */

    // Public command API
    enable: function()
    {
	this.changeStatus("Enabling...");
	return ReplayAgent.enable();
    },

    disable: function()
    {
	this.changeStatus("Disabling...");
	return ReplayAgent.disable();
    },

    isEnabled: function(cb)
    {
	return ReplayAgent.enable(cb);
    },

    changeStatus: function(newStatus)
    {
        this._status = newStatus || "(no status)";
        this.dispatchEventToListeners(WebInspector.ReplayModel.Events.StatusChanged, this._status);
    },

    // the following commands cancel any pending or queued tasks, and act immediately.
    startCapture: function()
    {
        var task = this.startCaptureTask();
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    stopCapture: function()
    {
        var task = this.stopCaptureTask();
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    replayUpToMarkIndex: function(markIndex, allowBreakpoints, replaySpeed)
    {
        this.changeStatus("Starting replay...");

        var task = this.startReplayUpToMarkIndexTask(markIndex, allowBreakpoints, replaySpeed);
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    replayToCompletion: function(allowBreakpoints, replaySpeed)
    {
        var task = this.replayToCompletionTask(allowBreakpoints, replaySpeed);
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    replayToBreakpointHit: function(markIndex, hitIndex, allowBreakpoints, replaySpeed)
    {
        var task = this.replayToBreakpointHitTask(markIndex, hitIndex, allowBreakpoints, replaySpeed);
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    pausePlayback: function()
    {
        var task = this.pausePlaybackTask();
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    stopPlayback: function(shouldUnlock)
    {
        this.changeStatus("Stopping playback...");
        this._scheduler.cancelAllTasks().enqueue(this.stopPlaybackTask(shouldUnlock));
    },

    // Public task creation API
    startCaptureTask: function()
    {
        var model = this;
        var events = WebInspector.ReplayModel.Events;

        var task = new WebInspector.ReplayTask("StartCapture")
        .chain("stopPlaybackIfNeeded", function(cb) {
            if (model.isReplaying)
               model.stopPlaybackTask(true).run(cb)
            else
                cb();
        })
        .chain("unloadRecordingIfNeeded", function(cb) {
            if (!model.canReplay)
                return cb();

            model.onceEventListener(WebInspector.ReplayModel.Events.RecordingUnloaded, cb);
            model._unloadRecording();
        })
        .chain("suppressBreakpointsAndNotifyWillStart", function(cb) {
            console.assert(!model.isCapturing && !model.isReplaying,
                           "Cannot start capture whilst capturing or replaying alreday.");
            model.changeStatus("Starting capture...");
            model.dispatchEventToListeners(events.CaptureWillStart);
            // technically asynchronous, but is ordered before debugger resume command.
            model._suppressBreakpoints();
            cb();
        })
        .chain("resumeDebuggerIfPaused",
               WebInspector.ReplayModel.Steps.ResumeDebuggerIfPaused)
        .chain("requestStartCapture", function(cb) {
            // we must create recording before receiving CaptureDidStart, because
            // the recording needs to listen for that event as well.
            model._activeRecording = new WebInspector.ReplayLiveRecording(model);
            model._capturing = true;
            model.dispatchEventToListeners(WebInspector.ReplayModel.Events.RecordingCreated, model._activeRecording);
            model.onceEventListener(events.CaptureDidStart, cb, this);
            ReplayAgent.startCapture();
        })
        .chain("notifyDidStart", function(cb) {
            console.assert(model.createdRecording, "somehow lost created recording object");
            model.changeStatus("Capturing...");
            cb();
        });

        return task;
    },

    stopCaptureTask: function()
    {
        if (!this.isCapturing)
            return;

        var model = this;
        var events = WebInspector.ReplayModel.Events;
        var task = new WebInspector.ReplayTask("StopCapture")
        .chain("notifyWillStop", function(cb) {
            model.changeStatus("Stopping capture...");
            model.dispatchEventToListeners(events.CaptureWillStop);
            cb();
        })
        .chain("requestCaptureStop", function(cb) {
            model.onceEventListener(events.CaptureDidStop, cb, this);
            ReplayAgent.stopCapture(cb);
        })
        .chain("handleCaptureStopped", function(cb) {
            var recording = model.createdRecording;
            delete model._activeRecording;
            model._capturing = false;
            model.changeStatus("Ready");
            model._unsuppressBreakpoints();
            model._currentMarkIndex = -1;
            cb();
        });

        return task;
    },

    startReplayUpToMarkIndexTask: function(markIndex, allowBreakpoints, replaySpeed)
    {
        var model = this;
        var task = new WebInspector.ReplayTask("ReplayUpToMarkIndex");
        task.chain("setDefaults", function(cb) {
            /* ensure defaults if no arguments */
            allowBreakpoints = (typeof allowBreakpoints === "undefined") ? false : allowBreakpoints;
            var replaySpeeds = WebInspector.ReplayModel.ReplaySpeed;
            model._replaySpeed = (replaySpeed in replaySpeeds) ? replaySpeed
                                                               : replaySpeeds.Default;
            cb();
        });

        if (!allowBreakpoints) {
            task.chain("suppressBreakpointsIfNeeded", function(cb) {
                    model._suppressBreakpoints();
                cb();
            });
        } else {
            task.chain("unsuppressBreakpointsIfNeeded", function(cb) {
                    model._unsuppressBreakpoints();
                cb();
            });
        }

        task.chain("resumeDebuggerIfPaused",
               WebInspector.ReplayModel.Steps.ResumeDebuggerIfPaused);
        task.chain("notifyAndRequestReplay", function(cb) {
            // decide replay starting and ending mark indices
            var actions = model.loadedRecording.actions;
            var canReplayWithoutRestart = model.isReplaying &&
                model._currentMarkIndex && model._currentMarkIndex < markIndex;

            model._replayStartIndex = (canReplayWithoutRestart) ? model._currentMarkIndex
                                         : model.loadedRecording.actions[0].mark.index;
            model._replayFinishIndex = markIndex;

            var seeking = WebInspector.ReplayModel.ReplaySpeed.Seeking;
            model.dispatchEventToListeners(WebInspector.ReplayModel.Events.PlaybackWillStart);
            model.onceEventListener(WebInspector.ReplayModel.Events.PlaybackDidStart, cb, model);
            ReplayAgent.replayUpToMarkIndex(markIndex+1, model.replaySpeed == seeking);
        });

        task.chain("notifyReplayStarted", function(cb){
            model._replaying = true;
            model._inputPaused = false;
            model.changeStatus("Replaying...");
            cb();
        });

        return task;
    },

    replayToCompletionTask: function(allowBreakpoints, replaySpeed)
    {
        var model = this;
        var task = new WebInspector.ReplayTask("ReplayToCompletion");
        task.chain("setDefaults", function(cb) {
            model.changeStatus("Starting replay...");
            /* ensure defaults if no arguments */
            allowBreakpoints = (typeof allowBreakpoints === "undefined") ? false : allowBreakpoints;
            var replaySpeeds = WebInspector.ReplayModel.ReplaySpeed;
            model._replaySpeed = (replaySpeed in replaySpeeds) ? replaySpeed
                                                               : replaySpeeds.Default;
            cb();
        });

        if (!allowBreakpoints) {
            task.chain("suppressBreakpointsIfNeeded", function(cb) {
                    model._suppressBreakpoints();
                cb();
            });
        } else {
            task.chain("unsuppressBreakpointsIfNeeded", function(cb) {
                    model._unsuppressBreakpoints();
                cb();
            });
        }

        task.chain("resumeDebuggerIfPaused",
               WebInspector.ReplayModel.Steps.ResumeDebuggerIfPaused);
        task.chain("notifyAndRequestReplay", function(cb) {
            // decide replay starting and ending mark indices
            var actions = model.loadedRecording.actions;
            var lastMarkIndex = actions[actions.length-1].mark.index;
            // TODO: revisit this?
            // replayToCompletion() from the last mark causes last mark to play,
            // unless a recording was just made and there is no replay state.
            model._replayStartIndex = (!this._replaying && this._currentMarkIndex == lastMarkIndex) ? actions[0].mark.index : this._currentMarkIndex;
            model._replayFinishIndex = lastMarkIndex;

            var seeking = WebInspector.ReplayModel.ReplaySpeed.Seeking;
            model.dispatchEventToListeners(WebInspector.ReplayModel.Events.PlaybackWillStart);
            model.onceEventListener(WebInspector.ReplayModel.Events.PlaybackDidStart, cb, model);
            ReplayAgent.replayToCompletion(model.replaySpeed == seeking);
        });

        task.chain("notifyReplayStarted", function(cb){
            model._replaying = true;
            model._inputPaused = false;
            model.changeStatus("Replaying...");
            cb();
        });

        return task;
    },

    replayToBreakpointHitTask: function(markIndex, hitIndex, allowBreakpoints, replaySpeed)
    {
        var model = this;
        var replayEvents = WebInspector.ReplayModel.Events;
        var task = new WebInspector.ReplayTask("ReplayToBreakpointHit");

        task.chain("ReplayToMark", function(cb) {
            model.onceEventListener(replayEvents.InputPaused, cb, task);
            model.startReplayUpToMarkIndexTask(markIndex, allowBreakpoints, replaySpeed).run();
        });
        task.chain("RequestReplayWithBreakpoints", function(cb) {
            var subtask = model.replayToCompletionTask(true, replaySpeed);
            subtask.run(cb);
        });
        task.chain("CountDebuggerWait" + hitIndex + "Times", function(cb) {
            task._waitCount = 0;
            var debuggerWaitingCallback = function(event) {
                // we arrived at the wait we were looking for.
                if (task._waitCount++ == hitIndex) {
                    model.removeEventListener(replayEvents.DebuggerWaiting,
                                              debuggerWaitingCallback,
                                              task);
                    return cb();
                }
                // otherwise, prevent debugger wait from propagating; resume.
                event.preventDefault();
                if (WebInspector.debuggerModel.isPaused())
                    DebuggerAgent.resume();
            };

            model.addEventListener(replayEvents.DebuggerWaiting,
                                   debuggerWaitingCallback, task);
        });

        return task;
    },

    pausePlaybackTask: function()
    {
        var model = this;
        var task = new WebInspector.ReplayTask("PausePlayback");
        task.chain("suppressBreakpoints", function(cb) {
            model.changeStatus("Pausing...");
            model._suppressBreakpoints();
            cb();
        });
        task.chain("resumeDebuggerIfPaused",
            WebInspector.ReplayModel.Steps.ResumeDebuggerIfPaused);
        task.chain("requestPlaybackPause", function(cb) {
            var events = WebInspector.ReplayModel.Events;
            model.onceEventListener(events.InputPaused, cb, this);
            ReplayAgent.pausePlayback();
        });

        return task;
    },

    stopPlaybackTask: function(shouldUnlock)
    {
        var model = this;
        return new WebInspector.ReplayTask("StopPlayback")
        .chain("suppressBreakpoints", function(cb) {
            model._suppressBreakpoints();
            cb();
        })
        .chain("resumeDebuggerIfPaused",
               WebInspector.ReplayModel.Steps.ResumeDebuggerIfPaused)
        .chain("requestPlaybackStop", function(cb) {
            var events = WebInspector.ReplayModel.Events;
            model.onceEventListener(events.PlaybackStopped, cb, this);
            ReplayAgent.stopPlayback(!!shouldUnlock);
        });

        return task;
    },

    unloadRecordingTask: function()
    {
        var model = this;
        return new WebInspector.ReplayTask("UnloadRecording")
        .chain("stopPlaybackIfNeeded", function(cb) {
            if (model.isReplaying)
                model.stopPlaybackTask(true).run(cb);
            else
                cb();
        })
        .chain("unloadRecordingIfNeeded", function(cb) {
            if (!model.canReplay)
                return cb();

            model.onceEventListener(WebInspector.ReplayModel.Events.RecordingUnloaded, cb);
            model._unloadRecording();
        });
    },

    loadRecordingTask: function(recording)
    {
        var model = this;
        return new WebInspector.ReplayTask("LoadRecording")
        .chain("requestRecordingLoad", function(cb) {
            if (model.canReplay)
                return cb();

            model.onceEventListener(WebInspector.ReplayModel.Events.RecordingLoaded, cb);
            model._loadRecording(recording);
        });
    },

    switchRecordingTask: function(recording)
    {
        var model = this;
        return new WebInspector.ReplayTask("SwitchRecording")
        .chain("unloadRecording", function(cb) {
            var subtask = model.unloadRecordingTask();
            subtask.run(cb);
        })
        .chain("loadRecording", function(cb) {
            var subtask = model.loadRecordingTask(recording);
            subtask.run(cb);
        });
    },

    // Public query API
    get createdRecording()
    {
    console.assert(this.isCapturing, "ReplayModel.createdRecording only available when capturing is in progress.");
    return this._activeRecording;
    },

    get loadedRecording()
    {
    console.assert(this.canReplay, "ReplayModel.loadedRecording only available when replay is possible.");
    return this._activeRecording;
    },

    get isCapturing()
    {
	return this._capturing;
    },

    get isReplaying()
    {
	return this._replaying;
    },

    get replaySpeed()
    {
	return this._replaySpeed;
    },

    get inputPaused()
    {
	return this._inputPaused;
    },

    get debuggerPaused()
    {
    return WebInspector.debuggerModel.isPaused();
    },

    get canReplay()
    {
	return this._canReplay;
    },

    get inputLocked()
    {
	return this._inputLocked;
    },

    get currentMarkIndex()
    {
	return this._currentMarkIndex;
    },

    get replayStartMarkIndex()
    {
	return this._replayStartIndex;
    },

    get replayFinishMarkIndex()
    {
	return this._replayFinishIndex;
    },

    get scheduler()
    {
        return this._scheduler;
    },

    get breakpointTracker()
    {
        return this._breakpointTracker;
    },

    get savepointTracker()
    {
        return this._savepointTracker;
    },

    get scanners()
    {
        return this._scanners;
    },

    // Internal helpers
    _unloadRecording: function()
    {
        console.assert(this.loadedRecording, "Can't unload recording because none is loaded");
        // TODO: receiving !wasAllowed should trigger task error.
        ReplayAgent.unloadRecording();
    },

    _loadRecording: function(recording)
    {
        console.assert(!this._activeRecording, "Can't load recording because one is already loaded");
        // TODO: receiving !wasAllowed should trigger task error.
        ReplayAgent.loadRecording(recording.uid);
    },

    // Callbacks from the backend message dispatcher (ReplayDispatcher below)
    _replayEnabled: function()
    {
    this._canReplay = false;
	this.changeStatus("Ready");
	this.dispatchEventToListeners(WebInspector.ReplayModel.Events.Enabled);
    },

    _replayDisabled: function()
    {
	this._canReplay = false;
	this.changeStatus("Disabled");
	this.dispatchEventToListeners(WebInspector.ReplayModel.Events.Disabled);
    },

    _playbackPausedAtInput: function(markIndex)
    {
    var replayEvents = WebInspector.ReplayModel.Events;

    // This event is used to allow default action prevention when pausing at an input.
    var defaultPrevented = this.dispatchEventToListeners(replayEvents.InputWaiting, markIndex);
    if (defaultPrevented)
        return;

    // This is the default action for when we have paused at an input.
	this._inputPaused = true;
	this._unsuppressBreakpoints();

	this.changeStatus("Paused");
	this.dispatchEventToListeners(replayEvents.InputPaused, markIndex);
    },

    _playbackStopped: function()
    {
	this._replaying = false;
	this._unsuppressBreakpoints();

    // TODO: breakpoint scanner may want to prevent default here.
    // default action:
	this.changeStatus("Ready");
	this.dispatchEventToListeners(WebInspector.ReplayModel.Events.PlaybackStopped);
    },

    _playbackError: function(isFatal, errorMessage)
    {
        var data = {
            "errorMessage": errorMessage,
            "isFatal": isFatal,
        };

        this.dispatchEventToListeners(WebInspector.ReplayModel.Events.PlaybackError, data);
    },

    _imageCaptured: function(imageDataUri)
    {
        this.dispatchEventToListeners(WebInspector.ReplayModel.Events.ImageCaptured, imageDataUri);
    },

    _lockedInput: function()
    {
    	this._inputLocked = true;
        this.dispatchEventToListeners(WebInspector.ReplayModel.Events.InputLocked);
    },

    _unlockedInput: function()
    {
    	this._inputLocked = false;

        if (!this.capture)
            this.changeStatus("Ready");

        this.dispatchEventToListeners(WebInspector.ReplayModel.Events.InputUnlocked);
    },

    _setReplayCursor: function(markIndex)
    {
        if (this.loadedRecording.actionIndexFromMarkIndex(markIndex) > -1)
            this._currentMarkIndex = markIndex;

        this.dispatchEventToListeners(WebInspector.ReplayModel.Events.CursorChanged);
    },

    _recordingUnloaded: function()
    {
        this._canReplay = false;
        var recording = this._activeRecording;
        delete this._activeRecording;
        this.dispatchEventToListeners(WebInspector.ReplayModel.Events.RecordingUnloaded, recording);
    },

    _recordingLoaded: function(uid)
    {
        var setActiveRecording = function() {
            this._canReplay = true;
            this._activeRecording = this._recordingsModel.getRecordingWithUID(uid);
            this._setReplayCursor(this.loadedRecording.actions[0].mark.index || 0);
            this.dispatchEventToListeners(WebInspector.ReplayModel.Events.RecordingLoaded, this.loadedRecording);
        };

        var recording = this._recordingsModel.getRecordingWithUID(uid);
        console.assert(recording, "Unknown recording loaded!");

        if (recording.dataLoaded())
            setActiveRecording.call(this);
        else
            this._recordingsModel.onceEventListener(WebInspector.RecordingsModel.Events.RecordingAdded,
                                                    setActiveRecording, this);
    },

    // this is the raw DebuggerModel event. We translate into our own
    // Debugger{Waiting,Paused} events. Breakpoint-related events are interpreted
    // by ReplayBreakpointTracker.
    _debuggerPaused: function(event)
    {
	if (!this.isReplaying)
	    return;

    var replayEvents = WebInspector.ReplayModel.Events;
    var debuggerEvents = WebInspector.DebuggerModel.Events;

    // This event is used to allow default action prevention when doing debugger walks
    // or during breakpoint scanning.
    var defaultPrevented = this.dispatchEventToListeners(replayEvents.DebuggerWaiting, event);
    if (defaultPrevented)
        return;

    // This is the default action for when the debugger is waiting on the user.
    var oldStatus = this._status;
    var restoreStatusCallback = function() {
        this.changeStatus(oldStatus);
    };

    if (this._breakpointTracker.currentBreakpoint)
        this.changeStatus("Hit breakpoint");
    else
        this.changeStatus("Debugger paused");

    WebInspector.debuggerModel.onceEventListener(debuggerEvents.DebuggerResumed,
                                                restoreStatusCallback, this);

	this.dispatchEventToListeners(replayEvents.DebuggerPaused);
    },

    _debuggerResumed: function()
    {
	if (!this.isReplaying)
	    return;

	this._replayStartIndex = this._currentMarkIndex;

	this.dispatchEventToListeners(WebInspector.ReplayModel.Events.PlaybackWillStart);
	this.dispatchEventToListeners(WebInspector.ReplayModel.Events.PlaybackDidStart);
    },

    /* suppressing breakpoints will temporarily ignore the state of
     * WebInspector.debuggerModel.breakpointsActive and never hit breakpoints.
     *
     * This is generally only called as an optional behavior during replay.
     */
    _suppressBreakpoints: function()
    {
	if (this._suppressingBreakpoints)
	    return;

	this._suppressingBreakpoints = true;
	this._breakpointsWereEnabled = WebInspector.debuggerModel.breakpointsActive();
	WebInspector.debuggerModel.setBreakpointsActive(false);
    },

    _unsuppressBreakpoints: function()
    {
	if (!this._suppressingBreakpoints)
	    return;

	WebInspector.debuggerModel.setBreakpointsActive(this._breakpointsWereEnabled);
	this._suppressingBreakpoints = false;
    },

    __proto__: WebInspector.Object.prototype
};

WebInspector.ReplayDispatcher = function(model)
{
    this._model = model;
    InspectorBackend.registerReplayDispatcher(this);
};

WebInspector.ReplayDispatcher.prototype = {
    replayEnabled: function()
    {
	this._model._replayEnabled();
    },

    replayDisabled: function()
    {
	this._model._replayDisabled();
    },

    captureStarted: function()
    {
        this._model.dispatchEventToListeners(WebInspector.ReplayModel.Events.CaptureDidStart);
    },

    captureStopped: function()
    {
        this._model.dispatchEventToListeners(WebInspector.ReplayModel.Events.CaptureDidStop);
    },

    capturedAction: function(action)
    {
        this._model.createdRecording.addAction(action);
    },

    playbackStarted: function()
    {
        this._model.dispatchEventToListeners(WebInspector.ReplayModel.Events.PlaybackDidStart);
    },

    playbackPaused: function(markIndex)
    {
	this._model._playbackPausedAtInput(markIndex);
    },

    playbackFinished: function()
    {
	this._model._playbackStopped();
    },

    playbackError: function(isFatal, errorMessage)
    {
	this._model._playbackError(isFatal, errorMessage);
    },

    inputLocked: function()
    {
	this._model._lockedInput();
    },

    inputUnlocked: function()
    {
	this._model._unlockedInput();
    },

    playbackHitMark: function(markIndex)
    {
        this._model._setReplayCursor(markIndex);
    },

    imageCaptured: function(imageDataUri)
    {
        this._model._imageCaptured(imageDataUri);
    },
    
    recordingUnloaded: function()
    {
        this._model._recordingUnloaded();
    },

    recordingLoaded: function(uid)
    {
        this._model._recordingLoaded(uid);
    }
};

WebInspector.ReplayModel.Steps = {
    ResumeDebuggerIfPaused: function(cb)
    {
        var debuggerModel = WebInspector.debuggerModel;
        if (!debuggerModel.isPaused())
            return cb();

        var events = WebInspector.DebuggerModel.Events;
        debuggerModel.onceEventListener(events.DebuggerResumed, cb, this);
        DebuggerAgent.resume();
    },
}

WebInspector.replayModel;
