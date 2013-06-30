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

    this._element = replayManager.toolbarItem.element;

    this._items = {
        replay: {
            tooltip: WebInspector.UIString("Click to create a new recording or replay a loaded recording"),
            handler: this._replayItemWasClicked
        },
        prompt: {
            tooltip: WebInspector.UIString("Click to record"),
            handler: this._promptItemWasClicked
        },
        unload: {
            tooltip: WebInspector.UIString("Click to unload recording"),
            handler: this._unloadItemWasClicked
        }
    };

    for (var name in this._items)
        this._appendElementForNamedItem(name);

    // Necessary events required to track capture and replay state.
    replayManager.addEventListener(WebInspector.ReplayManager.Event.CaptureStarted, this._captureStarted, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.CaptureStopped, this._captureStopped, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.PlaybackStarted, this._replayStateChanged, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.PlaybackPaused, this._replayStateChanged, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.PlaybackFinished, this._replayStateChanged, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.RecordingLoaded, this._recordingLoaded, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.RecordingUnloaded, this._recordingUnloaded, this);

    // initialize correct state
    this._refreshButtonStates(replayManager);
};

WebInspector.ReplayDashboardView.CapturingStyleClassName = "capturing";
WebInspector.ReplayDashboardView.EnabledStyleClassName = "enabled";
WebInspector.ReplayDashboardView.InputPausedStyleClassName = "paused";
WebInspector.ReplayDashboardView.ReadyStyleClassName = "ready";
WebInspector.ReplayDashboardView.ReplayingStyleClassName = "replaying";

WebInspector.ReplayDashboardView.prototype = {
    constructor: WebInspector.ReplayDashboardView,
    __proto__: WebInspector.Object.prototype,

    // Private

    _appendElementForNamedItem: function(name)
    {
        var item = this._items[name];

        item.container = this._element.appendChild(document.createElement("div"));
        item.container.className = "item " + name;
        item.container.title = item.tooltip;

        item.container.appendChild(document.createElement("img"));

        item.outlet = item.container.appendChild(document.createElement("div"));

        Object.defineProperty(item, "text",
        {
            set: function(newText)
            {
                if (newText === item.outlet.textContent)
                    return;
                item.outlet.textContent = newText;
            }
        });

        // Adds additional state image to replay button
        if (name === "replay") {
           this._replayStateButton = document.createElement("img");
           item.outlet.appendChild(this._replayStateButton);
        }

        if (name === "prompt") {
           item.container.innerHTML = "";
           item.container.textContent = WebInspector.UIString("Click to start recording");
        }

        item.container.addEventListener("click", function(event) {
            this._itemWasClicked(name, event);
        }.bind(this));
    },

    _itemWasClicked: function(name, event)
    {
        var item = this._items[name];
        if (!item.container.classList.contains(WebInspector.ReplayDashboardView.EnabledStyleClassName))
            return;

        if (item.handler)
            item.handler.call(this, event);
    },

    _replayItemWasClicked: function(event)
    {
        if (event.target !== this._replayStateButton) {
            WebInspector.replayManager.toolbarItem.hidden = true;
            WebInspector.dashboardManager.toolbarItem.hidden = false;
            return;
        }

        this._setItemEnabled(this._items.replay, false);

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

    _promptItemWasClicked: function(event)
    {
        WebInspector.replayManager.startCaptureSoon();
    },

    _unloadItemWasClicked: function(event)
    {
        WebInspector.replayManager.unloadRecordingSoon();
    },

    _setItemEnabled: function(item, enabled)
    {
        if (enabled)
            item.container.classList.add(WebInspector.ReplayDashboardView.EnabledStyleClassName);
        else
            item.container.classList.remove(WebInspector.ReplayDashboardView.EnabledStyleClassName);
    },

    _captureStarted: function()
    {
        this._removeRecordingView();
        this._addRecordingView(new WebInspector.ContentView(WebInspector.replayManager.createdRecording));
        this._refreshButtonStates();
    },

    _captureStopped: function()
    {
        this._removeRecordingView();
        this._refreshButtonStates();
    },

    _recordingLoaded: function()
    {
        this._removeRecordingView();
        this._addRecordingView(new WebInspector.ContentView(WebInspector.replayManager.loadedRecording));
        this._refreshButtonStates();
    },

    _recordingUnloaded: function()
    {
        this._removeRecordingView();
        this._refreshButtonStates();
    },

    _addRecordingView: function(view)
    {
        console.assert(view instanceof WebInspector.SerializedRecordingContentView || view instanceof WebInspector.LiveRecordingContentView);
        this._recordingView = view;
        this._element.appendChild(this._recordingView.element);
        this._recordingView.visible = true;
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
    },

    _replayStateChanged: function()
    {
        this._refreshButtonStates(WebInspector.replayManager);
    },

    _refreshButtonStates: function(replayManager)
    {
        replayManager = replayManager || WebInspector.replayManager;
        console.assert(!!replayManager, "Could not find a valid reference to the replay manager.");

        var item = this._items.replay;

        this._setItemEnabled(this._items.replay, true);
        this._setItemEnabled(this._items.prompt, false);
        this._setItemEnabled(this._items.unload, true);

        item.container.classList.remove(WebInspector.ReplayDashboardView.ReadyStyleClassName);
        item.container.classList.remove(WebInspector.ReplayDashboardView.CapturingStyleClassName);
        item.container.classList.remove(WebInspector.ReplayDashboardView.InputPausedStyleClassName);
        item.container.classList.remove(WebInspector.ReplayDashboardView.ReplayingStyleClassName);

        switch (replayManager.replayState) {

        case WebInspector.ReplayManager.ReplayState.ReplayPausedAtInput:
        case WebInspector.ReplayManager.ReplayState.CanReplay:
            item.container.classList.add(WebInspector.ReplayDashboardView.InputPausedStyleClassName);
            break;

        case WebInspector.ReplayManager.ReplayState.ReplayProgressing:
            item.container.classList.add(WebInspector.ReplayDashboardView.ReplayingStyleClassName);
            break;

        case WebInspector.ReplayManager.ReplayState.Capturing:
            item.container.classList.add(WebInspector.ReplayDashboardView.CapturingStyleClassName);
            this._setItemEnabled(this._items.unload, false);
            break;

        case WebInspector.ReplayManager.ReplayState.CanCapture:
            item.container.classList.add(WebInspector.ReplayDashboardView.ReadyStyleClassName);
            this._setItemEnabled(this._items.prompt, true);
            this._setItemEnabled(this._items.unload, false);
            break;

        default:
            console.error("ReplayManager in invalid state: ", this.replayState);
        }
    }
};
