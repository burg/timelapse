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
WebInspector.TimelapseOverview = function(model, recording)
{
    WebInspector.View.call(this);

    this._model = model;
    this._recording = recording;

    this._previewProvider = new WebInspector.OverviewPreviewProvider(this._recording);
    this._recording.addProvider(this._previewProvider);

    this.element.className = "timelapse-overview";
    this.element.tabIndex = 0;

    this._messagePanel = new WebInspector.TimelapseOverviewMessagePanel(this);

    this._labelContainer = document.createElement("div");
    this._labelContainer.classList.add("timelapse-timeline-labels");
    this._labelContainer.classList.add("timelapse-overview-column-label");
    this._labelContainer.classList.add("timelapse-overview-row-main");
    this.element.appendChild(this._labelContainer);

    this._timelineContainer = document.createElement("div");
    this._timelineContainer.classList.add("timelapse-overview-timelines");
    this._timelineContainer.classList.add("timelapse-overview-column-main");
    this._timelineContainer.classList.add("timelapse-overview-row-main");

    var playbackSlider = new WebInspector.TimelapseOverviewSlider(this, "playback", true);
    this._timelineContainer.appendChild(playbackSlider.element);
    var previousSlider = new WebInspector.TimelapseOverviewSlider(this, "previous", false);
    this._timelineContainer.appendChild(previousSlider.element);
    var tentativeSlider = new WebInspector.TimelapseOverviewSlider(this, "tentative", false);
    this._timelineContainer.appendChild(tentativeSlider.element);

    this.sliders = {
        playback: playbackSlider,
        previous: previousSlider,
        tentative: tentativeSlider,
        savepoint: []
    };

    this._timelines = [];
    this._labels = [];
    this._circleContexts = [];
    this._providerListeners = {};

    this.element.appendChild(this._timelineContainer);

    this._dividersElement = document.createElement("div");
    this._dividersElement.className = "resources-dividers";
    this._timelineContainer.appendChild(this._dividersElement);

    this._dividersLabelBarElement = document.createElement("div");
    this._dividersLabelBarElement.className = "resources-dividers-label-bar";
    this._timelineContainer.appendChild(this._dividersLabelBarElement);

    this._refreshDelay = WebInspector.TimelapseOverview.DefaultRefreshDelay;

    this._callbacks = new WebInspector.EventListenerGroup(this, "TimelapseOverview static callbacks");
    this._registerListeners();
    this._callbacks.install();

    /* update dividers */
    this.updateDividers(true);

    if (this._hoveredCircleIndex)
        delete this._hoveredCircleIndex;
    if (this._selectedCircleIndex)
        delete this._selectedCircleIndex;

    // initialize slider position
    this.sliders.playback.setPosition(1.0, true);
    this.sliders.playback.enable();
    this.sliders.playback.show();

    this._updateSliderPositions();

    // add input providers that have already been created
    var inputProviders = this._recording.providersWithType(WebInspector.DataProvider.Types.TimelapseInput);
    for (var i = 0; i < inputProviders.length; i++)
        this._addProvider(inputProviders[i]);
    
    // add savepoint list if already created
    var providers = this._recording.providersWithType(WebInspector.DataProvider.Types.SavepointList);
    for (var i = 0; i < providers.length; i++)
        this._addProvider(providers[i]);
};

WebInspector.TimelapseOverview.ResizerOffset = 3.5;
WebInspector.TimelapseOverview.MinAnimationDelta = 0.5;
WebInspector.TimelapseOverview.WindowScrollSpeedFactor = 0.001;
WebInspector.TimelapseOverview.WindowZoomSpeedFactor = 0.001;
WebInspector.TimelapseOverview.DefaultRefreshDelay = 30;
WebInspector.TimelapseOverview.TimelineHeight = 30;

