/*
 * Copyright (C) 2013 Apple Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
 */

WebInspector.BreakpointTreeElement = function(breakpoint, className, title)
{
    console.assert(breakpoint instanceof WebInspector.Breakpoint);

    if (!className)
        className = WebInspector.BreakpointTreeElement.GenericLineIconStyleClassName;

    WebInspector.GeneralTreeElement.call(this, [WebInspector.BreakpointTreeElement.StyleClassName, className], title, null, breakpoint, false);

    this._breakpoint = breakpoint;

    if (!title)
        this._breakpoint.addEventListener(WebInspector.Breakpoint.Event.LocationDidChange, this._breakpointLocationDidChange, this);
    this._breakpoint.addEventListener(WebInspector.Breakpoint.Event.ModeDidChange, this._updateStatus, this);
    this._breakpoint.addEventListener(WebInspector.Breakpoint.Event.ResolvedStateDidChange, this._updateStatus, this);

    WebInspector.probeManager.addEventListener(WebInspector.ProbeManager.Event.ProbeSetAdded, this._probeSetAdded, this);
    WebInspector.probeManager.addEventListener(WebInspector.ProbeManager.Event.ProbeSetRemoved, this._probeSetRemoved, this);

    // Search for a pre-existing probe set for this breakpoint.
    var probeSet = WebInspector.probeManager.probeSetForBreakpoint(this._breakpoint);
    if (probeSet)
        this._probeSetAdded({data: probeSet});

    this._statusImageElement = document.createElement("img");
    this._statusImageElement.className = WebInspector.BreakpointTreeElement.StatusImageElementStyleClassName;
    this._statusImageElement.addEventListener("mousedown", this._statusImageElementMouseDown.bind(this));
    this._statusImageElement.addEventListener("click", this._statusImageElementClicked.bind(this));

    if (!title)
        this._updateTitles();
    this._updateStatus();

    this.status = this._statusImageElement;
    this.small = true;
};

WebInspector.BreakpointTreeElement.GenericLineIconStyleClassName = "breakpoint-generic-line-icon";
WebInspector.BreakpointTreeElement.StyleClassName = "breakpoint";
WebInspector.BreakpointTreeElement.StatusImageElementStyleClassName = "status-image";
WebInspector.BreakpointTreeElement.StatusImageResolvedStyleClassName = "resolved";
WebInspector.BreakpointTreeElement.StatusImageAutoContinueStyleClassName = "auto-continue";
WebInspector.BreakpointTreeElement.StatusImageDisabledStyleClassName = "disabled";
WebInspector.BreakpointTreeElement.FormattedLocationStyleClassName = "formatted-location";
WebInspector.BreakpointTreeElement.ProbeDataUpdatedStyleClassName = "data-updated";

WebInspector.BreakpointTreeElement.ProbeDataUpdatedAnimationDuration = 300; // milliseconds


