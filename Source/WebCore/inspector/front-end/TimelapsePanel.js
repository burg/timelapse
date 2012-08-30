/**
 * @constructor
 * @extends {WebInspector.Panel}
 */
WebInspector.TimelapsePanel = function()
{
    WebInspector.Panel.call(this, "timelapse");
    this.registerRequiredCSS("timelapsePanel.css");

    this._presentationModel = WebInspector.timelapsePresentationModel;
    this._model = WebInspector.timelapseModel;
    this._enabled = Preferences.timelapseAlwaysEnabled;

    var eventNames = WebInspector.TimelapseModel.EventTypes;
    this._model.addEventListener(eventNames.Enabled, this._timelapseEnabled, this);
    this._model.addEventListener(eventNames.Disabled, this._timelapseDisabled, this);
    this._model.addEventListener(eventNames.RecordingDidStart, this._recordingDidStart, this);
    this._model.addEventListener(eventNames.RecordingDidStop, this._recordingDidStop, this);

    this.createSplitView();
    this.splitView.hideMainElement();

    this._recordingView = new WebInspector.TimelapseRecordingView(this);
    this._replayingView = new WebInspector.TimelapseReplayingView(this);

    this._viewsContainerElement = this.splitView.mainElement;
    this._viewsContainerElement.id = "timelapse-views";
    this._viewsContainerElement.addStyleClass("hidden");

    this._registerShortcuts();
    this._createGlobalStatusBarButtons();
    this._createStatusBarButtons();

    this.popover = new WebInspector.TimelapsePopover(this);
    document.body.addEventListener("mousemove", this.startHidePopoverTimer.bind(this), false);

    this._reset();

    //tell backend to enable
    if (Preferences.timelapseAlwaysEnabled || WebInspector.settings.timelapseEnabled.get())
	// if enabled from prefs, synthetically make the enable event fire.
        this._model.enable();
    else {
        function onTimelapseEnabled(error, value) {
            if (value)
                WebInspector.timelapseModel.enable();
        }
        this._model.isEnabled(onTimelapseEnabled.bind(this));
    }
};