WebInspector.TimelapseOverview.prototype = {
    _registerListeners: function()
    {
        var sliderEvents = WebInspector.TimelapseOverviewSlider.Events;
        this._callbacks.register(this.sliders.playback, sliderEvents.DragStart, this._onPlaybackSliderDragStart);
        this._callbacks.register(this.sliders.playback, sliderEvents.DragEnd,   this._onPlaybackSliderDragEnd);
        this._callbacks.register(this.sliders.playback.element, "contextmenu", this._onPlaybackSliderContextMenu);

        this._callbacks.register(this._timelineContainer, "mousedown",  this._onOverviewMousedown);
        this._callbacks.register(this._timelineContainer, "click",      this._onOverviewClick);
        this._callbacks.register(this._timelineContainer, "mousewheel", this._onOverviewMousewheel);

        var scanner = this._model.scanners.breakpoint;
        var scannerEvents = WebInspector.TimelapseScanner.Events;
        this._callbacks.register(scanner, scannerEvents.ScanStarted, this._showMessagePanel.bind(this, "Scanning breakpoints..."));
        this._callbacks.register(scanner, scannerEvents.ScanStopped, this._hideMessagePanel);

        var replayEvents = WebInspector.TimelapseModel.Events;
        this._callbacks.register(this._model, replayEvents.PlaybackWillStart,  this._showMessagePanel);
        this._callbacks.register(this._model, replayEvents.PlaybackDidStart,   this._onPlaybackDidStart);
        this._callbacks.register(this._model, replayEvents.PlaybackStopped,    this._onPlaybackStopped);
        this._callbacks.register(this._model, replayEvents.PlaybackError,      this._onPlaybackError);
        this._callbacks.register(this._model, replayEvents.InputPaused,        this._onInputPaused);
        this._callbacks.register(this._model, replayEvents.InputHit,           this._onInputHit);
        this._callbacks.register(this._model, replayEvents.DebuggerPaused,     this._onDebuggerPaused);

        // TODO: these should instead listen to specific data provider events.
        var recordingEvents = WebInspector.TimelapseRecording.Events;
        this._callbacks.register(this._recording, recordingEvents.ProviderAdded,  this._onProviderAdded);
        this._callbacks.register(this._recording, recordingEvents.PreviewStarted, this._onPreviewStarted);
        this._callbacks.register(this._recording, recordingEvents.PreviewStopped, this._onPreviewStopped);
        this._callbacks.register(this._recording, recordingEvents.PreviewChanged, this._onPreviewChanged);

        this._callbacks.register(this._recording.calculator, WebInspector.TimelapseCalculator.Events.ZoomChanged, this._onZoomChanged);

        var manager = WebInspector.breakpointManager;
        var managerEvents = WebInspector.BreakpointManager.Events;
        this._callbacks.register(manager, managerEvents.BreakpointAdded,              this._onBreakpointRecordsChanged);
        this._callbacks.register(manager, managerEvents.BreakpointRemoved,            this._onBreakpointRecordsChanged);
        this._callbacks.register(manager, managerEvents.BreakpointRemovedFromStorage, this._onBreakpointRecordsChanged);
    },

    _timelineForProvider: function(provider)
    {
        for (var i = 0; i < this._timelines.length; i++) {
            if (this._timelines[i].provider === provider)
                return this._timelines[i];
        }

        return false;
    },

    _timelineForProviderType: function(ty)
    {
        for (var i = 0; i < this._timelines.length; i++) {
            if (this._timelines[i].provider.type === ty)
                return this._timelines[i];
        }

        return false;
    },

    willDispose: function()
    {
        this._callbacks.uninstall(true);
    },

    /* mostly copied from TimelineGrid.js */
    updateDividers: function(force)
    {
        // each label is at least 64 px wide
        var dividerCount = Math.round(this._dividersElement.offsetWidth / 64);
        var calculator = this.calculator;

        // if the there is the same unit time per divider, then don't need to update anything.
        var activeDuration = (calculator.zoomRight - calculator.zoomLeft) * calculator.boundarySpan;
        var timeOffset = calculator.boundarySpan * calculator.zoomLeft;

        var timePerDivider = activeDuration / dividerCount;
        if (!force && this._currentTimePerDivider === timePerDivider && this._currentTimeOffset === timeOffset)
            return false;
        this._currentTimePerDivider = timePerDivider;
        this._currentTimeOffset = timeOffset;

        var divider = this._dividersElement.firstChild;
        var dividerLabelBar = this._dividersLabelBarElement.firstChild;
        var availWidth = this._dividersLabelBarElement.clientWidth;
        // this may grow as more dividers are added.
        var currentLabelBarWidth = availWidth;

        for (var i = 1; i < dividerCount; i++) {
            if (!divider) {
                divider = document.createElement("div");
                divider.className = "resources-divider";
                this._dividersElement.appendChild(divider);

                dividerLabelBar = document.createElement("div");
                dividerLabelBar.className = "resources-divider";

                var label = document.createElement("div");
                label.className = "resources-divider-label";
                dividerLabelBar._labelElement = label;
                dividerLabelBar.appendChild(label);
                this._dividersLabelBarElement.appendChild(dividerLabelBar);
                /* update current width */
                currentLabelBarWidth = this._dividersLabelBarElement.clientWidth;
            }

            var left = availWidth * (i / dividerCount);
            var percentLeft = 100 * left / currentLabelBarWidth;
            this._setDividerAndBarLeft(divider, dividerLabelBar, percentLeft);

            if (!isNaN(timePerDivider))
                dividerLabelBar._labelElement.textContent = Number.secondsToString(timeOffset + timePerDivider * i);
            else
                dividerLabelBar._labelElement.textContent = "";
            divider = divider.nextSibling;
            dividerLabelBar = dividerLabelBar.nextSibling;
        }

        // Remove extras.
        while (divider) {
            var nextDivider = divider.nextSibling;
            this._dividersElement.removeChild(divider);
            divider = nextDivider;
        }
        while (dividerLabelBar) {
            var nextDivider = dividerLabelBar.nextSibling;
            this._dividersLabelBarElement.removeChild(dividerLabelBar);
            dividerLabelBar = nextDivider;
        }
        return true;
    },

    _setDividerAndBarLeft: function(divider, dividerLabelBar, percentLeft)
    {
        var percentStyleLeft = parseFloat(divider.style.left);
        if (!isNaN(percentStyleLeft) && Math.abs(percentStyleLeft - percentLeft) < 0.1)
            return;
        divider.style.left = percentLeft + "%";
        dividerLabelBar.style.left = percentLeft + "%";
    },

    removeEventDividers: function()
    {
        this._eventDividersElement.removeChildren();
    },

    /* Extends View.wasShown */
    wasShown: function()
    {
        // calling the shadowed method first will allow child timelines
        //  to become visible before we try to refresh them.
        WebInspector.View.prototype.wasShown.call(this);
        this.doResize();
    },

    /* Extends View.onResize */
    onResize: function()
    {
        WebInspector.View.prototype.onResize.call(this);

        this._refreshIfNeeded();

        var ordinal = this._timelines.length;
        var height = WebInspector.TimelapseOverview.TimelineHeight;
        var fudge = 2;

        this._labelContainer.style.setProperty("height", ordinal*height+fudge + "px");
        this._timelineContainer.style.setProperty("height", ordinal*height+fudge + "px");

        this.updateDividers(false);

        // this is a hack to work around some incremental layout bug on initial load,
        // wherein the overview will not be the correct width until it
        // is resized, while the miniview behaves fine. See Issue #102.
    },

    get calculator()
    {
        return this._recording.calculator;
    },

    _scheduleRefresh: function()
    {
        if (this._needsRefresh)
            return;

        if (!this.isShowing())
            return;

        this._needsRefresh = true;

        if (!this._refreshTimeout)
            this._refreshTimeout = setTimeout(this.refresh.bind(this), this._refreshDelay);
    },

    _refreshIfNeeded: function()
    {
        if (this._needsRefresh)
            this.refresh();
    },

    refresh: function()
    {
        console.assert(this.isShowing(), "refreshing overview which is not visible.");

        /* timer management */
        this._needsRefresh = false;
        if (this._refreshTimeout) {
            clearTimeout(this._refreshTimeout);
            delete this._refreshTimeout;
        }

        /* fix the cursor */
        if (!this._lastPanPosition) {
            if (this.calculator.zoomInterval == 1.0)
                this._timelineContainer.style.cursor = "default";
            else
                this._timelineContainer.style.cursor = "-webkit-grab";
        }

        this._updateSliderPositions();
        this.updateDividers(false);
    },

    _updateSliderPositions: function()
    {
        /* reposition the sliders within the overview. */
        var actions = this._recording.actions;

        /* playback cursor */
        var markIdx = this._model.currentMarkIndex;
        var actionIndex = this._recording.actionIndexFromMarkIndex(markIdx);
        var percent = 0.0;
    if (actionIndex != -1)
        percent = this.calculator.computeOverviewPercentage(actions[actionIndex].mark.timestamp);

        this.sliders.playback.setPosition(percent, true);

        /* savepoint sliders */
    var sliders = this.sliders.savepoint;
    for (var i = 0; i < sliders.length; ++i) {
        var slider = sliders[i];
        var savepoint = slider._savepoint;
        markIdx = savepoint.markIndex;
                actionIndex = this._recording.actionIndexFromMarkIndex(markIdx);
                percent = 0.0;
        if (actionIndex != -1)
            percent = this.calculator.computeOverviewPercentage(actions[actionIndex].mark.timestamp);
                slider.setPosition(percent, true);
                slider.show();
        }

        /* previous/replay start slider */
        markIdx = this._model.replayStartMarkIndex;
        actionIndex = this._recording.actionIndexFromMarkIndex(markIdx);
        percent = (actionIndex != -1) ? this.calculator.computeOverviewPercentage(actions[actionIndex].mark.timestamp) : 0.0;
        this.sliders.previous.setPosition(percent, true);

        /* tentative/replay finish slider */
        markIdx = this._model.replayFinishMarkIndex;
        actionIndex = this._recording.actionIndexFromMarkIndex(markIdx);
        percent = (actionIndex != -1) ? this.calculator.computeOverviewPercentage(actions[actionIndex].mark.timestamp) : 0.0;
        this.sliders.tentative.setPosition(percent, true);
    },

    _canUseProvider: function(provider)
    {
        var types = WebInspector.DataProvider.Types;
        return provider.type == types.TimelapseInput ||
            provider.type == types.BreakpointHits ||
            provider.type == types.SavepointList;
    },

    _onProviderAdded: function(event)
    {
        var provider = event.data;

        if (!this._canUseProvider(provider))
            return;

        this._addProvider(provider);
    },
    
    _addProvider: function(provider)
    {
        var callbacks = new WebInspector.EventListenerGroup(this, "Provider listeners");
        this._providerListeners[provider.name] = callbacks;

        callbacks.register(provider, WebInspector.DataProvider.Events.WillRemove, this._removeProvider);

        if (provider.type === WebInspector.DataProvider.Types.SavepointList) {
            var savepointEvents = WebInspector.SavepointListProvider.Events;
            callbacks.register(provider, savepointEvents.SavepointAdded,   this._onSavepointAdded);
            callbacks.register(provider, savepointEvents.SavepointRemoved, this._onSavepointRemoved);
            callbacks.install();
            return;
        }

        console.assert(!this._timelineForProvider(provider), "Timeline for provider already exists!");

        var ordinal = this._timelines.length;
        var height = WebInspector.TimelapseOverview.TimelineHeight;

        var label = new WebInspector.TimelapseTimelineLabel(provider);
        label.element.style.setProperty("top", ordinal*height + "px");
        label.show(this._labelContainer);
        this._labels.push(label);

        var timeline = new WebInspector.TimelapseCircleTimeline(this._recording, provider);
        timeline.element.style.setProperty("top", ordinal*height + "px");
        timeline.show(this._timelineContainer);

        // set up circle event listeners
        var timelineEvents = WebInspector.TimelapseCircleTimeline.Events;
        callbacks.register(timeline, timelineEvents.CircleMouseOver,  this._onCircleMouseOver);
        callbacks.register(timeline, timelineEvents.CircleMouseOut,   this._onCircleMouseOut);
        callbacks.register(timeline, timelineEvents.CircleSelected,   this._onCircleSelected);
        callbacks.register(timeline, timelineEvents.CircleDeselected, this._onCircleDeselected);
        callbacks.install();

        this._timelines.push(timeline);

        // force dimensions of containers to be recalculated
        this.onResize();
        this._scheduleRefresh();
    },

    _removeProvider: function(event)
    {
        var provider = event.data;

        var callbacks = this._providerListeners[provider.name];
        delete this._providerListeners[provider.name];
        callbacks.uninstall(true);

        if (provider.type == WebInspector.DataProvider.Types.SavepointList)
            return;

        var existingTimeline = this._timelineForProvider(provider);
        if (!existingTimeline)
            return;

        var i = this._timelines.lastIndexOf(existingTimeline);
        console.assert(i != -1, "Didn't find timeline for some reason.");
        var removedTimeline = this._timelines.splice(i, 1)[0];
        var removedLabel = this._labels.splice(i, 1)[0];

        // detach from DOM
        removedTimeline.detach();
        removedLabel.detach();

        // force dimensions of containers to be recalculated
        this.onResize();
        this._scheduleRefresh();
    },

    _onCircleMouseOver: function(event)
    {
        var timeline = event.data.timeline;

        this._timelines.forEach(function(tl) {
            if (timeline === tl)
                return;

            tl.clearHighlights();
        });

        // clear selections for the old circle
        if (this._circleContexts.length > 0) {
            var i = Math.max(0, this._circleContexts.length-1);
            var prevContext = this._circleContexts[i];
            prevContext.timeline.provider.clearSelections();
        }

        // set selections for the new circle
        var circleIdx = event.data.circleIndex;
        var indices = timeline.data.recordIndices[circleIdx];
        timeline.provider.selectedIndices = indices;

        // adjust stacks
        var context = {
            "index": circleIdx,
            "timeline": timeline
        };
        this._circleContexts.push(context);
        this._previewProvider.pushView(this._makePreviewForProvider(timeline.provider));
    },

    _onCircleMouseOut: function(event)
    {
        var timeline = event.data.timeline;
        console.assert(this._circleContexts.length > 0, "We lost track of what circle was being hovered. :-(");

        // clear selections for the popped circle
        var prevContext = this._circleContexts.pop();
        prevContext.timeline.provider.clearSelections();

        // set selections for the old circle now on top.
        if (this._circleContexts.length > 0) {
            var i = Math.max(0, this._circleContexts.length-1);
            var context = this._circleContexts[i];
            var indices = context.timeline.data.recordIndices[context.index];
            context.timeline.provider.selectedIndices = indices;
        }

        // NB. This has to be last, since it ultimately triggers view refresh to reflect new highlights..
        this._previewProvider.popView();
    },

    _onCircleSelected: function(event)
    {
        var timeline = event.data.timeline;

        this._timelines.forEach(function(tl) {
            if (timeline === tl)
                return;

            tl.clearSelection();
            tl.refresh();
        });

        // discard any active circle contexts (should be <= 2)
        while (this._circleContexts.length > 0) {
            var prevContext = this._circleContexts.pop();
            prevContext.timeline.provider.clearSelections();
            this._previewProvider.popView();
        }

        // set selections for new circle on top.
        var circleIdx = event.data.circleIndex;
        var indices = timeline.data.recordIndices[circleIdx];
        timeline.provider.selectedIndices = indices;

        // adjust stacks
        var context = {
            "index": circleIdx,
            "timeline": timeline,
        };
        var view = this._makePreviewForProvider(timeline.provider);
        // double-push, since we completely cleared the stack and must hover to select.
        this._circleContexts.push(context);
        this._circleContexts.push(context);
        this._previewProvider.pushView(view);
        this._previewProvider.pushView(view);
    },

    _onCircleDeselected: function(event)
    {
        // NB. this assumes that the circle of one timeline won't be selected while
        // hovering a circle of a different timeline.
        console.assert(this._circleContexts.length > 0, "circle deselected but no circle context detected.");
        console.assert(this._circleContexts[0].timeline === event.data.timeline, "circle deselected but no matching context detected.");

        // discard any active circle contexts (should be <= 2)
        while (this._circleContexts.length > 0) {
            var prevContext = this._circleContexts.pop();
            prevContext.timeline.provider.clearSelections();
            this._previewProvider.popView();
        }
    },

    _onOverviewMousedown: function(event)
    {
        if (event.button != 0)
            return;

        // The drag handle prevents the controller from being focused, so do it explicitly
        WebInspector.timelapseControllerView.focus();

        var node = event.target;

        while (node) {
            if (node === this.sliders.playback.element)
                break;
            else if (node === this.element) {
                if (this.calculator.zoomInterval == 1.0)
                    break;

                this._lastPanPosition = (event.pageX - this.element.offsetLeft) / this.element.clientWidth;
                WebInspector.installDragHandle(this.element, null, this._overviewPanning.bind(this), this._overviewPanningEnd.bind(this), "-webkit-grabbing");
                break;
            }
            node = node.parentNode;
        }
    },

    _onOverviewClick: function(event)
    {
        if (event.button != 0)
            return;

        var node = event.target;

        while (node) {
            if (node === this.sliders.playback.element)
                break;
            else if (node === this.element) {
                this._timelines.forEach(function(timeline) {
                    timeline.clearHighlights();
                    timeline.clearSelection();
                    timeline.refresh();
                });
                break;
            }
            node = node.parentNode;
        }
    },

    _overviewPanning: function(event)
    {
        var position = (event.pageX - this.element.offsetLeft) / this.element.clientWidth;
        var zoomLeft = this.calculator.zoomLeft;
        var zoomRight = this.calculator.zoomRight;
        var zoomInterval = this.calculator.zoomInterval;
        var globalDelta = (position - this._lastPanPosition) * zoomInterval;
        this._lastPanPosition = position;
        this.calculator.setZoomInterval(Number.constrain(zoomLeft - globalDelta, 0, 1.0 - zoomInterval),
                                        Number.constrain(zoomRight - globalDelta, zoomInterval, 1.0));
    },

    _overviewPanningEnd: function(event)
    {
        delete this._lastPanPosition;
    },

    _onOverviewMousewheel: function(event)
    {
        var zoomLeft = this.calculator.zoomLeft;
        var zoomRight = this.calculator.zoomRight;
        var zoomInterval = this.calculator.zoomInterval;

        /* case: scrolling horizontally = panning */
        if (event.wheelDeltaX && zoomInterval != 1.0) {
            var delta = event.wheelDeltaX * WebInspector.TimelapseOverview.WindowScrollSpeedFactor;
            zoomLeft = Number.constrain(zoomLeft - delta, 0.0, 1.0 - zoomInterval);
            zoomRight = Number.constrain(zoomRight - delta, zoomInterval, 1.0);
        }

        /* case: scrolling vertically = panning */
        else if (event.wheelDeltaY) {
            var delta = event.wheelDeltaY * WebInspector.TimelapseOverview.WindowScrollSpeedFactor;
            zoomLeft = Number.constrain(zoomLeft - delta, 0.0, 1.0 - zoomInterval);
            zoomRight = Number.constrain(zoomRight - delta, zoomInterval, 1.0);
        }

        this.calculator.setZoomInterval(zoomLeft, zoomRight);
    },

    _onPlaybackSliderDragStart: function(event)
    {
        this.sliders.playback.addEventListener(WebInspector.TimelapseOverviewSlider.Events.Moved,
                                               this._onPlaybackSliderDragged,
                                               this);

        this._recording.startPreviewing();
    },

    _onPlaybackSliderDragged: function(event)
    {
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

        var position = this.sliders.playback.position;
        var wantedTs = this.calculator.computeOverviewTimestamp(position);
        var minTs = this.calculator.minimumBoundary;
        var maxTs = this.calculator.maximumBoundary;

        // for each active input provider, find the nearest mark within the calculator zoom interval
        var closestPerProvider = [];
        var inputProviders = this._actioning.providersWithType(WebInspector.DataProvider.Types.TimelapseInput);
        for (var i = 0; i < inputProviders.length; i++) {
            var provider = inputProviders[i];
            if (!provider.isEnabled() || !provider.actions.length)
                continue;

            var minIdx = provider.actions.nearestBinaryIndexOf(minTs, timestampAndActionComparator, timeDistanceFunction);
            var maxIdx = provider.records.nearestBinaryIndexOf(maxTs, timestampAndActionComparator, timeDistanceFunction);
            var idx = provider.records.nearestBinaryIndexWithin(wantedTs, minIdx, maxIdx, timestampAndActionComparator, timeDistanceFunction);
            closestPerProvider.push(provider.records[idx]);
        }

        // if nothing matched at all, then there are no active providers. Just stop.
        if (closestPerProvider.length === 0)
            return;

        // now find the best out of the nearest candidates
        var bestMatch = closestPerProvider[0];
        for (var i = 1; i < closestPerProvider.length; i++) {
            if (Math.abs(wantedTs - closestPerProvider[i]) < Math.abs(wantedTs - bestMatch))
                bestMatch = closestPerProvider[i];
        }

        this._recording.previewAction(bestMatch);
    },

    _onPlaybackSliderDragEnd: function(event)
    {
        this.sliders.playback.removeEventListener(WebInspector.TimelapseOverviewSlider.Events.Moved,
                                                 this._onPlaybackSliderDragged,
                                                 this);

        var targetAction = this._recording.previewedAction;
        this._recording.stopPreviewing();
    if (targetAction) // not true if dragged and dropped in place
        this._model.replayUpToMarkIndex(targetAction.mark.index);
    },

    _onPlaybackSliderContextMenu: function(event)
    {
        var currentBreakpoint = this._model.breakpointTracker.currentBreakpoint;
        if (currentBreakpoint)
            currentBreakpoint.contextMenu(event);
    },
    
    _onZoomChanged: function()
    {
        if (!this._currentZoomInterval || this.calculator.zoomInterval != this._currentZoomInterval)
            this._currentZoomInterval = this.calculator.zoomInterval;

        this._scheduleRefresh();
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
        var action = event.data;
        var percent = this.calculator.computeOverviewPercentage(action.mark.timestamp);
        this.sliders.tentative.setPosition(percent, true);
    },

    _onPlaybackError: function(event)
    {
        var errorMessage = event.data.errorMessage;
        var isFatal = event.data.isFatal;

        if (isFatal) {
            var clickDismissalCallback = function(event) {
                this._previewProvider.popView();
                this._messagePanel.element.removeEventListener("click", clickDismissalCallback, false);
                this._messagePanel.detach();
            }.bind(this);

            this._messagePanel.content = document.createTextNode("Playback was terminated by a fatal error. Please try again.");
            this._messagePanel.element.addEventListener("click", clickDismissalCallback, false);
        } else {
            var model = this._model;
            var message = this._messagePanel;
            var preview = this._previewProvider;
            var optionLabels = [
                "Keep going",
                "Ignore warnings",
                "Abort"
            ];

            var replaySpeeds = WebInspector.TimelapseModel.ReplaySpeed;
            var optionCallbacks = [
                // case: moral equivalent of pressing play button
                function(event) {
                    var allowBreakpoints = model.scanningBreakpoints ||
                        model.replaySpeed === replaySpeeds.Normal;
                    model.replayUpToMarkIndex(model.replayFinishMarkIndex,
                                              allowBreakpoints, model.replaySpeed);
                    preview.popView();
                    message.detach();
                },

                // case: disable pauses, then press play
                function(event) {
                    var allowBreakpoints = model.scanningBreakpoints ||
                        model.replaySpeed === replaySpeeds.Normal;
                    TimelapseAgent.setPauseOnError(false);
                    model.replayUpToMarkIndex(model.replayFinishMarkIndex,
                                              allowBreakpoints, model.replaySpeed);
                    preview.popView();
                    message.detach();
                },

                // case: unlock
                function() {
                    model.stopPlayback(true);
                    preview.popView();
                    message.detach();
                }
            ];

            var ul = document.createElement("ul");

            for (var i = 0; i < optionLabels.length; i++) {
                var li = document.createElement("li");
                var span = document.createElement("span");
                span.textContent = optionLabels[i];
                span.addEventListener("click", optionCallbacks[i], false);
                li.appendChild(span);
                ul.appendChild(li);
            }
            var p = document.createElement("p");
            p.appendChild(document.createTextNode("Something went wrong during playback."));
            p.appendChild(ul);
            this._messagePanel.content = p;
        }

        this._previewProvider.pushView(new WebInspector.OverviewPreviewViews.ErrorView(errorMessage));
        this._messagePanel.show(this.element);
    },

    _showMessagePanel: function(message)
    {
        // If the message panel is already showing, this means some higher-level
        // event has displayed a message.
        // For example, BreakpointScan{Started,Stopped} sets its own messages.
        if (this._messagePanel.isShowing())
            return;

        // figure out an appropriate message if none provided.
        if (typeof message !== "string") {
            if (this._model.replaySpeed === WebInspector.TimelapseModel.ReplaySpeed.Seeking) {
                message = "Seeking...";
            } else {
                message = "Replaying... click to cancel.";
            }
        }

        var clickCallback = function(clickEvent) {
            if (this._model.isReplaying)
                this._model.pausePlayback();

            this._messagePanel.element.removeEventListener("click", clickCallback, false);
            this._messagePanel.detach();
        }.bind(this);
        this._messagePanel.addEventListener("click", clickCallback, false);
        this._messagePanel.content = document.createTextNode(message);
        this._messagePanel.show(this.element);
    },
    
    _hideMessagePanel: function(event)
    {
        this._messagePanel.detach();
        this._scheduleRefresh();
    },

    _onPlaybackDidStart: function(event)
    {
        var actions = this._recording.actions;
        var startAction = actions[this._recording.actionIndexFromMarkIndex(this._model.replayStartMarkIndex)];
        var finishAction = actions[this._recording.actionIndexFromMarkIndex(this._model.replayFinishMarkIndex)];
        var currentAction = actions[this._recording.actionIndexFromMarkIndex(this._model.currentMarkIndex)];

        this.sliders.playback.element.addStyleClass("playback-slider");
        this.sliders.playback.element.removeStyleClass("breakpoint-slider");

        this.sliders.previous.setPosition(this.calculator.computeOverviewPercentage(startAction.mark.timestamp), true);
        this.sliders.previous.show();
        this.sliders.tentative.setPosition(this.calculator.computeOverviewPercentage(finishAction.mark.timestamp), true);
        this.sliders.tentative.show();

        this.sliders.playback.disable();
        this.sliders.playback.setPosition(this.calculator.computeOverviewPercentage(currentAction.mark.timestamp), true);
        this.sliders.playback.element.addStyleClass("playback-pulse");
    var replaySpeeds = WebInspector.TimelapseModel.ReplaySpeed;
        this.sliders.playback.minimumResolution = (this._model.replaySpeed === replaySpeeds.Seeking) ? 10.0 : 1.0;
    
    this._showMessagePanel();
    },

    _onPlaybackStopped: function(event)
    {
        this.sliders.previous.hide();
        this.sliders.tentative.hide();

        this.sliders.playback.resetResolution();
        this.sliders.playback.element.removeStyleClass("playback-pulse");
        this.sliders.playback.enable();

        this._hideMessagePanel(event);
    },

    _onInputPaused: function(event)
    {
        var actions = this._recording.actions;
        var actionIndex = this._recording.actionIndexFromMarkIndex(this._model.currentMarkIndex);
        
        if (actionIndex != -1) {
            var percent = this.calculator.computeOverviewPercentage(actions[actionIndex].mark.timestamp);
            this.sliders.playback.setPosition(percent, true);
        }

        // required because setPosition implicitly calls show()
        if (WebInspector.debuggerModel.isPaused())
            this.sliders.playback.hide(); 

        this.sliders.previous.hide();
        this.sliders.tentative.hide();

        this.sliders.playback.resetResolution();
        this.sliders.playback.element.removeStyleClass("playback-pulse");
        this.sliders.playback.enable();

        this._hideMessagePanel(event);

        this._scheduleRefresh();
    },

    _onInputHit: function(eventData)
    {
        var markIndex = eventData.data;
        var actionIndex = this._recording.actionIndexFromMarkIndex(markIndex);

        // don't animate if this mark has no corresponding action (aka, not a user-visible mark)
        if (actionIndex == -1)
            return;

        var actions = this._recording.actions;
        var percent = 0.0;
        if (markIndex > 0)
            percent = this.calculator.computeOverviewPercentage(actions[actionIndex].mark.timestamp);

        this.sliders.playback.setPosition(percent, true);

        // don't animate if this is close to the beginning/end, or out of view.
        if (percent < 0.0 || percent > 0.99)
            return;

        var nextAction = actions[actionIndex+1];
        var curActionTime = (actionIndex > 0) ? actions[actionIndex].mark.timestamp
                                              : this.calculator.minimumBoundary;

        var timeDelta = nextAction.mark.timestamp - curActionTime;
        if (timeDelta > WebInspector.TimelapseOverview.MinAnimationDelta) {
            var nextActionPosition = this.calculator.computeOverviewPercentage(nextAction.mark.timestamp);
            this.sliders.playback.animateTo(nextActionPosition, timeDelta);
        }
    },

    _onDebuggerPaused: function()
    {
        this.sliders.playback.element.addStyleClass("breakpoint-slider");
        this.sliders.playback.element.removeStyleClass("playback-pulse");
        this.sliders.playback.resetPosition();
        this.sliders.playback.enable();

        this._messagePanel.detach();

        var currentMarkIndex = WebInspector.timelapseModel.currentMarkIndex;
        var timeline = this._timelineForProviderType(WebInspector.DataProvider.Types.BreakpointHits);
        if (!timeline)
            return;

        // TODO: this breaks timeline abstractions; maybe refactor to have
        //timeline be notified by provider?
        var circleIdx = timeline._circleIndexFromMarkIndex(currentMarkIndex);
        timeline._selectCircle(circleIdx);
    },

    _onBreakpointRecordsChanged: function()
    {
        this._scheduleRefresh();
    },

    _onSavepointAdded: function(event)
    {
        var savepoint = event.data;
        var slider = new WebInspector.TimelapseOverviewSlider(this, "savepoint", false);
        slider._savepoint = savepoint;
        slider._listenerGroup = new WebInspector.EventListenerGroup(this, "TimelapseOverviewSlider listeners");
        slider._listenerGroup.register(slider.iconElement, "click", function() {
            this._model.scheduler.executeImmediately(savepoint.createRestoreTask());
        }, this);
        slider._listenerGroup.install();
        this._timelineContainer.appendChild(slider.element);
        this.sliders.savepoint.push(slider);

        this._updateSliderPositions();
    },

    _onSavepointRemoved: function(event)
    {
        var savepoint = event.data;
        for (var i = 0; i < this.sliders.savepoint.length; ++i) {
            if (this.sliders.savepoint[i]._savepoint !== savepoint)
                continue;
            
            var slider = this.sliders.savepoint.splice(i, 1)[0];
            slider._listenerGroup.uninstall();
            slider.dispose();
            return;
        }

        this._updateSliderPositions();
    },

    _makePreviewForProvider: function(provider)
    {
        if (provider.type === WebInspector.DataProvider.Types.BreakpointHits)
            return new WebInspector.OverviewPreviewViews.BreakpointHitView(this._recording, provider);
        else
            return new WebInspector.OverviewPreviewViews.InputView(provider);
    },
    
    __proto__: WebInspector.View.prototype
};

