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

WebInspector.LiveRecordingContentView = function(recording)
{
    WebInspector.ContentView.call(this, recording);

    this._recording = recording;
    this.element.classList.add(WebInspector.LiveRecordingContentView.StyleClassName);

    this._canvas = this.element.appendChild(document.createElement("canvas"));

    var stopElement = this.element.appendChild(document.createElement("div"));
    stopElement.innerHTML = "Stop Recording?"
    stopElement.className = WebInspector.ReplayDashboardView.StopStyleClassName;
    stopElement.title = WebInspector.UIString("Click to stop recording");
    stopElement.addEventListener("click", this._stopClicked.bind(this));

    this._timeline = { provider: null, maxIndex: -1, data: [] };

    this._listeners = new WebInspector.EventListenerGroup("LiveRecordingContentView recording listeners");
    this._listeners.install();

    this._animateFrameCallback = this.animateFrame.bind(this);

    window.webkitRequestAnimationFrame(this._animateFrameCallback);
};

WebInspector.LiveRecordingContentView.StyleClassName = "live-recording";
WebInspector.ReplayDashboardView.StopStyleClassName = "stop";

WebInspector.LiveRecordingContentView.GraphBorderWidth = 1; // in pixels
WebInspector.LiveRecordingContentView.GraphBorderStrokeColor = new WebInspector.Color("#999");
WebInspector.LiveRecordingContentView.MaxRecordLifetime = 10.0; // seconds
WebInspector.LiveRecordingContentView.MaxBinsPerTimeline = 300;
WebInspector.LiveRecordingContentView.LineGraphFillColor = new WebInspector.Color.fromRGBA(100, 100, 100, 0.6);


WebInspector.LiveRecordingContentView.prototype = {
    constructor: WebInspector.LiveRecordingContentView,
    __proto__: WebInspector.ContentView.prototype,

    // Public

    updateLayout: function()
    {
        this._autosizeCanvas();
        this._drawGraph();
    },

    closed: function()
    {
        WebInspector.ContentView.prototype.closed.call(this);
        this._listeners.uninstall(true);
    },

    animateFrame: function()
    {
        this._recomputeTimeline();
        this._drawGraph();

        if (this._recording.isCapturing)
            window.webkitRequestAnimationFrame(this._animateFrameCallback);
    },

    // Private

    _autosizeCanvas: function()
    {
        this._canvas.width = this.element.clientWidth;
        this._canvas.style.width = this.element.clientWidth + 'px';
        this._canvas.height = this.element.clientHeight;
        this._canvas.style.height = this.element.clientHeight + 'px';
        this._cachedOffsetWidth = this.element.offsetWidth;
    },

    _stopClicked: function(event)
    {
        WebInspector.replayManager.stopCaptureSoon();
    },

    // Clear the data of the timeline.
    _resetTimeline: function()
    {
        this._timeline.maxIndex = -1;
        this._timeline.data = [];
    },

    _recomputeTimeline: function()
    {
        var inputProvider = this._recording.firstProviderWithConstructor(WebInspector.LiveInputDataProvider);
        this._timeline.provider = inputProvider;
        var inputs = inputProvider.inputs;

        if (!inputs[0])
            return;

        this._binsPerTimeline = Math.min(this._cachedOffsetWidth/2, WebInspector.LiveRecordingContentView.MaxBinsPerTimeline);

        var interval = WebInspector.LiveRecordingContentView.MaxRecordLifetime;
        var now = Date.now();
        if (!this._previousAnimationTime)
            this._minTimestamp = inputs[0].timestamp - interval;
        else
            this._minTimestamp = this._minTimestamp + (now - this._previousAnimationTime) * 0.001;

        this._previousAnimationTime = now;
        var timestampGranularity = interval / this._binsPerTimeline;
        this._resetTimeline();

        // Create sparse arrays with 101 cells each to fill with counts for a given group.
        function markPercentagesForRecord(record)
        {
            if (record.timestamp < this._minTimestamp)
                return false;

            var snappedTimestamp = record.timestamp - (record.timestamp % timestampGranularity);
            var percent = Math.round(this._binsPerTimeline * (snappedTimestamp - this._minTimestamp) / interval);
            var percentile = Number.constrain(percent, 0, this._binsPerTimeline-1);

            if (!this._timeline.data[percentile])
                this._timeline.data[percentile] = 1;
            else
                this._timeline.data[percentile] += 1;

            return true;
        }
        var i = 0;
        for (i = inputs.length-1; i >= 0; i--) {
            if (!markPercentagesForRecord.call(this, inputs[i]))
                break;
        }

        var timeline = this._timeline;
        var highMark = 0;
        for (var i = 0; i < timeline.data.length; i++) {
            if (timeline.data[i] > highMark && i < timeline.data.length*0.9) {
                highMark = timeline.data[i];
                timeline.maxIndex = i;
            }
        }
    },

    _clearGraph: function(ctx)
    {
        if (typeof ctx === "undefined")
            ctx = this._canvas.getContext("2d");

        var availHeight = this._canvas.height;
        var availWidth = this._canvas.width;

        ctx.clearRect(0, 0, availWidth, availHeight);

        // Draw border.
        ctx.strokeStyle = WebInspector.LiveRecordingContentView.GraphBorderStrokeColor.value;
        ctx.lineWidth = WebInspector.LiveRecordingContentView.GraphBorderWidth;
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(availWidth, 0);
        ctx.lineTo(availWidth, availHeight);
        ctx.lineTo(0, availHeight);
        ctx.lineTo(0, 0);
        ctx.stroke();
    },

    _drawGraph: function()
    {
        var ctx = this._canvas.getContext('2d');
        this._clearGraph(ctx);

        if (!this._timeline.data || !this._timeline.provider)
            return;

        //ctx.save();
        //ctx.translate(WebInspector.LiveRecordingContentView.GraphBorderWidth, WebInspector.LiveRecordingContentView.GraphBorderWidth);

        var pointCount = this._binsPerTimeline;
        var availHeight = this._canvas.height - WebInspector.LiveRecordingContentView.GraphBorderWidth * 2 + 1;
        var availWidth = this._canvas.width - WebInspector.LiveRecordingContentView.GraphBorderWidth * 2 + 1;
        var offsetPerPoint = availWidth / pointCount;
        var maxValue = this._timeline.data[this._timeline.maxIndex];

        // Draw bars for all actions.
        function drawLineGraph(data) {
            ctx.beginPath();
            ctx.moveTo(0, availHeight);
            for (var i = 0; i < pointCount; ++i) {
                var percent = (data[i] / maxValue) || 0;
                var pointX = (offsetPerPoint * i) + (offsetPerPoint / 2);
                var pointY = availHeight * (1 - percent);
                ctx.lineTo(pointX, pointY);
            }
            ctx.lineTo(availWidth, availHeight);
            ctx.lineTo(0, availHeight);
            ctx.closePath();
            ctx.fill();
        }

        var currentData = this._timeline.data;
        ctx.lineJoin = "round";
        ctx.fillStyle = WebInspector.LiveRecordingContentView.LineGraphFillColor.value;
        drawLineGraph.call(this, currentData);

        //ctx.restore();
    }
};
