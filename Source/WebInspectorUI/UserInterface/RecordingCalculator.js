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

 WebInspector.RecordingCalculator = function(recording)
{
    WebInspector.Object.call(this);
    this._recording = recording;
    this.reset();
};

WebInspector.RecordingCalculator.Event = {
  ZoomChanged: "recording-calculator-zoom-changed"
};

WebInspector.RecordingCalculator.MinimumBoundarySpan = 0.0; // minimum viewable interval

WebInspector.RecordingCalculator.prototype = {
    constructor: WebInspector.RecordingCalculator,
    __proto__: WebInspector.Object.prototype,

    // Public

    reset: function()
    {
        this._zoomLeft = 0.0;
        this._zoomRight = 1.0;
        delete this.minimumBoundary;
        delete this.maximumBoundary;
    },

    get zoomInterval()
    {
        return this._zoomRight - this._zoomLeft;
    },

    setZoomInterval: function(left, right)
    {
        this._zoomLeft = Number.constrain(left || 0, 0.0, 1.0);
        this._zoomRight = Number.constrain(right || 1, 0.0, 1.0);
        this.dispatchEventToListeners(WebInspector.RecordingCalculator.Event.ZoomChanged);
    },

    get zoomLeft()
    {
        return this._zoomLeft;
    },

    set zoomLeft(zoom)
    {
        this.setZoomInterval(zoom, this.zoomRight);
    },

    get zoomRight()
    {
        return this._zoomRight;
    },

    set zoomRight(zoom)
    {
        this.setZoomInterval(this.zoomLeft, zoom);
    },

    get boundarySpan()
    {
        if (typeof this.minimumBoundary === "undefined" || typeof this.maximumBoundary === "undefined")
            return WebInspector.RecordingCalculator.MinimumBoundarySpan;

        return (this.maximumBoundary - this.minimumBoundary);
    },

    updateBoundaries: function(timestamp, suppressAdjustZoom)
    {
        if (typeof this.minimumBoundary === "undefined" || timestamp < this.minimumBoundary) {
            this.minimumBoundary = timestamp;
            if (!suppressAdjustZoom)
                this.zoomLeft = 0.0;
            return true;
        }
        if (typeof this.maximumBoundary === "undefined" || timestamp > this.maximumBoundary) {
            this.maximumBoundary = timestamp;
            this.dispatchEventToListeners(WebInspector.RecordingCalculator.Event.ZoomChanged);
            if (!suppressAdjustZoom)
                this.zoomRight = 0.0;
            return true;
        }
        return false;
    },

    // Computes a timestamp corresponding to a percent position on the overview.
    computeOverviewTimestamp: function(percent)
    {
    var overallPercent = this.zoomLeft + this.zoomInterval * percent;
    return this.minimumBoundary + this.boundarySpan * overallPercent;
    },

    // Computes a timestamp corresponding to a percent position on the miniview.
    computeMiniviewTimestamp: function(percent)
    {
    return this.minimumBoundary + this.boundarySpan * percent;
    },

    // this takes into account the viewable interval, returning the percentage within that region. */
    computeOverviewPercentage: function(timestamp)
    {
        return (timestamp - this.computeOverviewTimestamp(this.zoomLeft)) / (this.boundarySpan * this.zoomInterval);
    },

    computeMiniviewPercentage: function(timestamp)
    {
        return (timestamp - this.minimumBoundary) / this.boundarySpan;
    },

    computeMarkIndexFromPercentage: function(percent)
    {
        var timestamp = this.minimumBoundary + this.boundarySpan * percent;

        function timestampAndInputComparator(timestamp, input) {
            var input_timestamp = input.timestamp;
            if (input_timestamp > timestamp) return -1;
            if (input_timestamp < timestamp) return 1;
            return 0;
        }

        function timeDistanceFunction(timestamp, input) {
             return (input) ? Math.abs(timestamp - input.timestamp) : Number.POSITIVE_INFINITY;
        }

        var inputs = this._recording.inputs;
        var arrayIndex = inputs.nearestBinaryIndexOf(timestamp, timestampAndInputComparator, timeDistanceFunction);
        return inputs[arrayIndex].index;
    },

    formatValue: function(value)
    {
        return Number.secondsToString(value || 0);
    },

    // Format this as time since the minimum boundary.
    formatElapsedValue: function(value)
    {
        value = value || 0;
        return this.formatValue(value - this.minimumBoundary);
    },
};
