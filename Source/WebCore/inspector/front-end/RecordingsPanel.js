/**
 * @constructor
 * @extends {WebInspector.Panel}
 */
WebInspector.RecordingsPanel = function()
{
    WebInspector.Panel.call(this, "recordings");
    this.registerRequiredCSS("recordingsPanel.css");

    this.createSidebarViewWithTree();

    this._model = WebInspector.timelapseModel;
    this._model.addEventListener(WebInspector.TimelapseModel.Events.RecordingUnloaded, this._recordingUnloaded, this);
    this._model.addEventListener(WebInspector.TimelapseModel.Events.RecordingLoaded, this._recordingLoaded, this);

    this._registerShortcuts();
};

WebInspector.RecordingsPanel.prototype = {
    get toolbarItemLabel()
    {
        return WebInspector.UIString("Recordings");
    },

    _recordingUnloaded: function()
    {
        WebInspector.Panel.prototype.reset.call(this);
        this.searchCanceled();
        
        if (this._dataGrid) {
            this._dataGrid.detach();
            this._dataGrid.dispose();
            delete this._dataGrid;
        }
    },

    _recordingLoaded: function()
    {
        this.searchCanceled();
      
        this._dataGrid = new WebInspector.TimelapseGrid(this._model, this._model.loadedRecording);
        this._dataGrid.show(this.splitView.mainElement);
    },

    _registerShortcuts: function()
    {
	// Next/previous input.
    var handlerPrev = function() {
	    if (!this._model.inputPaused) return;
	    var grid = this._dataGrid;
	    grid.replayToPreviousNode.call(grid);
	};
    var handlerNext = function() {
	    if (!this._model.inputPaused) return;
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
};

WebInspector.RecordingsPanel.prototype.__proto__ = WebInspector.Panel.prototype;
