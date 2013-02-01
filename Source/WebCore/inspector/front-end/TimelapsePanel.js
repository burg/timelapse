/**
 * @constructor
 * @extends {WebInspector.Panel}
 */
WebInspector.TimelapsePanel = function()
{
    WebInspector.Panel.call(this, "timelapse");
    this.registerRequiredCSS("timelapsePanel.css");

    this.createSplitView();
    this.splitView.hideMainElement();

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
	function registerAndDocument(shortcuts, handlers, descriptor, related)
	{
        var shortcutNames = [];
        for (var i = 0; i < shortcuts.length; ++i) {
        this.registerShortcut(shortcuts[i].key, handlers[i]);
        shortcutNames.push(shortcuts[i].name);
        }

        var section = WebInspector.shortcutsScreen.section(WebInspector.UIString("Timelapse Panel"));
	    if (related)
		section.addRelatedKeys(shortcutNames, descriptor);
	    else
		section.addAlternateKeys(shortcutNames, descriptor);
	}

	var panel = this;
	var backend = this._model;
	var handlers, shortcuts, descriptor;
	var platformSpecificModifier = WebInspector.KeyboardShortcut.Modifiers.CtrlOrMeta;

	// Next/previous input.
	shortcuts = [];
	handlers = [];
        shortcuts.push(WebInspector.KeyboardShortcut.makeDescriptor("n"));
	handlers.push(function() {
	    if (!backend.inputPaused) return;
	    var grid = panel._dataGrid;
	    grid.replayToNextNode.call(grid);
	});
	shortcuts.push(WebInspector.KeyboardShortcut.makeDescriptor("p"));
	handlers.push(function() {
	    if (!backend.inputPaused) return;
	    var grid = panel._dataGrid;
	    grid.replayToPreviousNode.call(grid);
	});
	descriptor = WebInspector.UIString("Replay to next/previous input");
	registerAndDocument.call(panel, shortcuts, handlers, descriptor, true);
    },
};

WebInspector.TimelapsePanel.prototype.__proto__ = WebInspector.Panel.prototype;
