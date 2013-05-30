/*
 *  Copyright (C) 2013, Brian Burg.
 *  Copyright (C) 2013, University of Washington. All rights reserved.
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
 * @extends {WebInspector.Panel}
 * @implements {WebInspector.ContextMenu.Provider}
 */
WebInspector.RecordingsPanel = function()
{
    WebInspector.Panel.call(this, "recordings");
    WebInspector.RecordingsPanel._instance = this;
    this.registerRequiredCSS("recordingsPanel.css");

    this._replayModel = WebInspector.replayModel;
    this._recordingsModel = WebInspector.recordingsModel;
    this._callbacks = new WebInspector.EventListenerGroup(this, "recordings panel static listeners");
    var replayEvents = WebInspector.ReplayModel.Events;
    var recordingsEvents = WebInspector.RecordingsModel.Events;
    this._callbacks.register(this._replayModel, replayEvents.RecordingLoaded,   this._recordingLoaded);
    this._callbacks.register(this._replayModel, replayEvents.RecordingUnloaded, this._recordingUnloaded);
    this._callbacks.register(this._replayModel, replayEvents.CaptureDidStart,   this._captureStarted);
    this._callbacks.register(this._replayModel, replayEvents.CaptureDidStop,    this._captureStopped);
    this._callbacks.register(this._replayModel, replayEvents.PlaybackDidStart,  this._playbackStarted);
    this._callbacks.register(this._replayModel, replayEvents.InputPaused,       this._playbackPaused);
    this._callbacks.register(this._replayModel, replayEvents.DebuggerPaused,    this._playbackPaused);
    this._callbacks.register(this._replayModel, replayEvents.PlaybackStopped,   this._playbackStopped);
    this._callbacks.register(this._recordingsModel, recordingsEvents.RecordingAdded,   this._recordingAdded);
    this._callbacks.register(this._recordingsModel, recordingsEvents.RecordingRemoved, this._recordingRemoved);
    this._callbacks.register(this.element, "contextmenu", this._handlePanelContextMenuEvent);
    this._callbacks.install();

    this._viewsByUID = {};
    this._treeElementsByUID = {};

    this._registerShortcuts();
    this.createSidebarViewWithTree(this.element, undefined, 220);
    this.landingItemTreeElement = new WebInspector.RecordingsSidebarTreeElement(this);
    this.sidebarTree.appendChild(this.landingItemTreeElement);
    this.capturingItemTreeElement = new WebInspector.SidebarTreeElement("recording-capturing-sidebar-tree-item",
                                                                        WebInspector.UIString("Capturing..."),
                                                                        "", null, false);
    var sidebarGroup = new WebInspector.SidebarSectionTreeElement(WebInspector.UIString("AVAILABLE RECORDINGS"), null, true);
    this.sidebarTree.appendChild(sidebarGroup);

    if (this._replayModel.isCapturing)
        this.sidebarTree.appendChild(this.capturingItemTreeElement);

    WebInspector.ContextMenu.registerProvider(this);
    this._createFileSelectorElement();

    this._landingView = new WebInspector.RecordingsPanel.LandingView(this._replayModel);
    this.showLandingView();

    var recordings = WebInspector.recordingsModel.recordings;
    for (var i = 0; i < recordings.length; ++i)
        this._recordingAdded({data: recordings[i]});
    
    if (this._replayModel.canReplay)
        this._recordingLoaded();
};