WebInspector.TimelapsePanel.prototype = {
    get toolbarItemLabel()
    {
        return WebInspector.UIString("Timelapse");
    },

    get statusBarItems()
    {
        var items = [this.toggleTimelapseButton.element];
	items.push(this.toggleRecordButton.element);
	items.push(this.togglePlaybackButton.element);
	items.push(this.setAnchorButton.element);
	items.push(this.replayToAnchorButton.element);
	items.push(this.radarButton.element);
        return items;
    },

    wasShown: function()
    {
        WebInspector.Panel.prototype.wasShown.call(this);
    },

    willHide: function()
    {
	this.popover.hide();
	WebInspector.Panel.prototype.willHide.call(this);
    },

    //called to clear the interface without reloading inspector.html/building DOM
    _reset: function()
    {
        WebInspector.Panel.prototype.reset.call(this);
        this.searchCanceled();
        this.removeAllListeners();
	this._recordingView.clear();
	this._replayingView.clear();

	if (this._replayingView.isShowing)
	    this._replayingView.detach();

	this._recordingView.show(this.sidebarElement);
    },

    _registerShortcuts: function()
    {
	function registerAndDocument(shortcuts, handlers, descriptor, related)
	{
            var shortcutNames = [];
            for (var i = 0; i < shortcuts.length; ++i) {
	    	this.registerShortcut(shortcuts[i].key, handlers[i]);
	    	shortcutNames.push(shortcuts[i].name);
            }

            var section = WebInspector.shortcutsScreen.section(WebInspector.UIString("Timelapse Panel"));
	    if (related)
		section.addRelatedKeys(shortcutNames, descriptor);
	    else
		section.addAlternateKeys(shortcutNames, descriptor);
	}

	var panel = this;
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
	registerAndDocument.call(panel, shortcuts, handlers, descriptor);

	// Next/previous input.
	shortcuts = [];
	handlers = [];
        shortcuts.push(WebInspector.KeyboardShortcut.makeDescriptor("n"));
	handlers.push(function() {
	    if (!backend.inputPaused) return;
	    var grid = panel._replayingView._dataGrid;
	    grid.replayToNextNode.call(grid);
	});
	shortcuts.push(WebInspector.KeyboardShortcut.makeDescriptor("p"));
	handlers.push(function() {
	    if (!backend.inputPaused) return;
	    var grid = panel._replayingView._dataGrid;
	    grid.replayToPreviousNode.call(grid);
	});
	descriptor = WebInspector.UIString("Replay to next/previous input");
	registerAndDocument.call(panel, shortcuts, handlers, descriptor, true);

	// Continue debugging.
	shortcuts = [];
	handlers = [];
        shortcuts.push(WebInspector.KeyboardShortcut.makeDescriptor("c"));
	handlers.push(function() { DebuggerAgent.resume(); });
	descriptor = WebInspector.UIString("Continue debugging");
	registerAndDocument.call(panel, shortcuts, handlers, descriptor);
    },

    /* subroutines of initialization */
    _createGlobalStatusBarButtons: function()
    {
	var panel = this;
	var eventNames = WebInspector.TimelapseModel.EventTypes;

        // these three widgets are inserted into the right-anchored status
        // bar area by WebInspector._createGlobalStatusBarItems, if this panel
        // is loaded at all.
        this.globalLockButton = new WebInspector.StatusBarButton(WebInspector.UIString("Timelapse Locking Mode"), "timelapse-lock-status-bar-item");
        this.globalLockButton.addEventListener("click", this._lockButtonClicked, panel);
        this._model.addEventListener(eventNames.Enabled, function() {
            this.disabled = true;
            this.visible = true;
            this.toggled = false;
            this.title = "Input unlocked.";
        }, panel.globalLockButton);
        this._model.addEventListener(eventNames.Disabled, function() {
            this.visible = false;
        }, panel.globalLockButton);
        this._model.addEventListener(eventNames.RecordingDidStart, function() {
            this.disabled = true;
        }, panel.globalLockButton);
        this._model.addEventListener(eventNames.RecordingDidStop, function() {
            this.disabled = false;
        }, panel.globalLockButton);
        this._model.addEventListener(eventNames.InputLocked, function() {
            this.title = "Input locked.";
            this.toggled = true;
        }, panel.globalLockButton);
        this._model.addEventListener(eventNames.InputUnlocked, function() {
            if (panel._recording) return;
            this.title = "Input unlocked.";
            this.toggled = false;
        }, panel.globalLockButton);

	// this is the status message widget. It's plucked out and
	// attached by the main inspector script.
        this.statusMessage = document.createElement("div");
        this.statusMessage.id = "timelapse-status";
        this._model.addEventListener(eventNames.Enabled, function() {
           this.classList.remove("hidden");
        }, this.statusMessage);
        this._model.addEventListener(eventNames.Disabled, function() {
           this.classList.add("hidden");
        }, this.statusMessage);
	this._model.addEventListener(eventNames.StatusChanged, function(event) {
            var message = event.data;
            this.removeChildren();
            var messageSpan = document.createElement("span");
            messageSpan.textContent = WebInspector.UIString(message);
            this.appendChild(messageSpan);
        }, this.statusMessage);
    },

    _createStatusBarButtons: function()
    {
	var panel = this;
	var eventNames = WebInspector.TimelapseModel.EventTypes;

        var timelapseButton = this.toggleTimelapseButton = new WebInspector.StatusBarButton("", "enable-toggle-status-bar-item");
        timelapseButton.addEventListener("click", this._toggleTimelapseButtonClicked, panel);
        this._model.addEventListener(eventNames.Enabled, function() {
            this.title = WebInspector.UIString("Timelapse enabled. Click to disable.");
            this.toggled = true;
        }, timelapseButton);
        this._model.addEventListener(eventNames.Disabled, function() {
            this.title = WebInspector.UIString("Timelapse disabled. Click to enable.");
            this.toggled = false;
        }, timelapseButton);

        //the play/pause button
        var playbackButton = this.togglePlaybackButton = new WebInspector.StatusBarButton("", "playback-toggle-status-bar-item");
        playbackButton.addEventListener("click", panel._togglePlaybackButtonClicked, this);
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

	setAnchorButton.addEventListener("click", this._setAnchorButtonClicked, panel);
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

        anchorButton.addEventListener("click", this._replayToAnchorButtonClicked, panel);
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
        recordButton.addEventListener("click", this._toggleRecordButtonClicked, panel);
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
	radarButton.addEventListener("click", this._radarButtonClicked, panel);
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

    /* event handlers */
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
        this._reset();
    },

    _timelapseDisabled: function()
    {
        this._enabled = false;
        this._reset();

        // restore any disablements we did to the timeline.
        if (WebInspector.panels.timeline) {
            WebInspector.panels.timeline.toggleTimelineButton.disabled = false;
            WebInspector.panels.timeline.clearButton.disabled = false;
        }
    },

    _recordingDidStart: function() {
	this._reset();

	var timelinePanel = WebInspector.panels.timeline;
        // automatically turn on Timeline recording, and prevent its clearing or stopping.
        if (timelinePanel) {
            timelinePanel.toggleTimelineButton.disabled = false;
            timelinePanel.toggleTimelineButton.element.click();
            timelinePanel.toggleTimelineButton.disabled = true;
            timelinePanel.clearButton.disabled = true;
        }
    },

    _recordingDidStop: function() {
	this._recordingView.detach();
	this._replayingView.show(this.sidebarElement);
	
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
    },

    startHidePopoverTimer: function(event)
    {
	if (!WebInspector.Popover._popoverElement || this._hidePopoverTimer)
	    return;

	function doHide() {
	    this.popover.hide();
	    delete this._hidePopoverTimer;
	}
	this._hidePopoverTimer = setTimeout(doHide.bind(this), 1000);
    },

    killHidePopoverTimer: function(event)
    {
        if (this._hidePopoverTimer) {
            clearTimeout(this._hidePopoverTimer);
            delete this._hidePopoverTimer;
        }
    }
};