/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseCircleTimeline = function(recording, provider)
{
    WebInspector.View.call(this);

    this.calculator = recording.calculator;
    this._recording = recording;
    this._provider = provider;

    console.assert(!!provider, "Tried to instantiate circle timeline without provider :-(");

    this.element = document.createElement("div");
    this.element.className = "timelapse-overview-timeline timelapse-category-" + this.provider.name;
    this.element.timeline = this;
    this._canvas = document.createElement("canvas");
    this.element.appendChild(this._canvas);

    var events = WebInspector.DataProvider.Events;
    this._providerCallbacks = new WebInspector.EventListenerGroup(this, "TimelapseCircleTimeline provider listeners");
    this._providerCallbacks.register(this.provider, events.DataChanged, this._onDataChanged);
    this._providerCallbacks.register(this.provider, events.Enabled,     this._onProviderEnabled);
    this._providerCallbacks.register(this.provider, events.Disabled,    this._onProviderDisabled);
    this._providerCallbacks.register(this.provider, events.WillRemove,  this._onProviderRemoved);
    this._providerCallbacks.register(this.calculator, WebInspector.TimelapseCalculator.Events.ZoomChanged,
                                     this._onZoomChanged);
    this._providerCallbacks.install();

    this._interactionCallbacks = new WebInspector.EventListenerGroup(this, "TimelapseCircleTimeline mouse listeners");
    this._interactionCallbacks.register(this.element, "click",     this._onTimelineClicked);
    this._interactionCallbacks.register(this.element, "mousemove", this._onTimelineMousemove);
    this._interactionCallbacks.register(this.element, "mouseout",  this._onTimelineMouseout);
    this._interactionCallbacks.register(this.element, "dblclick",  this._onTimelineDoubleClicked);
    if (this.provider.isEnabled())
        this._interactionCallbacks.install();

    this._recomputeParameters();
    this._clearTimeline();
    this._highlights = [];
};

