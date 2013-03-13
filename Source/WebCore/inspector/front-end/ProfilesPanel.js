/*
 * Copyright (C) 2008 Apple Inc. All Rights Reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @constructor
 * @extends {WebInspector.Panel}
 * @implements {WebInspector.ContextMenu.Provider}
 */
WebInspector.ProfilesPanel = function()
{
    WebInspector.Panel.call(this, "profiles");
    WebInspector.ProfilesPanel._instance = this;
    this.registerRequiredCSS("panelEnablerView.css");
    this.registerRequiredCSS("heapProfiler.css");
    this.registerRequiredCSS("profilesPanel.css");

    this._model = WebInspector.profilesModel;

    this.createSidebarViewWithTree();

    this.profilesItemTreeElement = new WebInspector.ProfilesSidebarTreeElement(this);
    this.sidebarTree.appendChild(this.profilesItemTreeElement);

    var panelEnablerHeading = WebInspector.UIString("You need to enable profiling before you can use the Profiles panel.");
    var panelEnablerDisclaimer = WebInspector.UIString("Enabling profiling will make scripts run slower.");
    var panelEnablerButton = WebInspector.UIString("Enable Profiling");
    this.panelEnablerView = new WebInspector.PanelEnablerView("profiles", panelEnablerHeading, panelEnablerDisclaimer, panelEnablerButton);
    this.panelEnablerView.addEventListener("enable clicked", function() {
        this._model.toggleProfiling(this.panelEnablerView.alwaysEnabled);
    }, this);

    this.profileViews = document.createElement("div");
    this.profileViews.id = "profile-views";
    this.splitView.mainElement.appendChild(this.profileViews);

    this._statusBarButtons = [];

    this.enableToggleButton = new WebInspector.StatusBarButton("", "enable-toggle-status-bar-item");
    if (Capabilities.profilerCausesRecompilation) {
        this._statusBarButtons.push(this.enableToggleButton);
        this.enableToggleButton.addEventListener("click", this._onToggleProfiling, this);
    }
    this.recordButton = new WebInspector.StatusBarButton("", "record-profile-status-bar-item");
    this.recordButton.addEventListener("click", this.toggleRecordButton, this);
    this._statusBarButtons.push(this.recordButton);

    this.clearResultsButton = new WebInspector.StatusBarButton(WebInspector.UIString("Clear all profiles."), "clear-status-bar-item");
    this.clearResultsButton.addEventListener("click", this._model.clearProfiles.bind(this._model, true));
    this._statusBarButtons.push(this.clearResultsButton);

    if (WebInspector.experimentsSettings.liveNativeMemoryChart.isEnabled()) {
        this.garbageCollectButton = new WebInspector.StatusBarButton(WebInspector.UIString("Collect Garbage"), "garbage-collect-status-bar-item");
        this.garbageCollectButton.addEventListener("click", this._garbageCollectButtonClicked, this);
        this._statusBarButtons.push(this.garbageCollectButton);
    }

    this._profileTypeStatusBarItemsContainer = document.createElement("div");
    this._profileTypeStatusBarItemsContainer.className = "status-bar-items";

    this._profileViewStatusBarItemsContainer = document.createElement("div");
    this._profileViewStatusBarItemsContainer.className = "status-bar-items";

    this.recordButton.toggled = false;

    this._launcherView = new WebInspector.ProfileLauncherView(this);
    this._launcherView.addEventListener(WebInspector.ProfileLauncherView.EventTypes.ProfileTypeSelected, this._onProfileTypeSelected, this);

    this._createFileSelectorElement();
    this.element.addEventListener("contextmenu", this._handleContextMenuEvent.bind(this), true);

    WebInspector.ContextMenu.registerProvider(this);

    this._model.addEventListener(WebInspector.ProfilesModel.Events.ProfileAdded, this._profileAdded, this);
    this._model.addEventListener(WebInspector.ProfilesModel.Events.ProfileRemoved, this._profileRemoved, this);
    this._model.addEventListener(WebInspector.ProfilesModel.Events.CaptureStarted, this._captureStarted, this);
    this._model.addEventListener(WebInspector.ProfilesModel.Events.CaptureFinished, this._captureFinished, this);
    this._model.addEventListener(WebInspector.ProfilesModel.Events.ProfileTypeAdded, this._profileTypeAdded, this);
    this._model.addEventListener(WebInspector.ProfilesModel.Events.ProfilerEnabled, this._profilerEnabled, this);
    this._model.addEventListener(WebInspector.ProfilesModel.Events.ProfilerDisabled, this._profilerDisabled, this);
    
    this._updateEnablementStatus();
    
    // add already-existing profile types.
    var profileTypes = this._model.getProfileTypes();
    for (var i = 0; i < profileTypes.length; ++i) {
        this._profileTypeAdded({ data: profileTypes[i] });
    
        // add already-existing profiles.
        var profiles = this._model.getProfiles(profileTypes[i].id);
        for (var j = 0; j < profiles.length; ++j)
            this._profileAdded({ data: profiles[j] });
    }
}

