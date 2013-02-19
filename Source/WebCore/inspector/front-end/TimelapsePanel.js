/**
 * @constructor
 * @extends {WebInspector.Panel}
 */
WebInspector.TimelapsePanel = function()
{
    WebInspector.Panel.call(this, "timelapse");
    this.registerRequiredCSS("timelapsePanel.css");

    this.createSidebarViewWithTree();

    this._model = WebInspector.timelapseModel;
    this._model.addEventListener(WebInspector.TimelapseModel.Events.CaptureDidStart, this._captureDidStart, this);
    this._model.addEventListener(WebInspector.TimelapseModel.Events.CaptureDidStop, this._captureDidStop, this);

    this._registerShortcuts();
};

WebInspector.TimelapsePanel.prototype = {
    get toolbarItemLabel()
    {
        return WebInspector.UIString("Timelapse");
    },

    _captureDidStart: function()
    {
        WebInspector.Panel.prototype.reset.call(this);
        this.searchCanceled();
        
        if (this._dataGrid) {
            this._dataGrid.detach();
            this._dataGrid.dispose();
            delete this._dataGrid;
        }
    },

    _captureDidStop: function()
    {
        this.searchCanceled();
      
        this._dataGrid = new WebInspector.TimelapseGrid(this._model, this._model.activeRecording);
        this._dataGrid.show(this.splitView.sidebarElement);
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
    var section = WebInspector.shortcutsScreen.section(WebInspector.UIString("Timelapse Panel"));
    section.addRelatedKeys(keys, WebInspector.UIString("Replay to previous/next input"));
    },
};

WebInspector.TimelapsePanel.prototype.__proto__ = WebInspector.Panel.prototype;
