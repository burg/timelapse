/*
 *  Copyright (C) 2013, University of Washington. All rights reserved.
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

WebInspector.SerializedRecordingContentView = function(recording)
{
    WebInspector.ContentView.call(this, recording);

    this._recording = recording;
    this._providerListeners = {};
    this._listeners = new WebInspector.EventListenerGroup(this, "SerializedRecordingContentView recording listeners");

    this.element.classList.add(WebInspector.SerializedRecordingContentView.StyleClassName);

    this._zoomGutter = this.element.createChild("div");
    this._zoomGutter.classList.add(WebInspector.SerializedRecordingContentView.ZoomGutterStyleClassName);

    this.markers = {};
    this.markers.activezoom = new WebInspector.HorizontalRangeMarker(this._zoomGutter);
    this.markers.activezoom.element.classList.add(WebInspector.SerializedRecordingContentView.ActiveZoomMarkerStyleClassName);
    this.markers.activezoom.adjustable = true;
    this._listeners.register(this.markers.activezoom, WebInspector.HorizontalRangeMarker.Event.Dragging, this._activeZoomMarkerDragged);
    this._zoomGutter.appendChild(this.markers.activezoom.element);

    this.markers.highlight = new WebInspector.HorizontalRangeMarker(this._zoomGutter);
    this.markers.highlight.element.classList.add(WebInspector.SerializedRecordingContentView.ZoomHighlightMarkerStyleClassName);
    this.markers.highlight.adjustable = true;
    this._zoomGutter.appendChild(this.markers.highlight.element);

    this._messagePanel = new WebInspector.HorizontalMessageSheet();
    this.element.appendChild(this._messagePanel.element);
    this._listeners.register(WebInspector.replayManager, WebInspector.ReplayManager.Event.PlaybackWillStart, this._showMessagePanel);
    this._listeners.register(WebInspector.replayManager, WebInspector.ReplayManager.Event.PlaybackStarted, this._showMessagePanel);
    this._listeners.register(WebInspector.replayManager, WebInspector.ReplayManager.Event.PlaybackPaused, this._hideMessagePanel);
    this._listeners.register(WebInspector.replayManager, WebInspector.ReplayManager.Event.PlaybackFinished, this._hideMessagePanel);

    this._listeners.register(recording, WebInspector.RecordingObject.Event.ProviderAdded, this._providerAdded);
    this._listeners.register(recording.calculator, WebInspector.RecordingCalculator.Event.ZoomChanged, this._updateZoomElements);
    this._listeners.register(WebInspector.replayManager, WebInspector.ReplayManager.Event.CursorChanged, this._updateReplayCursorPosition);
    this._listeners.register(WebInspector.replayManager, WebInspector.ReplayManager.Event.PlaybackError, this._onPlaybackError);

    this._listeners.install();

    // add input providers that have already been created
    var inputProviders = recording.providersWithConstructor(WebInspector.ReplayInputDataProvider);
    for (var i = 0; i < inputProviders.length; ++i)
        this._setupProvider(inputProviders[i]);
};

WebInspector.SerializedRecordingContentView.StyleClassName = "serialized-recording";
WebInspector.SerializedRecordingContentView.ActiveZoomMarkerStyleClassName = "active-zoom-marker";
WebInspector.SerializedRecordingContentView.MessagePanelStyleClassName = "message-panel";
WebInspector.SerializedRecordingContentView.ZoomGutterStyleClassName = "zoom-gutter";
WebInspector.SerializedRecordingContentView.ZoomHighlightMarkerStyleClassName = "zoom-highlight-marker";

WebInspector.SerializedRecordingContentView.prototype = {
    constructor: WebInspector.SerializedRecordingContentView,
    __proto__: WebInspector.ContentView.prototype,

    // Public

    updateLayout: function()
    {
        WebInspector.ContentView.prototype.updateLayout.call(this);

        if (this._lineGraph)
            this._lineGraph.updateLayout();
    },

    shown: function()
    {
        WebInspector.ContentView.prototype.shown.call(this);

        if (this._lineGraph)
            this._lineGraph.shown();
    },

    closed: function()
    {
        WebInspector.ContentView.prototype.closed.call(this);
        this._listeners.uninstall(true);

        for (var providerName in this._providerListeners) {
            var provider = this._providerListeners[providerName].provider;
            this._teardownProvider(provider);
        }
    },

    // Private

    _providerAdded: function(event)
    {
        var provider = event.data;
        this._setupProvider(provider);
    },

    _providerRemoved: function(event)
    {
        var provider = event.data;
        this._teardownProvider(provider);
    },

    _setupProvider: function(provider)
    {
        console.assert(provider instanceof WebInspector.DataProvider, "Tried to setup non-provider [object]: ", provider);

        var callbacks = new WebInspector.EventListenerGroup(this, "Provider listeners");
        this._providerListeners[provider.name] = { "callbacks": callbacks, "provider": provider };

        callbacks.register(provider, WebInspector.DataProvider.Event.WillRemove, this._teardownProvider);

        // Provider-specific setup goes here.
        if (provider instanceof WebInspector.ReplayInputDataProvider) {
            this._lineGraph = new WebInspector.ReplayInputGraph(provider, this._recording.calculator);
            this.element.appendChild(this._lineGraph.element);
        }

        callbacks.install();
    },

    _teardownProvider: function(provider)
    {
        console.assert(provider instanceof WebInspector.DataProvider, "Tried to teardown non-provider [object]: ", provider);

        var callbacks = this._providerListeners[provider.name].callbacks;
        delete this._providerListeners[provider.name];
        callbacks.uninstall(true);

        // Provider-specific teardown goes here.
        if (provider instanceof WebInspector.ReplayInputDataProvider) {
            this.element.removeChild(this._lineGraph.element);
            this._lineGraph.closed();
            delete this._lineGraph;
        }
    },

    _updateReplayCursorPosition: function(event, suppressAnimations)
    {
        var inputProvider = this._recording.firstProviderWithConstructor(WebInspector.ReplayInputDataProvider);
        var inputs = inputProvider.inputs;
        if (!inputs.length)
            return;

        // This assumes that there is a 1-to-1 corresponence between marks and inputs.
        // Marks are counted starting from 1 while indices start from 0.
        var inputIndex = Number.constrain(WebInspector.replayManager.currentMarkIndex - 1, 0, inputs.length - 1);
        var inputTimestamp = inputs[inputIndex].timestamp;
        var cursorPercent = this._recording.calculator.globalPercentFromTimestamp(inputTimestamp);
        this.markers.highlight.setRange(0.0, cursorPercent);

        if (suppressAnimations)
            return;

        if (inputIndex === inputProvider.inputs.length - 1)
            return;
        var nextInput = inputProvider.inputs[inputIndex + 1];
        var nextCursorPercent = this._recording.calculator.globalPercentFromTimestamp(nextInput.timestamp);
        var timeDelta = nextInput.timestamp - inputTimestamp;
        this.markers.highlight.animateTo(0.0, nextCursorPercent, timeDelta);
    },

    _updateZoomElements: function()
    {
        this._updateReplayCursorPosition();
        this.markers.activezoom.setRange(this._recording.calculator.zoomLeft, this._recording.calculator.zoomRight);
    },

    _activeZoomMarkerDragged: function(event)
    {
        var data = event.data;
        var dragDelta = data.dragPosition - data.initialDragPosition;
        dragDelta = Number.constrain(dragDelta, -data.initialLeft, 1.0 - data.initialRight);
        this._recording.calculator.setZoomInterval(data.initialLeft + dragDelta, data.initialRight + dragDelta);
    },

    _onPlaybackError: function(event)
    {
        var error = event.data.errorMessage;
        var isFatal = event.data.isFatal;

        if (isFatal) {
            this._messagePanel.setMessage({ text: WebInspector.UIString("Playback was terminated by a fatal error.") });
        } else {
            this._messagePanel.setMessage({ text: WebInspector.UIString("Something went wrong during playback.") });
            var options = [
                {
                    label: WebInspector.UIString("Keep going"),
                    classname: "keep-going",
                    callback: function(event) {
                        var allowBreakpoints = WebInspector.replayManager.replaySpeed === WebInspector.ReplayManager.ReplaySpeed.Normal;
                        WebInspector.replayManager.replayToCompletionSoon(allowBreakpoints, WebInspector.replayManager.replaySpeed);
                    } 
                },

                {
                    label: WebInspector.UIString("Ignore warnings"),
                    classname: "ignore",
                    callback: function(event) {
                        var allowBreakpoints = WebInspector.replayManager.replaySpeed === WebInspector.ReplayManager.ReplaySpeed.Normal;
                        ReplayAgent.setPauseOnError(false);
                        WebInspector.replayManager.replayToCompletionSoon(allowBreakpoints, WebInspector.replayManager.replaySpeed);
                    } 
                },

                {
                    label: WebInspector.UIString("Abort"),
                    classname: "abort",
                    callback: function() {
                        WebInspector.replayManager.stopPlaybackSoon(true);
                    }
                } 
            ];
            this._messagePanel.setOptions(options);
        }
        this._messagePanel.shown();
    },

    _showMessagePanel: function()
    {
        this._messagePanel.hidden();

        // Figure out an appropriate message if none provided.
        if (this._messagePanel.message === "") {
            if (WebInspector.replayManager.replaySpeed === WebInspector.ReplayManager.ReplaySpeed.Seeking) {
                this._messagePanel.setMessage({ text: WebInspector.UIString("Seeking...") });
            } else {
                this._messagePanel.setMessage({ 
                    text: WebInspector.UIString("Replaying... click to cancel."),
                    callback:  function() {
                        WebInspector.replayManager.pausePlaybackSoon()
                    }
                });
            }
        }

        this._messagePanel.shown();
    },

    _hideMessagePanel: function()
    {   
        this._messagePanel.hidden();
    }
};
