/*
 *  Copyright (C) 2011, Brian Burg.
 *  Copyright (C) 2011, University of Washington. All rights reserved.
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
 * @extends {WebInspector.Object}
 */
WebInspector.ReplayRecording = function(model)
{
    WebInspector.Object.call(this);
    this._model = model;
    this.calculator = new WebInspector.RecordingCalculator(this);
    this._providers = [];
    this._actions = [];

    this._callbacks = new WebInspector.EventListenerGroup(this, "ReplayRecording listeners");
    this.registerListeners(this._callbacks);
    this._callbacks.install();
};

WebInspector.ReplayRecording.Events = {
    ProviderAdded:  "ProviderAdded",
    // fired when an action is added to the recording, either from capture or disk.
    ActionAdded:    "ActionAdded",
    // TODO: the following events are details of specific data providers.
    InputSelected:  "InputSelected",
    PreviewStarted: "PreviewStarted",
    PreviewStopped: "PreviewStopped",
    PreviewChanged: "PreviewChanged",
};

WebInspector.ReplayRecording.prototype = {
    // Private API (helpers)
    
    // NB. this is extended by subclasses, so don't inline it into a constructor.
    registerListeners: function(group) {
        // FIXME: (Issue #201): The BreakpointScanner should add the breakpoint provider, not the recording itself.
        var scannerEvents = WebInspector.ReplayScanner.Events;
        group.register(this._model.scanners.breakpoint, scannerEvents.ScanStarted, this._breakpointScanStarted);
        var replayEvents = WebInspector.ReplayModel.Events;
        // TODO: support re-loading the same recording instance. Need to set back up in RecordingLoaded callback.
        group.register(this._model, replayEvents.RecordingUnloaded, this._recordingUnloaded);
        var profileEvents = WebInspector.ProfilesModel.Events;
        group.register(WebInspector.profilesModel, profileEvents.ProfileAdded,   this._profileAdded);
        group.register(WebInspector.profilesModel, profileEvents.ProfileRemoved, this._profileRemoved);
    },

    // Private API (callbacks)
    _recordingUnloaded: function(event)
    {
        var recording = event.data;
        if (recording !== this)
            return;
        
        this._callbacks.uninstall();
        this._model.onceEventListener(WebInspector.ReplayModel.Events.RecordingLoaded, this._recordingLoaded, this);
    },

    _recordingLoaded: function()
    {
        if (this._model.loadedRecording !== this)
            return;
        
        this._callbacks.install();
    },

    _breakpointScanStarted: function()
    {
	// TODO: (Issue #154): don't create new breakpoint providers, just add new data to one.
	var breakpointProviders = this.providersWithType(WebInspector.DataProvider.Types.BreakpointHits);
	if (breakpointProviders.length > 0)
	    return;

	var breakpointProvider = new WebInspector.ReplayBreakpointDataProvider(
        this,
	    WebInspector.UIString("Breakpoint"),
	    WebInspector.Color.fromRGB(10,55,230)
	);

	breakpointProvider.addEventListener(WebInspector.DataProvider.Events.Invalidated,
					    this.removeProvider.bind(this, breakpointProvider));

	this.addProvider(breakpointProvider);
    },
    
    _profileAdded: function(event)
    {
        if (event.defaultPrevented)
            return;
        
        var profile = event.data;
        if (profile.isTemporary)
            return;
        
        if (profile.profileType.id !== WebInspector.CPUProfileType.TypeId)
            return;
        
        event.preventDefault();
        this.addProvider(new WebInspector.ProfileHeatmapProvider(profile));
    },

    _profileRemoved: function(event)
    {
        var profile = event.data;
        var heatmapProviders = this.providersWithType(WebInspector.DataProvider.Types.ProfileHeatmap);
        for (var i = 0; i < heatmapProviders.length; ++i) {
            var provider = heatmapProviders[i];
            if (provider.profile === profile) {
                this.removeProvider(provider);
                return;
            }
        }
    },
    
    // Public API
    displayName: function() {},
    filename: function() {},
    dataLoaded: function() {},
    
    get savepointList() {
	var providers = this.providersWithType(WebInspector.DataProvider.Types.SavepointList);
	console.assert(providers.length == 1, "Expected one savepoint list provider, but found "+providers.length);
	return (providers.length) ? providers.pop() : false;
    },
    
    addProvider: function(provider) {
	if (this._providers.indexOf(provider) != -1)
	    return;

	this._providers.push(provider);
    	this.dispatchEventToListeners(WebInspector.ReplayRecording.Events.ProviderAdded, provider);
    },

    removeProvider: function(provider) {
	var idx = this._providers.indexOf(provider);
	if (idx == -1)
	    return;

	this._removeProviderAtIndex(idx);
    },

    _providersWithName: function(name)
    {
	var found = [];
	for (var i = 0; i < this._providers.length; i++) {
	    var provider = this._providers[i];
	    if (provider.name === name) {
		found.push(provider);
	    }
	}
	
	return found;
    },

    providersWithType: function(ty)
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

    _removeProviderAtIndex: function(idx) {
	console.assert(idx >= 0 && idx < this._providers.length, "Tried to remove provider at invalid index.");
	this._providers[idx].willRemove();
	this._providers.splice(idx, 1);
    },

    _clearProviders: function() {
	while (this._providers.length > 0) {
	    this._removeProviderAtIndex(0);
	}
    },

    _initializeSavepointList: function()
    {
        this.addProvider(new WebInspector.SavepointListProvider(this));
    },
    
    _initializeInputs: function()
    {
        var providerTypes = WebInspector.DataProvider.Types;
        this.addProvider(new WebInspector.ReplayInputDataProvider(
             this,
		     "userinput",
		     WebInspector.UIString("User"),
		     WebInspector.Color.fromRGB(20,170,70)
		));
        this.addProvider(new WebInspector.ReplayInputDataProvider(
             this,
             "network",
			 WebInspector.UIString("Network"),
			 WebInspector.Color.fromRGB(200,150,0)
        ));
        this.addProvider(new WebInspector.ReplayInputDataProvider(
             this,
		     "timer",
		     WebInspector.UIString("Timer"),
		     WebInspector.Color.fromRGB(200,30,30)
		));
    },

    get isCapturing() { return false; },

    get actions()
    {
    return this._actions;
    },

    actionIndexFromMarkIndex: function(markIndex)
    {
        function markIndexAndActionComparator(idx, action) {
            var action_idx = action.mark.index;
            if (action_idx > idx) return -1;
            if (action_idx < idx) return 1;
            return 0;
        }

        return this.actions.binaryIndexOf(markIndex, markIndexAndActionComparator);
    },

    timestampFromMarkIndex: function(markIndex)
    {
        var actionIndex = this.actionIndexFromMarkIndex(markIndex);
        var action = this.actions[actionIndex];
        return action.mark.timestamp;
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    get previewModeActive()
    {
	return !!this._previewModeActive;
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    get previewedAction()
    {
	return this._previewedAction;
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    startPreviewing: function()
    {
	this._previewModeActive = true;
    	this.dispatchEventToListeners(WebInspector.ReplayRecording.Events.PreviewStarted);
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    stopPreviewing: function()
    {
	delete this._previewModeActive;
	delete this._previewedAction;
    	this.dispatchEventToListeners(WebInspector.ReplayRecording.Events.PreviewStopped);
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    previewAction: function(action)
    {
	console.assert(!!action, "Cannot preview undefined action");

	this._previewedAction = action;
	this.dispatchEventToListeners(WebInspector.ReplayRecording.Events.PreviewChanged, action);
    },

    // TODO: Selection state should live on the specific DataProvider which is being selected.
    selectAction: function(markIndex)
    {
	this._selectedInputIndex = markIndex;
	this.dispatchEventToListeners(WebInspector.ReplayRecording.Events.InputSelected, markIndex);
    },

    scanInZoomRegion: function(scanner)
    {
        console.assert(scanner instanceof WebInspector.ReplayScanner,
                       "Tried to scan zoom region with object that wasn't a ReplayScanner.");
        
        var startIndex = this.calculator.computeMarkIndexFromPercentage(this.calculator.zoomLeft);
        var endIndex = this.calculator.computeMarkIndexFromPercentage(this.calculator.zoomRight);

        scanner.scanRegion(startIndex, endIndex);
    },
    
    // Called by WebInspector.ReplayDispatcher and when bulk-loading a recording
    addAction: function(action)
    {
        this.calculator.updateBoundaries(action);
        this.dispatchEventToListeners(WebInspector.ReplayRecording.Events.ActionAdded, action);
    },
    
    __proto__: WebInspector.Object.prototype
};

WebInspector.SerializedRecording = function(model, uid)
{
    WebInspector.ReplayRecording.call(this, model);
    this.uid = uid;
    this._dataLoaded = false;
    this.addProvider(new WebInspector.ReplayScreenshotDataProvider(this, "screenshots"));
}

WebInspector.SerializedRecording.prototype = {
    loadData: function(data)
    {
        this._dateCreated = new Date(data.dateCreated);
        // TODO: (Issue #246): this isn't actually used. Remove from protocol?
        this._displayName = data.name;

        this._initializeInputs();
        this._initializeSavepointList();

        this._actions = data.actions;
        this._dataLoaded = true;
        
        for (var i = 0; i < data.actions.length; ++i)
            this.addAction(data.actions[i]);
    },

    dataLoaded: function()
    {
        return this._dataLoaded;
    },

    get dateCreated()
    {
        return this._dateCreated;
    },

    filename: function()
    {
        return "CapturedRecording-" + this.dateCreated.toISO8601Compact() + ".webreplay";
    },

    displayName: function()
    {
        return WebInspector.UIString("Captured Recording %d", this.uid) || WebInspector.UIString("(uninitialized)");
    },

    _recordingUnloaded: function()
    {
        WebInspector.ReplayRecording.prototype._recordingUnloaded.call(this);
        var screenshotProviders = this.providersWithType(WebInspector.DataProvider.Types.Screenshots);
        for (var i = 0; i < screenshotProviders.length; i++) {
            this.removeProvider(screenshotProviders[i]);
        };
    },

    __proto__: WebInspector.ReplayRecording.prototype
};

WebInspector.ReplayLiveRecording = function(model)
{
    WebInspector.ReplayRecording.call(this, model);
    this.uid = -1;
    this._isCapturing = false;
};

WebInspector.ReplayLiveRecording.prototype = {
    displayName: function()
    {
        return WebInspector.UIString("(Live Recording)");
    },

    dataLoaded: function()
    {
        return true;
    },
    
    get isCapturing()
    {
        return this._isCapturing;
    },
    
    addAction: function(action)
    {
        this._actions.push(action);
        WebInspector.ReplayRecording.prototype.addAction.call(this, action);
    },
    
    registerListeners: function(group) {
        var replayEvents = WebInspector.ReplayModel.Events;
        group.register(this._model, replayEvents.CaptureDidStart, this._captureDidStart);
        group.register(this._model, replayEvents.CaptureDidStop,  this._captureDidStop);

        WebInspector.ReplayRecording.prototype.registerListeners.call(this, group);
    },
    
    _captureDidStart: function()
    {
        this._isCapturing = true;
        this._initializeInputs();
    },

    _captureDidStop: function()
    {
        this._isCapturing = false;
        this._initializeSavepointList();

        this.calculator.setZoomInterval(0.0, 1.0);
    },
    
    __proto__: WebInspector.ReplayRecording.prototype
};

/**
 * @constructor
 */
WebInspector.ReplayScreenshotDataProvider = function(recording, name)
{
    WebInspector.DataProvider.call(this, recording, name,
                   WebInspector.DataProvider.Types.Screenshots);

    this._screenshots = [];

    var eventNames = WebInspector.ReplayModel.Events;
    WebInspector.replayModel.addEventListener(eventNames.ImageCaptured, this._imageCaptured, this);
};

WebInspector.ReplayScreenshotDataProvider.prototype = {

    get screenshots()
    {
        return this._screenshots;
    },

    willRemove: function() {
        var eventNames = WebInspector.ReplayModel.Events;
        recording.removeEventListener(eventNames.ImageCaptured, this._imageCaptured, this);
    },

    _imageCaptured: function(event) {
        var imageDataUri = event.data.imageDataUri;
        var markIndex = event.data.markIndex;
        this._screenshots[markIndex] = imageDataUri;
        this.dispatchEventToListeners(WebInspector.DataProvider.Events.DataChanged);
    },

    __proto__: WebInspector.DataProvider.prototype
};


/**
 * @constructor
 */
WebInspector.RecordingCalculator = function(recording)
{
    this._recording = recording;
    WebInspector.Object.call(this);
};

WebInspector.RecordingCalculator.Events = {
  ZoomChanged: "ZoomChanged"
};

WebInspector.RecordingCalculator.prototype = {
    _minimumBoundarySpan: 0.0,

    reset: function()
    {
        this._zoomLeft = 0.0;
        this._zoomRight = 0.0;
        delete this.minimumBoundary;
        delete this.maximumBoundary;
    },


    setZoomInterval: function(left, right)
    {
	this._zoomLeft = Number.constrain(left || 0, 0.0, 1.0);
	this._zoomRight = Number.constrain(right || 1, 0.0, 1.0);
	this.dispatchEventToListeners(WebInspector.RecordingCalculator.Events.ZoomChanged);
    },

    get zoomLeft()
    {
	return this._zoomLeft;
    },

    get zoomRight()
    {
	return this._zoomRight;
    },

    get zoomInterval()
    {
	return this._zoomRight - this._zoomLeft;
    },

    set zoomLeft(zoom)
    {
	this.setZoomInterval(zoom, this.zoomRight);
    },

    set zoomRight(zoom)
    {
	this.setZoomInterval(this.zoomLeft, zoom);
    },

    get boundarySpan()
    {
	if (typeof this.minimumBoundary === "undefined" || typeof this.maximumBoundary === "undefined")
	    return this._minimumBoundarySpan;

        return (this.maximumBoundary - this.minimumBoundary);
    },

    updateBoundaries: function(action, suppressAdjustZoom)
    {
        var ts = action.mark.timestamp;
        if (typeof this.minimumBoundary === "undefined" || ts < this.minimumBoundary) {
            this.minimumBoundary = ts;
            if (!suppressAdjustZoom)
                this.zoomLeft = 0.0;
            return true;
        }
        if (typeof this.maximumBoundary === "undefined" || ts > this.maximumBoundary) {
            this.maximumBoundary = ts;
            this.dispatchEventToListeners(WebInspector.RecordingCalculator.Events.ZoomChanged);
            if (!suppressAdjustZoom)
                this.zoomRight = 0.0;
            return true;
        }
        return false;
    },

    /* computes a timestamp corresponding to a percent position on the overview. */
    computeOverviewTimestamp: function(percent)
    {
	var overallPercent = this.zoomLeft + this.zoomInterval * percent;
	return this.minimumBoundary + this.boundarySpan * overallPercent;
    },

    /* computes a timestamp corresponding to a percent position on the miniview. */
    computeMiniviewTimestamp: function(percent)
    {
	return this.minimumBoundary + this.boundarySpan * percent;
    },

    computeOverviewPercentage: function(ts)
    {
	/* this takes into account the viewable interval, returning the percentage within that region. */
	var overallPercent = (ts - this.minimumBoundary) / this.boundarySpan;
	return (overallPercent - this.zoomLeft) / this.zoomInterval;
    },

    computeMiniviewPercentage: function(ts)
    {
	return (ts - this.minimumBoundary) / this.boundarySpan;
    },

    computeMarkIndexFromPercentage: function(percent)
    {
    	var timestamp = this.minimumBoundary + this.boundarySpan * percent;

	function timestampAndActionComparator(ts, action) {
	    var action_ts = action.mark.timestamp;
	    if (action_ts > ts) return -1;
	    if (action_ts < ts) return 1;
	    return 0;
	}

	function timeDistanceFunction(ts, action) {
	    if (!action)
		return Number.POSITIVE_INFINITY;

	    return Math.abs(ts - action.mark.timestamp);
	}

	var actions = this._recording.actions;
	var idx = actions.nearestBinaryIndexOf(timestamp, timestampAndActionComparator, timeDistanceFunction);
	return actions[idx].mark.index;
    },

    formatValue: function(value)
    {
        return Number.secondsToString(value || 0);
    },

    // format this as time since the minimum boundary.
    formatElapsedValue: function(value)
    {
	value = value || 0;
	return this.formatValue(value - this.minimumBoundary);
    },
    
    __proto__: WebInspector.Object.prototype
};

WebInspector.ReplayRecording;
