/*
 * Copyright (C) 2012 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @constructor
 * @extends {WebInspector.ProfileType}
 */
WebInspector.CanvasProfileType = function()
{
    WebInspector.ProfileType.call(this, WebInspector.CanvasProfileType.TypeId, WebInspector.UIString("Capture Canvas Frame"));
    this._nextProfileUid = 1;
    this._recording = false;
    this._lastProfileHeader = null;

    this._capturingModeSelector = new WebInspector.StatusBarComboBox(this._dispatchViewUpdatedEvent.bind(this));
    this._capturingModeSelector.element.title = WebInspector.UIString("Canvas capture mode.");
    this._capturingModeSelector.createOption(WebInspector.UIString("Single Frame"), WebInspector.UIString("Capture a single canvas frame."), "");
    this._capturingModeSelector.createOption(WebInspector.UIString("Consecutive Frames"), WebInspector.UIString("Capture consecutive canvas frames."), "1");

    /** @type {!Object.<string, Element>} */
    this._frameOptions = {};

    /** @type {!Object.<string, boolean>} */
    this._framesWithCanvases = {};

    this._frameSelector = new WebInspector.StatusBarComboBox(this._dispatchViewUpdatedEvent.bind(this));
    this._frameSelector.element.title = WebInspector.UIString("Frame containing the canvases to capture.");
    this._frameSelector.element.addStyleClass("hidden");
    WebInspector.runtimeModel.contextLists().forEach(this._addFrame, this);
    WebInspector.runtimeModel.addEventListener(WebInspector.RuntimeModel.Events.FrameExecutionContextListAdded, this._frameAdded, this);
    WebInspector.runtimeModel.addEventListener(WebInspector.RuntimeModel.Events.FrameExecutionContextListRemoved, this._frameRemoved, this);

    this._decorationElement = document.createElement("div");
    this._decorationElement.addStyleClass("profile-canvas-decoration");
    this._decorationElement.addStyleClass("hidden");
    this._decorationElement.textContent = WebInspector.UIString("There is an uninstrumented canvas on the page. Reload the page to instrument it.");
    var reloadPageButton = this._decorationElement.createChild("button");
    reloadPageButton.type = "button";
    reloadPageButton.textContent = WebInspector.UIString("Reload");
    reloadPageButton.addEventListener("click", this._onReloadPageButtonClick.bind(this), false);

    this._dispatcher = new WebInspector.CanvasDispatcher(this);

    // FIXME: enable/disable by a UI action?
    CanvasAgent.enable(this._updateDecorationElement.bind(this));
    WebInspector.resourceTreeModel.addEventListener(WebInspector.ResourceTreeModel.EventTypes.MainFrameNavigated, this._updateDecorationElement, this);
}

WebInspector.CanvasProfileType.TypeId = "CANVAS_PROFILE";

