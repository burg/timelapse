/*
 *  Copyright (C) 2012, Brian Burg, Jake Bailey.
 *  Copyright (C) 2012, University of Washington. All rights reserved.
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
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseControllerView = function()
{
    WebInspector.View.call(this);

    this.element.id = "timelapse-controller-view";
    this.element.tabIndex = 0;

    this._model = WebInspector.timelapseModel;
    this._presentationModel = WebInspector.timelapsePresentationModel;

    var eventNames = WebInspector.TimelapseModel.EventTypes;
    this._model.addEventListener(eventNames.Enabled, this._timelapseEnabled, this);
    this._model.addEventListener(eventNames.Disabled, this._timelapseDisabled, this);
    this._model.addEventListener(eventNames.RecordingDidStart, this._recordingDidStart, this);
    this._model.addEventListener(eventNames.RecordingDidStop, this._recordingDidStop, this);

    this._recordingView = new WebInspector.TimelapseRecordingView(this);
    this._replayingView = new WebInspector.TimelapseReplayingView(this);

    this._createStatusBarButtons();
    this._registerShortcuts();
    this.element.addEventListener("keydown", this._keyDown.bind(this), false);
    this.element.addEventListener("focus", this.focus.bind(this), true);
    this.element.addEventListener("blur", this.blur.bind(this), true);

    // Tell backend to enable itself.
    this._model.enable();
};

WebInspector.TimelapseControllerView.prototype = {
    get statusBarItems()
    {
        var items = [this.toggleTimelapseButton.element];
	items.push(this.lockButton.element);
	items.push(this.toggleRecordButton.element);
	items.push(this.togglePlaybackButton.element);
	items.push(this.setAnchorButton.element);
	items.push(this.replayToAnchorButton.element);
	items.push(this.radarButton.element);
        return items;
    },

    reset: function()
    {
	this._recordingView.clear();
	this._replayingView.clear();

	if (this._replayingView.isShowing)
	    this._replayingView.detach();

	this._recordingView.show(this.element);
    },

    afterShow: function()
    {
	this.focus();
    },

    focus: function()
    {
	WebInspector.View.prototype.focus.call(this);
	this.element.style.opacity = 1.0;
    },

    blur: function()
    {
	this.element.style.opacity = 0.7;
    },

    /* subroutines of initialization */
    _createStatusBarButtons: function()
    {
	var controllerView = this;
	var eventNames = WebInspector.TimelapseModel.EventTypes;

        var timelapseButton = this.toggleTimelapseButton = new WebInspector.StatusBarButton("", "enable-toggle-status-bar-item");
        timelapseButton.addEventListener("click", this._toggleTimelapseButtonClicked, controllerView);
        this._model.addEventListener(eventNames.Enabled, function() {
            this.title = WebInspector.UIString("Timelapse enabled. Click to disable.");
            this.toggled = true;
        }, timelapseButton);
        this._model.addEventListener(eventNames.Disabled, function() {
            this.title = WebInspector.UIString("Timelapse disabled. Click to enable.");
            this.toggled = false;
        }, timelapseButton);

	//the lock/unlock button
	var lockButton = this.lockButton = new WebInspector.StatusBarButton(WebInspector.UIString("Timelapse Locking Mode"), "timelapse-lock-status-bar-item");
        lockButton.addEventListener("click", this._lockButtonClicked, this);
        this._model.addEventListener(eventNames.Enabled, function() {
            this.disabled = true;
            this.visible = true;
            this.toggled = false;
            this.title = "Input unlocked.";
        }, lockButton);
        this._model.addEventListener(eventNames.Disabled, function() {
            this.visible = false;
        }, lockButton);
        this._model.addEventListener(eventNames.RecordingDidStart, function() {
            this.disabled = true;
        }, lockButton);
        this._model.addEventListener(eventNames.RecordingDidStop, function() {
            this.disabled = false;
        }, lockButton);
        this._model.addEventListener(eventNames.InputLocked, function() {
            this.title = "Input locked.";
            this.toggled = true;
        }, lockButton);
        this._model.addEventListener(eventNames.InputUnlocked, function() {
            if (this._recording) return;
            this.title = "Input unlocked.";
            this.toggled = false;
        }, lockButton);

        //the play/pause button
        var playbackButton = this.togglePlaybackButton = new WebInspector.StatusBarButton("", "playback-toggle-status-bar-item");
        playbackButton.addEventListener("click", controllerView._togglePlaybackButtonClicked, this);
        playbackButton.disabled = true;
        this.toggled = false;
        playbackButton.element.addStyleClass("play-playback-status-bar-item");
        this._model.addEventListener(eventNames.Enabled, function() {
            this.visible = true;
            this.disabled = true;
            this.toggled = false;
        }, playbackButton);
        this._model.addEventListener(eventNames.Disabled, function() {
            this.visible = false;
        }, playbackButton);
        this._model.addEventListener(eventNames.RecordingDidStart, function() {
            this.disabled = true;
        }, playbackButton);
        this._model.addEventListener(eventNames.RecordingDidStop, function() {
            this.disabled = false;
        }, playbackButton);
        this._model.addEventListener(eventNames.PlaybackDidStart, function() {
            this.element.removeStyleClass("play-playback-status-bar-item");
            this.element.addStyleClass("pause-playback-status-bar-item");
        }, playbackButton);
        this._model.addEventListener(eventNames.InputPaused, function() {
            this.element.removeStyleClass("pause-playback-status-bar-item");
            this.element.addStyleClass("play-playback-status-bar-item");
        }, playbackButton);
        this._model.addEventListener(eventNames.BreakpointPaused, function() {
            this.element.removeStyleClass("pause-playback-status-bar-item");
            this.element.addStyleClass("play-playback-status-bar-item");
        }, playbackButton);
        this._model.addEventListener(eventNames.PlaybackStopped, function() {
            this.element.removeStyleClass("pause-playback-status-bar-item");
            this.element.addStyleClass("play-playback-status-bar-item");
        }, playbackButton);

	//the set-anchor button
	var setAnchorButton = this.setAnchorButton = new WebInspector.StatusBarButton("", "set-anchor-status-bar-item");

	setAnchorButton.addEventListener("click", this._setAnchorButtonClicked, controllerView);
        this._model.addEventListener(eventNames.Enabled, function() {
            this.visible = true;
            this.disabled = true;
        }, setAnchorButton);
        this._model.addEventListener(eventNames.Disabled, function() {
            this.visible = false;
        }, setAnchorButton);
        this._model.addEventListener(eventNames.RecordingDidStart, function() {
            this.disabled = true;
        }, setAnchorButton);
        this._model.addEventListener(eventNames.PlaybackDidStart, function() {
	    this.disabled = true;
	}, setAnchorButton);
        this._model.addEventListener(eventNames.PlaybackStopped, function() {
	    this.disabled = true;
	}, setAnchorButton);
	this._model.addEventListener(eventNames.BreakpointPaused, function() {
	    this.disabled = false;
	}, setAnchorButton);

        //the replay-to-anchor button
        var anchorButton = this.replayToAnchorButton = new WebInspector.StatusBarButton("", "replay-to-anchor-status-bar-item");

        anchorButton.addEventListener("click", this._replayToAnchorButtonClicked, controllerView);
        this._model.addEventListener(eventNames.Enabled, function() {
            this.visible = true;
            this.disabled = true;
        }, anchorButton);
        this._model.addEventListener(eventNames.Disabled, function() {
            this.visible = false;
        }, anchorButton);
        this._model.addEventListener(eventNames.RecordingDidStart, function() {
            this.disabled = true;
        }, anchorButton);
        this._model.addEventListener(eventNames.PlaybackDidStart, function() {
	    this.toggled = WebInspector.timelapsePresentationModel.replayingToAnchor;
	    this.disabled = true;
	}, anchorButton);
        this._model.addEventListener(eventNames.InputPaused, function() {
	    this.toggled = WebInspector.timelapsePresentationModel.replayingToAnchor;
	    this.disabled = !WebInspector.timelapsePresentationModel.anchorManager.hasAnchor();
	}, anchorButton);
        this._model.addEventListener(eventNames.PlaybackStopped, function() {
	    this.toggled = false;
	    this.disabled = !WebInspector.timelapsePresentationModel.anchorManager.hasAnchor();
	}, anchorButton);
	this._model.addEventListener(eventNames.BreakpointPaused, function() {
	    this.toggled = false;
	    this.disabled = !WebInspector.timelapsePresentationModel.anchorManager.hasAnchor();
	}, anchorButton);
	this._presentationModel.addEventListener(WebInspector.TimelapsePresentationModel.EventTypes.DebuggerPaused, function() {
	    this.toggled = false;
	}, anchorButton);

	var anchor = this._presentationModel.anchorManager;
	var anchorEvents = WebInspector.TimelapseAnchorManager.EventTypes;
        anchor.addEventListener(anchorEvents.AnchorSet, function() {
            this.disabled = false;
        }, anchorButton);
	anchor.addEventListener(anchorEvents.AnchorRemoved, function() {
            this.disabled = !WebInspector.timelapsePresentationModel.anchorManager.hasAnchor();
	}, anchorButton);

        //the record button
        var recordButton = this.toggleRecordButton = new WebInspector.StatusBarButton("", "toggle-record-status-bar-item");
        recordButton.addEventListener("click", this._toggleRecordButtonClicked, controllerView);
        this._model.addEventListener(eventNames.Enabled, function() {
            this.disabled = false;
            this.visible = true;
            this.toggled = WebInspector.timelapseModel.recording;
            this.title = "Click to record.";
        }, recordButton);
        this._model.addEventListener(eventNames.Disabled, function() {
            this.visible = false;
        }, recordButton);
        this._model.addEventListener(eventNames.RecordingWillStart, function() {
            this.disabled = true;
        }, recordButton);
        this._model.addEventListener(eventNames.RecordingDidStart, function() {
            this.disabled = false;
            this.toggled = true;
            this.title = "Recording. Click to stop.";
        }, recordButton);
        this._model.addEventListener(eventNames.RecordingWillStop, function() {
            this.disabled = true;
        }, recordButton);
        this._model.addEventListener(eventNames.RecordingDidStop, function() {
            this.disabled = false;
            this.toggled = false;
            this.title = "Not recording. Click to re-record.";
        }, recordButton);

	//the breakpoint radar button
	var radarButton = this.radarButton = new WebInspector.StatusBarButton("", "breakpoint-radar-status-bar-item");
	radarButton.addEventListener("click", this._radarButtonClicked, controllerView);
        this._model.addEventListener(eventNames.Enabled, function() {
            this.visible = true;
            this.disabled = true;
        }, radarButton);
        this._model.addEventListener(eventNames.Disabled, function() {
            this.visible = false;
        }, radarButton);
        this._model.addEventListener(eventNames.RecordingDidStart, function() {
            this.disabled = true;
        }, radarButton);
        this._model.addEventListener(eventNames.RecordingDidStop, function() {
            this.disabled = false;
        }, radarButton);
        this._model.addEventListener(eventNames.PlaybackDidStart, function() {
	    this.toggled = WebInspector.timelapseModel.scanningBreakpoints;
        }, radarButton);
	this._presentationModel.addEventListener(WebInspector.TimelapsePresentationModel.EventTypes.DebuggerPaused, function() {
	    this.toggled = WebInspector.timelapseModel.scanningBreakpoints;
	}, radarButton);
	this._model.addEventListener(eventNames.InputPaused, function() {
	    this.toggled = WebInspector.timelapseModel.scanningBreakpoints;
	}, radarButton);
        this._model.addEventListener(eventNames.PlaybackStopped, function() {
	    this.toggled = false;
        }, radarButton);
    },

    _registerShortcuts: function()
    {
	this._shortcuts = {};

	function registerAndDocument(shortcuts, handlers, descriptor, related)
	{
            var shortcutNames = [];
            for (var i = 0; i < shortcuts.length; ++i) {
		this._shortcuts[shortcuts[i].key] = handlers[i];
		shortcutNames.push(shortcuts[i].name);
            }

            var section = WebInspector.shortcutsScreen.section(WebInspector.UIString("Timelapse"));
	    if (related)
		section.addRelatedKeys(shortcutNames, descriptor);
	    else
		section.addAlternateKeys(shortcutNames, descriptor);
	}

	var view = this;
	var backend = this._model;
	var handlers, shortcuts, descriptor;
	var platformSpecificModifier = WebInspector.KeyboardShortcut.Modifiers.CtrlOrMeta;

	// Play/pause.
	shortcuts = [];
	handlers = [];
	var spacebar = WebInspector.KeyboardShortcut.Keys.Space;
        shortcuts.push(WebInspector.KeyboardShortcut.makeDescriptor(spacebar));
	handlers.push(this._togglePlaybackButtonClicked.bind(this));
	descriptor = WebInspector.UIString("Play/pause");
	registerAndDocument.call(view, shortcuts, handlers, descriptor);
    },

    /* event handlers */
    _keyDown: function(event)
    {
        var shortcut = WebInspector.KeyboardShortcut.makeKeyFromEvent(event);
        var handler = this._shortcuts[shortcut];
        if (handler) {
            handler();
            event.preventDefault();
            return;
        }
    },

    _lockButtonClicked: function()
    {
	if (!this._enabled)
	    return;

	// if in playback mode and locked, then unlock. This should
	// just stop the current playback, which will cause unlock
	// anyway.
	if (this._model.inputLocked)
	    this._model.stopPlayback(true);
    },

    _toggleTimelapseButtonClicked: function(optionalAlways)
    {
	//enable timelapse
        if (!this._enabled) {
            WebInspector.settings.timelapseEnabled.set(!!optionalAlways);
            this._model.enable();
	}

	//disable timelapse. First, stop recording or playback.
	if (this._model.recording)
	    this._model.stopRecording();

	if (this._model.replaying && !this._model.inputPaused)
	    this._model.stopPlayback();

        WebInspector.settings.timelapseEnabled.set(false);
        this._model.disable();
    },

    _toggleRecordButtonClicked: function()
    {
	if (this._model.recording)
	    this._model.stopRecording();
	else
	    this._model.startRecording();
    },

    _togglePlaybackButtonClicked: function()
    {
	if (!this._model.canReplay)
	    return;

	if (!this._model.replaying)
	    this._model.replayToCompletion(true, false);

	else if (this._model.replaying && this._model.inputPaused)
	    this._model.replayToCompletion(true, false);

	else if (this._model.replaying && this._model.breakpointPaused)
	    DebuggerAgent.resume();

	else if (this._model.replaying && !this._model.inputPaused)
	    this._model.pausePlayback();
    },

    _radarButtonClicked: function()
    {
	if (!this._model.scanningBreakpoints)
	    this._presentationModel.scanBreakpointsInZoomRegion();
	else
	    this._model.pausePlayback();
    },

    _timelapseEnabled: function()
    {
        this._enabled = true;
        this.reset();
    },

    _timelapseDisabled: function()
    {
        this._enabled = false;
        this.reset();

        // restore any disablements we did to the timeline.
        if (WebInspector.panels.timeline) {
            WebInspector.panels.timeline.toggleTimelineButton.disabled = false;
            WebInspector.panels.timeline.clearButton.disabled = false;
        }
    },

    _recordingDidStart: function()
    {
	this.reset();

	var timelinePanel = WebInspector.panels.timeline;
        // automatically turn on Timeline recording, and prevent its clearing or stopping.
        if (timelinePanel) {
            timelinePanel.toggleTimelineButton.disabled = false;
            timelinePanel.toggleTimelineButton.element.click();
            timelinePanel.toggleTimelineButton.disabled = true;
            timelinePanel.clearButton.disabled = true;
        }
    },

    _recordingDidStop: function()
    {
	// if nothing was recorded, don't even show the replay view.
	// the recording view knows to change its message in this situation.
	if (this._model.allRecords.length == 0)
	    return;

	this._recordingView.detach();
	this._replayingView.show(this.element);


	var timelinePanel = WebInspector.panels.timeline;
        // automatically turn off Timeline recording.
        if (timelinePanel) {
            timelinePanel.toggleTimelineButton.disabled = false;
            timelinePanel.toggleTimelineButton.element.click();
            timelinePanel.toggleTimelineButton.disabled = true;
        }
    },

    _setAnchorButtonClicked: function()
    {
	if (this._model.breakpointPaused)
	    this._presentationModel.anchorManager.setAnchor();
    },

    _replayToAnchorButtonClicked: function()
    {
	this._presentationModel.anchorManager.replayToAnchor();
    }
}

