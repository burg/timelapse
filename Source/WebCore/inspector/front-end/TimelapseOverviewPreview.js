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
WebInspector.OverviewPreviewProvider = function()
{
    WebInspector.DataProvider.call(this, "preview", WebInspector.DataProvider.Types.OverviewPreview);
    this._views = [];
    this._views.push(new WebInspector.OverviewPreviewViews.DefaultView());
};

WebInspector.OverviewPreviewProvider.prototype = {
    pushView: function(view) {
	this._views.unshift(view);
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.DataChanged, this);
    },

    popView: function() {
	this._views.shift();
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
    }
};

WebInspector.OverviewPreviewProvider.prototype.__proto__ = WebInspector.DataProvider.prototype;

WebInspector.OverviewPreviewViews = {};

/**
 * @constructor
 * @extends {WebInspector.View}
 */

WebInspector.OverviewPreviewViews.BaseView = function(name)
{
    WebInspector.View.call(this);

    this.element.classList.add("timelapse-overview-preview");
    this.element.classList.add("timelapse-preview-" + name);
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
    }
};

WebInspector.OverviewPreviewViews.BaseView.prototype.__proto__ = WebInspector.View.prototype;

/**
 * @constructor
 * @extends {WebInspector.OverviewPreviewViews.BaseView}
 */
WebInspector.OverviewPreviewViews.DefaultView = function()
{
    WebInspector.OverviewPreviewViews.BaseView.call(this, "default");
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
};

WebInspector.OverviewPreviewViews.DefaultView.prototype.__proto__ = WebInspector.OverviewPreviewViews.BaseView.prototype;

/**
 * @constructor
 * @extends {WebInspector.OverviewPreviewViews.BaseView}
 */
WebInspector.OverviewPreviewViews.InputView = function(provider)
{
    console.assert(provider.type === WebInspector.DataProvider.Types.TimelapseInput,
		  "Instantiated InputView preview with bad provider type.");

    WebInspector.OverviewPreviewViews.BaseView.call(this, "input");
    this.header = provider.displayName + " " + provider.counterNoun;
    var records = provider.selectedRecords;

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
	button.className = "timelapse-button-icon " + styleClass;
	cell.appendChild(button);
	button.addEventListener("click", callback);
	return cell;
    }

    var table = document.createElement("table");

    for (var i = 0; i < records.length; i++) {
	var record = records[i];
	var row = document.createElement("tr");
	row.className = "row-with-count";
	var countCell = document.createElement("td");
	countCell.textContent = record.mark.index;
	row.appendChild(countCell);

	var cell = document.createElement("td");
	var name = WebInspector.TimelapseInputDataProvider.InputStyles[record.type].title;
	cell.setTextAndTitle(name);
	cell.addStyleClass("text-cell");
	row.appendChild(cell);

	if (record.mark.index == WebInspector.timelapseModel.currentMarkIndex)
	    row.addStyleClass("selected");

	var view = this;

	row.addEventListener("dblclick", function(markIndex) {
				 this.replayUpToMarkIndex(markIndex);
			     }.bind(WebInspector.timelapseModel, record.mark.index));

	table.appendChild(row);
    }

    this.body = table;
};

WebInspector.OverviewPreviewViews.InputView.prototype.__proto__ = WebInspector.OverviewPreviewViews.BaseView.prototype;

/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseOverviewPreview = function()
{
    WebInspector.View.call(this);

    this.element.classList.add("timelapse-preview-container");
    this._presentationModel = WebInspector.timelapsePresentationModel;

    var presEvents = WebInspector.TimelapsePresentationModel.EventTypes;
    this._presentationModel.addEventListener(presEvents.ProviderAdded, this._onProviderAdded, this);

    // scan for existing useful provider
    var providers = this._presentationModel.providersWithType(WebInspector.DataProvider.Types.OverviewPreview);
    for (var i = 0; i < providers.length; i++)
	this._setProvider(providers[i]);

    this.refresh();
};

WebInspector.TimelapseOverviewPreview.prototype = {
    refresh: function()
    {
	if (!this._provider)
	    return;

	var view = this._provider.views[0];

	if (this._shownView && this._shownView !== view)
	    this._shownView.detach();

	this._shownView = view;
	this._shownView.show(this.element);
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
	this._provider.addEventListener(WebInspector.DataProvider.Events.WillRemove, this._onProviderWillRemove, this);
	this._provider.addEventListener(WebInspector.DataProvider.Events.DataChanged, this.refresh, this);

	this.refresh();
    },

    _onProviderWillRemove: function(event)
    {
	var provider = event.data;
	console.assert(this._canUseProvider(provider) && this._provider === provider,
		       "Got WillRemove for unrelated provider!");

	this._provider.removeEventListener(WebInspector.DataProvider.Events.WillRemove, this._onProviderWillRemove, this);
	this._provider.removeEventListener(WebInspector.DataProvider.Events.DataChanged, this.refresh, this);
	delete this._provider;
    }
};

WebInspector.TimelapseOverviewPreview.prototype.__proto__ = WebInspector.View.prototype;