WebInspector.CanvasProfileType.prototype = {
    get statusBarItems()
    {
        return [this._capturingModeSelector.element, this._frameSelector.element];
    },

    get buttonTooltip()
    {
        if (this._isSingleFrameMode())
            return WebInspector.UIString("Capture next canvas frame.");
        else
            return this._recording ? WebInspector.UIString("Stop capturing canvas frames.") : WebInspector.UIString("Start capturing canvas frames.");
    },

    /**
     * @override
     * @param {WebInspector.ProfilesModel} model
     * @return {boolean}
     */
    buttonClicked: function(model)
    {
        if (this._recording) {
            this._recording = false;
            this._stopFrameCapturing();
        } else if (this._isSingleFrameMode()) {
            this._recording = false;
            this._runSingleFrameCapturing(model);
        } else {
            this._recording = true;
            this._startFrameCapturing(model);
        }
        model.setRecordingProfile(WebInspector.CanvasProfileType.TypeId, this._recording);
        return this._recording;
    },

    /**
     * @param {WebInspector.ProfilesModel} model
     */
    _runSingleFrameCapturing: function(model)
    {
        var frameId = this._selectedFrameId();
        CanvasAgent.captureFrame(frameId, this._didStartCapturingFrame.bind(this, model, frameId));
    },

    /**
     * @param {WebInspector.ProfilesModel} model
     */
    _startFrameCapturing: function(model)
    {
        var frameId = this._selectedFrameId();
        CanvasAgent.startCapturing(frameId, this._didStartCapturingFrame.bind(this, model, frameId));
    },

    _stopFrameCapturing: function()
    {
        if (!this._lastProfileHeader)
            return;
        var profileHeader = this._lastProfileHeader;
        var traceLogId = profileHeader.traceLogId();
        this._lastProfileHeader = null;
        function didStopCapturing()
        {
            profileHeader._updateCapturingStatus();
        }
        CanvasAgent.stopCapturing(traceLogId, didStopCapturing.bind(this));
    },

    /**
     * @param {WebInspector.ProfilesModel} model
     * @param {string|undefined} frameId
     * @param {?Protocol.Error} error
     * @param {CanvasAgent.TraceLogId} traceLogId
     */
    _didStartCapturingFrame: function(model, frameId, error, traceLogId)
    {
        if (error || this._lastProfileHeader && this._lastProfileHeader.traceLogId() === traceLogId)
            return;
        var profileHeader = new WebInspector.CanvasProfileHeader(this, WebInspector.UIString("Trace Log %d", this._nextProfileUid), this._nextProfileUid, traceLogId, frameId);
        ++this._nextProfileUid;
        this._lastProfileHeader = profileHeader;
        model.addProfileHeader(profileHeader);
        profileHeader._updateCapturingStatus();
    },

    get treeItemTitle()
    {
        return WebInspector.UIString("CANVAS PROFILE");
    },

    get description()
    {
        return WebInspector.UIString("Canvas calls instrumentation");
    },

    /**
     * @override
     * @return {Element}
     */
    decorationElement: function()
    {
        return this._decorationElement;
    },

    /**
     * @override
     */
    reset: function()
    {
        this._nextProfileUid = 1;
    },

    setRecordingProfile: function(isProfiling)
    {
        this._recording = isProfiling;
    },

    /**
     * @override
     * @param {string=} title
     * @return {WebInspector.ProfileHeader}
     */
    createTemporaryProfile: function(title)
    {
        title = title || WebInspector.UIString("Capturing\u2026");
        return new WebInspector.CanvasProfileHeader(this, title);
    },

    /**
     * @override
     * @param {ProfilerAgent.ProfileHeader} profile
     * @return {WebInspector.ProfileHeader}
     */
    createProfile: function(profile)
    {
        return new WebInspector.CanvasProfileHeader(this, profile.title, -1);
    },

    _updateDecorationElement: function()
    {
        /**
         * @param {?Protocol.Error} error
         * @param {boolean} result
         */
        function callback(error, result)
        {
            var hideWarning = (error || !result);
            this._decorationElement.enableStyleClass("hidden", hideWarning);
        }
        CanvasAgent.hasUninstrumentedCanvases(callback.bind(this));
    },

    /**
     * @param {MouseEvent} event
     */
    _onReloadPageButtonClick: function(event)
    {
        PageAgent.reload(event.shiftKey);
    },

    /**
     * @return {boolean}
     */
    _isSingleFrameMode: function()
    {
        return !this._capturingModeSelector.selectedOption().value;
    },

    /**
     * @param {WebInspector.Event} event
     */
    _frameAdded: function(event)
    {
        var contextList = /** @type {WebInspector.FrameExecutionContextList} */ (event.data);
        this._addFrame(contextList);
    },

    /**
     * @param {WebInspector.FrameExecutionContextList} contextList
     */
    _addFrame: function(contextList)
    {
        var frameId = contextList.frameId;
        var option = document.createElement("option");
        option.text = contextList.displayName;
        option.title = contextList.url;
        option.value = frameId;

        this._frameOptions[frameId] = option;

        if (this._framesWithCanvases[frameId]) {
            this._frameSelector.addOption(option);
            this._dispatchViewUpdatedEvent();
        }
    },

    /**
     * @param {WebInspector.Event} event
     */
    _frameRemoved: function(event)
    {
        var contextList = /** @type {WebInspector.FrameExecutionContextList} */ (event.data);
        var frameId = contextList.frameId;
        var option = this._frameOptions[frameId];
        if (option && this._framesWithCanvases[frameId]) {
            this._frameSelector.removeOption(option);
            this._dispatchViewUpdatedEvent();
        }
        delete this._frameOptions[frameId];
        delete this._framesWithCanvases[frameId];
    },

    /**
     * @param {string} frameId
     */
    _contextCreated: function(frameId)
    {
        if (this._framesWithCanvases[frameId])
            return;
        this._framesWithCanvases[frameId] = true;
        var option = this._frameOptions[frameId];
        if (option) {
            this._frameSelector.addOption(option);
            this._dispatchViewUpdatedEvent();
        }
    },

    /**
     * @param {NetworkAgent.FrameId=} frameId
     * @param {CanvasAgent.TraceLogId=} traceLogId
     */
    _traceLogsRemoved: function(frameId, traceLogId)
    {
        var sidebarElementsToDelete = [];
        var sidebarElements = /** @type {!Array.<WebInspector.ProfileSidebarTreeElement>} */ ((this.treeElement && this.treeElement.children) || []);
        for (var i = 0, n = sidebarElements.length; i < n; ++i) {
            var header = /** @type {WebInspector.CanvasProfileHeader} */ (sidebarElements[i].profile);
            if (!header)
                continue;
            if (frameId && frameId !== header.frameId())
                continue;
            if (traceLogId && traceLogId !== header.traceLogId())
                continue;
            sidebarElementsToDelete.push(sidebarElements[i]);
        }
        for (var i = 0, n = sidebarElementsToDelete.length; i < n; ++i)
            sidebarElementsToDelete[i].ondelete();
    },

    /**
     * @return {string|undefined}
     */
    _selectedFrameId: function()
    {
        var option = this._frameSelector.selectedOption();
        return option ? option.value : undefined;
    },

    _dispatchViewUpdatedEvent: function()
    {
        this._frameSelector.element.enableStyleClass("hidden", this._frameSelector.size() <= 1);
        this.dispatchEventToListeners(WebInspector.ProfileType.Events.ViewUpdated);
    },

    __proto__: WebInspector.ProfileType.prototype
}

