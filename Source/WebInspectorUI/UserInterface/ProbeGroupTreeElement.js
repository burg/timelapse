/*
 *  Copyright (C) 2013 University of Washington. All rights reserved.
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

WebInspector.ProbeGroupTreeElement = function(probeGroup, className, title)
{
    console.assert(probeGroup instanceof WebInspector.ProbeGroupObject, "Unknown object supplied as probe group: ", probeGroup);

    if (!className)
        className = WebInspector.ProbeGroupTreeElement.GenericLineIconStyleClassName;

    WebInspector.GeneralTreeElement.call(this, [WebInspector.ProbeGroupTreeElement.StyleClassName, className], title, null, probeGroup, false);

    this._probeGroup = probeGroup;

    this._groupListeners = new WebInspector.EventListenerGroup(this, "Probe group listeners");
    this._groupListeners.register(probeGroup, WebInspector.ProbeGroupObject.Event.WillRemove, this._teardownProbeGroup);
    this._groupListeners.register(probeGroup, WebInspector.ProbeGroupObject.Event.ResolveStateDidChange, this._updateStatus);
    this._groupListeners.register(probeGroup, WebInspector.ProbeGroupObject.Event.Enabled, this._updateStatus);
    this._groupListeners.register(probeGroup, WebInspector.ProbeGroupObject.Event.Disabled, this._updateStatus);
    this._groupListeners.register(probeGroup, WebInspector.ProbeGroupObject.Event.SamplesCleared, this._setupData);
    this._groupListeners.install();

    this._setupData();

    WebInspector.probeManager.addEventListener(WebInspector.ProbeManager.Event.ProbesEnablementChanged, this._updateStatus);

    this._statusImageElement = document.createElement("img");
    this._statusImageElement.classList.add(WebInspector.ProbeGroupTreeElement.StatusImageElementStyleClassName);
    this._statusImageElement.addEventListener("mousedown", this._statusImageElementMouseDown.bind(this));
    this._statusImageElement.addEventListener("click", this._statusImageElementClicked.bind(this));

    if (!title)
        this._updateTitles();
    this._updateStatus();

    this.status = this._statusImageElement;
    this.small = true;
};

WebInspector.ProbeGroupTreeElement.GenericLineIconStyleClassName = "probe-group-generic-line-icon";
WebInspector.ProbeGroupTreeElement.StyleClassName = "probe-group";
WebInspector.ProbeGroupTreeElement.StatusImageElementStyleClassName = "status-image";
WebInspector.ProbeGroupTreeElement.StatusImageActiveStyleClassName = "active-probe";
WebInspector.ProbeGroupTreeElement.StatusImageDisabledStyleClassName = "disabled";
WebInspector.ProbeGroupTreeElement.FormattedLocationStyleClassName = "formatted-location";
WebInspector.ProbeGroupTreeElement.DataUpdatedStyleClassName = "data-updated";

WebInspector.ProbeGroupTreeElement.DataUpdatedAnimationDuration = 300; // milliseconds

WebInspector.ProbeGroupTreeElement.prototype = {
    constructor: WebInspector.ProbeGroupTreeElement,
    __proto__: WebInspector.GeneralTreeElement.prototype,

    // Public

    get probeGroup()
    {
        return this._probeGroup;
    },

    get filterableData()
    {
        return {text: [this.mainTitle, this.subtitle]};
    },

    ondelete: function()
    {
        this._probeGroup.clear();
        return true;
    },

    onenter: function()
    {
        if (this._probeGroup.isEnabled)
        	this._probeGroup.disable();
        else
        	this._probeGroup.enable();
        return true;
    },

    onspace: function()
    {
        if (this._probeGroup.isEnabled)
        	this._probeGroup.disable();
        else
        	this._probeGroup.enable();
        return true;
    },

    // Private

    _setupData: function()
    {
        this._dataListeners = new WebInspector.EventListenerGroup(this, "Data table event listeners");
        this._dataListeners.register(this._probeGroup.dataTable, WebInspector.ProbeGroupDataTable.Event.WillRemove, this._teardownData);
        this._dataListeners.register(this._probeGroup.dataTable, WebInspector.ProbeGroupDataTable.Event.FrameInserted, this._dataUpdated);
        this._dataListeners.register(this._probeGroup.dataTable, WebInspector.ProbeGroupDataTable.Event.FrameReplaced, this._dataUpdated);
        this._dataListeners.install();
    },

    _teardownData: function()
    {
        this._dataListeners.uninstall(true);
        delete this._dataListeners;
    },

    _teardownProbeGroup: function()
    {
        this._groupListeners.uninstall(true);
        delete this._groupListeners;
    },

    _updateTitles: function()
    {
        var displayLineNumber = this._probeGroup.position.lineNumber;
        var displayColumnNumber = this._probeGroup.position.columnNumber;
        var sourceCodeLocation = null;

        if (this._probeGroup.resolved) {
            sourceCodeLocation = this._probeGroup.sourceCodeLocation;
            displayLineNumber = sourceCodeLocation.displayLineNumber;
            displayColumnNumber = sourceCodeLocation.displayColumnNumber;
        }

        if (displayColumnNumber > 0)
            this.mainTitle = WebInspector.UIString("Line %d:%d").format(displayLineNumber + 1, displayColumnNumber + 1); // The user visible line and column numbers are 1-based.
        else
            this.mainTitle = WebInspector.UIString("Line %d").format(displayLineNumber + 1); // The user visible line number is 1-based.

        if (!sourceCodeLocation)
            return;

        if (sourceCodeLocation.hasMappedLocation()) {
            this.subtitle = sourceCodeLocation.formattedLocationString();

            if (sourceCodeLocation.hasFormattedLocation())
                this.subtitleElement.classList.add(WebInspector.ProbeGroupTreeElement.FormattedLocationStyleClassName);
            else
                this.subtitleElement.classList.remove(WebInspector.ProbeGroupTreeElement.FormattedLocationStyleClassName);

            this.tooltip = this.mainTitle + " \u2014 " + WebInspector.UIString("originally %s").format(sourceCodeLocation.originalLocationString());
        }
    },

    _dataUpdated: function()
    {
        if (this.element.classList.contains(WebInspector.ProbeGroupTreeElement.DataUpdatedStyleClassName)) {
            clearTimeout(this._currentTimeout);
            this.element.classList.remove(WebInspector.ProbeGroupTreeElement.DataUpdatedStyleClassName);
        }

        this.element.classList.add(WebInspector.ProbeGroupTreeElement.DataUpdatedStyleClassName);
        this._currentTimeout = setTimeout(function() {
            this.element.classList.remove(WebInspector.ProbeGroupTreeElement.DataUpdatedStyleClassName);
        }.bind(this), WebInspector.ProbeGroupTreeElement.DataUpdatedAnimationDuration);
    },

    _updateStatus: function()
    {
        if (!this._probeGroup.isEnabled)
            this._statusImageElement.classList.add(WebInspector.ProbeGroupTreeElement.StatusImageDisabledStyleClassName);
        else
            this._statusImageElement.classList.remove(WebInspector.ProbeGroupTreeElement.StatusImageDisabledStyleClassName);

        if (WebInspector.probeManager.probesEnabled)
            this._statusImageElement.classList.add(WebInspector.ProbeGroupTreeElement.StatusImageActiveStyleClassName);
        else
            this._statusImageElement.classList.remove(WebInspector.ProbeGroupTreeElement.StatusImageActiveStyleClassName);
    },

    _statusImageElementMouseDown: function(event)
    {
        // To prevent the tree element from selecting.
        event.stopPropagation();
    },

    _statusImageElementClicked: function(event)
    {
        if (this._probeGroup.isEnabled)
        	this._probeGroup.disable();
        else
        	this._probeGroup.enable();
    }
};
