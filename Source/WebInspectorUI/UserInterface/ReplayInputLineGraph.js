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

WebInspector.ReplayInputLineGraph = function(inputProvider, calculator)
{
    console.assert(inputProvider instanceof WebInspector.ReplayInputDataProvider, "Wrong [object] type passed to constructor: ", inputProvider);
    console.assert(calculator instanceof WebInspector.RecordingCalculator, "Wrong [object] type passed to constructor: ", calculator);

    WebInspector.Object.call(this);

    this._provider = inputProvider;
    this._calculator = calculator;
    this._data = { maxIndex: -1, bins: [] };

    this.element = document.createElement("canvas");
    this.element.classList.add(WebInspector.ReplayInputLineGraph.StyleClassName);

    this._calculator.addEventListener(WebInspector.RecordingCalculator.Event.ZoomChanged, this._refreshSoon, this);
}

WebInspector.ReplayInputLineGraph.MaxBins = 300;
WebInspector.ReplayInputLineGraph.LineFillColor = new WebInspector.Color.fromRGBA(100, 100, 100, 0.6);
WebInspector.ReplayInputLineGraph.StyleClassName = "line-graph";


WebInspector.ReplayInputLineGraph.prototype = {
    constructor: WebInspector.ReplayInputLineGraph,
    __proto__: WebInspector.Object.prototype,

    // Public

    animateFrame: function()
    {
        this._recomputeGraphData();
        this._drawGraph();
    },

    // This class contains ContentView workalikes, but is not actually a content view.
    // These methods are used by the owning widget to signal setup, teardown, and resize.
    shown: function()
    {
        this._refreshSoon(true);
    },

    updateLayout: function()
    {
        this._refreshSoon(true);
    },

    closed: function()
    {
        this._calculator.removeEventListener(WebInspector.RecordingCalculator.Event.ZoomChanged, this._refreshSoon, this);
    },

    // Private

    _refreshSoon: function(shouldResizeCanvas)
    {
        // TODO: do this inside of animateFrame, using bound argument.
        if (shouldResizeCanvas)
            this._autosizeCanvas();

        // TODO: enqueue requestAnimationFrame callback to animateFrame() if a request is not already enqueued.
        this.animateFrame();
    },

    _autosizeCanvas: function()
    {
        if (this.element.parentElement === null)
            return;

        this.element.width = this.element.parentElement.clientWidth;
        this.element.style.width = this.element.parentElement.clientWidth + 'px';
        this.element.height = this.element.parentElement.clientHeight;
        this.element.style.height = this.element.parentElement.clientHeight + 'px';
        this._cachedOffsetWidth = this.element.parentElement.offsetWidth;
    },

    _resetGraphData: function()
    {
        this._data.maxIndex = -1;
        this._data.bins = [];
    },

     _recomputeGraphData: function()
    {
        var inputs = this._provider.inputs;
        if (!inputs.length)
            return;

        var binsPerTimeline = Math.min(Math.floor(this._cachedOffsetWidth / 2), WebInspector.ReplayInputLineGraph.MaxBins);
        var timestampGranularity = this._calculator.boundarySpan / binsPerTimeline;
        this._resetGraphData();

        // Create sparse arrays with 101 cells each to fill with counts for a given group.
        var markBinForTimestamp = function(timestamp)
        {
            var snappedTimestamp = timestamp - (timestamp % timestampGranularity);
            var percent = this._calculator.computeMiniviewPercentage(snappedTimestamp);
            var binIndex = Number.constrain(Math.round(percent * binsPerTimeline), 0, binsPerTimeline - 1);

            if (!this._data.bins[binIndex])
                this._data.bins[binIndex] = 1;
            else
                this._data.bins[binIndex] += 1;

            return true;
        };

        // TODO: only mark inputs within the active zoom interval

        for (var i = 0; i < inputs.length; ++i)
            if (!markBinForTimestamp.call(this, inputs[i].timestamp))
                break;

        var highMark = 0;
        for (var i = 0; i < this._data.bins.length; ++i) {
            if (this._data.bins[i] > highMark) {
                highMark = this._data.bins[i];
                this._data.maxIndex = i;
            }
        }
    },

    _clearGraph: function(ctx)
    {
        if (typeof ctx === "undefined")
            ctx = this.element.getContext("2d");

        ctx.clearRect(0, 0, this.element.width, this.element.height);
    },

    _drawGraph: function()
    {
        // Draw line graph for all inputs.
        var drawLineGraph = function(ctx, data) {
            if (!data.bins.length)
                return;

            var availHeight = this.element.height;
            var availWidth = this.element.width;
            var offsetPerPoint = availWidth / data.bins.length;
            var maxValue = data.bins[data.maxIndex];

            // Start from top-left, add line segments.
            ctx.beginPath();
            ctx.moveTo(0, availHeight);
            for (var i = 0; i < data.bins.length; ++i) {
                var percent = (data.bins[i] / maxValue) || 0;
                var pointX = (offsetPerPoint * i) + (offsetPerPoint / 2);
                var pointY = availHeight * (1 - percent);
                ctx.lineTo(pointX, pointY);
            }

            // TODO: this is a good place to add a stroke to the top edge.

            // Close the path along the bottom of the canvas.
            ctx.lineTo(availWidth, availHeight);
            ctx.lineTo(0, availHeight);
            ctx.closePath();
            ctx.fill();
        };

        var context = this.element.getContext('2d');
        this._clearGraph(context);

        context.lineJoin = WebInspector.ReplayInputLineGraph.LineJoinStyle;
        context.fillStyle = WebInspector.ReplayInputLineGraph.LineFillColor.value;
        drawLineGraph.call(this, context, this._data);
    }
};
