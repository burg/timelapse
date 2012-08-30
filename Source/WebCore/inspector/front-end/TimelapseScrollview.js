/*
 *  Copyright (C) 2012, Brian Burg.
 *  Copyright (C) 2012, University of Washington. All rights reserved.
 *
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

/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseScrollview = function()
{
    WebInspector.View.call(this);
    this.registerRequiredCSS("timelapseMiniview.css");

    this._model = WebInspector.timelapseModel;
    this._presentationModel = WebInspector.timelapsePresentationModel;
   
    var eventNames = WebInspector.TimelapseModel.EventTypes;
    this._model.addEventListener(eventNames.RecordingDidStart, this._onRecordingDidStart, this);

    this._initializeView();	
};

WebInspector.TimelapseScrollview.MaxRecordLifetime = 10.0; /* seconds */
WebInspector.TimelapseScrollview.MaxBinsPerTimeline = 600;


WebInspector.TimelapseScrollview.prototype = {
    // Public API
    reset: function()
    {
	this._resetTimelines();
	this._previousMaxValue = 0;
	delete this._previousAnimationTime;
	this._autosizeCanvas();
	this._clearGraph();
    },

    refresh: function()
    {
	this._drawGraph();
    },

    wasShown: function()
    {
	/* in case we stopped animating, but the window resized... */
	this._drawGraph();
    },

    onResize: function()
    {
	this._autosizeCanvas();
	this._drawGraph();
    },

    get calculator()
    {
	return this._presentationModel.calculator;
    },

    animateFrame: function()
    {
	this._recomputeTimelines();
	this._drawGraph();

	if (this._model.recording)
	    window.webkitRequestAnimationFrame(this.animateFrame.bind(this));
    },

    // Private API helpers

    _graphBorderWidth: 1,

    _autosizeCanvas: function()
    {
	this._canvas.width = this.element.clientWidth;
    	this._canvas.style.width = this.element.clientWidth + 'px';
	this._canvas.height = this.element.clientHeight;
	this._canvas.style.height = this.element.clientHeight + 'px';
    },

    _initializeView: function()
    {
	this.element.className = "timelapse-scrollview";

	this._canvas = document.createElement("canvas");
	this.element.appendChild(this._canvas);

	this.reset();
    },

    _binsPerTimeline: 200,

    _resetTimelines: function()
    {
	function createEmptyTimeline() {
	    return { maxIndex: -1, data: [] };
	}

	this._timelines = {};
	var order = this._presentationModel.categoryOrder;
	for (var i = 0; i < order.length; i++) {
	    var key = order[i];
	    var category = this._presentationModel.categories[key];
	    this._timelines[category.name] = createEmptyTimeline();
	}
	this._timelines["all"] = createEmptyTimeline();
    },

    _recomputeTimelines: function()
    {
	if (!this.calculator.minimumBoundary)
	    return;

	this._binsPerTimeline = Math.min(this.element.offsetWidth, WebInspector.TimelapseScrollview.MaxBinsPerTimeline);

	var interval = WebInspector.TimelapseScrollview.MaxRecordLifetime;
	var now = Date.now();
	if (!this._previousAnimationTime)
	    this._minTimestamp = this.calculator.minimumBoundary - interval;
	else
	    this._minTimestamp = this._minTimestamp + (now - this._previousAnimationTime) * 0.001;

	this._previousAnimationTime = now;
	var records = this._model.allRecords;
	var timestampGranularity = interval / this._binsPerTimeline;
	this._resetTimelines();

	// Create sparse arrays with 101 cells each to fill with counts for a given category.
	for (var i = records.length-1; i >= 0; i--) {
	    var record = records[i];
	    if (record.mark.timestamp < this._minTimestamp)
		break;

	    var category = this._presentationModel.recordStyles[record.type].category;
	    var snappedTimestamp = record.mark.timestamp - (record.mark.timestamp % timestampGranularity);
	    var percent = Math.round(this._binsPerTimeline * (snappedTimestamp - this._minTimestamp) / interval);
	    var percentile = Number.constrain(percent, 0, this._binsPerTimeline-1);

	    if (!this._timelines[category.name].data[percentile])
		this._timelines[category.name].data[percentile] = 1;
	    else
		this._timelines[category.name].data[percentile] += 1;

	    if (!this._timelines.all.data[percentile])
		this._timelines.all.data[percentile] = 1;
	    else
		this._timelines.all.data[percentile] += 1;
	}

	for (var key in this._timelines) {
	    var timeline = this._timelines[key];
	    var highMark = 0;
	    for (var i = 0; i < timeline.data.length; i++) {
		if (timeline.data[i] > highMark && i < timeline.data.length*0.9) {
		    highMark = timeline.data[i];
		    timeline.maxIndex = i;
		}
	    }
	}
    },

    _clearGraph: function(ctx)
    {
	if (typeof ctx === "undefined")
	    ctx = this._canvas.getContext("2d");

	var availHeight = this._canvas.height;
	var availWidth = this._canvas.width;

	ctx.fillStyle = "#fff";
	ctx.clearRect(0, 0, availWidth, availHeight);
	/* draw border */
	ctx.strokeStyle = "#666";
	ctx.lineWidth = this._graphBorderWidth;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(availWidth, 0);
	ctx.lineTo(availWidth, availHeight);
	ctx.lineTo(0, availHeight);
	ctx.lineTo(0, 0);
	ctx.stroke();

	ctx.save();
	ctx.translate(this._graphBorderWidth, this._graphBorderWidth);
	availHeight -= this._graphBorderWidth*2;
	availWidth -= this._graphBorderWidth*2; 

	/* draw 1/4, 1/2, 3/4 */
	var shouldDrawLabels = this._timelines && this._timelines.all.data.length > 0;
	if (shouldDrawLabels)
	    var maxValue = this._previousMaxValue || this._timelines.all.data[this._timelines.all.maxIndex];

	ctx.strokeStyle = "#e5e5e5";
	ctx.fillStyle="#888";
	ctx.font = "8px Lucida Console, sans-serif";
	ctx.textAlign = "right";
	ctx.lineWidth = 1.0;
	var height = Math.floor(availHeight*0.33)+0.5;
	ctx.beginPath();
	ctx.moveTo(0, height);
	ctx.lineTo(availWidth, height);
 	ctx.stroke();
	if (shouldDrawLabels)
	    ctx.fillText(Math.ceil(maxValue*0.66), availWidth-5, height+2, 15);
	height = Math.floor(availHeight*0.66)+0.5;
	ctx.beginPath();
	ctx.moveTo(0, height);
	ctx.lineTo(availWidth, height);
	ctx.stroke();
	if (shouldDrawLabels)
	    ctx.fillText(Math.floor(maxValue*0.33), availWidth-5, height+2, 15);

	ctx.restore();
    },

    _drawGraph: function()
    {
	var ctx = this._canvas.getContext('2d');
	this._clearGraph(ctx);

	if (!this._timelines)
	    return;

	ctx.save();
	ctx.translate(this._graphBorderWidth, this._graphBorderWidth);

	var pointCount = this._binsPerTimeline;
	var availHeight = this._canvas.height - this._graphBorderWidth*2;
	var availWidth = this._canvas.width - this._graphBorderWidth*2;
	var offsetPerPoint = availWidth / pointCount;
	var maxValue = this._timelines.all.data[this._timelines.all.maxIndex];

	/* draw allRecords bars */
	function drawLineGraph(data, name) {
	    ctx.lineJoin = "round";
	    ctx.beginPath();
	    ctx.moveTo(0, availHeight);
	    var highMark = 0;
	    for (var i = 0; i < pointCount; i++) {
		var percent = (data[i] / maxValue) || 0;
		var pointX = offsetPerPoint*i+offsetPerPoint/2;
		var pointY = availHeight * (1-percent);
		ctx.lineTo(pointX, pointY);
	    }
	    ctx.lineTo(availWidth, availHeight);
	    ctx.lineTo(0, availHeight);
	    ctx.closePath();
	    ctx.fill();
	}
	
	var currentData = this._timelines.all.data.slice();
	ctx.fillStyle = "rgba(0,0,0,0.3)";
	drawLineGraph.call(this, currentData, "all");

	/* first, substract values for all disabled categories */
	var order = this._presentationModel.categoryOrder;
	for (var i = 0; i < order.length; i++) {
	    var key = order[i];
	    var category = this._presentationModel.categories[key];
	    if (!category.disabled)
		continue;

	    var catData = this._timelines[category.name].data;
	    for (var j = 0; j < catData.length; j++)
		if (catData[j])
		    currentData[j] -= catData[j];
	}


	/* then, go back and paint those that remain (and substract them) */
	for (i = 0; i < order.length; i++) {
	    var key = order[i];
	    var category = this._presentationModel.categories[key];
	    if (category.disabled)
		continue;

	    var rgb = category.color.rgb;
	    var rgba = WebInspector.Color.fromRGBA(rgb[0],
						   rgb[1],
						   rgb[2],
						   0.6);
	    ctx.fillStyle = rgba.toString();
	    drawLineGraph.call(this, currentData, category.name);

	    var catData = this._timelines[category.name].data;
	    for (var j = 0; j < catData.length; j++)
		if (catData[j])
		    currentData[j] -= catData[j];
	}

	ctx.restore();
    },

    // Private API (callbacks)
    _onRecordingDidStart: function()
    {
	this._recordingStartTime = Date.now();
	this.reset();
	window.webkitRequestAnimationFrame(this.animateFrame.bind(this));
    }
};

WebInspector.TimelapseScrollview.prototype.__proto__ = WebInspector.View.prototype;