WebInspector.RecordingsPanel.prototype = {
    _handlePanelContextMenuEvent: function(event)
    {
        var contextMenu = new WebInspector.ContextMenu(event);
        contextMenu.appendApplicableItems();
        contextMenu.show();
    },

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
        this._recordingsModel.loadFromFile(file);
        this._createFileSelectorElement();
    },

    willDispose: function()
    {
        this._callbacks.uninstall(true);
    },

    get toolbarItemLabel()
    {
        return WebInspector.UIString("Recordings");
    },

    get activeView()
    {
        return this._activeView;
    },
    
    set activeView(newView)
    {
        console.assert(newView, "Tried to set active recordings panel view to nothing.");
        var oldView = this._activeView;
        if (oldView)
            oldView.detach();
        this._activeView = newView;
        newView.show(this.splitView.mainElement);
        
        if (newView === this._landingView) {
            this.sidebarTree.selected = false;
            return;
        }
            
        var treeItem = this._treeElementsByUID[newView.recording.uid];
        treeItem._suppressOnSelect = true;
        treeItem.revealAndSelect();
        delete treeItem._suppressOnSelect;
    },

    showLandingView: function()
    {
        this.activeView = this._landingView;
    },

    showRecording: function(recording)
    {
        var view = this._viewsByUID[recording.uid];
        this.activeView = view;
    },
    
    _recordingUnloaded: function(event)
    {
        var recording = event.data;
    
        this.searchCanceled();
        this.sidebarTree.selected = false;
        if (recording)
            this._treeElementsByUID[recording.uid]._listItemNode.removeStyleClass("loaded");
    },

    _recordingLoaded: function()
    {
        this.searchCanceled();
        var recording = this._replayModel.loadedRecording;
        this.showRecording(recording);
        this._treeElementsByUID[recording.uid]._listItemNode.addStyleClass("loaded");
    },

    _captureStarted: function()
    {
        this.sidebarTree.appendChild(this.capturingItemTreeElement);
    },
    
    _captureStopped: function()
    {
        this.sidebarTree.removeChild(this.capturingItemTreeElement);
    },

    _playbackStarted: function()
    {
        var recording = this._replayModel.loadedRecording;
        var treeItem = this._treeElementsByUID[recording.uid]._listItemNode;
        treeItem.addStyleClass("replaying");
        treeItem.removeStyleClass("paused");
    },
    
    _playbackPaused: function()
    {
        var recording = this._replayModel.loadedRecording;
        var treeItem = this._treeElementsByUID[recording.uid]._listItemNode;
        treeItem.removeStyleClass("replaying");
        treeItem.addStyleClass("paused");
    },
    
    _playbackStopped: function()
    {
        var recording = this._replayModel.loadedRecording;
        var treeItem = this._treeElementsByUID[recording.uid]._listItemNode;
        treeItem.removeStyleClass("replaying");
        treeItem.removeStyleClass("paused");
    },

    _recordingAdded: function(event)
    {
        var recording = event.data;
        console.assert(!this._viewsByUID[recording.uid], "already have view for this uid");

        var view = new WebInspector.RecordingInputsGrid(this._replayModel, recording);
        this._viewsByUID[recording.uid] = view;
        var treeItem = new WebInspector.RecordingSidebarTreeElement(recording, "recording-sidebar-tree-item");
        this._treeElementsByUID[recording.uid] = treeItem;

        if (!this._recordingsModel.recordings.length) {
            this.element.addStyleClass("recordings-available");
            this.element.removeStyleClass("recordings-unavailable");
        }
        
        this.sidebarTree.appendChild(treeItem);
    },

    _recordingRemoved: function(event)
    {
        var recording = event.data;
        var view = this._viewsByUID[recording.uid];
        if (!view)
            return;

        delete this._viewsByUID[recording.uid];
        var treeItem = this._treeElementsByUID[recording.uid];
        delete this._treeElementsByUID[recording.uid];
        if (treeItem.selected)
            this.sidebarTree.selected = false;
        this.sidebarTree.removeChild(treeItem);
        if (!this._recordingsModel.recordings.length) {
            this.element.addStyleClass("recordings-available");
            this.element.removeStyleClass("recordings-unavailable");
        }

        // if we were staring at view for this recording, show landing view.
        if (view === this.activeView)
            this.showLandingView();

        view.dispose();
    },

    _registerShortcuts: function()
    {
        // Next/previous input.
        var handlerPrev = function() {
            if (!this._replayModel.inputPaused) return;
            var grid = this._dataGrid;
            grid.replayToPreviousNode.call(grid);
        };
        var handlerNext = function() {
            if (!this._replayModel.inputPaused) return;
            var grid = this._dataGrid;
            grid.replayToNextNode.call(grid);
        };

        var shortcut = WebInspector.KeyboardShortcut;
        var shortcutPrev = shortcut.makeDescriptor("P", shortcut.Modifiers.Alt);
        var shortcutNext = shortcut.makeDescriptor("N", shortcut.Modifiers.Alt);
        this.registerShortcuts(shortcutPrev, handlerPrev.bind(this));
        this.registerShortcuts(shortcutNext, handlerNext.bind(this));

        var keys = [shortcutPrev, shortcutNext];
        var section = WebInspector.shortcutsScreen.section(WebInspector.UIString("Recordings Panel"));
        section.addRelatedKeys(keys, WebInspector.UIString("Replay to previous/next input"));
    },

     /**
     * @param {WebInspector.ContextMenu} contextMenu
     * @param {Object} target
     */
    appendApplicableItems: function(event, contextMenu, target)
    {
        if (WebInspector.inspectorView.currentPanel() != this)
            return;

        contextMenu.appendItem(WebInspector.UIString("Load Recording\u2026"),
                               this._fileSelectorElement.click.bind(this._fileSelectorElement));
        contextMenu.appendSeparator();

        if (!(target instanceof WebInspector.ReplayRecording))
            return;

        var recording = target;
        contextMenu.appendItem(WebInspector.UIString("Save Recording\u2026"),
                               this._recordingsModel.saveToFile.bind(this._recordingsModel, recording));
        contextMenu.appendItem(WebInspector.UIString("Delete Recording"),
                               this._recordingsModel.removeRecording.bind(this._recordingsModel, recording));

    },

    __proto__: WebInspector.Panel.prototype
};