WebInspector.TimelapseCircleTimeline.prototype = {
    get data()
    {
        return this._data;
    },

    get provider()
    {
        return this._provider;
    },

    wasShown: function()
    {
        WebInspector.View.prototype.wasShown.call(this);
        this.refresh();
    },

    onResize: function()
    {
        WebInspector.View.prototype.onResize.call(this);

        /* resize timeline */
        this._recomputeParameters();
        this.refresh();
    },

    _recomputeParameters: function()
    {
        this._canvas.width = this.element.clientWidth;
        this._canvas.style.width = this.element.clientWidth + 'px';
        this._canvas.height = this.element.clientHeight;
        this._canvas.style.height = this.element.clientHeight + 'px';

        var fillAlpha = 0.3;
        var fillColor = WebInspector.Color.fromRGBA(this.provider.color.rgb[0],
                                                    this.provider.color.rgb[1],
                                                    this.provider.color.rgb[2],
                                                    fillAlpha).toString();

        this._ctx = this._canvas.getContext("2d");
        this._ctx.fillStyle = fillColor;
    },

    refresh: function()
    {
        this._recomputeTimeline();
        this._drawTimeline();
    },

    _onProviderRemoved: function()
    {
        this._providerCallbacks.uninstall(true);
        // TODO: we can't quite delete the provider right now, because
        // we are somewhere calling this.refresh() after the provider
        // has been deleted but before the Timeline view has been detached.

        //delete this._provider;
    },

    _onDataChanged: function()
    {
        if (this.isShowing())
            this._recomputeTimeline();

        this.clearHighlights();
        this.refresh();
    },

    _onProviderEnabled: function()
    {
        this.element.classList.remove("disabled");
        this._recomputeParameters();
        this._interactionCallbacks.install();
        this.refresh();
    },

    _onProviderDisabled: function()
    {
        this.element.classList.add("disabled");
        this._recomputeParameters();
        this._interactionCallbacks.uninstall();
        if (this._selectedCircleIndex)
            this._deselectCircle();
        this.refresh();
    },

    _selectCircle: function(circleIndex)
    {
        if (this._selectedCircleIndex) {
            this.clearCursor();
            this.removeHighlight(this._selectedCircleIndex);
            delete this._selectedCircleIndex;
        }

        this._selectedCircleIndex = circleIndex;
        this.addHighlight(circleIndex);
        this.refresh();

        var eventData = {
            "timeline": this,
            "circleIndex": circleIndex,
        };

        this.dispatchEventToListeners(WebInspector.TimelapseCircleTimeline.Events.CircleSelected, eventData);
    },

    _deselectCircle: function(circleIndex)
    {
        console.assert(this._selectedCircleIndex, "can't deselect on timeline with no selected circle.");

        this.clearCursor();
        this.removeHighlight(this._selectedCircleIndex);
        delete this._selectedCircleIndex;
        this.refresh();

        var eventData = {
            "timeline": this,
            "circleIndex": circleIndex,
        };

        this.dispatchEventToListeners(WebInspector.TimelapseCircleTimeline.Events.CircleDeselected, eventData);
    },

    _circleMouseOut: function(circleIndex)
    {
        if (!this._hoveredCircleIndex)
            return;

        this.clearCursor();
        this.removeHighlight(this._hoveredCircleIndex);
        delete this._hoveredCircleIndex;
        this.refresh();

        var eventData = {
            "timeline": this,
            "circleIndex": circleIndex,
        };

        this.dispatchEventToListeners(WebInspector.TimelapseCircleTimeline.Events.CircleMouseOut, eventData);
    },

    _circleMouseOver: function(circleIndex)
    {
        this._hoveredCircleIndex = circleIndex;

        this.setCursor("pointer");
        this.addHighlight(circleIndex);

        var eventData = {
            "timeline": this,
            "circleIndex": circleIndex,
        };

        this.dispatchEventToListeners(WebInspector.TimelapseCircleTimeline.Events.CircleMouseOver, eventData);
    },

    _onTimelineClicked: function(event)
    {
        var node = event.target;

        if (node.tagName == "CANVAS")
            node = node.parentElement;
        else
            return;

        console.assert(!!node.timeline && this === node.timeline, "timeline node didn't have (correct or any) timeline object.");

        if (this.data.recordIndices.length == 0)
            return;

        // * clicking on a circle selects it.
        // * otherwise, the overview will pick up the event when it bubbles up,
        // and clear any selections in other timelines.
        var clickedCircleIdx = this.hitTest(event);
        if (clickedCircleIdx != -1) {
            this._selectCircle(clickedCircleIdx);
            event.stopPropagation();
        }
    },

    _onTimelineMousemove: function(event)
    {
        var node = event.target;

        if (node.tagName == "CANVAS")
            node = node.parentElement;
        else
            return;

        console.assert(!!node.timeline && this === node.timeline, "timeline node didn't have (correct or any) timeline object.");

        if (this.data.recordIndices.length == 0)
            return;

        var hoveredCircleIdx = this.hitTest(event);
        var hadPreviousHover = this.hasOwnProperty("_hoveredCircleIndex");
        var hoverChanged = (hadPreviousHover && this._hoveredCircleIndex != hoveredCircleIdx) || (!hadPreviousHover && hoveredCircleIdx != -1);

        if (!hoverChanged)
            return;

        if (hadPreviousHover)
            this._circleMouseOut(hoveredCircleIdx);

        if (hoveredCircleIdx != -1)
            this._circleMouseOver(hoveredCircleIdx);

        this.refresh();
    },

    _onTimelineMouseout: function(event)
    {
        if (!this.hasOwnProperty("_hoveredCircleIndex"))
            return;

        var node = event.target;

        if (node.tagName == "CANVAS")
            node = node.parentElement;
        else
            return;

        console.assert(!!node.timeline && this === node.timeline, "timeline node didn't have (correct or any) timeline object.");

        if (this.data.recordIndices.length == 0)
            return;

        this._circleMouseOut(this._hoveredCircleIndex);
    },

    _onTimelineDoubleClicked: function(event)
    {
        var node = event.target;

        if (node.tagName == "CANVAS")
            node = node.parentElement;
        else
            return;

        console.assert(!!node.timeline && this === node.timeline, "timeline node didn't have (correct or any) timeline object.");

        if (this.data.recordIndices.length == 0)
            return;

        var clickedCircleIdx = this.hitTest(event);
        if (clickedCircleIdx == -1)
            return;

        var actionIndex = this.data.recordIndices[clickedCircleIdx][0];
        WebInspector.timelapseModel.replayUpToMarkIndex(this.provider.records[actionIndex].mark.index);
    },

    _circleIndexFromMarkIndex: function(markIndex)
    {
        var recordIndices = this._data.recordIndices;

        for (var i = 0; i < recordIndices.length; i++) {
            var indexList = recordIndices[i];
            var records = this._provider.records;
            for (var j = 0; j < indexList.length; j++) {
                if (records[indexList[j]].mark.index != markIndex)
                    continue;
                else
                    return i;
            }
        }
        return -1;
    },

    hitTest: function(event)
    {
        function timestampComparator(a, b) {
            return a - b;
        }

        function timeDistanceFunction(a, b) {
            return Math.abs(a - b);
        }

        if (this._data.centers.length == 0)
            return -1;

        var x = event.pageX - event.target.totalOffsetLeft();
        var y = event.pageY - event.target.totalOffsetTop();

        var timestamp = this.calculator.computeOverviewTimestamp(x / event.target.offsetWidth);
        var idx = this._data.centers.nearestBinaryIndexOf(timestamp, timestampComparator, timeDistanceFunction);
        if (idx < 0 || idx >= this._data.centers.length)
            return -1;

        var nearestCenter = this.calculator.computeOverviewPercentage(this._data.centers[idx]) * this.element.clientWidth;
        var midHeight = this.element.clientHeight / 2;
        var radius = this._data.radii[idx];

        if (x < nearestCenter - radius || x > nearestCenter + radius ||
            y < midHeight - radius || y > midHeight + radius)
            return -1;

        return idx;
    },

    getCircleGeometry: function(idx)
    {
        var centers = this._data.centers;
        var radii = this._data.radii;
        var percent = this.calculator.computeOverviewPercentage(centers[idx]);
        var availWidth = this.element.clientWidth;
        var availHeight = this.element.clientHeight;

        return { top: availHeight/2,
                 left: percent * availWidth,
                 radius: radii[idx]
               };
    },

    setCursor: function(shape)
    {
        this.element.style.setProperty("cursor", shape);
    },

    clearCursor: function()
    {
        this.element.style.removeProperty("cursor");
    },

    addHighlight: function(idx)
    {
        /* Note: it's possible to have several highlights per circle. This is how clicking a hovered circle is possible. */
        this._highlights.push(idx);
    },

    removeHighlight: function(circleIdx)
    {
        var i = this._highlights.indexOf(circleIdx);
        if (i == -1)
            return;

        this._highlights.splice(i, 1);
    },

    clearHighlights: function()
    {
        this._highlights = [];
    },

    clearSelection: function()
    {
        if (!this._selectedCircleIndex)
            return;

        this._deselectCircle();
    },

    _drawHighlights: function()
    {
        var strokeAlpha = 0.7;
        var singleInputStrokeColor = WebInspector.Color.fromRGBA(0, 0, 0, strokeAlpha).toString();
        var defaultStrokeColor = WebInspector.Color.fromRGBA(Math.max(0, this.provider.color.rgb[0] - 50),
                                                             Math.max(0, this.provider.color.rgb[1] - 50),
                                                             Math.max(0, this.provider.color.rgb[2] - 50),
                                                             strokeAlpha).toString();

        for (var i = 0; i < this._highlights.length; i++) {
            var circleIdx = this._highlights[i];
            var selectedSingleInput = (this._data.recordIndices[circleIdx].length == 1);
            var newStroke = (selectedSingleInput) ? singleInputStrokeColor : defaultStrokeColor;
            if (this._ctx.strokeStyle != newStroke)
                this._ctx.strokeStyle = newStroke;

            var geometry = this.getCircleGeometry(circleIdx);
            this._ctx.beginPath();
            this._ctx.arc(geometry.left, geometry.top, geometry.radius, 0, 2*Math.PI, true);
            this._ctx.closePath();
            this._ctx.stroke();
        }
    },

    _drawTimeline: function()
    {
        if (this._canvas.width <= 0 || this._canvas.height <= 0)
            return;

        this._clearTimeline();

        if (this.calculator.zoomInterval == 0)
            return;

        /* timestamp representing the center of this dot */
        var centers = this._data.centers;
        var radii = this._data.radii;
        var availWidth = this.element.clientWidth;
        var availHeight = this.element.clientHeight;

        /* this is the same computation as getCircleGeometry, but doesn't allocate objects */
        for (var i = 0; i < centers.length; i++) {
            this._ctx.beginPath();
            var percent = this.calculator.computeOverviewPercentage(centers[i]);
            this._ctx.arc(percent * availWidth, availHeight/2, radii[i], 0, 2*Math.PI, true);
            this._ctx.closePath();
            this._ctx.fill();
        }

        this._drawHighlights();

        // Shade unexplored intervals
        if (this.provider.name == "breakpoint") {
            var model = WebInspector.timelapseModel;
            var intervals = this.provider.exploredIntervals;
            var ctx = this._ctx;
            var startPercent = 0, endPercent, widthPercent;

            var fillColor = ctx.fillStyle;
            var fogColor = "rgba(0, 0, 0, 0.1)";
            var transparent = "rgba(0, 0, 0, 0)";

            function fade(x, width, fadeIn) {
                var gradient = ctx.createLinearGradient(x + width, 0, x, 0);
                var startColor = fadeIn ? fogColor : transparent;
                var endColor = fadeIn ? transparent : fogColor;

                gradient.addColorStop(0.0, startColor);
                gradient.addColorStop(1.0, endColor);
                ctx.fillStyle = gradient;
                ctx.fillRect(x, 0, width, availHeight);
                ctx.fillStyle = fogColor;
            }

            ctx.fillStyle = fogColor;

            for (var i = 0; i < intervals.length; i++) {
                var timestamp = this._recording.timestampFromMarkIndex(intervals[i].start);
                endPercent = this.calculator.computeOverviewPercentage(timestamp);
                widthPercent = endPercent - startPercent;

                var x = Math.round(startPercent * availWidth);
                var width = Math.round(widthPercent * availWidth);

                if (i == 0) {
                    // Paint first unexplored interval (no fade in)
                    var fadeWidth = Math.min(width, 10);
                    if (width - fadeWidth > 0)
                        ctx.fillRect(x, 0, width - fadeWidth, availHeight);
                    fade(x + Math.max(width - fadeWidth, 0), fadeWidth);
                }
                else {
                    var fadeWidth = Math.floor(Math.min(width, 20) / 2);
                    fade(x, fadeWidth, true);
                    if (width - fadeWidth * 2 > 0)
                        ctx.fillRect(x + fadeWidth, 0, width - fadeWidth * 2, availHeight);
                    fade(x + width - fadeWidth, fadeWidth);
                }

                timestamp = this._recording.timestampFromMarkIndex(intervals[i].end);
                startPercent = this.calculator.computeOverviewPercentage(timestamp);
            }

            // Paint last unexplored interval (no fade out)
            endPercent = 1.0;
            widthPercent = endPercent - startPercent;

            var x = Math.round(startPercent * availWidth);
            var width = Math.round(widthPercent * availWidth);
            var fadeWidth = Math.min(width, 10);

            if (x > 0) {
                fade(x, fadeWidth, true);
                if (width - fadeWidth > 0)
                    ctx.fillRect(x + fadeWidth, 0, width - fadeWidth, availHeight);
            }
            // Otherwise, there are no explored intervals, so don't fade in either.
            else
                ctx.fillRect(0, 0, width, availHeight);

            ctx.fillStyle = fillColor;
        }
    },

    _recomputeTimeline: function()
    {
        // This method assumes this.isShowing(). If it's not, then it can't
        // access clientWidth and do auto-scaling based on available width.
        console.assert(this.isShowing(), "Timeline must be visible before it is recomputed.");

        this._data = { centers: [], radii: [], indexExtents: [], recordIndices: [] };

        var data = this.data;
        var records = this.provider.records;
        var minIntervalPx = 4.0; /* distance between adjacent record centers */
        var baseRadius = 3;
        var maxRecordsPerDot = 10;

        var availWidth = this.element.clientWidth;
        var minInterval = minIntervalPx / availWidth * this.calculator.zoomInterval * this.calculator.boundarySpan;

        var pendingRecordIndices = [];

        function flushDot() {
            if (pendingRecordIndices.length == 0)
                return;

            var totalTs = 0.0;
            for (var i = 0; i < pendingRecordIndices.length; i++)
                totalTs += records[pendingRecordIndices[i]].mark.timestamp;

            var averageTimestamp = totalTs/pendingRecordIndices.length;
            var radius = baseRadius + pendingRecordIndices.length;

            data.centers.push(averageTimestamp);
            data.radii.push(radius);
            data.recordIndices.push(pendingRecordIndices);

            pendingRecordIndices = [];
        }

        for (i = 0; i < records.length; i++) {
            if (pendingRecordIndices.length == maxRecordsPerDot
                || (i > 0 && records[i].mark.timestamp - records[i-1].mark.timestamp > minInterval))
                flushDot();

            // we assume the array of records is monotonic, so we can
            // use index as a stable reference to a specific record
            // within a provider. This speeds up changes in highlighted/selected records.
            pendingRecordIndices.push(i);
        }
        flushDot();
    },

    _clearTimeline: function()
    {
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    },

    _onZoomChanged: function()
    {
        if (this.isShowing())
            this.refresh();
    },
    
    __proto__: WebInspector.View.prototype
};