WebInspector.TimelapsePanel.prototype.__proto__ = WebInspector.Panel.prototype;

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
    wasShown: function()
    {
	this.refresh();
    },
    
    refresh: function()
    {
	this._scrollview.refresh();
	this._scrollview.onResize();
    },
    
    clear: function()
    {
	this._scrollview.reset();
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

    this._dataGrid = new WebInspector.TimelapseGrid();
    this._dataGrid.show(this.element);

    this._miniview = new WebInspector.TimelapseMiniview();
    this._miniview.show(this.element);

    this._overviewWindow = new WebInspector.TimelapseOverview();
    this._overviewWindow.show(this.element);

    var labelContainer = document.createElement("div");
    labelContainer.className = "timelapse-timeline-labels";

    var order = this._presentationModel.categoryOrder;
    var height = this._presentationModel.timelineHeight;
    for (var i = 0; i < order.length; i++) {
	var key = order[i];
	var label = new WebInspector.TimelapseTimelineLabel(this._presentationModel.categories[key]);
	label.element.style.setProperty("top", height*i + "px");
	labelContainer.appendChild(label.element);
    }
    this.element.appendChild(labelContainer);
};

WebInspector.TimelapseReplayingView.prototype = {
    wasShown: function()
    {
	this._overviewWindow.refresh();
	this._dataGrid.wasShown();
	this._miniview.refresh();
	this._miniview.onResize();
    },
    
    refresh: function()
    {
	this._overviewWindow.refresh();
	this._dataGrid.refresh();
	this._miniview.refresh();
	this._miniview.onResize();
    },
    
    clear: function()
    {
	this._overviewWindow.reset();
	this._dataGrid.reset();
	this._miniview.reset();
    }
};

WebInspector.TimelapseReplayingView.prototype.__proto__ = WebInspector.View.prototype;


/**
 * @constructor
 * @extends {WebInspector.Object}
 */
WebInspector.TimelapseTimelineLabel = function(category)
{
    WebInspector.Object.call(this);

    this._presentationModel = WebInspector.timelapsePresentationModel;
    this.category = category;

    this.element = document.createElement("div");
    this.element.className = "timelapse-timeline-label-wrapper timelapse-category-" + category.name;
    this.element.style.setProperty("background-color", category.color.toString());

    var label = document.createElement("div");
    label.className = "timelapse-timeline-label timelapse-category-" + category.name;
    label.textContent = category.title;
    label.title = category.title;
    label.addEventListener("click", this._onLabelClicked.bind(this), false);
    this.element.appendChild(label);

    var events = WebInspector.TimelapsePresentationModel.EventTypes;
    this._presentationModel.addEventListener(events.FilterChanged, this.refresh, this);
};

WebInspector.TimelapseTimelineLabel.prototype = {
    _onLabelClicked: function()
    {
	this._presentationModel.toggleCategory(this.category);
    },
    
    refresh: function()
    {
	if (this.category.disabled)
	    this.disable();
	else
	    this.enable();
    },
    
    enable: function()
    {
	this.element.classList.remove("disabled");
    },

    disable: function()
    {
	this.element.classList.add("disabled");
    }
};

WebInspector.TimelapseTimelineLabel.prototype.__proto__ = WebInspector.Object.prototype;


