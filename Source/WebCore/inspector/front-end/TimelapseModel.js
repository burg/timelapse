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
    this._records = [];

    //enablement defaults to preference
    this._recording = false;
    this._replaying = false;
    this._inputPaused = false;
    this._breakpointPaused = false;
    this._canReplay = false;
    this._inputLocked = false;
    this._scanningBreakpoints = false;
    this._replayingToBreakpoint = false;

    this._breakpointsWereEnabled = WebInspector.debuggerModel.breakpointsActive();
    this._suppressingBreakpoints = false;
    this._pauseCallbacks = [];
    this._debuggerWalk = [];

    WebInspector.debuggerModel.addEventListener(WebInspector.DebuggerModel.Events.DebuggerPaused, this._debuggerPaused, this);
    WebInspector.debuggerModel.addEventListener(WebInspector.DebuggerModel.Events.DebuggerResumed, this._debuggerResumed, this);
};

WebInspector.TimelapseModel.EventTypes = {
    Enabled: "TimelapseEnabled",
    Disabled: "TimelapseDisabled",
    StatusChanged: "TimelapseStatusChanged",

    // These events are associated with capture.
    RecordingWillStart: "TimelapseRecordingWillStart",
    RecordingDidStart: "TimelapseRecordingDidStart",
    RecordingWillStop: "TimelapseRecordingWillStop",
    RecordingDidStop: "TimelapseRecordingDidStop",
    RecordAdded: "TimelapseRecordAdded",

    // These events are associated with playback.
    PlaybackWillStart: "TimelapsePlaybackWillStart",
    PlaybackDidStart: "TimelapsePlaybackDidStart",
    PlaybackStopped: "TimelapsePlaybackStopped",

    BreakpointPaused: "TimelapseBreakpointPaused",
    BreakpointHit: "TimelapseBreakpointHit",

    InputPaused: "TimelapseInputPaused",
    InputHit: "TimelapseInputHit",
    InputLocked: "TimelapseInputLocked",
    InputUnlocked: "TimelapseInputUnlocked"
};

