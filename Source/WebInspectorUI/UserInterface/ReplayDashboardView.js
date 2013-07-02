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

WebInspector.ReplayDashboardView = function(replayManager)
{
    WebInspector.Object.call(this);

    replayManager = replayManager || WebInspector.replayManager;
    console.assert(replayManager instanceof WebInspector.ReplayManager, "Couldn't obtain valid ReplayManager reference:", replayManager);

    this._element = replayManager.toolbarItem.element;

    // build static dashboard elements
    var navigationContainer = this._element.appendChild(document.createElement("div"));
    navigationContainer.className = WebInspector.ReplayDashboardView.NavigationContainerStyleClassName;
    var backButton = navigationContainer.appendChild(document.createElement("img"));
    backButton.className = WebInspector.ReplayDashboardView.BackButtonStyleClassName;
    backButton.title = WebInspector.UIString("Click to create a new recording or replay a loaded recording");
    backButton.addEventListener("click", this._backButtonClicked.bind(this));
    var replayButton = navigationContainer.appendChild(document.createElement("img"));
    replayButton.className = WebInspector.ReplayDashboardView.ReplayButtonStyleClassName;
    replayButton.title = WebInspector.UIString("Click to create a new recording or replay a loaded recording");
    replayButton.addEventListener("click", this._replayButtonClicked.bind(this));

    var promptElement = this._element.appendChild(document.createElement("div"));
    promptElement.className = WebInspector.ReplayDashboardView.PromptStyleClassName;
    promptElement.title = WebInspector.UIString("Click to record");
    promptElement.textContent = WebInspector.UIString("Click to start recording");
    promptElement.addEventListener("click", this._promptClicked.bind(this));

    var ejectButton = this._element.appendChild(document.createElement("div"));
    ejectButton.className = WebInspector.ReplayDashboardView.EjectButtonStyleClassName;
    ejectButton.title = WebInspector.UIString("Click to eject recording");
    ejectButton.addEventListener("click", this._ejectButtonClicked.bind(this));
    ejectButton.appendChild(document.createElement("img"));

    // Add events required to track capture and replay state.
    replayManager.addEventListener(WebInspector.ReplayManager.Event.CaptureStarted, this._captureStarted, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.CaptureStopped, this._captureStopped, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.PlaybackStarted, this._playbackStarted, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.PlaybackPaused, this._playbackPaused, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.PlaybackFinished, this._playbackFinished, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.RecordingLoaded, this._recordingLoaded, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.RecordingUnloaded, this._recordingUnloaded, this);

    // Track when the dashboard is shown and hidden so we can notify child ContentViews.
    replayManager.toolbarItem.addEventListener(WebInspector.NavigationItem.Event.Hidden, this._dashboardHidden, this);
    replayManager.toolbarItem.addEventListener(WebInspector.NavigationItem.Event.Shown, this._dashboardShown, this);

    // Manually iitialize style classes by querying current replay state.
    if (replayManager.isCapturing)
        this._captureStarted();
    if (replayManager.canReplay)
        this._recordingLoaded();
    if (replayManager.isReplaying)
        this._playbackStarted();
    if (replayManager.inputPaused)
        this._playbackPaused();
};

WebInspector.ReplayDashboardView.BackButtonStyleClassName = "back";
WebInspector.ReplayDashboardView.EjectButtonStyleClassName = "eject";
WebInspector.ReplayDashboardView.NavigationContainerStyleClassName = "navigation-container";
WebInspector.ReplayDashboardView.PromptStyleClassName = "prompt";
WebInspector.ReplayDashboardView.ReplayButtonStyleClassName = "replay";

// Class names for states applied to the replay dashboard element.
WebInspector.ReplayDashboardView.CapturingStyleClassName = "capturing";
WebInspector.ReplayDashboardView.InputPausedStyleClassName = "input-paused";
WebInspector.ReplayDashboardView.RecordingLoadedStyleClassName = "recording-loaded";
WebInspector.ReplayDashboardView.ReplayingStyleClassName = "replaying";

