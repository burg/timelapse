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
WebInspector.TimelapseRecording = function(model)
{
    WebInspector.Object.call(this);
    this._model = model;
    this.calculator = new WebInspector.TimelapseCalculator(this);
    this._providers = [];
    this._records = [];

    this._modifyListeners("addEventListener");
};

WebInspector.TimelapseRecording.Events = {
    ProviderAdded:  "TimelapseProviderAdded",
    // fired when a record is added to the recording, either from capture or disk.
    RecordAdded:    "TimelapseRecordAdded",
    // TODO: the following events are details of specific data providers.
    InputSelected:  "TimelapseInputSelected",
    PreviewStarted: "TimelapsePreviewStarted",
    PreviewStopped: "TimelapsePreviewStopped",
    PreviewChanged: "TimelapsePreviewChanged",
};

WebInspector.TimelapseRecording.prototype = {
    // Private API (helpers)
    _modifyListeners: function(op) {
    console.assert(op === "addEventListener" || op === "removeEventListener",
                   "Tried to do something unsupported to listeners: " + op);
    
    var scannerEvents = WebInspector.TimelapseScanner.Events;
    // FIXME: (Issue #201): The BreakpointScanner should add the breakpoint provider, not the recording itself.
    this._model.scanners.breakpoint[op](scannerEvents.ScanStarted, this._breakpointScanStarted, this);

    var eventNames = WebInspector.TimelapseModel.Events;
    this._model[op](eventNames.RecordingUnloaded, this._recordingUnloaded, this);
    
    WebInspector.profilesModel[op](WebInspector.ProfilesModel.Events.ProfileAdded, this._profileAdded, this);
    WebInspector.profilesModel[op](WebInspector.ProfilesModel.Events.ProfileRemoved, this._profileRemoved, this);
    },

    // Private API (callbacks)
    _recordingUnloaded: function(event)
    {
    var recording = event.data;
    if (recording !== this)
        return;
        
    this._modifyListeners("removeEventListener");

    var providerTypes = WebInspector.DataProvider.Types;
    for (var key in providerTypes) {
        var providers = this.providersWithType(providerTypes[key]);
        for (var i = 0; i < providers.length; i++)
            this.removeProvider(providers[i]);
    }
    },

    _breakpointScanStarted: function()
    {
	// TODO: manage multiple breakpoint providers
	var breakpointProviders = this.providersWithType(WebInspector.DataProvider.Types.BreakpointHits);
	if (breakpointProviders.length > 0)
	    return;

	var breakpointProvider = new WebInspector.TimelapseBreakpointDataProvider(
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
    get savepointList() {
	var providers = this.providersWithType(WebInspector.DataProvider.Types.SavepointList);
	console.assert(providers.length == 1, "Expected one savepoint list provider, but found "+providers.length);
	return (providers.length) ? providers.pop() : false;
    },
    
    addProvider: function(provider) {
	if (this._providers.indexOf(provider) != -1)
	    return;

	this._providers.push(provider);
    	this.dispatchEventToListeners(WebInspector.TimelapseRecording.Events.ProviderAdded, provider);
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
        this.addProvider(new WebInspector.TimelapseInputDataProvider(
             this,
		     "userinput",
		     WebInspector.UIString("User"),
		     WebInspector.Color.fromRGB(20,170,70)
		));
        this.addProvider(new WebInspector.TimelapseInputDataProvider(
             this,
             "network",
			 WebInspector.UIString("Network"),
			 WebInspector.Color.fromRGB(200,150,0)
        ));
        this.addProvider(new WebInspector.TimelapseInputDataProvider(
             this,
		     "timer",
		     WebInspector.UIString("Timer"),
		     WebInspector.Color.fromRGB(200,30,30)
		));
    },

    get isCapturing() { return false; },

    get allRecords()
    {
    return this._records;
    },

    recordIndexFromMarkIndex: function(markIndex)
    {
        function markIndexAndRecordComparator(idx, record) {
            var record_idx = record.mark.index;
            if (record_idx > idx) return -1;
            if (record_idx < idx) return 1;
            return 0;
        }

        return this.allRecords.binaryIndexOf(markIndex, markIndexAndRecordComparator);
    },

    timestampFromMarkIndex: function(markIndex)
    {
        var recordIndex = this.recordIndexFromMarkIndex(markIndex);
        var record = this.allRecords[recordIndex];
        return record.mark.timestamp;
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    get previewModeActive()
    {
	return !!this._previewModeActive;
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    get previewedRecord()
    {
	return this._previewedRecord;
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    startPreviewing: function()
    {
	this._previewModeActive = true;
    	this.dispatchEventToListeners(WebInspector.TimelapseRecording.Events.PreviewStarted);
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    stopPreviewing: function()
    {
	delete this._previewModeActive;
	delete this._previewedRecord;
    	this.dispatchEventToListeners(WebInspector.TimelapseRecording.Events.PreviewStopped);
    },

    // TODO: Preview state should live on the specific DataProvider which is being previewed.
    previewRecord: function(record)
    {
	console.assert(!!record, "Cannot preview undefined record");

	this._previewedRecord = record;
	this.dispatchEventToListeners(WebInspector.TimelapseRecording.Events.PreviewChanged, record);
    },

    // TODO: Selection state should live on the specific DataProvider which is being selected.
    selectInput: function(markIndex)
    {
	this._selectedInputIndex = markIndex;
	this.dispatchEventToListeners(WebInspector.TimelapseRecording.Events.InputSelected, markIndex);
    },

    scanInZoomRegion: function(scanner)
    {
        console.assert(scanner instanceof WebInspector.TimelapseScanner,
                       "Tried to scan zoom region with object that wasn't a TimelapseScanner.");
        
        var startIndex = this.calculator.computeMarkIndexFromPercentage(this.calculator.zoomLeft);
        var endIndex = this.calculator.computeMarkIndexFromPercentage(this.calculator.zoomRight);

        scanner.scanRegion(startIndex, endIndex);
    },
    
    // Called by WebInspector.TimelapseDispatcher
    _capturedAction: function(record)
    {
	this._records.push(record);
  	this.calculator.updateBoundaries(record);
	this.dispatchEventToListeners(WebInspector.TimelapseRecording.Events.RecordAdded, record);
    },
    
    __proto__: WebInspector.Object.prototype
};

WebInspector.TimelapseSerializedRecording = function(model)
{
    WebInspector.TimelapseRecording.call(this, model);
    
    this._initializeInputs();
    this._initializeSavepointList();
}

WebInspector.TimelapseSerializedRecording.prototype = {
    __proto__: WebInspector.TimelapseRecording.prototype
};

WebInspector.TimelapseLiveRecording = function(model)
{
    WebInspector.TimelapseRecording.call(this, model);
    this._isCapturing = false;
};

WebInspector.TimelapseLiveRecording.prototype = {
    
    get isCapturing()
    {
        return this._isCapturing;
    },
    
    _modifyListeners: function(op) {
    console.assert(op === "addEventListener" || op === "removeEventListener",
                   "Tried to do something unsupported to listeners: " + op);
       
    var eventNames = WebInspector.TimelapseModel.Events;
    this._model[op](eventNames.CaptureDidStart, this._captureDidStart, this);
    this._model[op](eventNames.CaptureDidStop,  this._captureDidStop,  this);

    WebInspector.TimelapseRecording.prototype._modifyListeners.call(this, op);
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
    
    __proto__: WebInspector.TimelapseRecording.prototype
};

/**
 * @constructor
 */
WebInspector.TimelapseCalculator = function(recording)
{
    this._recording = recording;
    WebInspector.Object.call(this);
};

WebInspector.TimelapseCalculator.Events = {
  ZoomChanged: "TimelapseZoomChanged"  
};

WebInspector.TimelapseCalculator.prototype = {
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
	this.dispatchEventToListeners(WebInspector.TimelapseCalculator.Events.ZoomChanged);
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

    updateBoundaries: function(record)
    {
	var ts = record.mark.timestamp;
        if (typeof this.minimumBoundary === "undefined" || ts < this.minimumBoundary) {
            this.minimumBoundary = ts;
            return true;
        }
        if (typeof this.maximumBoundary === "undefined" || ts > this.maximumBoundary) {
            this.maximumBoundary = ts;
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
	return records[idx].mark.index;
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

WebInspector.TimelapseRecording;