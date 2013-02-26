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

    //enablement defaults to preference
    this._capturing = false;
    this._replaying = false;
    this._inputPaused = false;
    this._breakpointPaused = false;
    this._canReplay = false;
    this._replaySpeed = WebInspector.TimelapseModel.ReplaySpeed.Default;
    this._inputLocked = false;
    // TODO: delete
    this._scanningBreakpoints = false;
    // TODO: delete
    this._replayingToBreakpoint = false;

    this._recordings = [];

    this._breakpointsWereEnabled = WebInspector.debuggerModel.breakpointsActive();
    this._suppressingBreakpoints = false;
    // TODO: delete
    this._replayActionQueue = [];

    this._scheduler = new WebInspector.ReplayTaskScheduler().run();
    // TODO: delete
    this._debuggerWalk = [];

    // TODO: delete
    WebInspector.debuggerModel.addEventListener(WebInspector.DebuggerModel.Events.DebuggerPaused, this._debuggerPaused, this);
    WebInspector.debuggerModel.addEventListener(WebInspector.DebuggerModel.Events.DebuggerResumed, this._debuggerResumed, this);
};

WebInspector.TimelapseModel.ReplaySpeed = {
    Normal: "Normal",
    Seeking: "Seeking",
    //-
    Default: "Normal"
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

    BreakpointPaused: "TimelapseBreakpointPaused",
    BreakpointHit: "TimelapseBreakpointHit",
    // fires after hit; default action is to show breakpoint cursor.
    DebuggerWaiting: "TimelapseDebuggerWaiting",

    InputPaused: "TimelapseInputPaused",
    InputHit: "TimelapseInputHit",
    InputLocked: "TimelapseInputLocked",
    InputUnlocked: "TimelapseInputUnlocked",

    BreakpointScanStarted: "TimelapseBreakpointScanStarted",
    BreakpointScanStopped: "TimelapseBreakpointScanStopped"
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
	this._changeStatus("Enabling...");
	return TimelapseAgent.enable();
    },

    disable: function()
    {
	this._changeStatus("Disabling...");
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
            // TODO: remove this eventually
            model._stopBreakpointScan();

            model._changeStatus("Starting capture...");
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
            model._changeStatus("Capturing...");
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
            model._changeStatus("Stopping capture...");
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
            model._changeStatus("Ready");
            model._unsuppressBreakpoints();
            var numRecords = recording.allRecords.length;
            if (numRecords == 0) {
                model._currentMarkIndex = 0;
                return cb(true);
            }
            // actually add and load the just-captured recording.
            model._addRecording(recording);
            model._loadRecording(recording);
            model._currentMarkIndex = recording.allRecords[numRecords-1].mark.index;
            cb();
        });
        
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    replayUpToMarkIndex: function(markIndex, allowBreakpoints, replaySpeed)
    {
        var task = this._replayUpToMarkIndexTask(markIndex, allowBreakpoints, replaySpeed);
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    _replayUpToMarkIndexTask: function(markIndex, allowBreakpoints, replaySpeed)
    {
        var model = this;
        var task = new WebInspector.ReplayTask("ReplayUpToMarkIndex");
        task.chain("setDefaults", function(cb) {
            model._changeStatus("Starting replay...");
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
            TimelapseAgent.replayUpToMarkIndex(markIndex+1,
                                               model.replaySpeed == seeking);
            cb();
        });
        
        return task;
    },

    _replayToCompletionTask: function(allowBreakpoints, replaySpeed)
    {
        var model = this;
        var task = new WebInspector.ReplayTask("ReplayToCompletion");
        task.chain("setDefaults", function(cb) {
            model._changeStatus("Starting replay...");
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
            TimelapseAgent.replayToCompletion(model.replaySpeed == seeking);
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
        var task = this._replayToBreakpointHitTask(markIndex, hitIndex, allowBreakpoints, replaySpeed);
        this._scheduler.cancelAllTasks().enqueue(task);
    },
    
    _replayToBreakpointHitTask: function(markIndex, hitIndex, allowBreakpoints, replaySpeed)
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
                var subtask = model._replayUpToMarkIndexTask(prevIndex, allowBreakpoints, replaySpeed);
                subtask.run(cb);
            });
        }
        task.chain("ReplayOneMark", function(cb) {
            var subtask = model._replayUpToMarkIndexTask(markIndex, allowBreakpoints, replaySpeed);
            subtask.run(cb);
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

    replayDebuggerWalk: function(markIndex, hitIndex, debuggerWalk)
    {
        var model = this;
        var debuggerEvents = WebInspector.DebuggerModel.Events;
        var speeds = WebInspector.TimelapseModel.ReplaySpeed;

        var task = new WebInspector.ReplayTask("ReplayDebuggerWalk");
        task.chain("ReplayToWalkStartingBreakpoint", function(cb) {
            var task = model._replayToBreakpointHitTask(markIndex, hitIndex, true, speeds.Seeking);
            task.run(cb);
        });
        
        for (var i = 0; i < debuggerWalk.length; i++) {
            task.chain("TakeDebuggerWalkStep", function(cb, event) {
                // the first callback will come from previous step, not DebuggerPaused
                if (typeof event !== "undefined")
                    event.preventDefault(); // stop 

                WebInspector.debuggerModel.onceEventListener(debuggerEvents.DebuggerPaused, cb, task);
                debuggerWalk.shift()();
            });
        }
        task.chain("UpdateStatus", function(cb) {
            model._changeStatus("At savepoint.");
            cb();
        });
        
        
        this._scheduler.cancelAllTasks().enqueue(task);
    },

    /* Scans breakpoints from startIndex (inclusive) to endIndex (exclusive). */
    scanBreakpointsInRegion: function(startIndex, endIndex)
    {
	var currentIndex = this._currentMarkIndex;
    var allRecords = this.loadedRecording.allRecords;

	/* Case: playback is paused inside the region to be scanned. */
	if (startIndex <= currentIndex && endIndex > currentIndex) {
	    this._enqueueAction(this.replayUpToMarkIndex.bind(this, endIndex, true, true));

	    if (startIndex > allRecords[0].mark.index)
		this._enqueueAction(this.replayUpToMarkIndex.bind(this, startIndex, false, true));

	    if (this._breakpointPaused)
		this._enqueueAction(this.replayToBreakpointHit.bind(this, currentIndex, this._breakpointHitIndex, true, true));
	    else
		this._enqueueAction(this.replayUpToMarkIndex.bind(this, currentIndex, true, true));
	}
	/* Case: playback is paused outside of the region to be scanned, or stopped. */
	else {
	    if (startIndex > allRecords[0].mark.index)
		this._enqueueAction(this.replayUpToMarkIndex.bind(this, startIndex, false, true));

	    // Workaround: currently there is no way to force replay up to the current mark index.
	    if (currentIndex == endIndex) {
		var endRecordIndex = this.loadedRecording.recordIndexFromMarkIndex(endIndex);
		var prevIndex = allRecords[endRecordIndex - 1].mark.index;
		this._enqueueAction(this.replayUpToMarkIndex.bind(this, prevIndex, true, true));
	    }

	    this._enqueueAction(this.replayUpToMarkIndex.bind(this, endIndex, true, true));

	    if (this._breakpointPaused)
		this._enqueueAction(this.replayToBreakpointHit.bind(this, currentIndex, this._breakpointHitIndex, false, true));
	    else
		this._enqueueAction(this.replayUpToMarkIndex.bind(this, currentIndex, false, true));
	}

	this._scanningBreakpoints = true;
	this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.BreakpointScanStarted);
	this._replayActionQueue.shift()();
    },

    // pauses playback immediately, cancelling any in-progress tasks.
    pausePlayback: function()
    {
        var model = this;
        var pauseTask = new WebInspector.ReplayTask("PausePlayback")
        .chain("suppressBreakpoints", function(cb) {
            //TODO: remove when scanning is task-ified.
            model._stopBreakpointScan();
            
            model._changeStatus("Pausing...");
            model._suppressBreakpoints();
            cb();
        })
        .chain("resumeDebuggerIfPaused",
               WebInspector.TimelapseModel.Steps.ResumeDebuggerIfPaused)
        .chain("requestPlaybackPause", function(cb) {
            var events = WebInspector.TimelapseModel.Events;
            var pausedCallback = function(cb) {
                model.removeEventListener(events.PlaybackWasPaused, pausedCallback, this);
                cb();
            }.bind(this, cb);
            
            model.addEventListener(events.PlaybackWasPaused, pausedCallback, this);
            TimelapseAgent.pausePlayback();
        });
       
        this._scheduler.cancelAllTasks().enqueue(pauseTask);
    },

    stopPlayback: function(shouldUnlock)
    {
        this._scheduler.cancelAllTasks().enqueue(this.stopPlaybackTask(shouldUnlock));
    },

    stopPlaybackTask: function(shouldUnlock)
    {
        var model = this;
        return new WebInspector.ReplayTask("StopPlayback")
        .chain("suppressBreakpoints", function(cb) {
            //TODO: remove when scanning is task-ified.
            model._stopBreakpointScan();
            
            model._changeStatus("Stopping playback...");
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

    get breakpointPaused()
    {
	return this._breakpointPaused;
    },

    get canReplay()
    {
	return this._canReplay;
    },

    get inputLocked()
    {
	return this._inputLocked;
    },

    get scanningBreakpoints()
    {
	return this._scanningBreakpoints;
    },

    get currentMarkIndex()
    {
	return this._currentMarkIndex;
    },

    get currentHitIndex()
    {
	return this._breakpointHitIndex;
    },

    get replayStartMarkIndex()
    {
	return this._replayStartIndex;
    },

    get replayFinishMarkIndex()
    {
	return this._replayFinishIndex;
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
    
    _changeStatus: function(newStatus)
    {
	this._status = newStatus || "(no status)";
	this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.StatusChanged, this._status);
    },

    // TODO: delete
    _enqueueAction: function(action)
    {
	this._replayActionQueue.push(action);
    },

    // TODO: delete
    _stopBreakpointScan: function() {
	if (!this._scanningBreakpoints)
	    return;

	this._replayActionQueue = [];
	this._scanningBreakpoints = false;
	this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.BreakpointScanStopped);
    },

    // Callbacks from the backend message dispatcher (TimelapseDispatcher below)
    _timelapseEnabled: function()
    {
    this._canReplay = false;
	this._changeStatus("Ready");
	this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.Enabled);
    },

    _timelapseDisabled: function()
    {
	this._canReplay = false;
	this._changeStatus("Disabled");
	this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.Disabled);
    },
    
    _playbackStarted: function()
    {
	this._replaying = true;
	this._inputPaused = false;
	this._changeStatus("Replaying...");
	this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.PlaybackDidStart);
    },

    _playbackPausedAtInput: function()
    {
	this._inputPaused = true;
	this._unsuppressBreakpoints();

    // TODO: remove
	if (this._replayActionQueue.length)
	    return this._replayActionQueue.shift()();

    // TODO: remove
	this._stopBreakpointScan();

	this._changeStatus("Paused");
	this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.InputPaused);
    },

    _playbackStopped: function()
    {
	this._replaying = false;
	this._unsuppressBreakpoints();

    // TODO: remove
	if (this._replayActionQueue.length)
	    return this._replayActionQueue.shift()();

    // TODO: remove
	this._stopBreakpointScan();
    
	this._changeStatus("Ready");
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
            this._changeStatus("Ready");

        this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.InputUnlocked);
    },

    _playbackHitInput: function(markIndex)
    {
        if (this.loadedRecording.recordIndexFromMarkIndex(markIndex) > -1)
            this._currentMarkIndex = markIndex;
        this._breakpointHitIndex = -1;
        this.dispatchEventToListeners(WebInspector.TimelapseModel.Events.InputHit, markIndex);
    },

    _debuggerPaused: function(event)
    {
	if (!this.isReplaying)
	    return;

	var rawLocation = event.data.callFrames[0].location;
	var uiLocation = WebInspector.debuggerModel.rawLocationToUILocation(rawLocation);
	var lineNumber = rawLocation.lineNumber;
	var breakpoint = WebInspector.breakpointManager.findBreakpoint(uiLocation.uiSourceCode, lineNumber);

    var timelapseEvents = WebInspector.TimelapseModel.Events;
    var debuggerEvents = WebInspector.DebuggerModel.Events;

	// Record breakpoint hit. We keep track for TimelapseModel.replayToBreakpointHit
    // TODO: this could be made dynamic with listeners
	if (breakpoint) {
	    this._breakpointHitIndex++;
	    this.dispatchEventToListeners(timelapseEvents.BreakpointHit, event.data);
	}

    // TODO: move to task, prevent default for DebuggerPaused
	// Continue scanning breakpoints/replaying to target breakpoint
	if (this._scanningBreakpoints)
	    return DebuggerAgent.resume();

    // This event is used to allow default action prevention when doing debugger walks
    // or during breakpoint scanning.
    var defaultPrevented = this.dispatchEventToListeners(timelapseEvents.DebuggerWaiting, event);
    if (defaultPrevented)
        return;

    // This is the default action for when the debugger is waiting on the user.
	if (breakpoint) {
        var oldStatus = this._status;
        var restoreStatusCallback = function() {
            this._changeStatus(oldStatus);
        };
	    this._changeStatus("Hit breakpoint");
        
        WebInspector.debuggerModel.onceEventListener(debuggerEvents.DebuggerResumed,
                                                    restoreStatusCallback, this);
	}

	// FIXME: We reach this point when the pause/step over/step in commands are used in
	// the debugger, so "breakpointPaused" isn't a great way to describe the current state.
    // TODO: unify this with DebuggerWaiting above, so that the status change is the default
	this._breakpointPaused = true;
	this.dispatchEventToListeners(timelapseEvents.BreakpointPaused);
    },

    _debuggerResumed: function()
    {
	if (!this.isReplaying || !this._breakpointPaused)
	    return;

	this._breakpointPaused = false;
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
	this._model._playbackStarted();
    },

    playbackWasPaused: function(markIndex)
    {
	this._model._playbackPausedAtInput();
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
