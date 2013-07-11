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

    this.markers = {};
    this.markers.playback = new WebInspector.HorizontalPointMarker(this.element);
    this.markers.playback.adjustable = true;
    this.markers.playback.element.classList.add(WebInspector.SerializedRecordingContentView.PlaybackMarkerStyleClassName);
    this.markers.playback.position = 0.0;
    this._listeners.register(this.markers.playback, WebInspector.HorizontalPointMarker.Event.Moved, this._playbackMarkerMoved);
    this._listeners.register(this.markers.playback, WebInspector.HorizontalPointMarker.Event.DragStart, this._playbackMarkerDragStarted);
    this._listeners.register(this.markers.playback, WebInspector.HorizontalPointMarker.Event.DragEnd, this._playbackMarkerDragEnded);
    this.element.appendChild(this.markers.playback.element);

    // When dragging the playback marker, this shows where dragging began.
    this.markers.draghint = new WebInspector.HorizontalPointMarker(this.element);
    this.markers.draghint.element.classList.add(WebInspector.SerializedRecordingContentView.DragHintMarkerStyleClassName);
    this.markers.draghint.position = 0.5;
    this.markers.draghint.visible = false;
    this.element.appendChild(this.markers.draghint.element);

    // When dragging the playback marker, this shows where the cursor would be dropped.
    this.markers.drophint = new WebInspector.HorizontalPointMarker(this.element);
    this.markers.drophint.element.classList.add(WebInspector.SerializedRecordingContentView.DropHintMarkerStyleClassName);
    this.markers.drophint.position = 0.5;
    this.markers.drophint.visible = false;
    this.element.appendChild(this.markers.drophint.element);

    // This provides a subtle gray effect over unplayed (future) sections of the recording.
    this.markers.smokescreen = new WebInspector.HorizontalRangeMarker(this.element);
    this.markers.smokescreen.element.classList.add(WebInspector.SerializedRecordingContentView.SmokescreenMarkerStyleClassName);
    this.element.appendChild(this.markers.smokescreen.element);

    this.element.appendChild(document.createElement("div")).classList.add("border");
    this._fullBar = this.element.appendChild(document.createElement("div"));
    this._fullBar.classList.add(WebInspector.SerializedRecordingContentView.FullBarStyleClassName);
    this._activeBar = this.element.appendChild(document.createElement("div"));
    this._activeBar.classList.add(WebInspector.SerializedRecordingContentView.ActiveBarStyleClassName);

    this._listeners.register(recording, WebInspector.RecordingObject.Event.ProviderAdded, this._providerAdded);
    this._listeners.register(WebInspector.replayManager, WebInspector.ReplayManager.Event.CursorChanged, this._updateMarkPositions);
    this._listeners.register(recording.calculator, WebInspector.RecordingCalculator.Event.ZoomChanged, this._updateZoomElements);
    this._listeners.install();

    // add input providers that have already been created
    var inputProviders = recording.providersWithConstructor(WebInspector.ReplayInputDataProvider);
    for (var i = 0; i < inputProviders.length; ++i)
        this._setupProvider(inputProviders[i]);
};

WebInspector.SerializedRecordingContentView.PlaybackMarkerStyleClassName = "playback-slider";
WebInspector.SerializedRecordingContentView.DragHintMarkerStyleClassName = "drag-hint";
WebInspector.SerializedRecordingContentView.DropHintMarkerStyleClassName = "drop-hint";
WebInspector.SerializedRecordingContentView.SmokescreenMarkerStyleClassName = "smokescreen";
WebInspector.SerializedRecordingContentView.StyleClassName = "serialized-recording";
WebInspector.SerializedRecordingContentView.FullBarStyleClassName = "full-bar";
WebInspector.SerializedRecordingContentView.ActiveBarStyleClassName = "active-bar";