WebInspector.TimelapseCircleTimeline.Events = {
    CircleMouseOver: "CircleMouseOver",
    CircleMouseOut: "CircleMouseOut",
    CircleSelected: "CircleSelected",
    CircleDeselected: "CircleDeselected",
}

WebInspector.TimelapseOverviewMessagePanel = function(overview)
{
    WebInspector.View.call(this);

    this.element = document.createElement("div");
    this.element.className = "timelapse-overview-message message-pulse";
}

WebInspector.TimelapseOverviewMessagePanel.prototype = {
    get content()
    {
        return this._content;
    },

    set content(val)
    {
        while (this.element.childNodes.length > 0)
            this.element.removeChild(this.element.childNodes[0]);

        this.element.appendChild(val);
        this._content = val;
    },
    
    __proto__: WebInspector.View.prototype
};

/**
 * @Constructor
 * @extends {WebInspector.Object}
 */
WebInspector.TimelapseOverviewSlider = function(overview, name, adjustable)
{
    WebInspector.Object.call(this);
    this._adjustable = adjustable;

    this.element = document.createElement("div");
    this.element.className = "timelapse-overview-slider " + name + "-slider";

    if (this._adjustable) {
        this.element.classList.add("adjustable");
        WebInspector.installDragHandle(this.element, this._startSliderDragging.bind(this), this._sliderDragging.bind(this), this._endSliderDragging.bind(this), "col-resize");
    }

    this._verticalBarElement = document.createElement("div");
    this._verticalBarElement.className = "timelapse-slider-band";
    this.element.appendChild(this._verticalBarElement);

    var wrapper = document.createElement("div");
    wrapper.className = "timelapse-slider-wedge-wrapper";
    var wedgeBorder = document.createElement("div");
    wedgeBorder.className = "timelapse-slider-wedge-border";
    wrapper.appendChild(wedgeBorder);
    var wedge = document.createElement("div");
    wedge.className = "timelapse-slider-wedge";
    wrapper.appendChild(wedge);
    this.element.appendChild(wrapper);

    if (name == "savepoint") {
        var icon = this.iconElement = document.createElement("div");
        icon.className = "timelapse-slider-icon";
        this.element.appendChild(icon);
    }

    this._overview = overview;
    this.clear();
    this.enable();
};

