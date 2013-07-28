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

    var shortUrl = parseURL(probeGroup.url).lastPathComponent || WebInspector.UIString("(unknown)");
    var title = WebInspector.UIString("Probe %s:%d").format(shortUrl, probeGroup.lineNumber + 1);

    var optionsElement = document.createElement("div");
    optionsElement.classList.add(WebInspector.ProbeGroupDetailsSection.SectionOptionsStyleClassName);

    var removeProbeButton = optionsElement.createChild("img");
    removeProbeButton.classList.add(WebInspector.ProbesSidebarPanel.ProbeRemoveStyleClassName);
    removeProbeButton.classList.add(WebInspector.ProbesSidebarPanel.ProbeButtonEnabledStyleClassName);
    this._listeners.register(removeProbeButton, "click", this._removeButtonClicked);

    var probeToggleElement = optionsElement.createChild("img");
    probeToggleElement.classList.add(WebInspector.ProbesSidebarPanel.ProbeToggleStyleClassName);
    probeToggleElement.classList.add(WebInspector.ProbesSidebarPanel.ProbeButtonEnabledStyleClassName);
    this._listeners.register(probeToggleElement, "click", this._probesToggleButtonClicked);

    var probeColorButton = optionsElement.createChild("div");
    probeColorButton.style.backgroundColor = WebInspector.ProbesSidebarPanel.DefaultProbeColor;
    probeColorButton.classList.add(WebInspector.ProbesSidebarPanel.ProbeColorStyleClassName);
    probeColorButton.classList.add(WebInspector.ProbesSidebarPanel.ProbeButtonEnabledStyleClassName);
    this._listeners.register(probeColorButton, "click", this._probeColorButtonClicked);

    var addProbeValue = optionsElement.createChild("img");
    addProbeValue.classList.add(WebInspector.ProbesSidebarPanel.AddProbeValueStyleClassName);
    this._listeners.register(addProbeValue, "click", this._addProbeButtonClicked);

    // FIXME: extract to ProbeGroupDataTable
    var container = document.createElement("div");
    container.classList.add(WebInspector.ProbesSidebarPanel.ProbeTableContainerColumnStyleClassName);
    var dataTable = container.createChild("table");
    var tableHeader = dataTable.createChild("tr");
    var initialExpression = tableHeader.createChild("th");
    initialExpression.textContent = probeGroup.probes.lastValue._expression;
    initialExpression.addEventListener("click", this._changeProbeValue.bind(this));
    initialExpression.classList.add(WebInspector.ProbesSidebarPanel.MainProbeColumnStyleClassName);

    WebInspector.probeManager.addEventListener(WebInspector.ProbeManager.Event.SamplesChanged, this._addSampleToTable.bind(this, dataTable));

    var singletonRow = new WebInspector.DetailsSectionRow;
    singletonRow.element.appendChild(container);

    var probeSectionGroup = new WebInspector.DetailsSectionGroup([singletonRow]);

    WebInspector.DetailsSection.call(this, "probe", title, [probeSectionGroup], optionsElement);

    this._listeners.install();
};

WebInspector.ProbeGroupDetailsSection.SectionOptionsStyleClassName = "options";

WebInspector.ProbeGroupDetailsSection.prototype = {
    __proto__: WebInspector.DetailsSection.prototype,
    constructor: WebInspector.ProbeGroupDetailsSection,

    // Public

    closed: function()
    {
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
        content.classList.add(WebInspector.ProbesSidebarPanel.ProbePopoverElementStyleClassName);
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
        var section = event.target.parentElement.parentElement.parentElement;
        section.parentElement.removeChild(section);
        //this._removeProbe(probe);
    },

    _probeColorButtonClicked: function(probeGroup, event)
    {
        var popover = new WebInspector.Popover;

        var colorContainer = document.createElement("div");
        colorContainer.classList.add(WebInspector.ProbesSidebarPanel.ProbePopoverElementStyleClassName);
        colorContainer.classList.add(WebInspector.ProbesSidebarPanel.ColorContainerStyleClassName);
        var colors = WebInspector.ProbesSidebarPanel.ProbeColorValues;
        for (var i = 0; i <= colors.length - 1; i++) {
            var color = colorContainer.createChild("div");
            color.textContent = colors[i];
            color.classList.add(WebInspector.ProbesSidebarPanel.ColorStyleClassName);
            color.addEventListener("click", this._updateColor.bind(this, colors[i], probeGroup, event.target, popover));
        };

        popover.content = colorContainer;
        var target = WebInspector.Rect.rectFromClientRect(event.target.getBoundingClientRect());
        popover.present(target, [WebInspector.RectEdge.MAX_Y, WebInspector.RectEdge.MIN_Y, WebInspector.RectEdge.MAX_X]);
    },

    _probesToggleButtonClicked: function(event)
    {
        if (event.target.classList.contains(WebInspector.ProbesSidebarPanel.ProbeButtonEnabledStyleClassName)) {
            console.log("Probe toggle clicked to disable");
            event.target.classList.remove(WebInspector.ProbesSidebarPanel.ProbeButtonEnabledStyleClassName);
            //probeManager.disableProbe(probe);
        } else {
            console.log("Probe toggle clicked to enable");
            event.target.classList.add(WebInspector.ProbesSidebarPanel.ProbeButtonEnabledStyleClassName);
            //probeManager.enableProbe(probe);
        }
        //WebInspector.probeManager.probesEnabled = this._probesToggleElement.classList.toggle(WebInspector.ProbesSidebarPanel.ProbeToggleEnabledStyleClassName);
    },

    // FIXME: extract to ProbeGroupDataTable
    _addSampleToTable: function(table, event)
    {
        var newRow = table.createChild("tr");
        var newCell = newRow.createChild("td");
        newCell.classList.add(WebInspector.ProbesSidebarPanel.MainProbeColumnStyleClassName);
        newCell.textContent = event.data.samples.lastValue.value;
    },

    _changeProbeValue: function(event)
    {
        var textBox = document.createElement("input");
        textBox.addEventListener("keypress", this._updateProbe.bind(this));
        textBox.addEventListener("click", (function (event) {event.target.select()}));
        textBox.type = "text";
        textBox.value = "Enter Expression";
        event.target.innerHTML = "";
        event.target.appendChild(textBox);
    },

    _updateColor: function(color, probeGroup, colorButton, popover, event)
    {
        probeGroup.color = color;
        colorButton.style.backgroundColor = color;
        popover.dismiss();
    },

    _updateProbe: function(event)
    {
        if (event.keyCode !== 13)
            return;
        event.target.parentElement.textContent = event.target.value;
        // Use event.target.value to modify probes! Or delete if == "".
    },
};
