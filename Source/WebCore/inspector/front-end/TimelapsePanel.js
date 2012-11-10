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

    this._controllerView = WebInspector.timelapseControllerView;
    this._controllerView.show(this.splitView.sidebarElement);

    this._dataGrid = new WebInspector.TimelapseGrid();
    this._dataGrid.show(this.splitView.sidebarElement);

    this._viewsContainerElement = this.splitView.mainElement;
    this._viewsContainerElement.id = "timelapse-views";
    this._viewsContainerElement.addStyleClass("hidden");

    this._registerShortcuts();

    this.popover = new WebInspector.TimelapsePopover(this);
    document.body.addEventListener("mousemove", this.startHidePopoverTimer.bind(this), false);

    this._reset();

    //tell backend to enable
    if (Preferences.timelapseAlwaysEnabled || WebInspector.settings.timelapseEnabled.get())
	// if enabled from prefs, synthetically make the enable event fire.
        this._model.enable();
    else {
        function onTimelapseEnabled(error, value) {
            if (value)
                WebInspector.timelapseModel.enable();
        }
        this._model.isEnabled(onTimelapseEnabled.bind(this));
    }
};

WebInspector.TimelapsePanel.prototype = {
    get toolbarItemLabel()
    {
        return WebInspector.UIString("Timelapse");
    },

    get statusBarItems()
    {
	return this._controllerView.statusBarItems;
    },

    wasShown: function()
    {
        WebInspector.Panel.prototype.wasShown.call(this);
        if (WebInspector.drawer.visible && WebInspector._timelapseWasShown) {
            WebInspector.drawer.hide(WebInspector.Drawer.AnimationType.Immediately);
            this._drawerWasVisible = true;
        }
	this._controllerView.show(this.splitView.sidebarElement);
	this._dataGrid.wasShown();
    },

    willHide: function()
    {
	this.popover.hide();
        if (this._drawerWasVisible) {
            WebInspector.drawer.show(this._controllerView, WebInspector.Drawer.AnimationType.Immediately);
            delete this._drawerWasVisible;
        }
	WebInspector.Panel.prototype.willHide.call(this);
    },

    //called to clear the interface without reloading inspector.html/building DOM
    _reset: function()
    {
        WebInspector.Panel.prototype.reset.call(this);
        this.searchCanceled();
        this.removeAllListeners();
	this._dataGrid.reset();
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

	// Play/pause.
	shortcuts = [];
	handlers = [];
	var spacebar = WebInspector.KeyboardShortcut.Keys.Space;
        shortcuts.push(WebInspector.KeyboardShortcut.makeDescriptor(spacebar));
	handlers.push(this._controllerView._togglePlaybackButtonClicked.bind(this));
	descriptor = WebInspector.UIString("Play/pause");
	registerAndDocument.call(panel, shortcuts, handlers, descriptor);

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

	// Continue debugging.
	shortcuts = [];
	handlers = [];
        shortcuts.push(WebInspector.KeyboardShortcut.makeDescriptor("c"));
	handlers.push(function() { DebuggerAgent.resume(); });
	descriptor = WebInspector.UIString("Continue debugging");
	registerAndDocument.call(panel, shortcuts, handlers, descriptor);
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

    startHidePopoverTimer: function(event)
    {
	if (!WebInspector.Popover._popoverElement || this._hidePopoverTimer)
	    return;

	function doHide() {
	    this.popover.hide();
	    delete this._hidePopoverTimer;
	}
	this._hidePopoverTimer = setTimeout(doHide.bind(this), 1000);
    },

    killHidePopoverTimer: function(event)
    {
        if (this._hidePopoverTimer) {
            clearTimeout(this._hidePopoverTimer);
            delete this._hidePopoverTimer;
        }
    }
};

WebInspector.TimelapsePanel.prototype.__proto__ = WebInspector.Panel.prototype;

WebInspector.TimelapsePopover = function(panel)
{
    WebInspector.Popover.call(this);

    this._panel = panel;

    var model = WebInspector.timelapseModel;
    var eventNames = WebInspector.TimelapseModel.EventTypes;

    model.addEventListener(eventNames.Enabled, this.hide, this);
    model.addEventListener(eventNames.Disabled, this.hide, this);
    model.addEventListener(eventNames.RecordingDidStart, this.hide, this);
    model.addEventListener(eventNames.PlaybackStopped, this.hide, this);
}

WebInspector.TimelapsePopover.prototype = {
    show: function(records, position)
    {
	if (this._disposed)
	    return;

	if (!records) {
	    this.hide();
	    return;
	}

	this._records = records;
	this._position = position;
	this.contentElement = WebInspector.timelapsePresentationModel.generatePopupContent(records);

        // This should not happen, but we hide previous popup to be on the safe side.
        if (WebInspector.Popover._popoverElement)
            document.body.removeChild(WebInspector.Popover._popoverElement);
        WebInspector.Popover._popoverElement = this.element;

        // Temporarily attach in order to measure preferred dimensions.
        this.contentElement.positionAt(0, 0);
        document.body.appendChild(this.contentElement);
        var preferredWidth = this.contentElement.offsetWidth;
        var preferredHeight = this.contentElement.offsetHeight;

	this._contentDiv.removeChildren();
	this._contentDiv.appendChild(this.contentElement);
        this.element.appendChild(this._contentDiv);
        document.body.appendChild(this.element);
        this._positionElement(position, preferredWidth, preferredHeight);
        this._visible = true;
	this._panel.killHidePopoverTimer.call(this._panel);
        this.contentElement.addEventListener("mousemove", function(event) {
	    this._panel.killHidePopoverTimer.call(this._panel);
	    event.stopPropagation();
	}.bind(this), true);
    },

    _positionElement: function(anchorPosition, preferredWidth, preferredHeight)
    {
	const borderWidth = 2;
        const scrollerWidth = 11;
        const arrowHeight = 6;
        const arrowOffset = 8;
	const arrowLeft = 12; // default arrow position
	const minArrowPosition = 7;
	const borderRadius = 12;

	var totalWidth = window.innerWidth;
	var totalHeight = window.innerHeight;

        var newElementPosition = {
	    x: 0,
	    y: anchorPosition.y + arrowHeight,
	    width: preferredWidth,
	    height: preferredHeight
	};

        // Positioning below the anchor.
        if (newElementPosition.y + newElementPosition.height + borderWidth * 2 >= totalHeight) {
            newElementPosition.height = totalHeight - anchorPosition.y - arrowHeight - borderWidth * 2;
	    newElementPosition.width += scrollerWidth;
        }

        if (anchorPosition.x + newElementPosition.width + borderWidth - arrowLeft - arrowOffset < totalWidth) {
	    // Touching left or no border.
            newElementPosition.x = Math.max(borderWidth, anchorPosition.x - borderWidth - arrowLeft - arrowOffset);
	    if (newElementPosition.x == borderWidth)
		this._popupArrowElement.style.left = Math.max(minArrowPosition, anchorPosition.x - arrowOffset) + "px";
	    else
		this._popupArrowElement.style.left = arrowLeft + "px";
        }
	else if (newElementPosition.width + borderWidth * 2 < totalWidth) {
	    // Touching right border.
            newElementPosition.x = totalWidth - newElementPosition.width - borderWidth * 2;
            this._popupArrowElement.style.right = Math.max(minArrowPosition, totalWidth - anchorPosition.x - borderWidth - arrowOffset - 1) + "px";
	    this._popupArrowElement.style.left = "auto";
        }
	else {
	    // Touching both borders.
            newElementPosition.x = borderWidth;
            newElementPosition.width = totalWidth - borderWidth * 2;
	    newElementPosition.height += scrollerWidth;
            this._popupArrowElement.style.left = Math.max(0, anchorPosition.x - arrowOffset) + "px";
        }

        this.element.className = "timelapse-popover custom-popup-vertical-scroll custom-popup-horizontal-scroll";
        this.element.positionAt(Math.round(newElementPosition.x), Math.round(newElementPosition.y));
        this.element.style.width = newElementPosition.width + borderWidth * 2 + "px";
        this.element.style.height = newElementPosition.height + borderWidth * 2 + "px";
    },

    refresh: function()
    {
	if (this._visible && this._records && this._position)
	    this.show(this._records, this._position);
    }
}

WebInspector.TimelapsePopover.prototype.__proto__ = WebInspector.Popover.prototype;