WebInspector.ReplayDashboardView.prototype = {
    constructor: WebInspector.ReplayDashboardView,
    __proto__: WebInspector.Object.prototype,

    // Private

    _dashboardShown: function()
    {
        if (!this._recordingView)
            return;

        this._recordingView.visible = true;
        this._recordingView.shown();
        this._recordingView.updateLayout();
    },

    _dashboardHidden: function()
    {
        if (!this._recordingView)
            return;

        this._recordingView.visible = false;
        this._recordingView.hidden();
    },

    _backButtonClicked: function()
    {
        WebInspector.replayManager.toolbarItem.hidden = true;
        WebInspector.dashboardManager.toolbarItem.hidden = false;
    },

    _replayButtonClicked: function(event)
    {
        switch (WebInspector.replayManager.replayState) {

        case WebInspector.ReplayManager.ReplayState.ReplayPausedAtInput:
        case WebInspector.ReplayManager.ReplayState.CanReplay:
            WebInspector.replayManager.replayToCompletionSoon(false, WebInspector.ReplayManager.ReplaySpeed.Normal);
            break;

        case WebInspector.ReplayManager.ReplayState.ReplayProgressing:
            WebInspector.replayManager.pausePlaybackSoon();
            break;

        case WebInspector.ReplayManager.ReplayState.Capturing:
            WebInspector.replayManager.stopCaptureSoon();
            break;

        case WebInspector.ReplayManager.ReplayState.CanCapture:
            WebInspector.replayManager.startCaptureSoon();
            break;

        default:
            console.error("ReplayManager in invalid state: ", this.replayState);
        }
    },

    _promptClicked: function(event)
    {
        WebInspector.replayManager.startCaptureSoon();
    },

    _ejectButtonClicked: function(event)
    {
        WebInspector.replayManager.unloadRecordingSoon();
    },

    _captureStarted: function()
    {
        this._removeRecordingView();
        this._element.classList.add(WebInspector.ReplayDashboardView.CapturingStyleClassName);
        this._addRecordingView(new WebInspector.ContentView(WebInspector.replayManager.createdRecording));
    },

    _captureStopped: function()
    {
        this._removeRecordingView();
        this._element.classList.remove(WebInspector.ReplayDashboardView.CapturingStyleClassName);
    },

    _recordingLoaded: function()
    {
        this._removeRecordingView();
        this._element.classList.add(WebInspector.ReplayDashboardView.RecordingLoadedStyleClassName);
        this._addRecordingView(new WebInspector.ContentView(WebInspector.replayManager.loadedRecording));
    },

    _recordingUnloaded: function()
    {
        this._removeRecordingView();
        this._element.classList.remove(WebInspector.ReplayDashboardView.RecordingLoadedStyleClassName);
    },

    _playbackStarted: function()
    {
        this._element.classList.add(WebInspector.ReplayDashboardView.ReplayingStyleClassName);
    },

    _playbackPaused: function()
    {
        this._element.classList.add(WebInspector.ReplayDashboardView.InputPausedStyleClassName);
    },

    _playbackFinished: function()
    {
        this._element.classList.remove(WebInspector.ReplayDashboardView.ReplayingStyleClassName);
        this._element.classList.remove(WebInspector.ReplayDashboardView.InputPausedStyleClassName);
    },

    _addRecordingView: function(view)
    {
        console.assert(view instanceof WebInspector.SerializedRecordingContentView || view instanceof WebInspector.LiveRecordingContentView);
        this._recordingView = view;
        this._element.appendChild(this._recordingView.element);
        if (WebInspector.replayManager.toolbarItem.hidden)
            this._dashboardHidden();
        else
            this._dashboardShown();
    },

    _removeRecordingView: function()
    {
        if (!this._recordingView)
            return;

        var recordingView = this._recordingView;
        delete this._recordingView;
        recordingView.visible = false;
        this._element.removeChild(recordingView.element);
        recordingView.closed();
    }
};