WebInspector.TimelapsePopover = function(panel)
{
    WebInspector.Popover.call(this);

    this._panel = panel;

    var model = WebInspector.timelapseModel;
    var eventNames = WebInspector.TimelapseModel.EventTypes;

    model.addEventListener(eventNames.Enabled, this.hide, this);
    model.addEventListener(eventNames.Disabled, this.hide, this);
    model.addEventListener(eventNames.RecordingDidStart, this.hide, this);
    model.addEventListener(eventNames.PlaybackStopped, this.hide, this);
}

WebInspector.TimelapsePopover.prototype = {
    show: function(records, position)
    {
	if (this._disposed)
	    return;

	if (!records) {
	    this.hide();
	    return;
	}

	this._records = records;
	this._position = position;
	this.contentElement = WebInspector.timelapsePresentationModel.generatePopupContent(records);

        // This should not happen, but we hide previous popup to be on the safe side.
        if (WebInspector.Popover._popoverElement)
            document.body.removeChild(WebInspector.Popover._popoverElement);
        WebInspector.Popover._popoverElement = this.element;

        // Temporarily attach in order to measure preferred dimensions.
        this.contentElement.positionAt(0, 0);
        document.body.appendChild(this.contentElement);
        var preferredWidth = this.contentElement.offsetWidth;
        var preferredHeight = this.contentElement.offsetHeight;

	this._contentDiv.removeChildren();
	this._contentDiv.appendChild(this.contentElement);
        this.element.appendChild(this._contentDiv);
        document.body.appendChild(this.element);
        this._positionElement(position, preferredWidth, preferredHeight);
        this._visible = true;
	this._panel.killHidePopoverTimer.call(this._panel);
        this.contentElement.addEventListener("mousemove", function(event) {
	    this._panel.killHidePopoverTimer.call(this._panel);
	    event.stopPropagation();
	}.bind(this), true);
    },

    _positionElement: function(anchorPosition, preferredWidth, preferredHeight)
    {
	const borderWidth = 2;
        const scrollerWidth = 11;
        const arrowHeight = 6;
        const arrowOffset = 8;
	const arrowLeft = 12; // default arrow position
	const minArrowPosition = 7;
	const borderRadius = 12;

	var totalWidth = window.innerWidth;
	var totalHeight = window.innerHeight;

        var newElementPosition = {
	    x: 0,
	    y: anchorPosition.y + arrowHeight,
	    width: preferredWidth,
	    height: preferredHeight
	};

        // Positioning below the anchor.
        if (newElementPosition.y + newElementPosition.height + borderWidth * 2 >= totalHeight) {
            newElementPosition.height = totalHeight - anchorPosition.y - arrowHeight - borderWidth * 2;
	    newElementPosition.width += scrollerWidth;
        }

        if (anchorPosition.x + newElementPosition.width + borderWidth - arrowLeft - arrowOffset < totalWidth) {
	    // Touching left or no border.
            newElementPosition.x = Math.max(borderWidth, anchorPosition.x - borderWidth - arrowLeft - arrowOffset);
	    if (newElementPosition.x == borderWidth)
		this._popupArrowElement.style.left = Math.max(minArrowPosition, anchorPosition.x - arrowOffset) + "px";
	    else
		this._popupArrowElement.style.left = arrowLeft + "px";
        }
	else if (newElementPosition.width + borderWidth * 2 < totalWidth) {
	    // Touching right border.
            newElementPosition.x = totalWidth - newElementPosition.width - borderWidth * 2;
            this._popupArrowElement.style.right = Math.max(minArrowPosition, totalWidth - anchorPosition.x - borderWidth - arrowOffset - 1) + "px";
	    this._popupArrowElement.style.left = "auto";
        }
	else {
	    // Touching both borders.
            newElementPosition.x = borderWidth;
            newElementPosition.width = totalWidth - borderWidth * 2;
	    newElementPosition.height += scrollerWidth;
            this._popupArrowElement.style.left = Math.max(0, anchorPosition.x - arrowOffset) + "px";
        }

        this.element.className = "timelapse-popover custom-popup-vertical-scroll custom-popup-horizontal-scroll";
        this.element.positionAt(Math.round(newElementPosition.x), Math.round(newElementPosition.y));
        this.element.style.width = newElementPosition.width + borderWidth * 2 + "px";
        this.element.style.height = newElementPosition.height + borderWidth * 2 + "px";
    },

    refresh: function()
    {
	if (this._visible && this._records && this._position)
	    this.show(this._records, this._position);
    }
}

WebInspector.TimelapsePopover.prototype.__proto__ = WebInspector.Popover.prototype;
