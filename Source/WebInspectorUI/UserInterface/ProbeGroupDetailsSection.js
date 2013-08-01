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

    var shortUrl = parseURL(probeGroup.url).lastPathComponent || WebInspector.UIString("(unknown)");
    var title = WebInspector.UIString("Probe %s:%d").format(shortUrl, probeGroup.lineNumber + 1);

    var optionsElement = document.createElement("div");
    optionsElement.classList.add(WebInspector.ProbeGroupDetailsSection.SectionOptionsStyleClassName);

    var removeProbeButton = optionsElement.createChild("img");
    removeProbeButton.classList.add(WebInspector.ProbeGroupDetailsSection.ProbeRemoveStyleClassName);
    removeProbeButton.classList.add(WebInspector.ProbeGroupDetailsSection.ProbeButtonEnabledStyleClassName);
    this._listeners.register(removeProbeButton, "click", this._removeButtonClicked);

    var toggleButton = optionsElement.createChild("img");
    toggleButton.classList.add(WebInspector.ProbeGroupDetailsSection.ProbeToggleStyleClassName);
    toggleButton.classList.add(WebInspector.ProbeGroupDetailsSection.ProbeButtonEnabledStyleClassName);
    this._listeners.register(toggleButton, "click", this._toggleButtonClicked);

    this._colorSelectorElement = optionsElement.createChild("div");
    this._colorSelectorElement.style.backgroundColor = WebInspector.ProbeGroupDetailsSection.DefaultProbeColor;
    this._colorSelectorElement.classList.add(WebInspector.ProbeGroupDetailsSection.ProbeColorStyleClassName);
    this._colorSelectorElement.classList.add(WebInspector.ProbeGroupDetailsSection.ProbeButtonEnabledStyleClassName);
    this._listeners.register(this._colorSelectorElement, "click", this._colorSelectorElementClicked);

    var addProbeButton = optionsElement.createChild("img");
    addProbeButton.classList.add(WebInspector.ProbeGroupDetailsSection.AddProbeValueStyleClassName);
    this._listeners.register(addProbeButton, "click", this._addProbeButtonClicked.bind(this, this._probeGroup.lineNumber));

    var dataTable = new WebInspector.ProbesDataGrid(probeGroup);
    var singletonRow = new WebInspector.DetailsSectionRow;
    singletonRow.element.appendChild(dataTable.element);
    var probeSectionGroup = new WebInspector.DetailsSectionGroup([singletonRow]);

    WebInspector.DetailsSection.call(this, "probe", title, [probeSectionGroup], optionsElement);

    // FIXME: the gutter should be managed and set by a view controller, not the model.
    this._gutterElement = document.createElement("div");
    this._gutterElement.classList.add(WebInspector.ProbeGroupDetailsSection.ProbeGutterStyleClassName);
    this._gutterElement.textContent = probeGroup.lineNumber + 1;

    this._updateColor();
    // FIXME: this will not work if the current view does not contain the probe.
    WebInspector.contentBrowser.currentContentView.responseContentView.textEditor._codeMirror.doc.cm.setGutterMarker(this._probeGroup.lineNumber, "CodeMirror-linenumbers", this._gutterElement);

    this._listeners.register(probeGroup, WebInspector.ProbeGroupObject.Event.PropertiesChanged, this._updateColor);
    this._listeners.install();
};

WebInspector.ProbeGroupDetailsSection.SectionOptionsStyleClassName = "options";
WebInspector.ProbeGroupDetailsSection.ProbeColorStyleClassName = "probe-color";
WebInspector.ProbeGroupDetailsSection.ProbeToggleStyleClassName = "probe-toggle";
WebInspector.ProbeGroupDetailsSection.ProbeRemoveStyleClassName = "probe-remove";
WebInspector.ProbeGroupDetailsSection.AddProbeValueStyleClassName = "probe-add";
WebInspector.ProbeGroupDetailsSection.ProbeButtonEnabledStyleClassName = "enabled";
WebInspector.ProbeGroupDetailsSection.ProbePopoverElementStyleClassName = "probe-popover";
WebInspector.ProbeGroupDetailsSection.ColorContainerStyleClassName = "color-container";
WebInspector.ProbeGroupDetailsSection.ProbeGutterStyleClassName = "probe-gutter";
WebInspector.ProbeGroupDetailsSection.ColorStyleClassName = "color";
WebInspector.ProbeGroupDetailsSection.ProbeColorValues = [new WebInspector.Color("yellow"), new WebInspector.Color("red"), new WebInspector.Color("blue"), new WebInspector.Color("green"), new WebInspector.Color("pink"), new WebInspector.Color("orange"), new WebInspector.Color("purple")];
WebInspector.ProbeGroupDetailsSection.DefaultProbeColor = new WebInspector.Color("yellow");


WebInspector.ProbeGroupDetailsSection.prototype = {
    __proto__: WebInspector.DetailsSection.prototype,
    constructor: WebInspector.ProbeGroupDetailsSection,

    // Public

    closed: function()
    {
        // FIXME: this will not work if the current view does not contain the probe.
        WebInspector.contentBrowser.currentContentView.responseContentView.textEditor._codeMirror.doc.cm.setGutterMarker(this._probeGroup.lineNumber, "CodeMirror-linenumbers", null);
        this._listeners.uninstall(true);
    },

    // Private

    _addProbeButtonClicked: function(lineNumber, event)
    {
        function getInitialProbeExpression(popover, event)
        {
            if (event.keyCode !== 13)
                return;
            var url = WebInspector.contentBrowser.currentContentView.resource.url;
            ProbeAgent.createScriptProbe(url, lineNumber, 0, event.target.value);
            popover.dismiss();
        }

        var popover = new WebInspector.Popover;
        var content = document.createElement("div");
        content.classList.add(WebInspector.ProbeGroupDetailsSection.ProbePopoverElementStyleClassName);
        content.createChild("div").textContent = "Add Another Value?";
        var textBox = content.createChild("input");
        textBox.addEventListener("keypress", getInitialProbeExpression.bind(this, popover));
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

    _colorSelectorElementClicked: function(event)
    {
        var popover = new WebInspector.Popover;

        var updateProbeGroupColor = function(group, color, usedPopover) {
            group.color = color;
            usedPopover.dismiss();
        };

        // TODO: Port to use upstream color picker widget.
        var colorContainer = document.createElement("div");
        colorContainer.classList.add(WebInspector.ProbeGroupDetailsSection.ProbePopoverElementStyleClassName);
        colorContainer.classList.add(WebInspector.ProbeGroupDetailsSection.ColorContainerStyleClassName);
        var colors = WebInspector.ProbeGroupDetailsSection.ProbeColorValues;
        for (var i = 0; i <= colors.length - 1; i++) {
            var color = colorContainer.createChild("div");
            color.textContent = colors[i].toString();
            color.classList.add(WebInspector.ProbeGroupDetailsSection.ColorStyleClassName);
            color.addEventListener("click", updateProbeGroupColor.bind(this, this._probeGroup, colors[i], popover));
        };

        popover.content = colorContainer;
        var target = WebInspector.Rect.rectFromClientRect(event.target.getBoundingClientRect());
        popover.present(target, [WebInspector.RectEdge.MAX_Y, WebInspector.RectEdge.MIN_Y, WebInspector.RectEdge.MAX_X]);
    },

    _toggleButtonClicked: function(event)
    {
        console.log("TODO: probe group section toggle button clicked.");
    },

    _updateColor: function()
    {
        this._colorSelectorElement.style.backgroundColor = this._probeGroup.color;
        this._gutterElement.style.backgroundColor = this._probeGroup.color;
    }
};
