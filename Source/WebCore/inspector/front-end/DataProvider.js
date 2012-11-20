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
 * @extends {WebInspector.Object}
 */
WebInspector.DataProvider = function(name, type)
{
    this._name = name;
    this._type = type;
    this._enabled = true;

    WebInspector.Object.call(this);
};

WebInspector.DataProvider.prototype = {
    get name()
    {
        return this._name;
    },

    get type()
    {
        return this._type;
    },

    // Override me!
    get displayName()
    {
        return this.name;
    },

    enable: function() {
	this._enabled = true;
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.Enabled, this);
    },

    disable: function() {
	this._enabled = false;
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.Disabled, this);
    },

    isEnabled: function() {
	return this._enabled;
    },

    // This should be used by listeners as an opportunity to remove callbacks
    willRemove: function() {
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.WillRemove, this);
    },
};

WebInspector.DataProvider.prototype.__proto__ = WebInspector.Object.prototype;

WebInspector.DataProvider.Types = {
    TimelapseInput: "TimelapseInput",
    BreakpointHits: "BreakpointHits",
};

WebInspector.DataProvider.Events = {
    Enabled: "Enabled",
    Disabled: "Disabled",
    WillRemove: "WillRemove",

    DataChanged: "DataChanged",
};

WebInspector.TimelapseInputDataProvider = function(inputCategory)
{
    WebInspector.DataProvider.call(this);

    this._category = inputCategory;
    this._records = [];

    var model = WebInspector.timelapseModel;
    var eventNames = WebInspector.TimelapseModel.EventTypes;
    model.addEventListener(eventNames.RecordAdded, this._recordAdded, this);
};

WebInspector.TimelapseInputDataProvider.prototype = {
    get category()
    {
	return this._category;
    },

    get displayName()
    {
	return this._category.title;
    },

    get records()
    {
	return this._records;
    },

    _recordAdded: function(event)
    {
	var record = event.data;
	var recordStyles = WebInspector.timelapsePresentationModel.recordStyles;

	if (recordStyles[record.type].category.name != this._category.name)
	    return;

	this._records.push(event.data);
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.DataChanged)
    },
};

WebInspector.TimelapseInputDataProvider.prototype.__proto__ = WebInspector.DataProvider.prototype;

// TODO: TimelapseAnchorDataProvider

// TODO: TimelapseBreakpointDataProvider
