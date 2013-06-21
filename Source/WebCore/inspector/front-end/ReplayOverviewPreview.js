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
 * @extends {WebInspector.DataProvider}
 */
WebInspector.OverviewPreviewProvider = function(recording)
{
    WebInspector.DataProvider.call(this, recording, "preview",
                                   WebInspector.DataProvider.Types.OverviewPreview);
    this._views = [];
    this._views.push(new WebInspector.OverviewPreviewViews.DefaultView());
};

WebInspector.OverviewPreviewProvider.prototype = {
    pushView: function(view) {
	this._views.push(view);
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.DataChanged, this);
    },

    popView: function() {
	var view = this._views.pop();
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.DataChanged, this);
    },

    clear: function() {
        this._views = [];
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.DataChanged, this);
    },

    get views()
    {
	console.assert(this._views.length > 0, "Tried to hand out empty views array!");
	return this._views;
    },
    
    __proto__: WebInspector.DataProvider.prototype
};

WebInspector.OverviewPreviewViews = {};

/**
 * @constructor
 * @extends {WebInspector.View}
 */

WebInspector.OverviewPreviewViews.BaseView = function(name)
{
    WebInspector.View.call(this);

    this.element.classList.add("replay-overview-preview");
    this.element.classList.add("replay-preview-" + name);
    this._header = document.createElement("header");
    this.element.appendChild(this._header);
    this._content = document.createElement("div"); // dummy
    this.element.appendChild(this._content);
};

WebInspector.OverviewPreviewViews.BaseView.prototype = {
    set header(text)
    {
	this._header.textContent = text;
    },

    set body(elem)
    {
	this.element.replaceChild(elem, this._content);
	this._content = elem;
    },

    // Override me
    refresh: function()
    {
    },
    
    __proto__: WebInspector.View.prototype
};

/**
 * @constructor
 * @extends {WebInspector.OverviewPreviewViews.BaseView}
 */
WebInspector.OverviewPreviewViews.DefaultView = function()
{
    WebInspector.OverviewPreviewViews.BaseView.call(this, "default");
    this.refresh();
};

WebInspector.OverviewPreviewViews.DefaultView.prototype = {
    refresh: function()
    {
	this.header = "Preview Window";
	var body = document.createElement("div");
	body.classList.add("preview-message");
	var text = ["Nothing to preview.",
	            "Select something from a timeline at left."];
	for (var i = 0; i < text.length; i++) {
	    var para = document.createElement("p");
	    para.textContent = text[i];
	    body.appendChild(para);
	}
	this.body = body;
    },
    
    __proto__: WebInspector.OverviewPreviewViews.BaseView.prototype
};

/**
 * @constructor
 * @extends {WebInspector.OverviewPreviewViews.BaseView}
 */
WebInspector.OverviewPreviewViews.ErrorView = function(message)
{
    WebInspector.OverviewPreviewViews.BaseView.call(this, "error");
    this._errorMessage = message;
    this.refresh();
};

WebInspector.OverviewPreviewViews.ErrorView.prototype = {
    refresh: function()
    {
	this.header = "Replay Error Details";
	var body = document.createElement("div");
	body.classList.add("preview-message");
	var para = document.createElement("p");
	para.textContent = this._errorMessage;
	body.appendChild(para);
	this.body = body;
    },
    
    __proto__: WebInspector.OverviewPreviewViews.BaseView.prototype
};

/**
 * @constructor
 * @extends {WebInspector.OverviewPreviewViews.BaseView}
 */
WebInspector.OverviewPreviewViews.InputView = function(provider)
{
    console.assert(provider.type === WebInspector.DataProvider.Types.ReplayInput,
		  "Instantiated InputView preview with bad provider type.");

    WebInspector.OverviewPreviewViews.BaseView.call(this, "input");
    this._provider = provider;
    this.refresh();
};