WebInspector.ProfilesPanel.prototype = {
    _createFileSelectorElement: function()
    {
        if (this._fileSelectorElement)
            this.element.removeChild(this._fileSelectorElement);
        this._fileSelectorElement = WebInspector.createFileSelectorElement(this._loadFromFile.bind(this));
        this.element.appendChild(this._fileSelectorElement);
    },

    /**
     * @param {!File} file
     */
    _loadFromFile: function(file)
    {
        if (!file.name.endsWith(".heapsnapshot")) {
            WebInspector.log(WebInspector.UIString("Only heap snapshots from files with extension '.heapsnapshot' can be loaded."));
            return;
        }

        if (!!this._model.findTemporaryProfile(WebInspector.HeapSnapshotProfileType.TypeId)) {
            WebInspector.log(WebInspector.UIString("Can't load profile when other profile is recording."));
            return;
        }

        var profileType = this._model.getProfileType(WebInspector.HeapSnapshotProfileType.TypeId);
        var temporaryProfile = profileType.createTemporaryProfile(UserInitiatedProfileName + "." + file.name);
        this._model.addProfileHeader(temporaryProfile);

        temporaryProfile._fromFile = true;
        temporaryProfile.loadFromFile(file);
        this._createFileSelectorElement();
    },

    get statusBarItems()
    {
        return this._statusBarButtons.select("element").concat(this._profileTypeStatusBarItemsContainer, this._profileViewStatusBarItemsContainer);
    },

    toggleRecordButton: function()
    {
        var isProfiling = this._selectedProfileType.buttonClicked(this._model);
        this.recordButton.toggled = isProfiling;
        this.recordButton.title = this._selectedProfileType.buttonTooltip;
    },

    wasShown: function()
    {
        WebInspector.Panel.prototype.wasShown.call(this);
    },

    _profileAdded: function(event)
    {
        var profile = event.data;

        var profileType = profile.profileType();
        var sidebarParent = profileType.treeElement;
        sidebarParent.hidden = false;

        var profileTreeElement = profile.createSidebarTreeElement();
        profile.sidebarElement = profileTreeElement;
        profile._profilesTreeElement = profileTreeElement;
        sidebarParent.appendChild(profileTreeElement);
        
        if (!this.visibleView && !profile.isTemporary)
            this.showProfile(profile);
    },

    _profileRemoved: function(event)
    {
        var profile = event.data;
        var sidebarParent = profile.profileType().treeElement;
        
        sidebarParent.removeChild(profile._profilesTreeElement);
        // No other item will be selected if there aren't any other profiles, so
        // make sure that view gets cleared when the last profile is removed.
        if (!sidebarParent.children.length) {
            this.profilesItemTreeElement.select();
            this._showLauncherView();
            sidebarParent.hidden = true;
            
            if (this._selectedProfileType)
                this.recordButton.title = this._selectedProfileType.buttonTooltip;
            this._launcherView.profileFinished();
            this.sidebarTreeElement.removeStyleClass("some-expandable");
        }
        
        var view = profile.existingView();
        if (view) {
            view.detach();
            if ("dispose" in view)
                view.dispose();
        }
        
        // FIXME: re-perform the search once profiles are pruned.
        delete this.currentQuery;
        this.searchCanceled();

    },

    _captureStarted: function(event)
    {
        var profileTypeObject = event.data;
        this.recordButton.toggled = true;
        this.recordButton.title = profileTypeObject.buttonTooltip;
        this._launcherView.profileStarted();
    },

    _captureFinished: function(event)
    {
        var profileTypeObject = event.data;
        this.recordButton.toggled = false;
        this.recordButton.title = profileTypeObject.buttonTooltip;
        this._launcherView.profileFinished();
    },

    _profileTypeAdded: function(event)
    {
        var profileType = event.data;
        
        this._launcherView.addProfileType(profileType);
        profileType.treeElement = new WebInspector.SidebarSectionTreeElement(profileType.treeItemTitle, null, true);
        profileType.treeElement.hidden = true;
        this.sidebarTree.appendChild(profileType.treeElement);
        profileType.treeElement.childrenListElement.addEventListener("contextmenu", this._handleContextMenuEvent.bind(this), true);
        profileType.addEventListener(WebInspector.ProfileType.Events.ViewUpdated, this._updateProfileTypeSpecificUI, this);
    },

    _profilerEnabled: function()
    {
        this._updateEnablementStatus();
        this._showLauncherView();
    },

    _profilerDisabled: function()
    {
        this._updateEnablementStatus();
    },

    _heapSnapshotProgress: function(event)
    {
        var done = event.done || 0;
        var total = event.total || 0;
    
        var temporaryProfile = this._model.findTemporaryProfile(WebInspector.HeapSnapshotProfileType.TypeId);
        if (temporaryProfile) {
            temporaryProfile.sidebarElement.subtitle = WebInspector.UIString("%.2f%", (done / total) * 100);
            temporaryProfile.sidebarElement.wait = true;
            if (done >= total)
                this._model.removeProfileHeader(temporaryProfile);
        }
    },

    /**
     * @param {WebInspector.Event} event
     */
    _onProfileTypeSelected: function(event)
    {
        this._selectedProfileType = /** @type {!WebInspector.ProfileType} */ (event.data);
        this._updateProfileTypeSpecificUI();
    },

    _updateProfileTypeSpecificUI: function()
    {
        this.recordButton.title = this._selectedProfileType.buttonTooltip;

        this._profileTypeStatusBarItemsContainer.removeChildren();
        var statusBarItems = this._selectedProfileType.statusBarItems;
        if (statusBarItems) {
            for (var i = 0; i < statusBarItems.length; ++i)
                this._profileTypeStatusBarItemsContainer.appendChild(statusBarItems[i]);
        }
        this._resize(this.splitView.sidebarWidth());
    },

    _showLauncherView: function()
    {
        this.closeVisibleView();
        this._profileViewStatusBarItemsContainer.removeChildren();
        this._launcherView.show(this.splitView.mainElement);
        this.visibleView = this._launcherView;
        this.profilesItemTreeElement.select();
    },

    _garbageCollectButtonClicked: function()
    {
        HeapProfilerAgent.collectGarbage();
    },

    /**
     * @param {Event} event
     */
    _handleContextMenuEvent: function(event)
    {
        var element = event.srcElement;
        while (element && !element.treeElement && element !== this.element)
            element = element.parentElement;
        if (!element)
            return;
        if (element.treeElement && element.treeElement.handleContextMenuEvent) {
            element.treeElement.handleContextMenuEvent(event);
            return;
        }
        if (element !== this.element || event.srcElement === this.sidebarElement) {
            var contextMenu = new WebInspector.ContextMenu(event);
            if (this.visibleView instanceof WebInspector.HeapSnapshotView)
                this.visibleView.populateContextMenu(contextMenu, event);
            contextMenu.appendItem(WebInspector.UIString("Load Heap Snapshot\u2026"), this._fileSelectorElement.click.bind(this._fileSelectorElement));
            contextMenu.show();
        }
    },

    /**
     * @param {WebInspector.ProfileHeader} profile
     */
    showProfile: function(profile)
    {
        if (!profile || profile.isTemporary)
            return;

        var view = profile.view();
        if (view === this.visibleView)
            return;

        this.closeVisibleView();

        view.show(this.profileViews);

        profile._profilesTreeElement._suppressOnSelect = true;
        profile._profilesTreeElement.revealAndSelect();
        delete profile._profilesTreeElement._suppressOnSelect;

        this.visibleView = view;

        this._profileViewStatusBarItemsContainer.removeChildren();

        var statusBarItems = view.statusBarItems;
        if (statusBarItems)
            for (var i = 0; i < statusBarItems.length; ++i)
                this._profileViewStatusBarItemsContainer.appendChild(statusBarItems[i]);
    },

    /**
     * @param {HeapProfilerAgent.HeapSnapshotObjectId} snapshotObjectId
     * @param {string} viewName
     */
    showObject: function(snapshotObjectId, viewName)
    {
        var heapProfiles = this._model.getProfiles(WebInspector.HeapSnapshotProfileType.TypeId);
        for (var i = 0; i < heapProfiles.length; i++) {
            var profile = heapProfiles[i];
            // TODO: allow to choose snapshot if there are several options.
            if (profile.maxJSObjectId >= snapshotObjectId) {
                this.showProfile(profile);
                profile.view().changeView(viewName, function() {
                    profile.view().dataGrid.highlightObjectByHeapSnapshotId(snapshotObjectId);
                });
                break;
            }
        }
    },

    /**
     * @param {WebInspector.View} view
     */
    showView: function(view)
    {
        this.showProfile(view.profile);
    },

    /**
     * @param {string} url
     */
    showProfileForURL: function(url)
    {
        var profile = this._model.getProfileForURL(url);
        if (profile)
            this.showProfile(profile);
    },

    closeVisibleView: function()
    {
        if (this.visibleView)
            this.visibleView.detach();
        delete this.visibleView;
    },

    /**
     * @param {string} query
     */
    performSearch: function(query)
    {
        this.searchCanceled();

        var searchableViews = this._searchableViews();
        if (!searchableViews || !searchableViews.length)
            return;

        var visibleView = this.visibleView;

        var matchesCountUpdateTimeout = null;

        function updateMatchesCount()
        {
            WebInspector.searchController.updateSearchMatchesCount(this._totalSearchMatches, this);
            WebInspector.searchController.updateCurrentMatchIndex(this._currentSearchResultIndex, this);
            matchesCountUpdateTimeout = null;
        }

        function updateMatchesCountSoon()
        {
            if (matchesCountUpdateTimeout)
                return;
            // Update the matches count every half-second so it doesn't feel twitchy.
            matchesCountUpdateTimeout = setTimeout(updateMatchesCount.bind(this), 500);
        }

        function finishedCallback(view, searchMatches)
        {
            if (!searchMatches)
                return;

            this._totalSearchMatches += searchMatches;
            this._searchResults.push(view);

            if (this.searchMatchFound)
                this.searchMatchFound(view, searchMatches);

            updateMatchesCountSoon.call(this);

            if (view === visibleView)
                view.jumpToFirstSearchResult();
        }

        var i = 0;
        var panel = this;
        var boundFinishedCallback = finishedCallback.bind(this);
        var chunkIntervalIdentifier = null;

        // Split up the work into chunks so we don't block the
        // UI thread while processing.

        function processChunk()
        {
            var view = searchableViews[i];

            if (++i >= searchableViews.length) {
                if (panel._currentSearchChunkIntervalIdentifier === chunkIntervalIdentifier)
                    delete panel._currentSearchChunkIntervalIdentifier;
                clearInterval(chunkIntervalIdentifier);
            }

            if (!view)
                return;

            view.currentQuery = query;
            view.performSearch(query, boundFinishedCallback);
        }

        processChunk();

        chunkIntervalIdentifier = setInterval(processChunk, 25);
        this._currentSearchChunkIntervalIdentifier = chunkIntervalIdentifier;
    },

    jumpToNextSearchResult: function()
    {
        if (!this.showView || !this._searchResults || !this._searchResults.length)
            return;

        var showFirstResult = false;

        this._currentSearchResultIndex = this._searchResults.indexOf(this.visibleView);
        if (this._currentSearchResultIndex === -1) {
            this._currentSearchResultIndex = 0;
            showFirstResult = true;
        }

        var currentView = this._searchResults[this._currentSearchResultIndex];

        if (currentView.showingLastSearchResult()) {
            if (++this._currentSearchResultIndex >= this._searchResults.length)
                this._currentSearchResultIndex = 0;
            currentView = this._searchResults[this._currentSearchResultIndex];
            showFirstResult = true;
        }

        WebInspector.searchController.updateCurrentMatchIndex(this._currentSearchResultIndex, this);

        if (currentView !== this.visibleView) {
            this.showView(currentView);
            WebInspector.searchController.showSearchField();
        }

        if (showFirstResult)
            currentView.jumpToFirstSearchResult();
        else
            currentView.jumpToNextSearchResult();
    },

    jumpToPreviousSearchResult: function()
    {
        if (!this.showView || !this._searchResults || !this._searchResults.length)
            return;

        var showLastResult = false;

        this._currentSearchResultIndex = this._searchResults.indexOf(this.visibleView);
        if (this._currentSearchResultIndex === -1) {
            this._currentSearchResultIndex = 0;
            showLastResult = true;
        }

        var currentView = this._searchResults[this._currentSearchResultIndex];

        if (currentView.showingFirstSearchResult()) {
            if (--this._currentSearchResultIndex < 0)
                this._currentSearchResultIndex = (this._searchResults.length - 1);
            currentView = this._searchResults[this._currentSearchResultIndex];
            showLastResult = true;
        }

        WebInspector.searchController.updateCurrentMatchIndex(this._currentSearchResultIndex, this);

        if (currentView !== this.visibleView) {
            this.showView(currentView);
            WebInspector.searchController.showSearchField();
        }

        if (showLastResult)
            currentView.jumpToLastSearchResult();
        else
            currentView.jumpToPreviousSearchResult();
    },

    _searchableViews: function()
    {
        var views = [];

        const visibleView = this.visibleView;
        if (visibleView && visibleView.performSearch)
            views.push(visibleView);

        var profilesLength = this._profiles.length;
        for (var i = 0; i < profilesLength; ++i) {
            var profile = this._profiles[i];
            var view = profile.view();
            if (!view.performSearch || view === visibleView)
                continue;
            views.push(view);
        }

        return views;
    },

    searchMatchFound: function(view, matches)
    {
        view.profile._profilesTreeElement.searchMatches = matches;
    },

    searchCanceled: function()
    {
        if (this._searchResults) {
            for (var i = 0; i < this._searchResults.length; ++i) {
                var view = this._searchResults[i];
                if (view.searchCanceled)
                    view.searchCanceled();
                delete view.currentQuery;
            }
        }

        WebInspector.Panel.prototype.searchCanceled.call(this);

        if (this._currentSearchChunkIntervalIdentifier) {
            clearInterval(this._currentSearchChunkIntervalIdentifier);
            delete this._currentSearchChunkIntervalIdentifier;
        }

        this._totalSearchMatches = 0;
        this._currentSearchResultIndex = 0;
        this._searchResults = [];

        if (!this._profiles)
            return;

        for (var i = 0; i < this._profiles.length; ++i) {
            var profile = this._profiles[i];
            profile._profilesTreeElement.searchMatches = 0;
        }
    },

    _updateEnablementStatus: function()
    {
        // FIXME: Replace ProfileType-specific button visibility changes by a single ProfileType-agnostic "combo-button" visibility change.
        if (this._model.profilerEnabled) {
            this.enableToggleButton.title = WebInspector.UIString("Profiling enabled. Click to disable.");
            this.enableToggleButton.toggled = true;
            this.recordButton.visible = true;
            this._profileViewStatusBarItemsContainer.removeStyleClass("hidden");
            this.clearResultsButton.element.removeStyleClass("hidden");
            this.panelEnablerView.detach();
        } else {
            this.enableToggleButton.title = WebInspector.UIString("Profiling disabled. Click to enable.");
            this.enableToggleButton.toggled = false;
            this.recordButton.visible = false;
            this._profileViewStatusBarItemsContainer.addStyleClass("hidden");
            this.clearResultsButton.element.addStyleClass("hidden");
            this.panelEnablerView.show(this.element);
        }
    },

    /**
     * @param {WebInspector.Event} event
     */
    _onToggleProfiling: function(event) {
        this._model.toggleProfiling(true);
    },

    /**
     * @param {!WebInspector.Event} event
     */
    sidebarResized: function(event)
    {
        var sidebarWidth = /** @type {number} */ (event.data);
        this._resize(sidebarWidth);
    },

    onResize: function()
    {
        this._resize(this.splitView.sidebarWidth());
    },

    /**
     * @param {number} sidebarWidth
     */
    _resize: function(sidebarWidth)
    {
        var lastItemElement = this._statusBarButtons[this._statusBarButtons.length - 1].element;
        var left = lastItemElement.totalOffsetLeft() + lastItemElement.offsetWidth;
        this._profileTypeStatusBarItemsContainer.style.left = left + "px";
        left += this._profileTypeStatusBarItemsContainer.offsetWidth - 1;
        this._profileViewStatusBarItemsContainer.style.left = Math.max(left, sidebarWidth) + "px";
    },

    /** 
     * @param {WebInspector.ContextMenu} contextMenu
     * @param {Object} target
     */
    appendApplicableItems: function(event, contextMenu, target)
    {
        if (WebInspector.inspectorView.currentPanel() !== this)
            return;

        var object = /** @type {WebInspector.RemoteObject} */ (target);
        var objectId = object.objectId;
        if (!objectId)
            return;

        var heapProfiles = this._model.getProfiles(WebInspector.HeapSnapshotProfileType.TypeId);
        if (!heapProfiles.length)
            return;

        function revealInView(viewName)
        {
            HeapProfilerAgent.getHeapObjectId(objectId, didReceiveHeapObjectId.bind(this, viewName));
        }

        function didReceiveHeapObjectId(viewName, error, result)
        {
            if (WebInspector.inspectorView.currentPanel() !== this)
                return;
            if (!error)
                this.showObject(result, viewName);
        }

        contextMenu.appendItem(WebInspector.UIString("Reveal in Dominators View"), revealInView.bind(this, "Dominators"));
        contextMenu.appendItem(WebInspector.UIString("Reveal in Summary View"), revealInView.bind(this, "Summary"));
    },

    __proto__: WebInspector.Panel.prototype
}