WebInspector.BreakpointTreeElement.prototype = {
    constructor: WebInspector.BreakpointTreeElement,

    // Public

    get breakpoint()
    {
        return this._breakpoint;
    },

    ondelete: function()
    {
        if (!WebInspector.debuggerManager.isBreakpointRemovable(this._breakpoint))
            return false;

        WebInspector.debuggerManager.removeBreakpoint(this._breakpoint);
        return true;
    },

    onenter: function()
    {
        this._breakpoint.mode = this._breakpoint.nextMode;
        return true;
    },

    onspace: function()
    {
        this._breakpoint.mode = this._breakpoint.nextMode;
        return true;
    },

    oncontextmenu: function(event)
    {
        var contextMenu = new WebInspector.ContextMenu(event);
        this._breakpoint.appendContextMenuItems(contextMenu, this._statusImageElement);
        contextMenu.show();
    },

    // Private

    _updateTitles: function()
    {
        var sourceCodeLocation = this._breakpoint.sourceCodeLocation;

        var displayLineNumber = sourceCodeLocation.displayLineNumber;
        var displayColumnNumber = sourceCodeLocation.displayColumnNumber;
        if (displayColumnNumber > 0)
            this.mainTitle = WebInspector.UIString("Line %d:%d").format(displayLineNumber + 1, displayColumnNumber + 1); // The user visible line and column numbers are 1-based.
        else
            this.mainTitle = WebInspector.UIString("Line %d").format(displayLineNumber + 1); // The user visible line number is 1-based.

        if (sourceCodeLocation.hasMappedLocation()) {
            this.subtitle = sourceCodeLocation.formattedLocationString();

            if (sourceCodeLocation.hasFormattedLocation())
                this.subtitleElement.classList.add(WebInspector.BreakpointTreeElement.FormattedLocationStyleClassName);
            else
                this.subtitleElement.classList.remove(WebInspector.BreakpointTreeElement.FormattedLocationStyleClassName);

            this.tooltip = this.mainTitle + " \u2014 " + WebInspector.UIString("originally %s").format(sourceCodeLocation.originalLocationString());
        }
    },

    _updateStatus: function()
    {
        if (this._breakpoint.mode === WebInspector.Breakpoint.Mode.Disabled)
            this._statusImageElement.classList.add(WebInspector.BreakpointTreeElement.StatusImageDisabledStyleClassName);
        else
            this._statusImageElement.classList.remove(WebInspector.BreakpointTreeElement.StatusImageDisabledStyleClassName);

        if (this._breakpoint.mode === WebInspector.Breakpoint.Mode.AutoContinue)
            this._statusImageElement.classList.add(WebInspector.BreakpointTreeElement.StatusImageAutoContinueStyleClassName);
        else
            this._statusImageElement.classList.remove(WebInspector.BreakpointTreeElement.StatusImageAutoContinueStyleClassName);

        if (this._breakpoint.resolved)
            this._statusImageElement.classList.add(WebInspector.BreakpointTreeElement.StatusImageResolvedStyleClassName);
        else
            this._statusImageElement.classList.remove(WebInspector.BreakpointTreeElement.StatusImageResolvedStyleClassName);
    },

    _probeSetAdded: function(event)
    {
        var probeSet = event.data;
        if (probeSet.breakpoint !== this.breakpoint)
            return;

        probeSet.dataTable.addEventListener(WebInspector.ProbeSetDataTable.Event.FrameInserted, this._dataUpdated, this);
        probeSet.dataTable.addEventListener(WebInspector.ProbeSetDataTable.Event.FrameReplaced, this._dataUpdated, this);
    },

    _probeSetRemoved: function(event)
    {
        var probeSet = event.data;
        if (probeSet.breakpoint !== this.breakpoint)
            return;

        probeSet.dataTable.removeEventListener(WebInspector.ProbeSetDataTable.Event.FrameInserted, this._dataUpdated, this);
        probeSet.dataTable.removeEventListener(WebInspector.ProbeSetDataTable.Event.FrameReplaced, this._dataUpdated, this);
    },

    _dataUpdated: function()
    {
        if (this.element.classList.contains(WebInspector.BreakpointTreeElement.ProbeDataUpdatedStyleClassName)) {
            clearTimeout(this._currentTimeout);
            this.element.classList.remove(WebInspector.BreakpointTreeElement.ProbeDataUpdatedStyleClassName);
            // We want to restart the animation, which can only be done by removing the class,
            // performing layout, and re-adding the class. Try adding class back on next tick.
            setTimeout(this._dataUpdated.bind(this));
            return;
        }

        this.element.classList.add(WebInspector.BreakpointTreeElement.ProbeDataUpdatedStyleClassName);
        this._currentTimeout = setTimeout(function() {
            this.element.classList.remove(WebInspector.BreakpointTreeElement.ProbeDataUpdatedStyleClassName);
        }.bind(this), WebInspector.BreakpointTreeElement.ProbeDataUpdatedAnimationDuration);
    },

    _breakpointLocationDidChange: function(event)
    {
        console.assert(event.target === this._breakpoint);

        // The Breakpoint has a new display SourceCode. The sidebar will remove us. Stop listening to the breakpoint.
        if (event.data.oldDisplaySourceCode === this._breakpoint.displaySourceCode) {
            this._breakpoint.addEventListener(WebInspector.Breakpoint.Event.LocationDidChange, this._breakpointLocationDidChange, this);
            this._breakpoint.addEventListener(WebInspector.Breakpoint.Event.ModeDidChange, this._updateStatus, this);
            this._breakpoint.addEventListener(WebInspector.Breakpoint.Event.ResolvedStateDidChange, this._updateStatus, this);
            return;
        }

        this._updateTitles();
    },

    _statusImageElementMouseDown: function(event)
    {
        // To prevent the tree element from selecting.
        event.stopPropagation();
    },

    _statusImageElementClicked: function(event)
    {
        this._breakpoint.mode = this._breakpoint.nextMode;
    }
};

WebInspector.BreakpointTreeElement.prototype.__proto__ = WebInspector.GeneralTreeElement.prototype;
