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
        unload: {
            tooltip: WebInspector.UIString("Click to unloaded recording"),
            handler: this._unloadItemWasClicked
        }
    };

    for (var name in this._items)
        this._appendElementForNamedItem(name);

    this._setItemEnabled(this._items.replay, true);
    this._items.replay.container.classList.add("ready");

    // Necessary events required to track capture and replay state.
    replayManager.addEventListener(WebInspector.ReplayManager.Event.CaptureDidStart, this._captureStateChanged, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.CaptureDidStop, this._captureStateChanged, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.PlaybackDidStart, this._captureStateChanged, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.PlaybackPaused, this._captureStateChanged, this);
    replayManager.addEventListener(WebInspector.ReplayManager.Event.PlaybackFinished, this._captureStateChanged, this);
};

WebInspector.ReplayDashboardView.EnabledStyleClassName = "enabled";

WebInspector.ReplayDashboardView.prototype = {
    constructor: WebInspector.ReplayDashboardView,

    // Public

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
        if (name == "replay") {
           this._replayStateButton = document.createElement("img");
           item.outlet.appendChild(this._replayStateButton);
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

        switch (WebInspector.replayManager.replayState) {

        case WebInspector.ReplayManager.ReplayState.Paused:
        case WebInspector.ReplayManager.ReplayState.CanReplay:
            ReplayAgent.replayToCompletion(false);
            break;

        case WebInspector.ReplayManager.ReplayState.Replaying:
            ReplayAgent.pausePlayback();
            break;

        case WebInspector.ReplayManager.ReplayState.Capturing:
            ReplayAgent.stopCapture();
            this._setItemEnabled(this._items.unload, true);
            break;

        case WebInspector.ReplayManager.ReplayState.CanCapture:
            ReplayAgent.startCapture();
            break;

        default:
            console.assert(false, "ReplayManager in invalid state");
        }
    },

    _unloadItemWasClicked: function(event)
    {
        console.assert(WebInspector.replayManager.loadedRecording, "Can't unload recording because none is loaded");
        ReplayAgent.unloadRecording();
        this._setItemEnabled(this._items.unload, false);

        var item = this._items.replay;

        item.container.classList.remove("paused");
        item.container.classList.remove("replaying");
        item.container.classList.add("ready");
    },

    _setItemEnabled: function(item, enabled)
    {
        if (enabled)
            item.container.classList.add(WebInspector.ReplayDashboardView.EnabledStyleClassName);
        else
            item.container.classList.remove(WebInspector.ReplayDashboardView.EnabledStyleClassName);
    },

    _captureStateChanged: function()
    {
        var item = this._items.replay;

        item.container.classList.remove("ready");
        item.container.classList.remove("capturing");
        item.container.classList.remove("paused");
        item.container.classList.remove("replaying");

        switch (WebInspector.replayManager.replayState) {

        case WebInspector.ReplayManager.ReplayState.Paused:
        case WebInspector.ReplayManager.ReplayState.CanReplay:
            item.container.classList.add("paused");
            break;

        case WebInspector.ReplayManager.ReplayState.Replaying:
            item.container.classList.add("replaying");
            break;

        case WebInspector.ReplayManager.ReplayState.Capturing:
            item.container.classList.add("capturing");
            break;

        case WebInspector.ReplayManager.ReplayState.CanCapture:
            item.container.classList.add("ready");
            break;

        default:
            console.assert(false, "ReplayManager in invalid state");
        }
    }
};

WebInspector.ReplayDashboardView.prototype.__proto__ = WebInspector.Object.prototype;
