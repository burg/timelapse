/**
 * @constructor
 * @extends {WebInspector.Panel}
 */
WebInspector.TimelapsePanel = function()
{
    WebInspector.Panel.call(this, "timelapse");
    this.registerRequiredCSS("timelapsePanel.css");

    this._presentationModel = WebInspector.timelapsePresentationModel;
    this._model = WebInspector.timelapseModel;
    this._enabled = Preferences.timelapseAlwaysEnabled;

    var eventNames = WebInspector.TimelapseModel.EventTypes;
    this._model.addEventListener(eventNames.Enabled, this._timelapseEnabled, this);
    this._model.addEventListener(eventNames.Disabled, this._timelapseDisabled, this);
    this._model.addEventListener(eventNames.RecordingDidStart, this._recordingDidStart, this);
    this._model.addEventListener(eventNames.RecordingDidStop, this._recordingDidStop, this);

    this.createSplitView();
    this.splitView.hideMainElement();

    this._dataGrid = new WebInspector.TimelapseGrid();
    this._dataGrid.show(this.splitView.sidebarElement);

    this._registerShortcuts();

    this._reset();
};

WebInspector.TimelapsePanel.prototype = {
    get toolbarItemLabel()
    {
        return WebInspector.UIString("Timelapse");
    },

    //called to clear the interface without reloading inspector.html/building DOM
    _reset: function()
    {
        WebInspector.Panel.prototype.reset.call(this);
        this.searchCanceled();
        this.removeAllListeners();
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

    _timelapseEnabled: function()
    {
        this._reset();
    },

    _timelapseDisabled: function()
    {
        this._reset();
    },

    _recordingDidStart: function()
    {
	this._reset();
    },

    _recordingDidStop: function()
    {
	this._dataGrid.refresh();
    },
};

WebInspector.TimelapsePanel.prototype.__proto__ = WebInspector.Panel.prototype;