WebInspector.OverviewPreviewViews.InputView.prototype = {

    refresh: function() {
	this.header = this._provider.displayName + " " + this._provider.counterNoun;
	var records = this._provider.selectedRecords;

	if (records.length == 0) {
	    console.error("Trying to preview input provider with no selected records.");
	    var body = document.createElement("div");
	    body.classList.add("preview-message");
	    body.textContent = "No records.";
	    this.body = body;
	    return;
	}

	function createButtonInTD(styleClass, callback) {
	    var cell = document.createElement("td");
	    cell.setAttribute("width", "20px");
	    var button = document.createElement("div");
	    button.className = "replay-button-icon " + styleClass;
	    cell.appendChild(button);
	    button.addEventListener("click", callback);
	    return cell;
	}

	var wrapper = document.createElement("div");
	wrapper.classList.add("table-wrapper");
	var table = document.createElement("table");

	var recording = WebInspector.recordingsModel.recordings[0];
	var screenshotsProvider = recording.providersWithType(WebInspector.DataProvider.Types.Screenshots)[0];
	var screenshots = screenshotsProvider.screenshots;

	for (var i = 0; i < records.length; i++) {
	    var record = records[i];
	    var row = document.createElement("tr");
	    row.className = "row-with-count";
	    var countCell = document.createElement("td");
	    countCell.textContent = record.mark.index;
	    row.appendChild(countCell);

	    var cell = document.createElement("td");
	    var name = WebInspector.ReplayInputDataProvider.InputStyles[record.type].title;
	    cell.setTextAndTitle(name);
	    cell.addStyleClass("text-cell");
	    row.appendChild(cell);

	    if (record.mark.index == WebInspector.replayModel.currentMarkIndex)
		row.addStyleClass("selected");

	    var view = this;

	    row.addEventListener("dblclick", function(markIndex) {
				     this.replayUpToMarkIndex(markIndex);
				 }.bind(WebInspector.replayModel, record.mark.index));

		if (screenshots[record.mark.index]) {
		    table.appendChild(row);
		    row = document.createElement("tr");
		    cell = document.createElement("td");
		    cell.colSpan = 2;

			var img = document.createElement("img");
			img.src = screenshots[record.mark.index];
			img.style.maxWidth = "150px";
			img.style.maxHeight = "150px";
			cell.appendChild(img);

			row.appendChild(cell);
		}

	    table.appendChild(row);
	}

	wrapper.appendChild(table);
	this.body = wrapper;
    },
    
    __proto__: WebInspector.OverviewPreviewViews.BaseView.prototype
};

/**
 * @constructor
 * @extends {WebInspector.OverviewPreviewViews.BaseView}
 */
WebInspector.OverviewPreviewViews.BreakpointHitView = function(recording, provider)
{
    console.assert(provider.type === WebInspector.DataProvider.Types.BreakpointHits,
		  "Instantiated BreakpointHitView preview with bad provider type.");

    WebInspector.OverviewPreviewViews.BaseView.call(this, "breakpoint");
    this._recording = recording;
    this._provider = provider;
    this._linkifier = new WebInspector.Linkifier();
    this.refresh();
};

WebInspector.OverviewPreviewViews.BreakpointHitView.prototype = {

    refresh: function() {
	this.header = this._provider.displayName + " " + this._provider.counterNoun;
	var records = this._provider.selectedRecords;

	if (records.length == 0) {
	    console.error("Trying to preview breakpoint provider with no selected records.");
	    var body = document.createElement("div");
	    body.classList.add("preview-message");
	    body.textContent = "No records.";
	    this.body = body;
	    return;
	}

	function createButtonInTD(styleClass, callback) {
	    var cell = document.createElement("td");
	    cell.setAttribute("width", "20px");
	    var button = document.createElement("div");
	    button.className = "replay-button-icon " + styleClass;
	    cell.appendChild(button);
	    button.addEventListener("click", callback);
	    return cell;
	}

	var wrapper = document.createElement("div");
	wrapper.classList.add("table-wrapper");
	var table = document.createElement("table");

	var savepointList = this._recording.savepointList;

	var lastMarkIndex;
	for (var i = 0; i < records.length; i++) {
	    var record = records[i];
	    var row = document.createElement("tr");
	    var countCell = document.createElement("td");
	    if (record.mark.index != lastMarkIndex) {
		row.className = "row-with-count";
		countCell.textContent = record.mark.index;
		lastMarkIndex = record.mark.index;
	    }
	    row.appendChild(countCell);

	    var indexExplored = WebInspector.replayModel.breakpointTracker.exploredIndex(record.mark.index, record.hitIndex);
	    var savepoint = savepointList.findForBreakpointHit(record.mark.index, record.hitIndex);
	    var isCurrentBreakpoint = record.mark.index == WebInspector.replayModel.currentMarkIndex
		&& record.hitIndex == WebInspector.replayModel.currentHitIndex;

	    if (savepoint) {
            var savepointButton = createButtonInTD("replay-savepoint-button toggled", function(savepoint) {
                savepointList.removeSavepoint(savepoint);
		    }.bind(savepointButton, savepoint));
		    row.appendChild(savepointButton);
		}
	    else
		row.appendChild(document.createElement("td"));

	    if (indexExplored && !isCurrentBreakpoint) {
		var jumpButton = createButtonInTD("replay-jump-button", function(markIndex, hitIndex) {
			WebInspector.replayModel.replayToBreakpointHit(markIndex, hitIndex);
		    }.bind(jumpButton, record.mark.index, record.hitIndex));
		row.appendChild(jumpButton);
		}
	    else
		row.appendChild(document.createElement("td"));

	    var breakpoint = record.breakpoint;

	    var cell = document.createElement("td");
	    var sourceLink = breakpoint._linkifyLocation(this._linkifier);
	    sourceLink.addEventListener("contextmenu", breakpoint.contextMenu.bind(breakpoint), true);
	    cell.appendChild(sourceLink);
	    cell.addStyleClass("text-cell");
	    row.appendChild(cell);

	    if (isCurrentBreakpoint)
		row.addStyleClass("selected");
	    
	    if (record.mark.index == WebInspector.replayModel.currentMarkIndex
	       && record.hitIndex == WebInspector.replayModel.currentHitIndex)
		row.addStyleClass("selected");

	    // TODO: could be shorter
	    row.addEventListener("dblclick", function(markIndex) {
				     this.replayUpToMarkIndex(markIndex);
				 }.bind(WebInspector.replayModel, record.mark.index));

	    table.appendChild(row);

	    if (breakpoint.condition()) {
		var conditionRow = document.createElement("tr");
		conditionRow.className = "condition-row"

		var labelCell = document.createElement("td");
		labelCell.colSpan = 3;
		conditionRow.appendChild(labelCell);

		var conditionCell = document.createElement("td");
		var conditionText = document.createElement("span");
		conditionText.textContent = breakpoint.condition();
		conditionText.addStyleClass("source-code");
		conditionCell.appendChild(conditionText);
		conditionCell.addStyleClass("text-cell");
		conditionRow.appendChild(conditionCell);

		table.appendChild(conditionRow);
	    }
	}

	wrapper.appendChild(table);
	this.body = wrapper;
    },
    
    __proto__: WebInspector.OverviewPreviewViews.BaseView.prototype
};