WebInspector.TimelapseModel.prototype = {
    /* TimelapseModel represents the state of execution and recording
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

    startRecording: function()
    {
	this._pauseCallbacks = [];
	this._scanningBreakpoints = false;

	this._changeStatus("Starting capture...");
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.RecordingWillStart);

	this._suppressBreakpoints();

	if (WebInspector.debuggerModel.isPaused()) {
	    this._resumeCallback = this.startRecording.bind(this);
	    DebuggerAgent.resume();
	    return;
	}

	if (this._replaying) {
	    this._pauseCallbacks.push(TimelapseAgent.startRecording);
	    this.stopPlayback(true);
	    return;
	}

	TimelapseAgent.startRecording();
    },

    stopRecording: function()
    {
	var wasAllowed = TimelapseAgent.stopRecording();
	if (wasAllowed) {
	    this._changeStatus("Stopping capture...");
	    this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.RecordingWillStop);
	}

	return wasAllowed;
    },

    replayUpToMarkIndex: function(markIndex, allowBreakpoints, fastReplay)
    {
	if (fastReplay)
	    this._changeStatus("Starting fast replay...");
	else
	    this._changeStatus("Starting replay...");

	/* ensure defaults if no arguments */
	allowBreakpoints = (typeof allowBreakpoints === "undefined") ? false : allowBreakpoints;
	this._fastReplaying = (typeof fastReplay === "undefined") ? true : fastReplay;

	if (!allowBreakpoints)
	    this._suppressBreakpoints();

	if (WebInspector.debuggerModel.isPaused()) {
	    this._resumeCallback = this.replayUpToMarkIndex.bind(this, markIndex, allowBreakpoints, fastReplay);
	    DebuggerAgent.resume();
	    return;
	}

	// Workaround: attempting to replay to the first record replays through entire recording (see Issue #17)
	// if (markIndex == this._records[0].mark.index)
	//     markIndex = this._records[1].mark.index;

	this._replayStartIndex = this._records[0].mark.index;
	if (this._replaying && this._currentMarkIndex && this._currentMarkIndex <= markIndex)
	    this._replayStartIndex = this._currentMarkIndex;
	this._replayFinishIndex = markIndex;
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.PlaybackWillStart);
	return TimelapseAgent.replayUpToMarkIndex(markIndex+1, this.fastReplaying);
    },

    replayToCompletion: function(allowBreakpoints, fastReplay)
    {
	if (fastReplay)
	    this._changeStatus("Starting fast replay...");
	else
	    this._changeStatus("Starting replay...");

	/* ensure defaults if no arguments */
	allowBreakpoints = (typeof allowBreakpoints === "undefined") ? true : allowBreakpoints;
	this._fastReplaying = (typeof fastReplay === "undefined") ? false : fastReplay;

	if (!allowBreakpoints)
	    this._suppressBreakpoints();

	if (WebInspector.debuggerModel.isPaused()) {
	    this._resumeCallback = this.replayToCompletion.bind(this, allowBreakpoints, fastReplay);
	    DebuggerAgent.resume();
	    return;
	}

	// TODO: revisit this?
	// replayToCompletion() from the last mark causes last mark to play, 
	// unless a recording was just made and there is no replay state.
	var lastMarkIndex = this._records[this._records.length-1].mark.index;
	this._replayStartIndex = (!this._replaying && this._currentMarkIndex == lastMarkIndex) ? this._records[0].mark.index : this._currentMarkIndex;
	this._replayFinishIndex = lastMarkIndex;
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.PlaybackWillStart);
	return TimelapseAgent.replayToCompletion(this.fastReplaying);
    },

    replayToBreakpointHit: function(markIndex, hitIndex, allowBreakpoints, fastReplay)
    {
	this._targetHitIndex = hitIndex;
	this._replayingToBreakpoint = true;

	if (this._replaying && this._currentMarkIndex == markIndex) {
	    // Workaround: currently there is no way to force replay up to the current mark index.
	    if (hitIndex < this._breakpointHitIndex) {
		var recordIndex = this.recordIndexFromMarkIndex(markIndex);
		var prevIndex = this._records[recordIndex - 1].mark.index;
		this._pauseCallbacks.push(this.replayUpToMarkIndex.bind(this, markIndex, allowBreakpoints, fastReplay))
		this.replayUpToMarkIndex(prevIndex, allowBreakpoints, fastReplay);
	    }
	    else if (hitIndex > this._breakpointHitIndex) {
		if (WebInspector.debuggerModel.isPaused())
		    DebuggerAgent.resume();
		else
		    this.replayToCompletion(true);
	    }
	    else if (hitIndex == this._breakpointHitIndex) {
		delete this._targetHitIndex;
		this._replayingToBreakpoint = false;
	    }
	}
	else
	    this.replayUpToMarkIndex(markIndex, allowBreakpoints, fastReplay);
    },

    replayDebuggerWalk: function(markIndex, hitIndex, debuggerWalk)
    {
	this._debuggerWalk = debuggerWalk.slice();

	if (this._replaying && this._currentMarkIndex == markIndex) {
	    // Workaround: currently there is no way to force replay up to the current mark index.
	    var recordIndex = this.recordIndexFromMarkIndex(markIndex);
	    var prevIndex = this._records[recordIndex - 1].mark.index;
	    this._pauseCallbacks.push(this.replayToBreakpointHit.bind(this, markIndex, hitIndex, false, true));
	    this.replayUpToMarkIndex(prevIndex, false, true);
	}
	else
	    this.replayToBreakpointHit(markIndex, hitIndex, false, true);
    },

    /* Scans breakpoints from startIndex (inclusive) to endIndex (exclusive). */
    scanBreakpointsInRegion: function(startIndex, endIndex)
    {
	var currentIndex = this._currentMarkIndex;

	/* Case: playback is paused inside the region to be scanned. */
	if (startIndex <= currentIndex && endIndex > currentIndex) {
	    this._pauseCallbacks.push(this.replayUpToMarkIndex.bind(this, endIndex, true, true));

	    if (startIndex > this._records[0].mark.index)
		this._pauseCallbacks.push(this.replayUpToMarkIndex.bind(this, startIndex, false, true));

	    if (this._breakpointPaused)
		this._pauseCallbacks.push(this.replayToBreakpointHit.bind(this, currentIndex, this._breakpointHitIndex, true, true));
	    else
		this._pauseCallbacks.push(this.replayUpToMarkIndex.bind(this, currentIndex, true, true));
	}
	/* Case: playback is paused outside of the region to be scanned, or stopped. */
	else {
	    if (startIndex > this._records[0].mark.index)
		this._pauseCallbacks.push(this.replayUpToMarkIndex.bind(this, startIndex, false, true));

	    // Workaround: currently there is no way to force replay up to the current mark index.
	    if (currentIndex == endIndex) {
		var endRecordIndex = this.recordIndexFromMarkIndex(endIndex);
		var prevIndex = this._records[endRecordIndex - 1].mark.index;
		this._pauseCallbacks.push(this.replayUpToMarkIndex.bind(this, prevIndex, true, true));
	    }

	    this._pauseCallbacks.push(this.replayUpToMarkIndex.bind(this, endIndex, true, true));

	    if (this._breakpointPaused)
		this._pauseCallbacks.push(this.replayToBreakpointHit.bind(this, currentIndex, this._breakpointHitIndex, false, true));
	    else
		this._pauseCallbacks.push(this.replayUpToMarkIndex.bind(this, currentIndex, false, true));
	}

	this._scanningBreakpoints = true;
	this._pauseCallbacks.shift()();
    },

    pausePlayback: function()
    {
	if (this._scanningBreakpoints) {
	    this._pauseCallbacks = [];
	    this._scanningBreakpoints = false;
	}

	this._suppressBreakpoints();

	if (WebInspector.debuggerModel.isPaused()) {
	    this._resumeCallback = this.pausePlayback.bind(this);
	    DebuggerAgent.resume();
	    return;
	}

	this._changeStatus("Pausing...");
	return TimelapseAgent.pausePlayback();
    },

    stopPlayback: function(shouldUnlock)
    {
	if (this._scanningBreakpoints) {
	    this._pauseCallbacks = [];
	    this._scanningBreakpoints = false;
	}

	this._suppressBreakpoints();

	if (WebInspector.debuggerModel.isPaused()) {
	    this._resumeCallback = this.stopPlayback.bind(this);
	    DebuggerAgent.resume();
	    return;
	}

	this._changeStatus("Stopping playback...");
	return TimelapseAgent.stopPlayback(!!shouldUnlock);
    },

    // Public query API
    get recording()
    {
	return this._recording;
    },

    get replaying()
    {
	return this._replaying;
    },

    get fastReplaying()
    {
	return this._fastReplaying;
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

    get allRecords()
    {
	return this._records;
    },

    recordIndexFromMarkIndex: function(markIndex)
    {
	function markIndexAndRecordComparator(idx, record) {
	    var record_idx = record.mark.index;
	    if (record_idx > idx) return -1;
	    if (record_idx < idx) return 1;
	    return 0;
	}

	return this._records.binaryIndexOf(markIndex, markIndexAndRecordComparator);
    },

    timestampFromMarkIndex: function(markIndex)
    {
	var recordIndex = this.recordIndexFromMarkIndex(markIndex);
	var record = this._records[recordIndex];
	return record.mark.timestamp;
    },

    // Internal helpers
    _changeStatus: function(newStatus)
    {
	this._status = newStatus || "(no status)";
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.StatusChanged, this._status);
    },

    // Callbacks from the backend message dispatcher (TimelapseDispatcher below)
    _timelapseEnabled: function()
    {
    	this._canReplay = false;
	this._changeStatus("Ready");
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.Enabled);
    },

    _timelapseDisabled: function()
    {
	this._canReplay = false;
	this._changeStatus("Disabled");
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.Disabled);
    },
    
    _recordingDidStart: function()
    {
    	this._recording = true;
	this._changeStatus("Recording...");
	this._records = [];
	this._suppressBreakpoints();
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.RecordingDidStart);
    },

    _recordingDidStop: function()
    {
    	this._recording = false;
	this._canReplay = true;
	this._changeStatus("Ready");
	this._currentMarkIndex = this._records[this._records.length-1].mark.index;
	this._unsuppressBreakpoints();
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.RecordingDidStop);
    },

    _recordedAction: function(record)
    {
	this._records.push(record);
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.RecordAdded, record);
    },

    _playbackStarted: function()
    {
	this._replaying = true;
	this._inputPaused = false;
	this._changeStatus("Replaying...");
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.PlaybackDidStart);
    },

    _playbackPausedAtInput: function()
    {
	this._inputPaused = true;
	this._fastReplaying = false;
	this._unsuppressBreakpoints();

	if (this._pauseCallbacks.length) {
	    this._pauseCallbacks.shift()();
	    return;
	}

	this._scanningBreakpoints = false;

	if (this._replayingToBreakpoint) {
	    TimelapseAgent.replayToCompletion(true);
	    return;
	}

	this._changeStatus("Paused");
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.InputPaused);
    },

    _playbackStopped: function()
    {
	this._replaying = false;
	this._fastReplaying = false;
	this._replayingToBreakpoint = false;
	delete this._targetHitIndex;
	this._unsuppressBreakpoints();

	if (this._pauseCallbacks.length) {
	    this._pauseCallbacks.shift()();
	    return;
	}

	this._scanningBreakpoints = false;

	this._changeStatus("Ready");
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.PlaybackStopped);
    },

    _lockedInput: function()
    {
    	this._inputLocked = true;
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.InputLocked);
    },

    _unlockedInput: function()
    {
    	this._inputLocked = false;

	if (!this.recording)
	    this._changeStatus("Ready");

	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.InputUnlocked);
    },

    _playbackHitInput: function(markIndex)
    {
	if (this.recordIndexFromMarkIndex(markIndex) > -1)
    	    this._currentMarkIndex = markIndex;
	this._breakpointHitIndex = -1;
	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.InputHit, markIndex);
    },

    _debuggerPaused: function(event)
    {
	if (!this._replaying)
	    return;

	var rawLocation = event.data.callFrames[0].location;
	var uiLocation = WebInspector.debuggerModel.rawLocationToUILocation(rawLocation);
	var lineNumber = rawLocation.lineNumber;
	var breakpoint = WebInspector.breakpointManager.findBreakpoint(uiLocation.uiSourceCode, lineNumber);

	if (breakpoint) {
	    this._breakpointHitIndex++;
	    this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.BreakpointHit, event.data);

	    if (this._targetHitIndex == this._breakpointHitIndex) {
		this._replayingToBreakpoint = false;
		delete this._targetHitIndex;
	    }
	}

	if (!this._replayingToBreakpoint && this._debuggerWalk.length) {
	    this._debuggerWalk.shift()();
	    return;
	}

	if (breakpoint) {
	    if (this._replayingToBreakpoint || this._scanningBreakpoints)
		DebuggerAgent.resume();
	    else {
		this._statusBeforeBreakpointPause = this._status;
		this._changeStatus("Hit breakpoint");
		this._breakpointPaused = true;
		this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.BreakpointPaused);
	    }
	}
	else {
	    // FIXME: We reach this point when the pause/step over/step in commands are used in
	    // the debugger, so "breakpointPaused" isn't a great way to describe the current state.
	    this._breakpointPaused = true;
	    this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.BreakpointPaused);
	}
    },

    _debuggerResumed: function()
    {
	if (this._resumeCallback) {
	    this._resumeCallback();
	    delete this._resumeCallback;
	}

	if (!this._replaying || !this._breakpointPaused)
	    return;

	this._breakpointPaused = false;
	this._replayStartIndex = this._currentMarkIndex;

	if (this._statusBeforeBreakpointPause) {
	    var oldStatus = this._statusBeforeBreakpointPause;
	    delete this._statusBeforeBreakpointPause;
	    this._changeStatus(oldStatus);
	}

	this.dispatchEventToListeners(WebInspector.TimelapseModel.EventTypes.PlaybackDidStart);
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
    }
};

WebInspector.TimelapseModel.prototype.__proto__ = WebInspector.Object.prototype;

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

    recordingWasStarted: function()
    {
	this._model._recordingDidStart();
    },

    recordingWasStopped: function()
    {
	this._model._recordingDidStop();
    },

    recordedAction: function(record)
    {
	this._model._recordedAction(record);
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

WebInspector.timelapseModel;
