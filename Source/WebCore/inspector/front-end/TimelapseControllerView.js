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

    this._model = model;

    this.element.id = "timelapse-controller-view";
    this.element.tabIndex = 0;

    this._createSharedStatusBarButtons();
    this.currentView = new WebInspector.TimelapseDefaultView(model);
    this._modifyListeners("addEventListener");

    // Tell backend to enable itself.
    this._model.enable();
};

WebInspector.TimelapseControllerView.prototype = {
    get statusBarItems()
    {
        return [
            this.recordButton.element,
            this._contextStatusBarItems
        ];
    },

    willDispose: function()
    {
        this._modifyListeners("removeEventListener");
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

    _modifyListeners: function(op) {
        console.assert(op === "addEventListener" || op === "removeEventListener",
                       "Tried to do something unsupported to listeners: " + op);

        var replayEvents = WebInspector.TimelapseModel.Events;
        this._model[op](replayEvents.Enabled,  this._timelapseEnabled, this);
        this._model[op](replayEvents.Disabled, this._timelapseDisabled, this);
        this._model[op](replayEvents.RecordingCreated,  this._recordingCreated, this);
        this._model[op](replayEvents.RecordingLoaded,   this._recordingLoaded, this);
        this._model[op](replayEvents.RecordingUnloaded, this._recordingUnloaded, this);

        this.element[op]("focus", this.getBoundListener(this.focus), true);
        this.element[op]("blur",  this.getBoundListener(this.blur), true);
        
        this.recordButton[op]("click", this.getBoundListener(this._recordButtonClicked), false);

        this._model[op](replayEvents.CaptureWillStart, this._disableRecordButton, this);
        this._model[op](replayEvents.CaptureDidStart,  this._captureDidStart, this);
        this._model[op](replayEvents.CaptureWillStop,  this._disableRecordButton, this);
        this._model[op](replayEvents.CaptureDidStop,   this._captureDidStop, this);
    },

    _createSharedStatusBarButtons: function()
    {
        // only create buttons once.
        if (this._contextStatusBarItems)
            return;

        this._contextStatusBarItems = document.createElement("div");
        this._contextStatusBarItems.className = "status-bar-items-group";

        this.recordButton = new WebInspector.StatusBarButton("", "toggle-record-status-bar-item");
    },

    _recordButtonClicked: function()
    {
        if (this._model.isCapturing)
            this._model.stopCapture();
        else
            this._model.startCapture();
    },

    _timelapseEnabled: function()
    {
        this._enabled = true;
        this._createSharedStatusBarButtons();
        this.currentView = new WebInspector.TimelapseDefaultView(this._model);
    },

    _timelapseDisabled: function()
    {
        this._enabled = false;
        this.currentView = new WebInspector.TimelapseDefaultView(this._model);
    },

    _disableRecordButton: function()
    {
        this.recordButton.disabled = true;
    },

    _captureDidStart: function()
    {
        this.recordButton.disabled = false;
        this.recordButton.toggled = true;
        this.recordButton.title = "Capture. Click to stop.";
    },

    _captureDidStop: function()
    {
        this.recordButton.disabled = false;
        this.recordButton.toggled = false;
        this.recordButton.title = "Not recording. Click to re-record.";
    },

    _recordingCreated: function(event)
    {
        var recording = event.data;
        this.currentView = new WebInspector.TimelapseCaptureView(this._model, recording);
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
        
        this._messagePanel[op]("click", this.getBoundListener(this._messagePanelClicked), false);

        var replayEvents = WebInspector.TimelapseModel.Events;
        this._model[op](replayEvents.CaptureWillStart, this._captureWillStart, this);
    },
    
    willDispose: function()
    {
        this._modifyListeners("removeEventListener");
    },

    get statusBarItems()
    {
        return [];
    },

    _messagePanelClicked: function(event)
    {
        this._model.startCapture();
    },
    
    _captureWillStart: function()
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
        
        this._messagePanel[op]("click", this.getBoundListener(this._messagePanelClicked), false);

        var replayEvents = WebInspector.TimelapseModel.Events;
        this._model[op](replayEvents.CaptureWillStop, this._captureWillStop, this);
        this._model[op](replayEvents.CaptureDidStop,  this._captureDidStop, this);
        
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

    _captureWillStop: function()
    {
    this._messagePanel.textContent = "Working...";
    },

    _captureDidStop: function()
    {
    this._messagePanel.classList.remove("message-pulse");

    // TODO: move to ReplayingView
    if (this._recording.allRecords.length == 0)
        this._messagePanel.textContent = "Nothing was captured. Please try again.";
    },

    _messagePanelClicked: function(event)
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

    this._createReplayStatusBarButtons();
    this._modifyListeners("addEventListener");

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
};

WebInspector.TimelapseReplayView.prototype = {
    _modifyListeners: function(op) {
        console.assert(op === "addEventListener" || op === "removeEventListener",
                       "Tried to do something unsupported to listeners: " + op);

        var replayEvents = WebInspector.TimelapseModel.Events;

        this.element[op]("keydown", this.getBoundListener(this._keyDown), false);
        
        this.lockButton[op]("click", this.getBoundListener(this._lockButtonClicked), false);
        this._model[op](replayEvents.InputLocked,   this._inputLocked, this);
        this._model[op](replayEvents.InputUnlocked, this._inputUnlocked, this);

        this.playbackButton[op]("click", this.getBoundListener(this._playbackButtonClicked), false);
        this._model[op](replayEvents.PlaybackDidStart, this._showPauseGlyph, this);
        this._model[op](replayEvents.InputPaused,      this._showPlaybackGlyph, this);
        this._model[op](replayEvents.DebuggerPaused,   this._showPlaybackGlyph, this);
        this._model[op](replayEvents.PlaybackStopped,  this._showPlaybackGlyph, this);

        this.setSavepointButton[op]("click", this.getBoundListener(this._setSavepointButtonClicked), false);
        this._model[op](replayEvents.PlaybackDidStart, this._disableSavepoints, this);
        this._model[op](replayEvents.InputPaused,      this._enableSavepoints, this);
        this._model[op](replayEvents.DebuggerPaused,   this._enableSavepoints, this);
        this._model[op](replayEvents.PlaybackStopped,  this._enableSavepoints, this);
        this._model[op](replayEvents.DebuggerPaused,   this._enableSavepoints, this);
    },
    
    willDispose: function()
    {
        this._modifyListeners("removeEventListener");
    },

    get statusBarItems()
    {
        return [
            this.lockButton,
            this.playbackButton,
            this.setSavepointButton,
            this.scanSelector,
        ];
    },

    _createReplayStatusBarButtons: function()
    {
        this.lockButton = new WebInspector.StatusBarButton(WebInspector.UIString("Timelapse Locking Mode"), "timelapse-lock-status-bar-item");

        this.playbackButton = new WebInspector.StatusBarButton("", "playback-toggle-status-bar-item");
        this.playbackButton.disabled = false;
        this.playbackButton.toggled = false;
        this.playbackButton.element.addStyleClass("play-playback-status-bar-item");

        this.setSavepointButton = new WebInspector.StatusBarButton("", "set-savepoint-status-bar-item");
        this.setSavepointButton.disabled = true;
        this.setSavepointButton.toggled = false;
        
        this.scanSelector = new WebInspector.StatusBarComboBox(this._scanSelectorChanged.bind(this), "timelapse-scan-selector", true);
        var displayedScanners = [];
        for (var key in this._model.scanners) {
            var scanner = this._model.scanners[key];
            if (scanner.isDisplayable)
                displayedScanners.push(scanner);
        }
        displayedScanners.sort(function(a, b) { return a.label.localeCompare(b.label); });
        
        for (var i = 0; i < displayedScanners.length; i++) {
            var scanner = displayedScanners[i];
            var option = document.createElement("option");
            option.text = scanner.label;
            option.title = scanner.label;
            option._scanner = scanner;
            this.scanSelector.addOption(option);
        }
        var dummyOption = this.scanSelectorDefaultOption = document.createElement("option");
        dummyOption.text =  WebInspector.UIString("Scan...");
        dummyOption.title = WebInspector.UIString("Click to select a scan action.");
        this.scanSelector.addOption(dummyOption);
        this.scanSelector.select(dummyOption);
        this.scanSelector.element.title = this.scanSelector.selectedOption().title;
    },

    _scanSelectorChanged: function()
    {
        var option = this.scanSelector.selectedOption();
        var scanner = option._scanner;
        if (!scanner)
            return; // case for dummy option.
            
        var scannerEvents = WebInspector.TimelapseScanner.Events;
        scanner.onceEventListener(scannerEvents.ScanStarted, function() {
            this.toggled = true;
        }, this.scanSelector);
        scanner.onceEventListener(scannerEvents.ScanStopped, function() {
            this.toggled = false;
        }, this.scanSelector);

        this._model.loadedRecording.scanInZoomRegion(scanner);
        this.scanSelector.select(this.scanSelectorDefaultOption);
    },

    _lockButtonClicked: function()
    {
        // if in playback mode and locked, then unlock. This should
        // just stop the current playback, which will cause unlock
        // anyway.
        if (this._model.inputLocked)
            this._model.stopPlayback(true);
    },

    _inputLocked: function()
    {
        this.lockButton.title = "Input locked.";
        this.lockButton.toggled = true;
    },
    
    _inputUnlocked: function()
    {
        if (this._capture) return;
            this.lockButton.title = "Input unlocked.";
            this.lockButton.toggled = false;
    },

    _showPauseGlyph: function()
    {
        this.playbackButton.element.addStyleClass("pause-playback-status-bar-item");
        this.playbackButton.element.removeStyleClass("play-playback-status-bar-item");
    },

    _showPlaybackGlyph: function()
    {
        this.playbackButton.element.removeStyleClass("pause-playback-status-bar-item");
        this.playbackButton.element.addStyleClass("play-playback-status-bar-item");
    },

    _enableSavepoints: function()
    {
        this.setSavepointButton.setEnabled(true);
    },

    _disableSavepoints: function()
    {
        this.setSavepointButton.setEnabled(false);
    },

    _registerShortcuts: function()
    {
        var shortcut = WebInspector.KeyboardShortcut;
        var keys = shortcut.Keys;
        var section = WebInspector.shortcutsScreen.section(WebInspector.UIString("Replay Controls"));
        this._shortcuts = {};
        
        // Play/pause.
        var playPauseShortcut = WebInspector.KeyboardShortcut.makeDescriptor(keys.Space);
        this._shortcuts[playPauseShortcut] = this._playbackButtonClicked.bind(this);
        section.addKey(playPauseShortcut, WebInspector.UIString("Play/pause recording"));
    },

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

    _playbackButtonClicked: function()
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
        var savepoint = this._model.savepointTracker.createSavepoint();
        this._mostRecentSavepoint = savepoint;
        this._recording.savepointList.addSavepoint(savepoint);
    },
    
    __proto__: WebInspector.View.prototype
};