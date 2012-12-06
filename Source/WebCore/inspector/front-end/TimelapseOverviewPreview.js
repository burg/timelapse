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
	this.dispatchEventToListeners(WebInspector.OverviewPreviewProvider.Events.DataChanged, this);
    },

    popView: function() {
	this._views.shift();
	this.dispatchEventToListeners(WebInspector.OverviewPreviewProvider.Events.DataChanged, this);
    },

    clear: function() {
        this._views = [];
	this.dispatchEventToListeners(WebInspector.OverviewPreviewProvider.Events.DataChanged, this);
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

WebInspector.OverviewPreviewViews.DefaultView = function()
{
    WebInspector.View.call(this);
    this.element.classList.add("timelapse-opreview-default");
    this.element.textContent = "Nothing to preview.\nSelect something from a timeline at left.";
};

WebInspector.OverviewPreviewViews.DefaultView.prototype.__proto__ = WebInspector.View.prototype;

/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseOverviewPreview = function()
{
    WebInspector.View.call(this);

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