WebInspector.RecordingsPanel.LandingView = function(model)
{
    WebInspector.View.call(this);

    this.element = document.createElement("div");
    this.element.addStyleClass("landing-view");
    
    this._replayModel = model;

    /*var instructions = [];
    var selectRecording = document.createElement("p");
    selectRecording.textContent = WebInspector.UIString("Select a recording to view.");
    selectRecording.addStyleClass("recording-available-text");
    instructions.push(selectRecording);
    
    var createRecording = document.createElement("p");
    createRecording.addStyleClass("recording-unavailable-text");
    createRecording.appendChild(document.createTextNode(WebInspector.UIString("No recordings available.")));
    var createRecordingAnchor = document.createElement("span");
    createRecordingAnchor.textContent = WebInspector.UIString("Click to create a recording.");
    this._callbacks.register(createRecordingAnchor, "click", this._createRecordingAnchorClicked);
    createRecording.appendChild(createRecordingAnchor);
    instructions.push(createRecording);
    
    for (var i = 0; i < instructions.length; ++i)
        this.element.appendChild(instructions[i]);*/
    
    this._messagePanel = document.createElement("p");
    this._messagePanel.className = "recording-landing-view-message";
    
    var recordings = WebInspector.recordingsModel.recordings;
    if(recordings.length > 0) {
        this._messagePanel.textContent = "Select a recording to view. Click to create a recording.";
    } else {
        this._messagePanel.textContent = "No recordings available. Click to create a recording.";
    }
    
    var replayEvents = WebInspector.ReplayModel.Events;
    this._callbacks = new WebInspector.EventListenerGroup(this, "recordings panel landing view listeners");
    this._callbacks.register(this._messagePanel, "click", this._createRecordingAnchorClicked);
    this._callbacks.install();
    
    this.element.appendChild(this._messagePanel);
};

WebInspector.RecordingsPanel.LandingView.prototype = {
    willDispose: function()
    {
        this._callbacks.uninstall(true);
    },

    _createRecordingAnchorClicked: function(event)
    {
        var button = WebInspector._toggleReplayControllerButton;
        if (button.disabled)
            return;
        
        if (WebInspector._consoleWasShown) {
            delete WebInspector._consoleWasShown;
            WebInspector._toggleConsoleButton.toggled = false;
        }
        
        button.toggled = true;
        
        button.title = WebInspector.UIString("Hide Replay controller.");
        var animationType = window.event && window.event.shiftKey ? WebInspector.Drawer.AnimationType.Slow : WebInspector.Drawer.AnimationType.Normal;
        WebInspector.drawer.show(WebInspector.replayControllerView, animationType);
        WebInspector._replayWasShown = true;
        this._replayModel.startCapture();

    },

    __proto__: WebInspector.View.prototype,
};

/**
 * @constructor
 * @extends {WebInspector.SidebarTreeElement}
 * @param {!WebInspector.ReplayRecording} recording
 * @param {string} titleFormat
 * @param {string} className
 */
WebInspector.RecordingSidebarTreeElement = function(recording, className)
{
    this.recording = recording;
    var maintitle = this.recording.displayName();
    var subtitle = recording.dateCreated.toLocaleString();
    WebInspector.SidebarTreeElement.call(this, className, maintitle, subtitle, recording, false);
};

WebInspector.RecordingSidebarTreeElement.prototype = {
    onselect: function()
    {
        if (!this._suppressOnSelect)
            this.treeOutline.panel.showRecording(this.recording);
    },

    ondelete: function()
    {
        WebInspector.recordingsModel.removeRecording(this.recording);
        return true;
    },

    ondblclick: function()
    {
        var model = WebInspector.replayModel;
        if (!model.canReplay)
            return;
        if (model.loadedRecording === this.recording)
            return;
        
        model.scheduler.executeImmediately(model.switchRecordingTask(this.recording));
    },

    onattach: function()
    {
        WebInspector.SidebarTreeElement.prototype.onattach.call(this);
        this.listItemElement.addEventListener("contextmenu", this._handleTreeContextMenuEvent.bind(this), true);
    },

    /**
     * @param {!Event} event
     */
    _handleTreeContextMenuEvent: function(event)
    {
        var contextMenu = new WebInspector.ContextMenu(event);
        contextMenu.appendApplicableItems(this.recording);
        contextMenu.show();
    },

    __proto__: WebInspector.SidebarTreeElement.prototype
};

/**
 * @constructor
 * @extends {WebInspector.SidebarTreeElement}
 * @param {!WebInspector.RecordingsPanel} panel
 */
WebInspector.RecordingsSidebarTreeElement = function(panel)
{
    this._panel = panel;
    this.small = false;

    WebInspector.SidebarTreeElement.call(this, "recordings-landing-view-tree-item", WebInspector.UIString("Recordings"), "", null, false);
}

WebInspector.RecordingsSidebarTreeElement.prototype = {
    onselect: function()
    {
        this._panel.showLandingView();
    },

    get selectable()
    {
        return true;
    },

    __proto__: WebInspector.SidebarTreeElement.prototype
}