WebInspector.SerializedRecordingContentView.prototype = {
    constructor: WebInspector.SerializedRecordingContentView,
    __proto__: WebInspector.ContentView.prototype,

    // Public

    updateLayout: function()
    {
        WebInspector.ContentView.prototype.updateLayout.call(this);

        if (this._lineGraph)
            this._lineGraph.updateLayout();

        for (var key in this.markers)
            this.markers[key].updateLayout();
    },

    shown: function()
    {
        WebInspector.ContentView.prototype.shown.call(this);

        if (this._lineGraph)
            this._lineGraph.shown();

        for (var key in this.markers)
            this.markers[key].shown();
    },

    closed: function()
    {
        WebInspector.ContentView.prototype.closed.call(this);
        this._listeners.uninstall(true);

        for (var providerName in this._providerListeners) {
            var provider = this._providerListeners[providerName].provider;
            this._teardownProvider(provider);
        }

        for (var key in this.markers)
            this.markers[key].closed();
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
            this._lineGraph = new WebInspector.ReplayInputLineGraph(provider, this._recording.calculator);
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

    _updateMarkPositions: function(event, suppressAnimations)
    {
        var cursorPosition = WebInspector.replayManager.currentMarkIndex;
        var inputProvider = this._recording.firstProviderWithConstructor(WebInspector.ReplayInputDataProvider);
        if (!inputProvider.inputs.length)
            return;

        // This assumes that there is a 1-to-1 corresponence between marks and inputs.
        // Marks are counted starting from 1 while indices start from 0.
        var inputIndex = Number.constrain(cursorPosition - 1, 0, inputProvider.inputs.length - 1);
        var markTimestamp = inputProvider.inputs[inputIndex].timestamp;
        var cursorPercent = this._recording.calculator.zoomedPercentFromTimestamp(markTimestamp);
        this.markers.playback.position = cursorPercent;
        this.markers.smokescreen.left = cursorPercent;

        if (suppressAnimations)
            return;

        if (inputIndex === inputProvider.inputs.length - 1)
            return;
        var nextInput = inputProvider.inputs[inputIndex + 1];
        var nextCursorPercent = this._recording.calculator.zoomedPercentFromTimestamp(nextInput.timestamp);
        var timeDelta = nextInput.timestamp - markTimestamp;
        this.markers.playback.animateTo(nextCursorPercent, timeDelta);
        this.markers.smokescreen.animateTo(nextCursorPercent, 1.0, timeDelta);
    },

    _playbackMarkerDragStarted: function()
    {
        this.markers.draghint.position = this.markers.playback.position;
        this.markers.draghint.visible = true;
        this.markers.drophint.visible = true;
    },

    _playbackMarkerMoved: function()
    {
        var closestInput = this._recording.calculator.closestInputFromZoomedPercent(this.markers.playback.position);
        var snappedTimestamp = closestInput.timestamp;
        var snappedPosition = this._recording.calculator.zoomedPercentFromTimestamp(snappedTimestamp);
        this.markers.drophint.position = snappedPosition;
        this.markers.smokescreen.left = this.markers.playback.position;
    },

    _playbackMarkerDragEnded: function()
    {
        var closestInput = this._recording.calculator.closestInputFromZoomedPercent(this.markers.playback.position);
        var snappedTimestamp = closestInput.timestamp;
        var snappedPosition = this._recording.calculator.zoomedPercentFromTimestamp(snappedTimestamp);

        this.markers.playback.position = snappedPosition;
        this.markers.smokescreen.left = this.markers.playback.position;
        this.markers.draghint.visible = false;
        this.markers.drophint.visible = false;

        WebInspector.replayManager.replayToMarkIndexSoon(closestInput.markIndex, false, WebInspector.ReplayManager.ReplaySpeed.Seeking);

    },

    _updateZoomElements: function()
    {
        if (!this._lineGraph)
            return;

        this._updateMarkPositions(null, true);

        var zoomLeft = this._recording.calculator.zoomLeft;
        var zoomRight = this._recording.calculator.zoomRight;
        var availWidth = this.element.offsetWidth;
        this._activeBar.style.left = zoomLeft * 100 + "%";
        this._activeBar.style.right = (1 - zoomRight) * 100 + "%";
    }
};