/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.ReplayOverviewPreview = function(model, recording)
{
    WebInspector.View.call(this);

    this.element.classList.add("replay-preview-container");
    this._model = model;
    this._recording = recording;

    this._callbacks = new WebInspector.EventListenerGroup(this, "Static ReplayOverviewPreview listeners");
    var recordingEvents = WebInspector.ReplayRecording.Events;
    this._callbacks.register(this._recording, recordingEvents.ProviderAdded, this._onProviderAdded);

    // if something changed about state of playback, then refresh (the visible view)
    var replayEvents = WebInspector.ReplayModel.Events;
    this._callbacks.register(this._model, replayEvents.PlaybackDidStart, this.refresh);
    this._callbacks.register(this._model, replayEvents.PlaybackStopped,  this.refresh);
    this._callbacks.register(this._model, replayEvents.DebuggerPaused,   this.refresh);
    this._callbacks.register(this._model, replayEvents.InputPaused,      this.refresh);
    this._callbacks.install();

    // scan for existing useful provider
    var providers = this._recording.providersWithType(WebInspector.DataProvider.Types.OverviewPreview);
    for (var i = 0; i < providers.length; i++)
	this._setProvider(providers[i]);

    this.refresh();
};

WebInspector.ReplayOverviewPreview.prototype = {
    willDispose: function()
    {
	this._callbacks.uninstall(true);
    },

    refresh: function()
    {
	if (!this._provider)
	    return;

	var i = Math.max(0, this._provider.views.length-1);
	var view = this._provider.views[i];

	if (this._shownView && this._shownView !== view)
	    this._shownView.detach();

	this._shownView = view;
	this._shownView.show(this.element);
	this._shownView.refresh();
    },

    _canUseProvider: function(provider)
    {
	return provider.type === WebInspector.DataProvider.Types.OverviewPreview;
    },

    _onProviderAdded: function(event)
    {
	var provider = event.data;
	if (!this._canUseProvider(provider))
	    return;

	this._setProvider(provider);
    },

    _setProvider: function(provider)
    {
	console.assert(!this._provider, "Tried to set more than one overview preview provider.");

	this._provider = provider;
	this._providerCallbacks = new WebInspector.EventListenerGroup(this, "ReplayOverviewPreview provider listeners");
	this._providerCallbacks.register(provider, WebInspector.DataProvider.Events.WillRemove,  this._onProviderWillRemove);
	this._providerCallbacks.register(provider, WebInspector.DataProvider.Events.DataChanged, this.refresh);
	this._providerCallbacks.install();

	this.refresh();
    },

    _onProviderWillRemove: function(event)
    {
	var provider = event.data;
	console.assert(this._canUseProvider(provider) && this._provider === provider,
		       "Got WillRemove for unrelated provider!");

	this._providerCallbacks.uninstall(true);
	delete this._providerCallbacks;
	delete this._provider;
    },
    
    __proto__: WebInspector.View.prototype
};
