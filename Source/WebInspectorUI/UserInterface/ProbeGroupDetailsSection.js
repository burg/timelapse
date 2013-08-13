/*
 * Copyright (C) 2013 University of Washington. All rights reserved.
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

WebInspector.ProbeGroupDetailsSection = function(probeGroup)
{
    console.assert(probeGroup instanceof WebInspector.ProbeGroupObject, "Tried to create details section for non-probe group", probeGroup);

    this._listeners = new WebInspector.EventListenerGroup(this, "Static per-probe group section event listeners.");
    this._probeGroup = probeGroup;

    var dummyTitle = "";

    var optionsElement = document.createElement("div");
    optionsElement.classList.add(WebInspector.ProbeGroupDetailsSection.SectionOptionsStyleClassName);
    var titleElement = this._probeGroupPositionTextOrLink();
    titleElement.classList.add(WebInspector.ProbeGroupDetailsSection.DontFloatLinkStyleClassName);
    optionsElement.appendChild(titleElement);

    var removeProbeButton = optionsElement.createChild("img");
    removeProbeButton.classList.add(WebInspector.ProbeGroupDetailsSection.ProbeRemoveStyleClassName);
    removeProbeButton.classList.add(WebInspector.ProbeGroupDetailsSection.ProbeButtonEnabledStyleClassName);
    this._listeners.register(removeProbeButton, "click", this._removeButtonClicked);

    var clearSamplesButton = optionsElement.createChild("img");
    clearSamplesButton.classList.add(WebInspector.ProbeGroupDetailsSection.ProbeClearSamplesStyleClassName);
    clearSamplesButton.classList.add(WebInspector.ProbeGroupDetailsSection.ProbeButtonEnabledStyleClassName);
    this._listeners.register(clearSamplesButton, "click", this._clearSamplesButtonClicked);

    var addProbeButton = optionsElement.createChild("img");
    addProbeButton.classList.add(WebInspector.ProbeGroupDetailsSection.AddProbeValueStyleClassName);
    this._listeners.register(addProbeButton, "click", this._addProbeButtonClicked);

    this._dataGrid = new WebInspector.ProbeGroupDataGrid(probeGroup);
    this._dataGrid.element.classList.add("inline");
    var singletonRow = new WebInspector.DetailsSectionRow;
    singletonRow.element.appendChild(this._dataGrid.element);
    var probeSectionGroup = new WebInspector.DetailsSectionGroup([singletonRow]);

    WebInspector.DetailsSection.call(this, "probe", dummyTitle, [probeSectionGroup], optionsElement);
    this.element.classList.add(WebInspector.ProbeGroupDetailsSection.StyleClassName);

    this._listeners.register(WebInspector.frameResourceManager, WebInspector.FrameResourceManager.Event.MainFrameDidChange, this._clearSamples)
    this._listeners.install();
};

WebInspector.ProbeGroupDetailsSection.AddProbeValueStyleClassName = "probe-add";
WebInspector.ProbeGroupDetailsSection.DontFloatLinkStyleClassName = "dont-float";
WebInspector.ProbeGroupDetailsSection.ProbeButtonEnabledStyleClassName = "enabled";
WebInspector.ProbeGroupDetailsSection.ProbePopoverElementStyleClassName = "probe-popover";
WebInspector.ProbeGroupDetailsSection.ProbeClearSamplesStyleClassName = "probe-clear-samples";
WebInspector.ProbeGroupDetailsSection.ProbeRemoveStyleClassName = "probe-remove";
WebInspector.ProbeGroupDetailsSection.SectionOptionsStyleClassName = "options";
WebInspector.ProbeGroupDetailsSection.StyleClassName = "probe-group";

WebInspector.ProbeGroupDetailsSection.prototype = {
    __proto__: WebInspector.DetailsSection.prototype,
    constructor: WebInspector.ProbeGroupDetailsSection,

    // Public

    closed: function()
    {
        this._listeners.uninstall(true);
        this.element.remove();
    },

    // Private

    _probeGroupPositionTextOrLink: function()
    {
        var shortUrl = parseURL(this._probeGroup.url).lastPathComponent || WebInspector.UIString("(unknown)");
        var title = WebInspector.UIString("%s:%d").format(shortUrl, this._probeGroup.position.lineNumber + 1);
        var sourceCodeLocation = this._probeGroup.sourceCodeLocation;
        if (!sourceCodeLocation)
            return document.createTextNode(title);
        return WebInspector.createSourceCodeLocationLink(sourceCodeLocation);
    },

    _addProbeButtonClicked: function(event)
    {
        function createProbeFromEnteredExpression(visiblePopover, event)
        {
            if (event.keyCode !== 13)
                return;
            var url = WebInspector.contentBrowser.currentContentView.resource.url;
            var expression = event.target.value;
            ProbeAgent.createScriptProbe(url, this._probeGroup.position.lineNumber, this._probeGroup.position.columnNumber, expression);
            visiblePopover.dismiss();
        }

        var popover = new WebInspector.Popover;
        var content = document.createElement("div");
        content.classList.add(WebInspector.ProbeGroupDetailsSection.ProbePopoverElementStyleClassName);
        content.createChild("div").textContent = "Add Another Value?";
        var textBox = content.createChild("input");
        textBox.addEventListener("keypress", createProbeFromEnteredExpression.bind(this, popover));
        textBox.addEventListener("click", function (event) {event.target.select()});
        textBox.type = "text";
        textBox.value = "Enter Expression";
        popover.content = content;
        var target = WebInspector.Rect.rectFromClientRect(event.target.getBoundingClientRect());
        popover.present(target, [WebInspector.RectEdge.MAX_Y, WebInspector.RectEdge.MIN_Y, WebInspector.RectEdge.MAX_X]);
    },

    _removeButtonClicked: function(event)
    {
        this._probeGroup.clear();

    },

    _clearSamples: function(event)
    {
        this._probeGroup.clearSamples();
        this._dataGrid.clearGridNodes();
    },

    _clearSamplesButtonClicked: function(event)
    {
        this._clearSamples();
    }
};