WebInspector.TimelapseOverviewSlider.Events = {
    Moved: "TimelapseSliderMoved",
    DragStart: "TimelapseSliderDragStart",
    DragEnd: "TimelapseSliderDragEnd"
};

WebInspector.TimelapseOverviewSlider.prototype = {
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

        this.cancelAnimation();
        this.refresh();

        if (!suppressEvents) {
            this.dispatchEventToListeners(WebInspector.TimelapseOverviewSlider.Events.Moved);
        }
    },

    resetPosition: function()
    {
        this._lastRefreshedPosition = 0.0;
        this.setPosition(this._position, true);
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

        if (this.element.hasStyleClass("breakpoint-slider")) {
            this._suppressingBreakpointStyle = true;
            this.element.removeStyleClass("breakpoint-slider");
        }

        this.element.classList.add("slider-dragging");

        this.dispatchEventToListeners(WebInspector.TimelapseOverviewSlider.Events.DragStart);
        return true;
    },

    _sliderDragging: function(event)
    {
        if (!this._enabled)
            return;

        var parent = this.element.parentElement; // should be timeline container
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

        if (this._suppressingBreakpointStyle) {
            delete this._suppressingBreakpointStyle;
            this.element.addStyleClass("breakpoint-slider");
        }

        this.element.classList.remove("slider-dragging");
        this.dispatchEventToListeners(WebInspector.TimelapseOverviewSlider.Events.DragEnd);
    },
    
    __proto__: WebInspector.Object.prototype
};