WebInspector.TimelapseControllerView.prototype.__proto__ = WebInspector.View.prototype;

/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseRecordingView = function()
{
    WebInspector.View.call(this);

    this._model = WebInspector.timelapseModel;
    this._presentationModel = WebInspector.timelapsePresentationModel;

    this.element.id = "timelapse-recording-view";

    this._messagePanel = document.createElement("div");
    this._messagePanel.className = "timelapse-recording-message";
    this._messagePanel.addEventListener("click", this._onMessagePanelClicked.bind(this), true);
    this.element.appendChild(this._messagePanel);

    var eventNames = WebInspector.TimelapseModel.EventTypes;
    this._model.addEventListener(eventNames.RecordingWillStart, this._onRecordingWillStart, this);
    this._model.addEventListener(eventNames.RecordingDidStart, this._onRecordingDidStart, this);
    this._model.addEventListener(eventNames.RecordingWillStop, this._onRecordingWillStop, this);
    this._model.addEventListener(eventNames.RecordingDidStop, this._onRecordingDidStop, this);

    WebInspector.resourceTreeModel.addEventListener(WebInspector.ResourceTreeModel.EventTypes.MainFrameNavigated, this._onMainFrameNavigated, this);

    this._scrollview = new WebInspector.TimelapseScrollview();
    this._scrollview.show(this.element);
};

