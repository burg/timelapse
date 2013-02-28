/*
 *  Copyright (C) 2012, 2013 Brian Burg, Jake Bailey.
 *  Copyright (C) 2012, 2013 University of Washington. All rights reserved.
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
WebInspector.TimelapseControllerView = function(model)
{
    WebInspector.View.call(this);

    this.element.id = "timelapse-controller-view";
    this.element.tabIndex = 0;

    this._model = model;

    var events = WebInspector.TimelapseModel.Events;
    this._model.addEventListener(events.Enabled, this._timelapseEnabled, this);
    this._model.addEventListener(events.Disabled, this._timelapseDisabled, this);
    this._model.addEventListener(events.RecordingCreated, this._recordingCreated, this);
    this._model.addEventListener(events.RecordingLoaded, this._recordingLoaded, this);
    this._model.addEventListener(events.RecordingUnloaded, this._recordingUnloaded, this);

    this.element.addEventListener("focus", this.focus.bind(this), true);
    this.element.addEventListener("blur", this.blur.bind(this), true);

    this._createSharedStatusBarButtons();

    this.currentView = new WebInspector.TimelapseDefaultView(model);

    // Tell backend to enable itself.
    this._model.enable();
};

WebInspector.TimelapseControllerView.prototype = {
    get statusBarItems()
    {
        return [
            this.toggleRecordButton.element,
            this._contextStatusBarItems
        ];
    },

    get currentView()
    {
        return this._currentView;
    },
    
    set currentView(view)
    {
        if (this._currentView) {
            this._currentView.detach();
            this._currentView.dispose();
        }
        
        this._currentView = view;
        
        this._contextStatusBarItems.removeChildren();
        var buttons = view.statusBarItems;
        
        for (var i = 0; i < buttons.length; i++)
            this._contextStatusBarItems.appendChild(buttons[i].element);

        this._currentView.show(this.element);
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

    _createSharedStatusBarButtons: function()
    {
        // only create buttons once.
        if (this._contextStatusBarItems)
            return;

        var controllerView = this;
        var eventNames = WebInspector.TimelapseModel.Events;

        this._contextStatusBarItems = document.createElement("div");
        this._contextStatusBarItems.className = "status-bar-items-group";

        //the record button
        var recordButton = this.toggleRecordButton = new WebInspector.StatusBarButton("", "toggle-record-status-bar-item");
        recordButton.addEventListener("click", this._toggleRecordButtonClicked, controllerView);
        this._model.addEventListener(eventNames.CaptureWillStart, function() {
            this.disabled = true;
        }, recordButton);
        this._model.addEventListener(eventNames.CaptureDidStart, function() {
            this.disabled = false;
            this.toggled = true;
            this.title = "Capture. Click to stop.";
        }, recordButton);
        this._model.addEventListener(eventNames.CaptureWillStop, function() {
            this.disabled = true;
        }, recordButton);
        this._model.addEventListener(eventNames.CaptureDidStop, function() {
            this.disabled = false;
            this.toggled = false;
            this.title = "Not recording. Click to re-record.";
        }, recordButton);
    },

    _toggleRecordButtonClicked: function()
    {
        if (this._model.isCapturing)
            this._model.stopCapture();
        else
            this._model.startCapture();
    },

    _timelapseEnabled: function()
    {
        this._enabled = true;
        this.currentView = new WebInspector.TimelapseDefaultView(this._model);
        this._createSharedStatusBarButtons();
    },

    _timelapseDisabled: function()
    {
        this._enabled = false;
        this.currentView = new WebInspector.TimelapseDefaultView(this._model);

        // TODO(Issue #79): don't automatically manage the timeline.
        // restore any disablements we did to the timeline.
        if (WebInspector.panels.timeline) {
            WebInspector.panels.timeline.toggleTimelineButton.disabled = false;
            WebInspector.panels.timeline.clearButton.disabled = false;
        }
    },

    _recordingCreated: function(event)
    {
        var recording = event.data;
        this.currentView = new WebInspector.TimelapseCaptureView(this._model, recording);

        // TODO(Issue #79): don't automatically manage the timeline.
        var timelinePanel = WebInspector.panels.timeline;
        // automatically turn on Timeline capture, and prevent its clearing or stopping.
        if (timelinePanel) {
            timelinePanel.toggleTimelineButton.disabled = false;
            timelinePanel.toggleTimelineButton.element.click();
            timelinePanel.toggleTimelineButton.disabled = true;
            timelinePanel.clearButton.disabled = true;
        }
    },

    _recordingLoaded: function(event)
    {
        // XXX: parameterize the default view's message
    
        // if nothing was recorded, don't even show the replay view.
        // the capture view knows to change its message in this situation.

        var recording = event.data;
        if (recording.allRecords.length == 0)
            return;

        this.currentView = new WebInspector.TimelapseReplayView(this._model, recording);

        // TODO(Issue #79): don't automatically manage the timeline.
        var timelinePanel = WebInspector.panels.timeline;
        // automatically turn off Timeline capture.
        if (timelinePanel) {
            timelinePanel.toggleTimelineButton.disabled = false;
            timelinePanel.toggleTimelineButton.element.click();
            timelinePanel.toggleTimelineButton.disabled = true;
        }
    },
    
    _recordingUnloaded: function()
    {
        this.currentView = new WebInspector.TimelapseDefaultView(this._model);
    },
    
    __proto__: WebInspector.View.prototype
}

/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseDefaultView = function(model)
{
    WebInspector.View.call(this);

    this._model = model;

    this.element.id = "timelapse-default-view";

    this._messagePanel = document.createElement("div");
    this._messagePanel.className = "timelapse-capture-message";
    this._messagePanel.textContent = "Nothing loaded. Click to start recording.";

    this._modifyListeners("addEventListener");
    
    this.element.appendChild(this._messagePanel);
};

WebInspector.TimelapseDefaultView.prototype = {
    _modifyListeners: function(op) {
        console.assert(op === "addEventListener" || op === "removeEventListener",
                       "Tried to do something unsupported to listeners: " + op);
        
        if (!this._clickListener)
            this._clickListener = this._onMessagePanelClicked.bind(this);
        
        this._messagePanel[op]("click", this._clickListener, true);

        var eventNames = WebInspector.TimelapseModel.Events;
        this._model[op](eventNames.CaptureWillStart, this._onCaptureWillStart, this);
    },
    
    willDispose: function()
    {
        this._modifyListeners("removeEventListener");
    },

    get statusBarItems()
    {
        return [];
    },

    _onMessagePanelClicked: function(event)
    {
        this._model.startCapture();
    },
    
    _onCaptureWillStart: function()
    {
        this._messagePanel.textContent = "Initializing...";
        this._messagePanel.classList.add("message-pulse");
    },
    
    __proto__: WebInspector.View.prototype
};

/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseCaptureView = function(model, recording)
{
    WebInspector.View.call(this);

    this._model = model;
    this._recording = recording;

    this.element.id = "timelapse-capture-view";

    this._messagePanel = document.createElement("div");
    this._messagePanel.classList.add("timelapse-capture-message");
    this._messagePanel.classList.add("message-pulse");
    this._messagePanel.textContent = "Reloading page...";
    this.element.appendChild(this._messagePanel);

    this._modifyListeners("addEventListener");

    this._scrollview = new WebInspector.TimelapseScrollview(model, recording);
    this._scrollview.show(this.element);
};

WebInspector.TimelapseCaptureView.prototype = {
    _modifyListeners: function(op) {
        console.assert(op === "addEventListener" || op === "removeEventListener",
                       "Tried to do something unsupported to listeners: " + op);
        
        if (!this._clickListener)
            this._clickListener = this._onMessagePanelClicked.bind(this);
        
        this._messagePanel[op]("click", this._clickListener, true);

        var eventNames = WebInspector.TimelapseModel.Events;
        this._model[op](eventNames.CaptureWillStop, this._onCaptureWillStop, this);
        this._model[op](eventNames.CaptureDidStop,  this._onCaptureDidStop, this);
        
         WebInspector.resourceTreeModel[op](WebInspector.ResourceTreeModel.EventTypes.MainFrameNavigated, this._onMainFrameNavigated, this);
    },

    willDispose: function()
    {
        this._modifyListeners("removeEventListener");
    },

    get statusBarItems()
    {
    return [];
    },

    _onMainFrameNavigated: function()
    {
    if (this._model.isCapturing)
        this._messagePanel.textContent = "Capturing... Click again to stop.";
    },

    _onCaptureWillStop: function()
    {
    this._messagePanel.textContent = "Working...";
    },

    _onCaptureDidStop: function()
    {
    this._messagePanel.classList.remove("message-pulse");

    // TODO: move to ReplayingView
    if (this._recording.allRecords.length == 0)
        this._messagePanel.textContent = "Nothing was captured. Please try again.";
    },

    _onMessagePanelClicked: function(event)
    {
    if (this._model.isCapturing)
        this._model.stopCapture();
    },
    
    __proto__: WebInspector.View.prototype
};

/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseReplayView = function(model, recording)
{
    WebInspector.View.call(this);

    this.element.id = "timelapse-replay-view";

    this._model = model;
    this._recording = recording;

    this._splitView = new WebInspector.SplitView(true,
                        "timelapseControllerSplitView", 200);
    this._splitView.show(this.element);

    this._overviewWindow = new WebInspector.TimelapseOverview(model, recording);
    this._overviewWindow.show(this._splitView.firstElement());

    this._miniview = new WebInspector.TimelapseMiniview(model, recording);
    this._miniview.show(this._splitView.firstElement());

    this._overviewPreview = new WebInspector.TimelapseOverviewPreview(model, recording);
    this._overviewPreview.show(this._splitView.secondElement());

    this._registerShortcuts();
    this._modifyListeners("addEventListener");
};

WebInspector.TimelapseReplayView.prototype = {
    _modifyListeners: function(op) {
        console.assert(op === "addEventListener" || op === "removeEventListener",
                       "Tried to do something unsupported to listeners: " + op);

        if (!this._keydownListener)
            this._keydownListener = this._keyDown.bind(this)
        
        this.element[op]("keydown", this._keydownListener, false);
    },
    
    willDispose: function()
    {
        this._modifyListeners("removeEventListener");
        // TODO: currently leaking status bar buttons via its listeners?
    },

    get statusBarItems()
    {
    if (!this._statusBarButtons)
        this._createReplayStatusBarButtons();

    return this._statusBarButtons;
    },

    _createReplayStatusBarButtons: function()
    {
        var eventNames = WebInspector.TimelapseModel.Events;
        var replayView = this;

        this._statusBarButtons = [];

        //the lock/unlock button
        var lockButton = this.lockButton = new WebInspector.StatusBarButton(WebInspector.UIString("Timelapse Locking Mode"), "timelapse-lock-status-bar-item");
        lockButton.addEventListener("click", this._lockButtonClicked, this);
        this._model.addEventListener(eventNames.InputLocked, function() {
            this.title = "Input locked.";
            this.toggled = true;
        }, lockButton);
        this._model.addEventListener(eventNames.InputUnlocked, function() {
            if (this._capture) return;
            this.title = "Input unlocked.";
            this.toggled = false;
        }, lockButton);
        this._statusBarButtons.push(lockButton);

        //the play/pause button
        var playbackButton = this.togglePlaybackButton = new WebInspector.StatusBarButton("", "playback-toggle-status-bar-item");
        playbackButton.addEventListener("click", replayView._togglePlaybackButtonClicked, this);
        playbackButton.disabled = false;
        this.toggled = false;

        var togglePlayGlyph = function() {
                this.element.removeStyleClass("pause-playback-status-bar-item");
                this.element.addStyleClass("play-playback-status-bar-item");
        };
        var togglePauseGlyph = function() {
                this.element.addStyleClass("pause-playback-status-bar-item");
                this.element.removeStyleClass("play-playback-status-bar-item");
        };

        this._model.addEventListener(eventNames.PlaybackDidStart, togglePauseGlyph, playbackButton);
        this._model.addEventListener(eventNames.InputPaused,      togglePlayGlyph,  playbackButton);
        this._model.addEventListener(eventNames.DebuggerPaused,   togglePlayGlyph,  playbackButton);
        this._model.addEventListener(eventNames.PlaybackStopped,  togglePlayGlyph,  playbackButton);
        this._statusBarButtons.push(playbackButton);
        togglePlayGlyph.call(playbackButton);

        //the set-savepoint button
        var setSavepointButton = this.setSavepointButton = new WebInspector.StatusBarButton("", "set-savepoint-status-bar-item");
        setSavepointButton.disabled = true;
        setSavepointButton.toggled = false;

        setSavepointButton.addEventListener("click", this._setSavepointButtonClicked, replayView);
        var disableButtonCallback = function() { this.disabled = true; };
        var enableButtonCallback  = function() { this.disabled = false; };

        this._model.addEventListener(eventNames.PlaybackDidStart, disableButtonCallback, setSavepointButton);
        this._model.addEventListener(eventNames.PlaybackStopped,  disableButtonCallback, setSavepointButton);
        this._model.addEventListener(eventNames.DebuggerPaused,   enableButtonCallback,  setSavepointButton);
        this._statusBarButtons.push(setSavepointButton);

        //the replay-to-savepoint button
        var savepointButton = this.replayToSavepointButton = new WebInspector.StatusBarButton("", "replay-to-savepoint-status-bar-item");
        savepointButton.disabled = true;
        savepointButton.toggled = false;

        savepointButton.addEventListener("click", this._replayToSavepointButtonClicked, replayView);
        var recording = this._recording;
        var provider = recording.savepointProvider;
        var syncSavepointStatus = function() {
            this.disabled = !provider.hasSavepoint();
        };

        this._model.addEventListener(eventNames.PlaybackDidStart, disableButtonCallback, savepointButton);
        this._model.addEventListener(eventNames.InputPaused,      syncSavepointStatus,   savepointButton);
        this._model.addEventListener(eventNames.PlaybackStopped,  function() {
            this.toggled = false;
            this.disabled = !provider.hasSavepoint();
        }, savepointButton);
        this._model.addEventListener(eventNames.DebuggerPaused, function() {
            this.toggled = false;
            this.disabled = !provider.hasSavepoint();
            
            enableButtonCallback.call(this);
        }, savepointButton);
        this._statusBarButtons.push(savepointButton);

        var events = WebInspector.ReplaySavepointProvider.Events;
        provider.addEventListener(events.SavepointSet,     enableButtonCallback, savepointButton);
        provider.addEventListener(events.SavepointRemoved, syncSavepointStatus,  savepointButton);
        var willRemoveCallback = function() {
            provider.removeEventListener(events.SavepointSet,     enableButtonCallback, savepointButton);
            provider.removeEventListener(events.SavepointRemoved, syncSavepointStatus,  savepointButton);
            provider.removeEventListener(WebInspector.DataProvider.Events.WillRemove, willRemoveCallback, savepointButton);
        };
        provider.addEventListener(WebInspector.DataProvider.Events.WillRemove, willRemoveCallback, savepointButton);
        
        //the scans drop-down menu
        this._scanSelector = new WebInspector.StatusBarComboBox(this._scanSelectorChanged.bind(this));
        this._scanSelector.element.addStyleClass("timelapse-scan-menu");
        var displayedScanners = [];
        for (var key in this._model.scanners) {
            var scanner = this._model.scanners[key];
            if (scanner.isDisplayable)
                displayedScanners.push(scanner);
        }
        displayedScanners.sort(function(a, b) { return a.localeCompare(b); });
        
        for (var i = 0; i < displayedScanners.length; i++) {
            var scanner = displayedScanners[i];
            var option = document.createElement("option");
            option.text = scanner.label;
            option.title = scanner.label;
            option._scanner = scanner;
            this._scanSelector.addOption(option);
        }
        var dummyOption = this._scanSelectorDefaultOption = document.createElement("option");
        dummyOption.text =  WebInspector.UIString("Scan...");
        dummyOption.title = WebInspector.UIString("Click to select a scan action.");
        this._scanSelector.addOption(dummyOption);
        this._scanSelector.select(dummyOption);
        this._scanSelector.element.title = this._scanSelector.selectedOption().title;
        
        var scannerEvents = WebInspector.TimelapseScanner.Events;
        this._model.addEventListener(eventNames.RecordingLoaded, function() {
            this.enabled = true;
        }, this._scanSelector);
        this._model.addEventListener(eventNames.RecordingUnloaded, function() {
            this.enabled = false;
        }, this._scanSelector);
        
        this._statusBarButtons.push(this._scanSelector);
    },

    _scanSelectorChanged: function()
    {
        var option = this._scanSelector.selectedOption();
        var scanner = option._scanner;
        if (!scanner)
            return; // case for dummy option.
            
        var scannerEvents = WebInspector.TimelapseScanner.Events;
        scanner.onceEventListener(scannerEvents.ScanStarted, function() {
            this.toggled = true;
        }, this._scanSelector);
        scanner.onceEventListener(scannerEvents.ScanStopped, function() {
            this.toggled = false;
        }, this._scanSelector);

        this._model.loadedRecording.scanInZoomRegion(scanner);
        this._scanSelector.select(this._scanSelectorDefaultOption);
    },

    _lockButtonClicked: function()
    {
    // if in playback mode and locked, then unlock. This should
    // just stop the current playback, which will cause unlock
    // anyway.
    if (this._model.inputLocked)
        this._model.stopPlayback(true);
    },

    _registerShortcuts: function()
    {
    var shortcut = WebInspector.KeyboardShortcut;
    var keys = shortcut.Keys;
    var section = WebInspector.shortcutsScreen.section(WebInspector.UIString("Replay Controls"));
    this._shortcuts = {};
    
    // Play/pause.
    var playPauseShortcut = WebInspector.KeyboardShortcut.makeDescriptor(keys.Space);
    this._shortcuts[playPauseShortcut] = this._togglePlaybackButtonClicked.bind(this);
    section.addKey(playPauseShortcut, WebInspector.UIString("Play/pause recording"));
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

    _togglePlaybackButtonClicked: function()
    {
    if (!this._model.canReplay)
        return;

    if (!this._model.isReplaying)
        this._model.replayToCompletion(true, WebInspector.TimelapseModel.ReplaySpeed.Normal);

    else if (this._model.isReplaying && this._model.inputPaused)
        this._model.replayToCompletion(true, WebInspector.TimelapseModel.ReplaySpeed.Normal);

    else if (this._model.isReplaying && this._model.debuggerPaused)
        DebuggerAgent.resume();

    else if (this._model.isReplaying && !this._model.inputPaused)
        this._model.pausePlayback();
    },

    _radarButtonClicked: function()
    {
    if (!this._model.scanners.breakpoint.isScanning)
        this._recording.scanInZoomRegion(this._model.scanners.breakpoint);
    else
        this._model.pausePlayback();
    },

    _setSavepointButtonClicked: function()
    {
        if (this._model.debuggerPaused)
            this._recording.savepointProvider.setSavepoint();
    },

    _replayToSavepointButtonClicked: function()
    {
        this._recording.savepointProvider.replayToSavepoint();
    },
    
    __proto__: WebInspector.View.prototype
};