/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseTimelineLabel = function(provider)
{
    WebInspector.View.call(this);

    this._provider = provider;

    this.element = document.createElement("div");
    this.element.className = "timelapse-timeline-label-wrapper timelapse-category-" + provider.name;
    this.element.style.setProperty("background-color", provider.color.toString());

    var label = document.createElement("div");
    label.className = "timelapse-timeline-label timelapse-category-" + provider.name;
    label.textContent = provider.displayName;
    label.title = provider.displayName;
    this.element.appendChild(label);

    this._callbacks = new WebInspector.EventListenerGroup(this, "Static TimelapseTimelineLabel listeners");
    this._callbacks.register(label, "click", this._onLabelClicked);
    var events = WebInspector.DataProvider.Events;
    this._callbacks.register(this._provider, events.Enabled,    this._onProviderEnabled);
    this._callbacks.register(this._provider, events.Disabled,   this._onProviderDisabled);
    this._callbacks.register(this._provider, events.WillRemove, this._onProviderRemoved);
    this._callbacks.install();
};

WebInspector.TimelapseTimelineLabel.prototype = {
    _onLabelClicked: function()
    {
        this._provider.toggleEnablement();
    },

    _onProviderEnabled: function()
    {
        this.element.classList.remove("disabled");
    },

    _onProviderDisabled: function()
    {
        this.element.classList.add("disabled");
    },

    _onProviderRemoved: function()
    {
        this._callbacks.uninstall(true);
        delete this._provider;
    },
    
    __proto__: WebInspector.View.prototype
};
