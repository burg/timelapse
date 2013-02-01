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
WebInspector.TimelapseMiniview = function(model, recording)
{
    WebInspector.View.call(this);

    // Each timeline aggregates the data for a specific provider name.
    // There can be several data providers with the same name, but only one timeline per name.
    // So, timelines are stored in an object by name, while providers are in a list.

    this._model = model;
    this._recording = recording;

    this._modifyListeners("addEventListener");

    this.element.classList.add("timelapse-miniview");
    this.element.classList.add("timelapse-overview-column-main");
    this.element.classList.add("timelapse-overview-row-label");
    this.element.tabIndex = 1;
    this.element.addEventListener("dblclick", this._onMiniviewDoubleClicked.bind(this), true);
    this.element.addEventListener("mousewheel", this._onMiniviewMousewheel.bind(this), true);
    WebInspector.installDragHandle(this.element, this._startZoomSelectorDragging.bind(this), this._zoomSelectorDragging.bind(this), this._endZoomSelectorDragging.bind(this), "ew-resize");
    
    this._canvas = document.createElement("canvas");
    this._canvas.className = "timelapse-miniview-canvas";
    this.element.appendChild(this._canvas);

    var playbackSlider = new WebInspector.TimelapseMiniviewSlider(this, "playback", true);
    playbackSlider.addEventListener(WebInspector.TimelapseMiniviewSlider.Events.DragStart,
				    this._onPlaybackSliderDragStart, this);
    playbackSlider.addEventListener(WebInspector.TimelapseMiniviewSlider.Events.DragEnd,
				    this._onPlaybackSliderDragEnd, this);
    this.element.appendChild(playbackSlider.element);

    var previousSlider = new WebInspector.TimelapseMiniviewSlider(this, "previous", false);
    this.element.appendChild(previousSlider.element);

    var tentativeSlider = new WebInspector.TimelapseMiniviewSlider(this, "tentative", false);
    this.element.appendChild(tentativeSlider.element);

    this._leftZoomGlassPane = document.createElement("div");
    this._leftZoomGlassPane.className = "timelapse-miniview-glasspane";
    this.element.appendChild(this._leftZoomGlassPane);

    this._rightZoomGlassPane = document.createElement("div");
    this._rightZoomGlassPane.className = "timelapse-miniview-glasspane";
    this.element.appendChild(this._rightZoomGlassPane);

    var leftZoomSlider = new WebInspector.TimelapseMiniviewSlider(this, "zoom", true, true);
    leftZoomSlider.element.classList.add("left");
    leftZoomSlider.addEventListener(WebInspector.TimelapseMiniviewSlider.Events.DragStart,
				    this._onZoomSliderDragStart.bind(this, "leftZoom"));
    leftZoomSlider.addEventListener(WebInspector.TimelapseMiniviewSlider.Events.DragEnd,
				    this._onZoomSliderDragEnd.bind(this, "leftZoom"));
    this.element.appendChild(leftZoomSlider.element);

    var rightZoomSlider = new WebInspector.TimelapseMiniviewSlider(this, "zoom", true, true);
    rightZoomSlider.element.classList.add("right");
    rightZoomSlider.addEventListener(WebInspector.TimelapseMiniviewSlider.Events.DragStart,
				     this._onZoomSliderDragStart.bind(this, "rightZoom"));
    rightZoomSlider.addEventListener(WebInspector.TimelapseMiniviewSlider.Events.DragEnd,
				     this._onZoomSliderDragEnd.bind(this, "rightZoom"));
    this.element.appendChild(rightZoomSlider.element);

    this.sliders = {
	playback: playbackSlider,
	previous: previousSlider,
	tentative: tentativeSlider,
	savepoint: [],
	leftZoom: leftZoomSlider,
	rightZoom: rightZoomSlider
    };

    this._providers = [];
    this._timelines = {};
    this._timelines.all = { providers: [], maxIndex: -1, data: [] };

    this._previousMaxValue = 0;
    this._clearGraph();
    
    // add input providers that have already been created
    var inputProviders = this._recording.providersWithType(WebInspector.DataProvider.Types.TimelapseInput);
    for (var i = 0; i < inputProviders.length; i++)
        this._addProvider(inputProviders[i]);
    
    // initialize slider position
    this.sliders.playback.enable();
    this.sliders.playback.setPosition(1.0, true);
  	this.sliders.playback.show();
};

WebInspector.TimelapseMiniview.EdgeSnapDistance = 0.02; /* percent */
WebInspector.TimelapseMiniview.MinSelectableSize = 0.005; /* percent */
WebInspector.TimelapseMiniview.MinAnimationDelta = 0.5; /* seconds? */
WebInspector.TimelapseMiniview.WindowScrollSpeedFactor = 0.001;
WebInspector.TimelapseMiniview.WindowZoomSpeedFactor = 0.001;