/**
 * @constructor
 * @implements {CanvasAgent.Dispatcher}
 * @param {WebInspector.CanvasProfileType} profileType
 */
WebInspector.CanvasDispatcher = function(profileType)
{
    this._profileType = profileType;
    InspectorBackend.registerCanvasDispatcher(this);
}

WebInspector.CanvasDispatcher.prototype = {
    /**
     * @param {string} frameId
     */
    contextCreated: function(frameId)
    {
        this._profileType._contextCreated(frameId);
    },

    /**
     * @param {NetworkAgent.FrameId=} frameId
     * @param {CanvasAgent.TraceLogId=} traceLogId
     */
    traceLogsRemoved: function(frameId, traceLogId)
    {
        this._profileType._traceLogsRemoved(frameId, traceLogId);
    }
}

/**
 * @constructor
 * @extends {WebInspector.ProfileHeader}
 * @param {!WebInspector.CanvasProfileType} type
 * @param {string} title
 * @param {number=} uid
 * @param {CanvasAgent.TraceLogId=} traceLogId
 * @param {NetworkAgent.FrameId=} frameId
 */
WebInspector.CanvasProfileHeader = function(type, title, uid, traceLogId, frameId)
{
    WebInspector.ProfileHeader.call(this, type, title, uid);
    /** @type {CanvasAgent.TraceLogId} */
    this._traceLogId = traceLogId || "";
    this._frameId = frameId;
    this._alive = true;
    this._traceLogSize = 0;
}

WebInspector.CanvasProfileHeader.prototype = {
    /**
     * @return {CanvasAgent.TraceLogId}
     */
    traceLogId: function()
    {
        return this._traceLogId;
    },

    /**
     * @return {NetworkAgent.FrameId|undefined}
     */
    frameId: function()
    {
        return this._frameId;
    },

    /**
     * @override
     * @return {WebInspector.ProfileSidebarTreeElement}
     */
    createSidebarTreeElement: function()
    {
        return new WebInspector.ProfileSidebarTreeElement(this, WebInspector.UIString("Trace Log %d"), "profile-sidebar-tree-item");
    },

    /**
     * @override
     * @param {WebInspector.ProfilesPanel} profilesPanel
     */
    createView: function(profilesPanel)
    {
        return new WebInspector.CanvasProfileView(this);
    },

    /**
     * @override
     * @param {WebInspector.ProfilesModel} model
     */
    dispose: function(model)
    {
        if (this._traceLogId) {
            CanvasAgent.dropTraceLog(this._traceLogId);
            clearTimeout(this._requestStatusTimer);
            if (this._alive)
                model.setRecordingProfile(WebInspector.CanvasProfileType.TypeId, false);
            this._alive = false;
        }
    },

    /**
     * @param {CanvasAgent.TraceLog=} traceLog
     */
    _updateCapturingStatus: function(traceLog)
    {
        if (!this.sidebarElement || !this._traceLogId)
            return;

        if (traceLog) {
            this._alive = traceLog.alive;
            this._traceLogSize = traceLog.totalAvailableCalls;
        }

        this.sidebarElement.subtitle = this._alive ? WebInspector.UIString("Capturing\u2026 %d calls", this._traceLogSize) : WebInspector.UIString("Captured %d calls", this._traceLogSize);
        this.sidebarElement.wait = this._alive;

        if (this._alive) {
            clearTimeout(this._requestStatusTimer);
            this._requestStatusTimer = setTimeout(this._requestCapturingStatus.bind(this), WebInspector.CanvasProfileView.TraceLogPollingInterval);
        }
    },

    _requestCapturingStatus: function()
    {
        /**
         * @param {?Protocol.Error} error
         * @param {CanvasAgent.TraceLog} traceLog
         */
        function didReceiveTraceLog(error, traceLog)
        {
            if (error)
                return;
            this._alive = traceLog.alive;
            this._traceLogSize = traceLog.totalAvailableCalls;
            this._updateCapturingStatus();
        }
        CanvasAgent.getTraceLog(this._traceLogId, 0, 0, didReceiveTraceLog.bind(this));
    },

    __proto__: WebInspector.ProfileHeader.prototype
}