WebInspector.TimelapseRecordingView.prototype = {
    clear: function()
    {
	this._messagePanel.textContent = "Click to Record.";
    },

    _onRecordingWillStart: function()
    {
	this._messagePanel.textContent = "Initializing...";
	this._messagePanel.classList.add("message-pulse");
    },

    _onRecordingDidStart: function()
    {
	this._messagePanel.textContent = "Reloading page...";
    },

    _onMainFrameNavigated: function()
    {
	if (this._model.recording)
	    this._messagePanel.textContent = "Recording... Click again to stop.";
    },

    _onRecordingWillStop: function()
    {
	this._messagePanel.textContent = "Working...";
    },

    _onRecordingDidStop: function()
    {
	this._messagePanel.classList.remove("message-pulse");

	if (this._model.allRecords.length == 0)
	    this._messagePanel.textContent = "Nothing was recorded. Please try again.";
    },

    _onMessagePanelClicked: function(event)
    {
	if (this._model.recording)
	    this._model.stopRecording();

	if (!this._model.recording && !this._model.replaying)
	    this._model.startRecording();
    }
};

WebInspector.TimelapseRecordingView.prototype.__proto__ = WebInspector.View.prototype;


/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseReplayingView = function()
{
    WebInspector.View.call(this);

    this.element.id = "timelapse-replaying-view";

    this._model = WebInspector.timelapseModel;
    this._presentationModel = WebInspector.timelapsePresentationModel;

    this._splitView = new WebInspector.SplitView(WebInspector.SplitView.SidebarPosition.Right,
						"timelapseControllerSplitView", 200);

    this._splitView.show(this.element);

    this._miniview = new WebInspector.TimelapseMiniview();
    this._miniview.show(this._splitView.mainElement);

    this._overviewWindow = new WebInspector.TimelapseOverview();
    this._overviewWindow.show(this._splitView.mainElement);

    this._overviewPreview = new WebInspector.TimelapseOverviewPreview();
    this._overviewPreview.show(this._splitView.sidebarElement);
};

WebInspector.TimelapseReplayingView.prototype = {
    clear: function()
    {
    },
};

WebInspector.TimelapseReplayingView.prototype.__proto__ = WebInspector.View.prototype;
