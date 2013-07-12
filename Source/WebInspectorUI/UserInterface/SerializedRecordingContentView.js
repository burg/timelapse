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

    this._listeners.register(recording, WebInspector.RecordingObject.Event.ProviderAdded, this._providerAdded);
    this._listeners.register(recording.calculator, WebInspector.RecordingCalculator.Event.ZoomChanged, this._updateZoomElements);
    this._listeners.install();

    // add input providers that have already been created
    var inputProviders = recording.providersWithConstructor(WebInspector.ReplayInputDataProvider);
    for (var i = 0; i < inputProviders.length; ++i)
        this._setupProvider(inputProviders[i]);
};

WebInspector.SerializedRecordingContentView.StyleClassName = "serialized-recording";
WebInspector.SerializedRecordingContentView.ZoomGutterStyleClassName = "zoom-gutter";
WebInspector.SerializedRecordingContentView.ActiveZoomMarkerStyleClassName = "active-zoom-marker";

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

    _updateZoomElements: function()
    {
        this.markers.activezoom.setRange(this._recording.calculator.zoomLeft, this._recording.calculator.zoomRight);
    },

    _activeZoomMarkerDragged: function(event)
    {
        var data = event.data;
        var dragDelta = data.dragPosition - data.initialDragPosition;
        dragDelta = Number.constrain(dragDelta, -data.initialLeft, 1.0 - data.initialRight);
        this._recording.calculator.setZoomInterval(data.initialLeft + dragDelta, data.initialRight + dragDelta);
    }
};
