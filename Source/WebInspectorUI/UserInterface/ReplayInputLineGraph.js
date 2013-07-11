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

    this.element = document.createElement("div");
    this.element.classList.add(WebInspector.ReplayInputLineGraph.StyleClassName);

    this._canvas = this.element.createChild("canvas");

    this._canvas.addEventListener("mousewheel", this._onMousewheel.bind(this), true);
    this._calculator.addEventListener(WebInspector.RecordingCalculator.Event.ZoomChanged, this.refreshSoon, this);

    this._animateFrameCallback = this.animateFrame.bind(this);
}

WebInspector.ReplayInputLineGraph.MaxBins = 300;
WebInspector.ReplayInputLineGraph.LineFillColor = new WebInspector.Color.fromRGBA(100, 100, 100, 0.6);
WebInspector.ReplayInputLineGraph.StyleClassName = "line-graph";
WebInspector.ReplayInputLineGraph.WindowScrollSpeedFactor = 0.001;
WebInspector.ReplayInputLineGraph.WindowZoomSpeedFactor = 0.001;
WebInspector.ReplayInputLineGraph.MinimumInterval = 0.05;


WebInspector.ReplayInputLineGraph.prototype = {
    constructor: WebInspector.ReplayInputLineGraph,
    __proto__: WebInspector.Object.prototype,

    // Public

    animateFrame: function(shouldResizeCanvas)
    {
        if (shouldResizeCanvas)
            this._resizeCanvas();

        this._recomputeGraphData();
        this._drawGraph();
    },

    // This class contains ContentView workalikes, but is not actually a content view.
    // These methods are used by the owning widget to signal setup, teardown, and resize.
    shown: function()
    {
        this.refreshSoon(true);
    },

    updateLayout: function()
    {
        this.refreshSoon(true);
    },

    closed: function()
    {
        this._calculator.removeEventListener(WebInspector.RecordingCalculator.Event.ZoomChanged, this.refreshSoon, this);
    },

    refreshSoon: function(shouldResizeCanvas)
    {
        if (this._haveEnqueuedAnimationRequest)
            return;

        this._haveEnqueuedAnimationRequest = true;
        if (shouldResizeCanvas)
            window.requestAnimationFrame(this.animateFrame.bind(this, true));
        else
            window.requestAnimationFrame(this._animateFrameCallback);
    },

    // Private

    _onMousewheel: function(event)
    {
        var zoomLeft = this._calculator.zoomLeft;
        var zoomRight = this._calculator.zoomRight;
        var zoomInterval = this._calculator.zoomInterval;

        if (typeof event.wheelDeltaX === "number" && event.wheelDeltaX && zoomInterval != 1.0) {
            var delta = event.wheelDeltaX * WebInspector.ReplayInputLineGraph.WindowScrollSpeedFactor;
            zoomLeft = Number.constrain(zoomLeft - delta, 0.0, 1.0 - zoomInterval);
            zoomRight = Number.constrain(zoomRight - delta, zoomInterval, 1.0);
        }

        if (event.shiftKey && typeof event.wheelDeltaY === "number" && event.wheelDeltaY && zoomInterval != 1.0) {
            var delta = event.wheelDeltaY * WebInspector.ReplayInputLineGraph.WindowScrollSpeedFactor;
            zoomLeft = Number.constrain(zoomLeft - delta, 0.0, 1.0 - zoomInterval);
            zoomRight = Number.constrain(zoomRight - delta, zoomInterval, 1.0);
        }

        if (typeof event.wheelDeltaY === "number" && event.wheelDeltaY) {
            var xPosition = Number.constrain(event.clientX - this.element.totalOffsetLeft, 0, this.element.offsetWidth);
            var percent = xPosition / this.element.offsetWidth;
            var delta = event.wheelDeltaY * WebInspector.ReplayInputLineGraph.WindowZoomSpeedFactor;
            /* calculate zoom adjustment from right side, and paste to left.
            can't do naive scaling on LHS if it is near zero.  */
            var zoomDelta = zoomRight - zoomRight * (1.0 + delta);
            zoomLeft = Number.constrain(zoomLeft + (2 * zoomDelta * percent), 0.0, zoomRight - WebInspector.ReplayInputLineGraph.MinimumInterval);
            zoomRight = Number.constrain(zoomRight - (2 * zoomDelta * (1 - percent)), zoomLeft + WebInspector.ReplayInputLineGraph.MinimumInterval, 1.0);
        }

        this._calculator.setZoomInterval(zoomLeft, zoomRight);
        //this.refreshSoon();
        this._recomputeGraphData();
        this._drawGraph();
    },

    _resizeCanvas: function()
    {
        if (this.element.parentElement === null)
            return;

        this._canvas.width = this.element.clientWidth;
        this._canvas.style.width = this.element.clientWidth + 'px';
        this._canvas.height = this.element.clientHeight;
        this._canvas.style.height = this.element.clientHeight + 'px';
        this._cachedOffsetWidth = this.element.offsetWidth;
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
        var timePerBin = this._calculator.boundarySpan * this._calculator.zoomInterval / binsPerTimeline;
        this._resetGraphData();

        // Create sparse arrays with 101 cells each to fill with counts for a given group.
        var markBinForTimestamp = function(timestamp)
        {
            var snappedTimestamp = timestamp - (timestamp % timePerBin);
            var percent = this._calculator.zoomedPercentFromTimestamp(snappedTimestamp);
            var binIndex = Number.constrain(Math.round(percent * binsPerTimeline), 0, binsPerTimeline - 1);

            if (!this._data.bins[binIndex])
                this._data.bins[binIndex] = 1;
            else
                this._data.bins[binIndex] += 1;

            return true;
        };

        var leftBound = this._calculator.timestampFromGlobalPercent(this._calculator.zoomLeft);
        var rightBound = this._calculator.timestampFromGlobalPercent(this._calculator.zoomRight);

        for (var i = 0; i < inputs.length; ++i)
            if (inputs[i].timestamp >= leftBound && inputs[i].timestamp <= rightBound)
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
            ctx = this._canvas.getContext("2d");

        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    },

    _drawGraph: function()
    {
        // Draw line graph for all inputs.
        var drawLineGraph = function(ctx, data) {
            if (!data.bins.length)
                return;

            var availHeight = this._canvas.height;
            var availWidth = this._canvas.width;
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

        var context = this._canvas.getContext('2d');
        this._clearGraph(context);

        context.lineJoin = WebInspector.ReplayInputLineGraph.LineJoinStyle;
        context.fillStyle = WebInspector.ReplayInputLineGraph.LineFillColor.value;
        drawLineGraph.call(this, context, this._data);
    }
};