/**
 * @constructor
 * @extends {WebInspector.SidebarTreeElement}
 * @param {!WebInspector.ProfileHeader} profile
 * @param {string} titleFormat
 * @param {string} className
 */
WebInspector.ProfileSidebarTreeElement = function(profile, className)
{
    this.profile = profile;

    WebInspector.SidebarTreeElement.call(this, className, "", "", profile, false);

    this.refreshTitles();
}

WebInspector.ProfileSidebarTreeElement.prototype = {
    onselect: function()
    {
        if (!this._suppressOnSelect)
            this.treeOutline.panel.showProfile(this.profile);
    },

    ondelete: function()
    {
        WebInspector.profilesModel.removeProfileHeader(this.profile);
        return true;
    },

    get mainTitle()
    {
        return this.profile.displayName();
    },

    set mainTitle(x)
    {
        this._mainTitle = x;
        this.refreshTitles();
    },

    set searchMatches(matches)
    {
        if (!matches) {
            if (!this.bubbleElement)
                return;
            this.bubbleElement.removeStyleClass("search-matches");
            this.bubbleText = "";
            return;
        }

        this.bubbleText = matches;
        this.bubbleElement.addStyleClass("search-matches");
    },

    /**
     * @param {!Event} event
     */
    handleContextMenuEvent: function(event)
    {
        var profile = this.profile;
        var contextMenu = new WebInspector.ContextMenu(event);
        var profilesPanel = WebInspector.ProfilesPanel._instance;
        // FIXME: use context menu provider
        if (profile.canSaveToFile()) {
            contextMenu.appendItem(WebInspector.UIString("Save Heap Snapshot\u2026"), profile.saveToFile.bind(profile));
            contextMenu.appendItem(WebInspector.UIString("Load Heap Snapshot\u2026"), profilesPanel._fileSelectorElement.click.bind(profilesPanel._fileSelectorElement));
            contextMenu.appendItem(WebInspector.UIString("Delete Heap Snapshot"), this.ondelete.bind(this));
        } else {
            contextMenu.appendItem(WebInspector.UIString("Load Heap Snapshot\u2026"), profilesPanel._fileSelectorElement.click.bind(profilesPanel._fileSelectorElement));
            contextMenu.appendItem(WebInspector.UIString("Delete profile"), this.ondelete.bind(this));
        }
        contextMenu.show();
    },

    __proto__: WebInspector.SidebarTreeElement.prototype
}