WebInspector.TimelapseMiniview.prototype = {
    _modifyListeners: function(op) {
        console.assert(op === "addEventListener" || op === "removeEventListener",
                       "Tried to do something unsupported to listeners: " + op);
        
        var eventNames = WebInspector.TimelapseModel.Events;
        this._model[op](eventNames.PlaybackDidStart, this._onPlaybackDidStart, this);
        this._model[op](eventNames.PlaybackStopped,  this._onPlaybackStopped, this);
        this._model[op](eventNames.InputPaused,      this._onInputPaused, this);
        this._model[op](eventNames.InputHit,         this._onInputHit, this);
        this._model[op](eventNames.BreakpointPaused, this._onBreakpointPaused, this);
        this._model[op](eventNames.BreakpointHit,    this._onBreakpointRecordsChanged, this);

        var recordingEventNames = WebInspector.TimelapseRecording.Events;
        this._recording[op](recordingEventNames.ProviderAdded,  this._onProviderAdded, this);
        this._recording[op](recordingEventNames.PreviewStarted, this._onPreviewStarted, this);
        this._recording[op](recordingEventNames.PreviewStopped, this._onPreviewStopped, this);
        this._recording[op](recordingEventNames.PreviewChanged, this._onPreviewChanged, this);

        this._recording.calculator[op](WebInspector.TimelapseCalculator.Events.ZoomChanged, this._onZoomChanged, this);

        var bpEventNames = WebInspector.BreakpointManager.Events;
        WebInspector.breakpointManager[op](bpEventNames.BreakpointAdded,   this._onBreakpointRecordsChanged, this);
        WebInspector.breakpointManager[op](bpEventNames.BreakpointRemoved, this._onBreakpointRecordsChanged, this);
        WebInspector.breakpointManager[op](bpEventNames.BreakpointRemovedFromStorage, this._onBreakpointRecordsChanged, this);
    },

    // Public API
    willDispose: function()
    {
        this._modifyListeners("removeEventListener");
    },
    
    wasShown: function()
    {
	WebInspector.View.prototype.wasShown.call(this);

	this._refreshIfNeeded();
	this._updateZoomLeft();
	this._updateZoomRight();
	this._autosizeCanvas();
    },

    onResize: function()
    {
	WebInspector.View.prototype.onResize.call(this);

	this._updateZoomLeft();
	this._updateZoomRight();
	this._autosizeCanvas();
	this._drawGraph();
    },

    get calculator()
    {
	return this._recording.calculator;
    },

    refresh: function()
    {
	this._recomputeTimelines();
	this._drawGraph();
	this.sliders.playback.refresh();
    },

    // Private API helpers

    _graphBorderWidth: 1,

    _canUseProvider: function(provider)
    {
	var types = WebInspector.DataProvider.Types;
	return provider.type == types.TimelapseInput ||
               provider.type == types.BreakpointHits ||
               provider.type == types.ReplaySavepoint;
    },

    _providersWithType: function(ty)
    {
	var found = [];
	for (var i = 0; i < this._providers.length; i++) {
	    var provider = this._providers[i];
	    if (provider.type === ty) {
		found.push(provider);
	    }
	}
	
	return found;
    },

    _modifyListenersForProvider: function(provider, op)
    {
    
    console.assert(op === "addEventListener" || op === "removeEventListener",
                   "Tried to do something unsupported to listeners: " + op);
        
	var events = WebInspector.DataProvider.Events;
	var types = WebInspector.DataProvider.Types;

	provider[op](events.WillRemove, this._onProviderWillRemove, this);

	if (provider.type == types.ReplaySavepoint) {
	    var savepointEvents = WebInspector.ReplaySavepointProvider.Events;
	    provider[op](savepointEvents.SavepointSet, this._onSavepointSet, this);
	    provider[op](savepointEvents.SavepointRemoved, this._onSavepointRemoved, this);
	} else {
	    provider[op](events.AddedInput, this._onAddedInput, this);
	    provider[op](events.Enabled, this._onProviderEnabled, this);
	    provider[op](events.Disabled, this._onProviderDisabled, this);
	}
    },

    _teardownListenersForProvider: function(provider)
    {
	var events = WebInspector.DataProvider.Events;
	var types = WebInspector.DataProvider.Types;

	provider.removeEventListener(events.WillRemove, this._onProviderWillRemove, this);

	if (provider.type == types.ReplaySavepoint) {
	    var savepointEvents = WebInspector.ReplaySavepointProvider.Events;
	    provider.removeEventListener(savepointEvents.SavepointSet, this._onSavepointSet, this);
	    provider.removeEventListener(savepointEvents.SavepointRemoved, this._onSavepointRemoved, this);
	} else {
	    provider.removeEventListener(events.AddedInput, this._onAddedInput, this);
	    provider.removeEventListener(events.Enabled, this._onProviderEnabled, this);
	    provider.removeEventListener(events.Disabled, this._onProviderDisabled, this);
	}
    },

    _autosizeCanvas: function()
    {
	this._canvas.width = this.element.clientWidth;
    	this._canvas.style.width = this.element.clientWidth + 'px';
	this._canvas.height = this.element.clientHeight;
	this._canvas.style.height = this.element.clientHeight + 'px';
    },

    _binsPerTimeline: 100,

    _scheduleRefresh: function()
    {
	window.webkitRequestAnimationFrame(this.refresh.bind(this));
    },

    _refreshIfNeeded: function()
    {
	this._scheduleRefresh();
    },


    // clear the data of the timelines, but not the entries themselves.
    // those are managed by the constructor and provider added/removed handlers.
    _resetTimelines: function()
    {
	for (var key in this._timelines) {
	    // doesn't touch the providers list, since this is managed by handlers.
	    this._timelines[key].maxIndex = -1;
	    this._timelines[key].data = [];
	}
    },

    _recomputeTimelines: function()
    {
	// Create sparse arrays with 101 cells each to fill with counts for a given group.
	function markPercentagesForRecord(record)
	{
	    var group = WebInspector.TimelapseInputDataProvider.InputStyles[record.type].group;
	    var percent = Math.floor(100.0 * this.calculator.computeMiniviewPercentage(record.mark.timestamp));
	    var percentile = Number.constrain(percent, 0, 99);

	    if (!this._timelines[group].data[percentile])
		this._timelines[group].data[percentile] = 1;
	    else
		this._timelines[group].data[percentile] += 1;

	    if (!this._timelines.all.data[percentile])
		this._timelines.all.data[percentile] = 1;
	    else
		this._timelines.all.data[percentile] += 1;
	}

	// Create sparse arrays with 101 cells each to fill with counts for a given group.
	function markPercentagesForBreakpointRecord(record)
	{
	    var group = "breakpoint";
	    var percent = Math.floor(100.0 * this.calculator.computeMiniviewPercentage(record.mark.timestamp));
	    var percentile = Number.constrain(percent, 0, 99);

	    if (!this._timelines[group].data[percentile])
		this._timelines[group].data[percentile] = 1;
	    else
		this._timelines[group].data[percentile] += 1;

	    if (!this._timelines.all.data[percentile])
		this._timelines.all.data[percentile] = 1;
	    else
		this._timelines.all.data[percentile] += 1;
	}

	this._resetTimelines();

	for (var i = 0; i < this._providers.length; i++) {
	    var provider = this._providers[i];
	    if (provider.records.length)

	    if (provider.type == WebInspector.DataProvider.Types.BreakpointHits)
		provider.records.map(markPercentagesForBreakpointRecord.bind(this));
	    else
		provider.records.map(markPercentagesForRecord.bind(this));
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

	/* draw 1/3, 2/3 */
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
	var maxValue = this._previousMaxValue || this._timelines.all.data[this._timelines.all.maxIndex];

	/* draw allRecords bars */
	function drawLineGraph(data, name) {
	    ctx.lineJoin = "round";
	    ctx.beginPath();
	    ctx.moveTo(0, availHeight);
	    var highMark = 0;
	    for (var i = 0; i < pointCount; i++) {
		var dataPoint = (i == 0) ? (data[i]||0)/2 : ((data[i-1]||0)
							     +(data[i]||0))/2;
		if (dataPoint > highMark && i < pointCount*0.9)
		    highMark = dataPoint;
		var percent = dataPoint / maxValue;
		var pointX = offsetPerPoint*i+offsetPerPoint/2;
		var pointY = availHeight * (1-percent);
		ctx.lineTo(pointX, pointY);
	    }
	    ctx.lineTo(availWidth, availHeight);
	    ctx.lineTo(0, availHeight);
	    ctx.closePath();
	    ctx.fill();

	    if (name == "all")
		this._previousMaxValue = highMark;
	}
	
	var currentData = this._timelines.all.data.slice();
	ctx.fillStyle = "rgba(0,0,0,0.3)";
	drawLineGraph.call(this, currentData, "all");

	// first, subtract values for timelines containing
	// constituent providers that are disabled.

	// TODO: this widget should be able to handle enabling just
	// some providers of the same type. Will need to refactor timelines.
	for (var key in this._timelines) {
	    if (key == "all")
		continue;

	    var timeline = this._timelines[key];
	    var anyProviderDisabled = false;
	    for (var i = 0; i < timeline.providers.length; i++) {
		if (!timeline.providers[i].isEnabled())
		    anyProviderDisabled = true;
	    }
	    if (!anyProviderDisabled)
		continue;

	    for (var j = 0; j < timeline.data.length; j++)
		if (timeline.data[j])
		    currentData[j] -= timeline.data[j];
	}

	// then, go back and paint those that remain (and subtract them)
	for (var key in this._timelines) {
	    if (key == "all")
		continue;

	    var timeline = this._timelines[key];
	    var anyProviderDisabled = false;
	    for (var i = 0; i < timeline.providers.length; i++) {
		if (!timeline.providers[i].isEnabled())
		    anyProviderDisabled = true;
	    }

	    var firstProvider = timeline.providers[0];
	    var rgb = firstProvider.color.rgb;
	    var rgba = WebInspector.Color.fromRGBA(rgb[0],
						   rgb[1],
						   rgb[2],
						   0.8);
	    ctx.fillStyle = rgba.toString();
	    drawLineGraph.call(this, currentData, firstProvider.name);

	    // overpainting disabled timelines ensures same alpha blending look
	    if (anyProviderDisabled)
		continue;
	    
	    for (var j = 0; j < timeline.data.length; j++)
		if (timeline.data[j])
		    currentData[j] -= timeline.data[j];
	}

	ctx.restore();
    },

    // Private API (callbacks)
    _onProviderAdded: function(event)
    {
	var provider = event.data;
	if (!this._canUseProvider(provider))
	    return;

    this._addProvider(provider);
    },
    
    _addProvider: function(provider)
    {
	this._modifyListenersForProvider(provider, "addEventListener");

	if (provider.type == WebInspector.DataProvider.Types.ReplaySavepoint)
	    return;

	// add provider to internal list
	console.assert(this._providers.indexOf(provider) == -1,
		       "Specific provider already added to miniview provider list.");
	this._providers.push(provider);

	// add timeline for this named provider, if it doesn't exist.
	if (!this._timelines.hasOwnProperty(provider.name))
	    this._timelines[provider.name] = { providers: [], maxIndex: -1, data: [] };

	console.assert(this._timelines[provider.name].providers.indexOf(provider) == -1,
		       "Tried to double-add a provider to a miniview timeline.");
	this._timelines[provider.name].providers.push(provider);

	// force dimensions to be recalculated
	this.onResize();
    },

    _onProviderWillRemove: function(event)
    {
	var provider = event.data;
	this._modifyListenersForProvider(provider, "removeEventListener");

	if (provider.type == WebInspector.DataProvider.Types.ReplaySavepoint)
	    return;

	var i = this._providers.indexOf(provider);
	console.assert(i != -1, "Can't remove provider not in timeline grid.");

	var removedProvider = this._providers.splice(i, 1)[0];

	// splice out the provider from related timeline, and remove
	// the timeline entirely if no more providers are attached to it.
	var timeline = this._timelines[removedProvider.name];
	timeline.providers.splice(timeline.providers.indexOf(removedProvider), 1);
	if (timeline.providers.length == 0) {
	    delete this._timelines[removedProvider.name];
	}
    },

    _onAddedInput: function(event)
    {
	var input = event.data.input;
	this._scheduleRefresh();
    },

    _onProviderEnabled: function(event)
    {
	this._potentialMarkBounds = false;
	this._scheduleRefresh();
    },

    _onProviderDisabled: function(event)
    {
	this._potentialMarkBounds = false;
	this._scheduleRefresh();
    },

    _onPlaybackDidStart: function()
    {
	// timestamp of start/finish/now to position the sliders.
	var allRecords = this._recording.allRecords;
	var startRecord = allRecords[this._model.recordIndexFromMarkIndex(this._model.replayStartMarkIndex)];
	var finishRecord = allRecords[this._model.recordIndexFromMarkIndex(this._model.replayFinishMarkIndex)];
	var currentRecordIndex = this._model.recordIndexFromMarkIndex(this._model.currentMarkIndex);

	this.sliders.playback.element.removeStyleClass("breakpoint-slider");
	this.sliders.playback.show();

	this.sliders.previous.setPosition(this.calculator.computeMiniviewPercentage(startRecord.mark.timestamp),
					  true);
	this.sliders.previous.show();
	this.sliders.tentative.setPosition(this.calculator.computeMiniviewPercentage(finishRecord.mark.timestamp),
					  true);
	this.sliders.tentative.show();
	this.sliders.playback.disable();
	this.sliders.playback.element.addStyleClass("playback-pulse");
	this.sliders.playback.minimumResolution = (this._model.fastReplaying) ? 10.0 : 1.0;

	if (currentRecordIndex != -1) {
    	    var currentRecord = allRecords[currentRecordIndex];
	    this.sliders.playback.setPosition(this.calculator.computeMiniviewPercentage(currentRecord.mark.timestamp), true);	
	} else {
	    this.sliders.playback.setPosition(0.0, true);
	}
    },

    _onPlaybackStopped: function()
    {
	this.sliders.playback.resetResolution();
	this.sliders.playback.element.removeStyleClass("playback-pulse");
	this.sliders.playback.enable();
	this.sliders.previous.hide();
	this.sliders.tentative.hide();
    },

    _onInputPaused: function()
    {
	var allRecords = this._recording.allRecords;
	var recordIndex = this._model.recordIndexFromMarkIndex(this._model.currentMarkIndex);
	
	if (recordIndex != -1) {
	    var percent = this.calculator.computeMiniviewPercentage(allRecords[recordIndex].mark.timestamp);
	    this.sliders.playback.setPosition(percent, true);
	}

	this.sliders.previous.hide();
	this.sliders.tentative.hide();

	this.sliders.playback.resetResolution();
	this.sliders.playback.element.removeStyleClass("playback-pulse");
	this.sliders.playback.enable();
    },


    _onInputHit: function(event)
    {
	var markIndex = event.data;
	var recordIndex = this._model.recordIndexFromMarkIndex(markIndex);

	// don't animate if this mark has no corresponding record (aka, not a user-visible mark)
	if (recordIndex == -1)
	    return;

	var allRecords = this._recording.allRecords;
	var percent = 0.0;
	if (markIndex > 0)
            percent = this.calculator.computeMiniviewPercentage(allRecords[recordIndex].mark.timestamp);

	this.sliders.playback.setPosition(percent, true);

	// don't animate if this is close to or at the end.
	if (percent > 0.99 || recordIndex == allRecords.length-1)
	    return;

	var nextRecord = allRecords[recordIndex+1];
	var curRecordTime = (recordIndex > 0) ? allRecords[recordIndex].mark.timestamp 
	                                      : this.calculator.minimumBoundary;

	var timeDelta = nextRecord.mark.timestamp - curRecordTime;
	if (timeDelta > WebInspector.TimelapseMiniview.MinAnimationDelta) {
	    var nextRecordPosition = this.calculator.computeMiniviewPercentage(nextRecord.mark.timestamp);
	    this.sliders.playback.animateTo(nextRecordPosition, timeDelta);
	}
    },

    _onBreakpointPaused: function(eventData)
        {
        this.sliders.playback.element.addStyleClass("breakpoint-slider");
        this.sliders.playback.element.removeStyleClass("playback-pulse");
        this.sliders.playback.enable();
    },

    _onBreakpointRecordsChanged: function(eventData)
    {
        this._scheduleRefresh();
    },

    _updateSavepointSliders: function()
    {
        var provider = this._recording.savepointProvider;
        var savepoints = provider.savepoints;
        for (var i = 0; i < savepoints.length; i++) {
            var savepoint = savepoints[i];
            var markIndex = savepoint.markIndex;
            var timestamp = this._model.timestampFromMarkIndex(markIndex);
            var percent = 0.0;
            if (markIndex > 0)
            percent = this.calculator.computeMiniviewPercentage(timestamp);

            this.sliders.savepoint[i].setPosition(percent, true);
        }
    },

    _onSavepointSet: function(event)
    {
        var savepointSlider = new WebInspector.TimelapseMiniviewSlider(this, "savepoint", false);
        this.element.appendChild(savepointSlider.element);
        this.sliders.savepoint.push(savepointSlider);

        this._updateSavepointSliders();
    },

    _onSavepointRemoved: function()
    {
        var savepointSlider = this.sliders.savepoint.pop();
        savepointSlider.dispose();

        this._updateSavepointSliders();
    },

    _onZoomChanged: function()
    {
	this._potentialMarkBounds = false;
	this._updateZoomLeft();
	this._updateZoomRight();
    },

    _onPreviewStarted: function()
    {
	this.sliders.previous.setPosition(this.sliders.playback.position);
	this.sliders.previous.show();
	this.sliders.tentative.setPosition(this.sliders.playback.position);
	this.sliders.tentative.show();
    },

    _onPreviewStopped: function()
    {
	this.sliders.previous.hide();
	this.sliders.tentative.hide();
    },

    _onPreviewChanged: function(event)
    {
	var record = event.data;
	var percent = this._recording.calculator.computeMiniviewPercentage(record.mark.timestamp);
	this.sliders.tentative.setPosition(percent, true);
    },

    _onPlaybackSliderDragStart: function(event)
    {
	this.sliders.playback.addEventListener(WebInspector.TimelapseMiniviewSlider.Events.Moved,
					      this._onPlaybackSliderDragged,
					      this);

	this._recording.startPreviewing();
    },

    _onPlaybackSliderDragged: function(event)
    {
	var calculator = this._recording.calculator;
	var position = this.sliders.playback.position;
    	var timestamp = calculator.computeMiniviewTimestamp(position);

	function timestampAndRecordComparator(ts, record) {
	    var record_ts = record.mark.timestamp;
	    if (record_ts > ts) return -1;
	    if (record_ts < ts) return 1;
	    return 0;
	}

	function timeDistanceFunction(ts, record) {
	    if (!record)
		return Number.POSITIVE_INFINITY;

	    return Math.abs(ts - record.mark.timestamp);
	}

	var records = this._recording.allRecords;
	var idx = records.nearestBinaryIndexOf(timestamp, timestampAndRecordComparator, timeDistanceFunction);
	var recordPosition = Math.floor(calculator.computeMiniviewPercentage(records[idx].mark.timestamp));
	var prevRecordPosition = (idx == 0) ? 0.0
                                            : calculator.computeMiniviewPercentage(records[idx-1].mark.timestamp);
	var nextRecordPosition = (idx == records.length-1) ? 1.0
                                                           : calculator.computeMiniviewPercentage(records[idx+1].mark.timestamp);
	var minBounds = recordPosition - (recordPosition - prevRecordPosition)/2.0;
	var maxBounds = recordPosition - (recordPosition - nextRecordPosition)/2.0;

	// this is used to short-circuit searching for the nearest record if it's
	// within the space "owned" by current nearest record. So, the nearest record
	// is only recomputed when moving more than halfway away from
	// this record to the next one
	this._potentialMarkBounds = {min: minBounds, max: maxBounds};

	this._recording.previewRecord(records[idx]);
    },

    _onPlaybackSliderDragEnd: function(event)
    {
	this.sliders.playback.removeEventListener(WebInspector.TimelapseMiniviewSlider.Events.Moved,
						 this._onPlaybackSliderDragged,
						 this);

	var targetRecord = this._recording.previewedRecord;
	this._recording.stopPreviewing();
	this._model.replayUpToMarkIndex(targetRecord.mark.index);
    },

    _onZoomSliderDragStart: function(zoomSide, event)
    {
	this.sliders[zoomSide].addEventListener(WebInspector.TimelapseMiniviewSlider.Events.Moved,
						this._onZoomSliderDragged.bind(this, zoomSide), this);
    },

    _onZoomSliderDragged: function(zoomSide, event)
    {
	var snapDistance = WebInspector.TimelapseMiniview.EdgeSnapDistance;
	var minSelectableSize = WebInspector.TimelapseMiniview.MinSelectableSize;
	if (zoomSide === "leftZoom") {
	    var start = this.sliders.leftZoom.position;
	    // Glue to edge
	    if (start < snapDistance)
		start = 0;
	    // don't cross over
	    else if (start >= this.sliders.rightZoom.position - minSelectableSize)
	        start = this.sliders.rightZoom.position - minSelectableSize;

	    this._recording.calculator.zoomLeft = start;	    
	} else {
	    var end = this.sliders.rightZoom.position;
	    // Glue to edge
	    if (end > 1.0 - snapDistance)
		end = 1.0;
	    // don't cross over
	    else if (end < this.sliders.leftZoom.position + minSelectableSize)
                end = this.sliders.leftZoom.position + minSelectableSize;

	    this._recording.calculator.zoomRight = end;
	}
    },

    _onZoomSliderDragEnd: function(zoomSide, event)
    {
	this.sliders[zoomSide].addEventListener(WebInspector.TimelapseMiniviewSlider.Events.Moved,
						  this._onZoomSliderDragged.bind(this, zoomSide), this);
    },

    rulerAdjustment: 4, /* pixels */

    _updateZoomLeft: function()
    {
	this.sliders.leftZoom.setPosition(this._recording.calculator.zoomLeft, true);
	this._leftZoomGlassPane.style.left = 0;
	var width = this.sliders.leftZoom.element.offsetLeft;
	if (width > 0)
	    width += this.rulerAdjustment;
	this._leftZoomGlassPane.style.width = Math.max(0, width) + "px";
    },

    _updateZoomRight: function()
    {
	this.sliders.rightZoom.setPosition(this._recording.calculator.zoomRight, true);
	this._rightZoomGlassPane.style.left = (this.sliders.rightZoom.element.offsetLeft + this.rulerAdjustment) + "px";
	this._rightZoomGlassPane.style.right = 0;
    },

    _startZoomSelectorDragging: function(event)
    {
        var position = (event.pageX - this.element.offsetLeft) / this.element.clientWidth;
        this._zoomSelector = new WebInspector.TimelapseMiniview.ZoomSelector(this.element, position, event);

	// The drag handle prevents the controller from being focused, so do it explicitly
	WebInspector.timelapseControllerView.focus();

	return true;
    },

    _zoomSelectorDragging: function(event)
    {
        this._zoomSelector._updatePosition((event.pageX - this.element.offsetLeft) / this.element.clientWidth);
    },

    _endZoomSelectorDragging: function(event)
    {
        var zoom = this._zoomSelector._close((event.pageX - this.element.offsetLeft) / this.element.clientWidth);
	var minSize = WebInspector.TimelapseMiniview.MinSelectableSize;
        delete this._zoomSelector;
        if (zoom.end - zoom.start < minSize)
            if (1.0 - zoom.end > minSize)
                zoom.end = zoom.start +  minSize;
            else
                zoom.start = zoom.end -  minSize;

	this._recording.calculator.setZoomInterval(zoom.start, zoom.end);
    },

    _onMiniviewDoubleClicked: function()
    {
	this._recording.calculator.setZoomInterval(0.0, 1.0);
    },

    _onMiniviewMousewheel: function(event)
    {
	var zoomLeft = this._recording.calculator.zoomLeft;
	var zoomRight = this._recording.calculator.zoomRight;
	var zoomInterval = this._recording.calculator.zoomInterval;

        if (typeof event.wheelDeltaX === "number" && 
	    event.wheelDeltaX && zoomInterval != 1.0) {
	    var delta = event.wheelDeltaX * WebInspector.TimelapseMiniview.WindowScrollSpeedFactor;
	    zoomLeft = Number.constrain(zoomLeft - delta, 0.0, 1.0 - zoomInterval);
	    zoomRight = Number.constrain(zoomRight - delta, zoomInterval, 1.0);
        }

        if (typeof event.wheelDeltaY === "number" && event.wheelDeltaY) {
	    var delta = event.wheelDeltaY * WebInspector.TimelapseMiniview.WindowZoomSpeedFactor;
	    /* calculate zoom adjustment from right side, and paste to left.
	     can't do naive scaling on LHS if it is near zero.  */
	    var zoomDelta = zoomRight - zoomRight * (1.0 + delta);
	    zoomLeft = Number.constrain(zoomLeft + zoomDelta, 0.0, zoomRight);
	    zoomRight = Number.constrain(zoomRight - zoomDelta, zoomLeft, 1.0);
        }

	this._recording.calculator.setZoomInterval(zoomLeft, zoomRight);
    }

};

WebInspector.TimelapseMiniview.prototype.__proto__ = WebInspector.View.prototype;

/**
 * @constructor
 * @extends {WebInspector.Object}
 */
WebInspector.TimelapseMiniviewSlider = function(miniview, name, adjustable, handlebars)
{
    WebInspector.Object.call(this);
    this._adjustable = adjustable;

    this.element = document.createElement("div");
    this.element.className = "timelapse-miniview-slider " + name + "-slider";

    this._verticalBarElement = document.createElement("div");
    this._verticalBarElement.className = "timelapse-slider-band";
    this.element.appendChild(this._verticalBarElement);

    if (!!handlebars) {
	var handlebarBottom = document.createElement("div");
	handlebarBottom.className = "timelapse-slider-handlebar-bottom";
	this.element.appendChild(handlebarBottom);
	var handlebarTop = document.createElement("div");
	handlebarTop.className = "timelapse-slider-handlebar-top";
	this.element.appendChild(handlebarTop);
    }

    if (this._adjustable) {
	this.element.classList.add("adjustable");
	WebInspector.installDragHandle(this.element, this._startSliderDragging.bind(this), this._sliderDragging.bind(this), this._endSliderDragging.bind(this), "col-resize");
    }

    this._miniview = miniview;
    this.clear();
    this.enable();
};

WebInspector.TimelapseMiniviewSlider.Events = {
    Moved: "TimelapseSliderMoved",
    DragStart: "TimelapseSliderDragStart",
    DragEnd: "TimelapseSliderDragEnd"
};

WebInspector.TimelapseMiniviewSlider.prototype = {
    clear: function()
    {
	this._lastRefreshedPosition = 0.0;
	this.element.classList.add("hidden");
	this.disable();
    },

    minimumResolution: 1.0, /* in pixels */
    defaultMinimumResolution: 1.0,

    /* percent is a value between 0 and 1. */
    setPosition: function(percent, suppressEvents)
    {
	this._position = Number.constrain(percent, 0.0, 1.0);
	this.element.classList.remove("hidden");

	this.cancelAnimation();
	this.refresh();
	
	if (!suppressEvents) {
	    this.dispatchEventToListeners(WebInspector.TimelapseMiniviewSlider.Events.Moved);
	}
    },

    resetResolution: function()
    {
	this.minimumResolution = this.defaultMinimumResolution;
    },

    animateTo: function(position, duration)
    {
	animations = [
	    {
		element: this.element, 
		start: {left: this.position * 100.0},
		end: {left: position * 100.0},
		timingFunction: WebInspector.TimingFunctions.Linear
	    }
	];

	this.cancelAnimation();
	this._currentAnimation = WebInspector.animateStyle(animations, duration * 1000.0,
							   this.cancelAnimation.bind(this));
    },

    cancelAnimation: function()
    {
	if (!this._currentAnimation)
	    return;

	this._currentAnimation.cancel();
	delete this._currentAnimation;
    },

    get position()
    {
	return this._position;
    },

    set position(pos)
    {
	this.setPosition(pos, false);
    },

    show: function()
    {
	this.element.classList.remove("hidden");
    },

    hide: function()
    {
	this.element.classList.add("hidden");
	if (this._currentAnimation)
	    this._currentAnimation.cancel();
    },

    disable: function()
    {
	this._enabled = false;
	this.element.classList.add("disabled");
    },

    enable: function()
    {
	this._enabled = true;
	this.element.classList.remove("disabled");
    },

    dispose: function()
    {
	this.element.parentElement.removeChild(this.element);
    },

    refresh: function()
    {
	var parentWidth = this.element.parentElement.clientWidth;
	var rightMaximum = (parentWidth - this._verticalBarElement.offsetWidth) / parentWidth;

	/* if the difference between last painted position and new
	 position is less than the minimum resolution (in pixels),
	 then don't force a refresh. */
	var delta = Math.abs(parentWidth * (this._position - this._lastRefreshedPosition));
	if (delta < this.minimumResolution)
	    return;

	this._lastRefreshedPosition = Number.constrain(this.position, 0.0, rightMaximum);
	this.element.style.left = this._lastRefreshedPosition * 100.0 + "%";
    },

    _startSliderDragging: function(event)
    {
	if (!this._enabled)
	    return false;

	if (this.element.hasStyleClass("breakpoint-slider"))
	    this.element.removeStyleClass("breakpoint-slider");

	this.element.classList.add("slider-dragging");

	this.dispatchEventToListeners(WebInspector.TimelapseMiniviewSlider.Events.DragStart);
	return true;
    },

    _sliderDragging: function(event)
    {
	if (!this._enabled)
	    return;

	var parent = this.element.parentElement; // should be heatmap container
	var dragPoint = event.clientX - parent.totalOffsetLeft() - (this.element.offsetWidth/2);
	var leftMinimum = parent.clientLeft;
	var rightMaximum = leftMinimum + parent.clientWidth - this.element.offsetWidth;
	dragPoint = Number.constrain(dragPoint, leftMinimum, rightMaximum - this._verticalBarElement.offsetWidth);
	this.setPosition(dragPoint / (rightMaximum - leftMinimum));
	event.preventDefault();
    },

    _endSliderDragging: function(event)
    {	
	if (!this._enabled)
	    return;

	this.element.classList.remove("slider-dragging");
	this.dispatchEventToListeners(WebInspector.TimelapseMiniviewSlider.Events.DragEnd);
    }
};

WebInspector.TimelapseMiniviewSlider.prototype.__proto__ = WebInspector.Object.prototype;


/**
 * @constructor
 */
WebInspector.TimelapseMiniview.ZoomSelector = function(parent, position, event)
{
    this._startPosition = position;
    this._width = parent.offsetWidth;
    this.element = document.createElement("div");
    this.element.className = "timelapse-zoom-selector";
    this.element.style.left = this._startPosition * 100.0 + "%";
    this.element.style.right = (1.0 - this._startPosition) * 100.0 + "%";
    parent.appendChild(this.element);
};

WebInspector.TimelapseMiniview.ZoomSelector.prototype = {
    _close: function(position)
    {
        this.element.parentNode.removeChild(this.element);
        return this._startPosition < position
	? {start: this._startPosition, end: position}
	: {start: position, end: this._startPosition};
    },

    _updatePosition: function(position)
    {
        position = Math.max(0, Math.min(position, this._width));
        if (position < this._startPosition) {
            this.element.style.left = position * 100.0 + "%";
            this.element.style.right = (1.0 - this._startPosition) * 100.0 + "%";
        } else {
            this.element.style.left = this._startPosition * 100.0 + "%";
            this.element.style.right = (1.0 - position) * 100.0 + "%";
        }
    }
};


