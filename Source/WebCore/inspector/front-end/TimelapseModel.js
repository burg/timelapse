/*
 *  Copyright (C) 2011, Brian Burg.
 *  Copyright (C) 2011, University of Washington. All rights reserved.
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
WebInspector.TimelapseModel = function()
{
    WebInspector.Object.call(this);
    this._dispatcher = new WebInspector.TimelapseDispatcher(this);

    this._recordings = [];
    this._capturing = false;
    this._replaying = false;
    this._inputPaused = false;
    this._canReplay = false;
    this._replaySpeed = WebInspector.TimelapseModel.ReplaySpeed.Default;
    this._inputLocked = false;

    this._breakpointTracker = new WebInspector.TimelapseBreakpointTracker(this);
    this._breakpointScanner = new WebInspector.TimelapseBreakpointScanner(this);
    this._breakpointsWereEnabled = WebInspector.debuggerModel.breakpointsActive();
    this._suppressingBreakpoints = false;

    this._scheduler = new WebInspector.ReplayTaskScheduler().run();

    WebInspector.debuggerModel.addEventListener(WebInspector.DebuggerModel.Events.DebuggerPaused,  this._debuggerPaused, this);
    WebInspector.debuggerModel.addEventListener(WebInspector.DebuggerModel.Events.DebuggerResumed, this._debuggerResumed, this);
};

WebInspector.TimelapseModel.ReplaySpeed = {
    Normal: "Normal",
    Seeking: "Seeking",
    //-
    Default: "Seeking"
};

WebInspector.TimelapseModel.Events = {
    Enabled: "TimelapseEnabled",
    Disabled: "TimelapseDisabled",
    StatusChanged: "TimelapseStatusChanged",

    // Recording* events are coarse-grained, and control switching of entire views.
    // Capture{Will,Did}{Start,Stop} events are fine-grained, suitable for
    // updating capture-specific widget progress but not for creating them.
    
    // The ordering of these events during capture lifecycle is as follows:
    // RecordingUnloaded (can only record from here)
    // -> CaptureWillStart -> RecordingCreated -> CaptureDidStart
    // -> CaptureWillStop  -> RecordingAdded   -> CaptureDidStop -> RecordingLoaded
    //
    // Recordings can be added independently or capture, replay, or load status.
    // A recording can only be loaded or unloaded from the opposite state.

    // fires when a new recording is initialized for capturing (but is unloaded).
    RecordingCreated: "TimelapseRecordingCreated",
    // fires when recording loaded from disk, or finished capturing it.
    RecordingAdded: "TimelapseRecordingAdded",
    // fired when activeRecording changes.
    RecordingLoaded: "TimelapseRecordingLoaded",
    RecordingUnloaded: "TimelapseRecordingUnloaded",

    // These events are associated with capture.
    CaptureWillStart: "TimelapseCaptureWillStart",
    CaptureDidStart: "TimelapseCaptureDidStart",
    CaptureWillStop: "TimelapseCaptureWillStop",
    CaptureDidStop: "TimelapseCaptureDidStop",

    // These events are associated with playback.
    PlaybackWillStart: "TimelapsePlaybackWillStart",
    PlaybackDidStart: "TimelapsePlaybackDidStart",
    PlaybackStopped: "TimelapsePlaybackStopped",

    // Hits of actual breakpoints or inputs always trigger *Hit events.
    BreakpointHit: "TimelapseBreakpointHit",
    InputHit: "TimelapseInputHit",

    // Debugger pauses or input pauses are preceded by the *Waiting events.
    // *Waiting events allow listeners to prevent the default actions, in
    // the case that they perform automated steps without user interaction.
    DebuggerWaiting: "TimelapseDebuggerWaiting",
    InputWaiting: "TimelapseInputWaiting",

    // The default action taken for *Waiting events is to update the status bar
    // and fire the corresponding *Paused event below. These trigger breakpoint
    // sliders, etc. that are present for the user to interact with paused states.
    DebuggerPaused: "TimelapseDebuggerPaused",
    InputPaused: "TimelapseInputPaused",

    InputLocked: "TimelapseInputLocked",
    InputUnlocked: "TimelapseInputUnlocked",
};

WebInspector.TimelapseModel.prototype = {
    /* TimelapseModel represents the state of execution and capture
     * or replay. Clients call methods of TimelapseModel to issue
     * commands that affect record or replay, or to query its state.
     * 
     * This model also translates backend->frontend calls into events.
     */

    // Public command API
    enable: function()
    {
	this.changeStatus("Enabling...");
	return TimelapseAgent.enable();
    },

    disable: function()
    {
	this.changeStatus("Disabling...");
	return TimelapseAgent.disable();
    },

    isEnabled: function(cb)
    {
	return TimelapseAgent.enable(cb);
    },

    startCapture: function()
    {
        var model = this;
        var events = WebInspector.TimelapseModel.Events;

        var task = new WebInspector.ReplayTask("StartCapture")
        .chain("stopPlaybackIfNeeded", function(cb) {
            if (model.isReplaying)
               model.stopPlaybackTask(true).run(cb)
            else
                cb();
        })
        .chain("unloadRecordingIfNeeded", function(cb) {
            if (model.canReplay)
                model._unloadRecording();
            cb();
        })
        .chain("suppressBreakpointsAndNotifyWillStart", function(cb) {
            console.assert(!model.isCapturing && !model.isReplaying,
                           "Cannot start capture whilst capturing or replaying alreday.");
            model.changeStatus("Starting capture...");
            model.dispatchEventToListeners(events.CaptureWillStart);
            model._suppressBreakpoints();
            cb();
        })
        .chain("resumeDebuggerIfPaused",
               WebInspector.TimelapseModel.Steps.ResumeDebuggerIfPaused)
        .chain("requestStartCapture", function(cb) {
            model.onceEventListener(events.CaptureDidStart, cb, this);

            // we must create recording before receiving CaptureDidStart, because
            // the recording needs to listen for that event as well.
            var recording = model._activeRecording = new WebInspector.TimelapseLiveRecording(model);
            model.dispatchEventToListeners(WebInspector.TimelapseModel.Events.RecordingCreated, recording);
            TimelapseAgent.startCapture();
        })
        .chain("notifyDidStart", function(cb) {
            model._capturing = true;
            model.changeStatus("Capturing...");
            cb();
        });
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    stopCapture: function()
    {
        if (!this.isCapturing)
            return;

        var model = this;
        var events = WebInspector.TimelapseModel.Events;
        var task = new WebInspector.ReplayTask("StopCapture")
        .chain("notifyWillStop", function(cb) {
            model.changeStatus("Stopping capture...");
            model.dispatchEventToListeners(events.CaptureWillStop);
            cb();
        })
        .chain("requestCaptureStop", function(cb) {
            model.onceEventListener(events.CaptureDidStop, cb, this);
            TimelapseAgent.stopCapture(cb);
        })
        .chain("handleCaptureStopped", function(cb) {
            var recording = model.createdRecording;
            delete model._activeRecording;
            model._capturing = false;
            model.changeStatus("Ready");
            model._unsuppressBreakpoints();
            var numRecords = recording.allRecords.length;
            if (numRecords == 0) {
                model._currentMarkIndex = 0;
                return cb(true);
            }
            model._currentMarkIndex = recording.allRecords[numRecords-1].mark.index;

            // actually add and load the just-captured recording.
            model._addRecording(recording);
            model._loadRecording(recording);
            cb();
        });
        
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    replayUpToMarkIndex: function(markIndex, allowBreakpoints, replaySpeed)
    {
        this.changeStatus("Starting replay...");

        var task = this.startReplayUpToMarkIndexTask(markIndex, allowBreakpoints, replaySpeed);
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    startReplayUpToMarkIndexTask: function(markIndex, allowBreakpoints, replaySpeed)
    {
        var model = this;
        var task = new WebInspector.ReplayTask("ReplayUpToMarkIndex");
        task.chain("setDefaults", function(cb) {
            /* ensure defaults if no arguments */
            allowBreakpoints = (typeof allowBreakpoints === "undefined") ? false : allowBreakpoints;
            var replaySpeeds = WebInspector.TimelapseModel.ReplaySpeed;
            model._replaySpeed = (replaySpeed in replaySpeeds) ? replaySpeed
                                                               : replaySpeeds.Default;
            cb();
        });

        if (!allowBreakpoints) {
            task.chain("suppressBreakpointsIfNeeded", function(cb) {
                    model._suppressBreakpoints();
                cb();
            });
        }

        task.chain("resumeDebuggerIfPaused",
               WebInspector.TimelapseModel.Steps.ResumeDebuggerIfPaused);
        task.chain("notifyAndRequestReplay", function(cb) {
            // decide replay starting and ending mark indices
            var allRecords = model.loadedRecording.allRecords;
            var canReplayWithoutRestart = model.isReplaying &&
                model._currentMarkIndex && model._currentMarkIndex <= markIndex;

            model._replayStartIndex = (canReplayWithoutRestart) ? model._currentMarkIndex
                                         : model.loadedRecording.allRecords[0].mark.index;
            model._replayFinishIndex = markIndex;

            var seeking = WebInspector.TimelapseModel.ReplaySpeed.Seeking;
            model.dispatchEventToListeners(WebInspector.TimelapseModel.Events.PlaybackWillStart);
            model.onceEventListener(WebInspector.TimelapseModel.Events.PlaybackDidStart, cb, model);
            TimelapseAgent.replayUpToMarkIndex(markIndex+1, model.replaySpeed == seeking);
        });
        
        task.chain("notifyReplayStarted", function(cb){
            model._replaying = true;
            model._inputPaused = false;
            model.changeStatus("Replaying...");
            cb();
        });
        
        return task;
    },

    _replayToCompletionTask: function(allowBreakpoints, replaySpeed)
    {
        var model = this;
        var task = new WebInspector.ReplayTask("ReplayToCompletion");
        task.chain("setDefaults", function(cb) {
            model.changeStatus("Starting replay...");
            /* ensure defaults if no arguments */
            allowBreakpoints = (typeof allowBreakpoints === "undefined") ? false : allowBreakpoints;
            var replaySpeeds = WebInspector.TimelapseModel.ReplaySpeed;
            model._replaySpeed = (replaySpeed in replaySpeeds) ? replaySpeed
                                                               : replaySpeeds.Default;
            cb();
        });

        if (!allowBreakpoints) {
            task.chain("suppressBreakpointsIfNeeded", function(cb) {
                    model._suppressBreakpoints();
                cb();
            });
        }

        task.chain("resumeDebuggerIfPaused",
               WebInspector.TimelapseModel.Steps.ResumeDebuggerIfPaused);
        task.chain("notifyAndRequestReplay", function(cb) {
            // decide replay starting and ending mark indices
            var allRecords = model.loadedRecording.allRecords;
            var lastMarkIndex = allRecords[allRecords.length-1].mark.index;
            // TODO: revisit this?
            // replayToCompletion() from the last mark causes last mark to play,
            // unless a recording was just made and there is no replay state.
            model._replayStartIndex = (!this._replaying && this._currentMarkIndex == lastMarkIndex) ? allRecords[0].mark.index : this._currentMarkIndex;
            model._replayFinishIndex = lastMarkIndex;

            var seeking = WebInspector.TimelapseModel.ReplaySpeed.Seeking;
            model.dispatchEventToListeners(WebInspector.TimelapseModel.Events.PlaybackWillStart);
            model.onceEventListener(WebInspector.TimelapseModel.Events.PlaybackDidStart, cb, model);
            TimelapseAgent.replayToCompletion(model.replaySpeed == seeking);
        });

        task.chain("notifyReplayStarted", function(cb){
            model._replaying = true;
            model._inputPaused = false;
            model.changeStatus("Replaying...");
            cb();
        });
        
        return task;
    },
    
    replayToCompletion: function(allowBreakpoints, replaySpeed)
    {
        var task = this._replayToCompletionTask(allowBreakpoints, replaySpeed);
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    replayToBreakpointHit: function(markIndex, hitIndex, allowBreakpoints, replaySpeed)
    {
        var task = this.replayToBreakpointHitTask(markIndex, hitIndex, allowBreakpoints, replaySpeed);
        this._scheduler.cancelAllTasks().enqueue(task);
    },
    
    replayToBreakpointHitTask: function(markIndex, hitIndex, allowBreakpoints, replaySpeed)
    {
        var model = this;
        var timelapseEvents = WebInspector.TimelapseModel.Events;
        var task = new WebInspector.ReplayTask("ReplayToBreakpointHit");

        // Always hit a breakpoint by seeking to preceding mark (if not there),
        // play one mark, and then start playback and resume |hitIndex-1| times.
        if (this._currentMarkIndex != markIndex-1) {
            task.chain("ReplayToPrecedingMark", function(cb) {
                var recordIndex = model.loadedRecording.recordIndexFromMarkIndex(markIndex);
                var prevIndex = model.loadedRecording.allRecords[recordIndex - 1].mark.index;
                model.onceEventListener(timelapseEvents.InputPaused, cb, task);
                model.startReplayUpToMarkIndexTask(prevIndex, allowBreakpoints, replaySpeed).run();
            });
        }
        task.chain("ReplayOneMark", function(cb) {
            model.onceEventListener(timelapseEvents.InputPaused, cb, task);
            model.startReplayUpToMarkIndexTask(markIndex, allowBreakpoints, replaySpeed).run();
        });
        task.chain("RequestReplayWithBreakpoints", function(cb) {
            var subtask = model._replayToCompletionTask(true, replaySpeed);
            subtask.run(cb);
        });
        task.chain("CountDebuggerWait" + hitIndex + "Times", function(cb) {
            this._waitCount = 0;
            var debuggerWaitingCallback = function(event) {
                // we arrived at the wait we were looking for.
                if (this._waitCount++ == hitIndex) {
                    model.removeEventListener(timelapseEvents.DebuggerWaiting,
                                              debuggerWaitingCallback,
                                              task);
                    return cb();
                }
                // otherwise, prevent debugger wait from propagating; resume.
                event.preventDefault();
                if (WebInspector.debuggerModel.isPaused())
                    DebuggerAgent.resume();
            };
           
            model.addEventListener(timelapseEvents.DebuggerWaiting,
                                   debuggerWaitingCallback, task);
        });
        
        return task;
    },
    
    // pauses playback immediately, cancelling any in-progress tasks.
    pausePlayback: function()
    {
        var model = this;
        var task = new WebInspector.ReplayTask("PausePlayback");
        task.chain("suppressBreakpoints", function(cb) {
            model.changeStatus("Pausing...");
            model._suppressBreakpoints();
            cb();
        });
        task.chain("resumeDebuggerIfPaused",
            WebInspector.TimelapseModel.Steps.ResumeDebuggerIfPaused);
        task.chain("requestPlaybackPause", function(cb) {
            var events = WebInspector.TimelapseModel.Events;
            model.onceEventListener(events.InputPaused, cb, this);
            TimelapseAgent.pausePlayback();
        });
       
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    stopPlayback: function(shouldUnlock)
    {
        this.changeStatus("Stopping playback...");
        this._scheduler.cancelAllTasks().enqueue(this._stopPlaybackTask(shouldUnlock));
    },

    _stopPlaybackTask: function(shouldUnlock)
    {
        var model = this;
        return new WebInspector.ReplayTask("StopPlayback")
        .chain("suppressBreakpoints", function(cb) {
            model._suppressBreakpoints();
            cb();
        })
        .chain("resumeDebuggerIfPaused",
               WebInspector.TimelapseModel.Steps.ResumeDebuggerIfPaused)
        .chain("requestPlaybackStop", function(cb) {
            var events = WebInspector.TimelapseModel.Events;
            model.onceEventListener(events.PlaybackStopped, cb, this);
            TimelapseAgent.stopPlayback(!!shouldUnlock);
        });
    },

    // Public query API
    get createdRecording()
    {
    console.assert(this.isCapturing, "TimelapseModel.createdRecording only available when capturing is in progress.");
    return this._activeRecording;
    },

    get loadedRecording()
    {
    console.assert(this.canReplay, "TimelapseModel.loadedRecording only available when replay is possible.");
    return this._activeRecording;
    },
    
    get recordings()
    {
        return this._recordings.slice(0);
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
    
    get breakpointScanner()
    {
        return this._breakpointScanner;
    },

    // Internal helpers
    _unloadRecording: function()
    {
    console.assert(this.loadedRecording, "Can't unload recording because none is loaded");

    this._canReplay = false;

    var recording = this.loadedRecording;
    delete this._activeRecording;
    this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.RecordingUnloaded, recording);
    },
    
    _loadRecording: function(recording)
    {
    console.assert(!this._activeRecording, "Can't load recording because one is already loaded");
    
    this._canReplay = true;
    
    this._activeRecording = recording;
    this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.RecordingLoaded, recording);
    },
    
    _addRecording: function(recording)
    {
    this._recordings.push(recording);
    this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.RecordingAdded, recording);
    },
    
    changeStatus: function(newStatus)
    {
	this._status = newStatus || "(no status)";
	this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.StatusChanged, this._status);
    },

    // Callbacks from the backend message dispatcher (TimelapseDispatcher below)
    _timelapseEnabled: function()
    {
    this._canReplay = false;
	this.changeStatus("Ready");
	this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.Enabled);
    },

    _timelapseDisabled: function()
    {
	this._canReplay = false;
	this.changeStatus("Disabled");
	this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.Disabled);
    },
    
    _playbackPausedAtInput: function(markIndex)
    {
    var timelapseEvents = WebInspector.TimelapseModel.Events;
    
    // This event is used to allow default action prevention when pausing at an input.
    var defaultPrevented = this.dispatchEventToListeners(timelapseEvents.InputWaiting, markIndex);
    if (defaultPrevented)
        return;

    // This is the default action for when we have paused at an input.
	this._inputPaused = true;
	this._unsuppressBreakpoints();

	this.changeStatus("Paused");
	this.dispatchEventToListeners(timelapseEvents.InputPaused, markIndex);
    },

    _playbackStopped: function()
    {
	this._replaying = false;
	this._unsuppressBreakpoints();

    // TODO: breakpoint scanner may want to prevent default here.
    // default action:
	this.changeStatus("Ready");
	this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.PlaybackStopped);
    },

    _playbackError: function(isFatal, errorMessage)
    {
        var data = {
            "errorMessage": errorMessage,
            "isFatal": isFatal,
        };
    
        this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.PlaybackError, data);
    },

    _lockedInput: function()
    {
    	this._inputLocked = true;
        this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.InputLocked);
    },

    _unlockedInput: function()
    {
    	this._inputLocked = false;

        if (!this.capture)
            this.changeStatus("Ready");

        this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.InputUnlocked);
    },

    _playbackHitInput: function(markIndex)
    {
        if (this.loadedRecording.recordIndexFromMarkIndex(markIndex) > -1)
            this._currentMarkIndex = markIndex;

        this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.InputHit, markIndex);
    },

    // this is the raw DebuggerModel event. We translate into our own
    // Debugger{Waiting,Paused} events. Breakpoint-related events are interpreted
    // by TimelapseBreakpointTracker.
    _debuggerPaused: function(event)
    {
	if (!this.isReplaying)
	    return;

    var timelapseEvents = WebInspector.TimelapseModel.Events;
    var debuggerEvents = WebInspector.DebuggerModel.Events;

    // This event is used to allow default action prevention when doing debugger walks
    // or during breakpoint scanning.
    var defaultPrevented = this.dispatchEventToListeners(timelapseEvents.DebuggerWaiting, event);
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

	this.dispatchEventToListeners(timelapseEvents.DebuggerPaused);
    },

    _debuggerResumed: function()
    {
	if (!this.isReplaying)
	    return;

	this._replayStartIndex = this._currentMarkIndex;

	this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.PlaybackWillStart);
	this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.PlaybackDidStart);
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

WebInspector.TimelapseDispatcher = function(model)
{
    this._model = model;
    InspectorBackend.registerTimelapseDispatcher(this);
};

WebInspector.TimelapseDispatcher.prototype = {
    timelapseWasEnabled: function()
    {
	this._model._timelapseEnabled();
    },

    timelapseWasDisabled: function()
    {
	this._model._timelapseDisabled();
    },

    captureWasStarted: function()
    {
        this._model.dispatchEventToListeners(WebInspector.TimelapseModel.Events.CaptureDidStart);
    },

    captureWasStopped: function()
    {
        this._model.dispatchEventToListeners(WebInspector.TimelapseModel.Events.CaptureDidStop);
    },

    capturedAction: function(record)
    {
	this._model.createdRecording._capturedAction(record);
    },

    playbackWasStarted: function()
    {
        this._model.dispatchEventToListeners(WebInspector.TimelapseModel.Events.PlaybackDidStart);
    },

    playbackWasPaused: function(markIndex)
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
	this._model._playbackHitInput(markIndex);
    }
};

WebInspector.TimelapseModel.Steps = {
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

WebInspector.timelapseModel;