/**
 * @constructor
 * @extends {WebInspector.SidebarTreeElement}
 * @param {string} title
 * @param {string=} subtitle
 */
WebInspector.ProfileGroupSidebarTreeElement = function(title, subtitle)
{
    WebInspector.SidebarTreeElement.call(this, "profile-group-sidebar-tree-item", title, subtitle, null, true);
}

WebInspector.ProfileGroupSidebarTreeElement.prototype = {
    onselect: function()
    {
        if (this.children.length > 0)
            WebInspector.ProfilesPanel._instance.showProfile(this.children[this.children.length - 1].profile);
    },

    __proto__: WebInspector.SidebarTreeElement.prototype
}

/**
 * @constructor
 * @extends {WebInspector.SidebarTreeElement}
 * @param {!WebInspector.ProfilesPanel} panel
 */
WebInspector.ProfilesSidebarTreeElement = function(panel)
{
    this._panel = panel;
    this.small = false;

    WebInspector.SidebarTreeElement.call(this, "profile-launcher-view-tree-item", WebInspector.UIString("Profiles"), "", null, false);
}

WebInspector.ProfilesSidebarTreeElement.prototype = {
    onselect: function()
    {
        this._panel._showLauncherView();
    },

    get selectable()
    {
        return true;
    },

    __proto__: WebInspector.SidebarTreeElement.prototype
}

importScript("ProfileDataGridTree.js");
importScript("BottomUpProfileDataGridTree.js");
importScript("ProfileLauncherView.js");
importScript("TopDownProfileDataGridTree.js");
