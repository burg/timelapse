/*
 * Copyright (C) 2013, University of Washington. All rights reserved.
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

WebInspector.ProbesSidebarPanel = function()
{
	WebInspector.NavigationSidebarPanel.call(this, "probes", WebInspector.UIString("Probes"), "Images/NavigationItemProbes.pdf", "4", true);

    WebInspector.Frame.addEventListener(WebInspector.Frame.Event.MainResourceDidChange, this._mainResourceChanged, this);
    WebInspector.Frame.addEventListener(WebInspector.Frame.Event.ResourceWasAdded, this._resourceAdded, this);

    WebInspector.probeManager.addEventListener(WebInspector.ProbeManager.Event.GroupAdded, this._groupAdded, this);
    //???????.addEventListener(WebInspector.ProbeGroupObject.Event.ProbesChanged, this._groupChanged, this);

    this._probeGroups = {};
    this._navigationBar = new WebInspector.NavigationBar;
    this.element.appendChild(this._navigationBar.element);

    this._probesRecordStopButtonItem = new WebInspector.ToggleButtonNavigationItem("probes-record-stop", WebInspector.UIString("Click to play"), WebInspector.UIString("Click to pause"), "Images/Resume.pdf", "Images/Pause.pdf", 16, 16);
    this._probesRecordStopButtonItem.addEventListener(WebInspector.ButtonNavigationItem.Event.Clicked, this._probesRecordStopButtonClicked, this);
    this._navigationBar.addNavigationItem(this._probesRecordStopButtonItem);

    // Add this offset-sections class name so the sticky headers don't overlap the navigation bar.
    this.element.classList.add(WebInspector.ProbesSidebarPanel.OffsetSectionsStyleClassName);

    this.filterBar.placeholder = WebInspector.UIString("Filter Probes List");

    //WebInspector.Probe.addEventListener(WebInspector.Probe.Event.DisplayLocationDidChange, this._probeDisplayLocationDidChange, this);

};

WebInspector.ProbesSidebarPanel.OffsetSectionsStyleClassName  = "offset-sections";
WebInspector.ProbesSidebarPanel.ProbeOptionsStyleClassName = "options";
WebInspector.ProbesSidebarPanel.ProbeColorStyleClassName = "probe-color";
WebInspector.ProbesSidebarPanel.ProbeToggleStyleClassName = "probe-toggle";
WebInspector.ProbesSidebarPanel.ProbeRemoveStyleClassName = "probe-remove";
WebInspector.ProbesSidebarPanel.AddProbeValueStyleClassName = "probe-add";
WebInspector.ProbesSidebarPanel.ProbeButtonEnabledStyleClassName = "enabled";
WebInspector.ProbesSidebarPanel.ProbeTableContainerColumnStyleClassName = "table-container";
WebInspector.ProbesSidebarPanel.MainProbeColumnStyleClassName = "main-column";
WebInspector.ProbesSidebarPanel.ProbePopoverElementStyleClassName = "probe-popover";
WebInspector.ProbesSidebarPanel.ColorContainerStyleClassName = "color-container";
WebInspector.ProbesSidebarPanel.ColorStyleClassName = "color";
WebInspector.ProbesSidebarPanel.ProbeColorValues = ["Yellow", "Red", "Blue", "Green", "Pink", "Orange", "Purple"];
WebInspector.ProbesSidebarPanel.DefaultProbeColor = "Yellow";

WebInspector.ProbesSidebarPanel.prototype = {
    constructor: WebInspector.ProbesSidebarPanel,

    // Private
    _resourceAdded: function(event)
    {
        var resource = event.data.resource;
        this._addProbesForSourceCode(resource);
    },

    _mainResourceChanged: function(event)
    {
        var resource = event.target.mainResource;
        this._addProbesForSourceCode(resource);
    },

	_addProbesForSourceCode: function(sourceCode)
    {
        //var probes = WebInspector.probeManager.probesForSourceCode(sourceCode);
        //for (var i = 0; i < probes.length; ++i)
        //    this._addProbe(probes[i], sourceCode);
    },

    _addTable: function(probeGroup) /*probe, sourceCode*/
    {
        var container = document.createElement("div");
        container.classList.add(WebInspector.ProbesSidebarPanel.ProbeTableContainerColumnStyleClassName);
        var dataTable = container.createChild("table");
        this._probeGroups[probeGroup.url + ":" + probeGroup.lineNumber] = dataTable;
        var tableHeader = dataTable.createChild("tr");
        var initialExpression = tableHeader.createChild("th");
        initialExpression.textContent = probeGroup.probes.lastValue._expression;
        initialExpression.addEventListener("click", this._changeProbeValue.bind(this));
        initialExpression.classList.add(WebInspector.ProbesSidebarPanel.MainProbeColumnStyleClassName);

        WebInspector.probeManager.addEventListener(WebInspector.ProbeManager.Event.SamplesChanged, this._addSampleToTable.bind(this, dataTable));
        /* Harcoded sample data...
        var foo = tableHeader.createChild("th");
        foo.textContent = "$0.foo";
        foo.addEventListener("click", this._changeProbeValue.bind(this));
        var bar = tableHeader.createChild("th");
        bar.textContent = "$0.bar";
        bar.addEventListener("click", this._changeProbeValue.bind(this));
        var baz = tableHeader.createChild("th")
        baz.textContent = "$0.baz";
        baz.addEventListener("click", this._changeProbeValue.bind(this));
        var mumble = tableHeader.createChild("th")
        mumble.textContent = "$0.mumble";
        mumble.addEventListener("click", this._changeProbeValue.bind(this));
        var bumble = tableHeader.createChild("th")
        bumble.textContent = "$0.bumble";
        bumble.addEventListener("click", this._changeProbeValue.bind(this));

        var tableRowOne = dataTable.createChild("tr");
        var o1 = tableRowOne.createChild("td");
        o1.textContent = "Object T1";
        o1.classList.add(WebInspector.ProbesSidebarPanel.MainProbeColumnStyleClassName);
        tableRowOne.createChild("td").textContent = "Foo T1";
        tableRowOne.createChild("td").textContent = "Bar T1";
        tableRowOne.createChild("td").textContent = "Baz T1";
        var tableRowTwo = dataTable.createChild("tr");
        var o2 = tableRowTwo.createChild("td");
        o2.textContent = "Object T2";
        o2.classList.add(WebInspector.ProbesSidebarPanel.MainProbeColumnStyleClassName);
        tableRowTwo.createChild("td").textContent = "Foo T2";
        tableRowTwo.createChild("td").textContent = "Bar T2";
        tableRowTwo.createChild("td").textContent = "Baz T2";
        var tableRowThree = dataTable.createChild("tr");
        var o3 = tableRowThree.createChild("td");
        o3.textContent = "Object T3";
        o3.classList.add(WebInspector.ProbesSidebarPanel.MainProbeColumnStyleClassName);
        tableRowThree.createChild("td").textContent = "Foo T3";
        tableRowThree.createChild("td").textContent = "Bar T3";
        tableRowThree.createChild("td").textContent = "Baz T3";*/

        var probesRow = new WebInspector.DetailsSectionRow;
        probesRow.element.appendChild(container);

        var probeOptions = document.createElement("div");
        probeOptions.classList.add(WebInspector.ProbesSidebarPanel.ProbeOptionsStyleClassName);

        var removeProbeButton = probeOptions.createChild("img");
        removeProbeButton.classList.add(WebInspector.ProbesSidebarPanel.ProbeRemoveStyleClassName); 
        removeProbeButton.classList.add(WebInspector.ProbesSidebarPanel.ProbeButtonEnabledStyleClassName);
        removeProbeButton.addEventListener("click", this._removeButtonClicked.bind(this));

        var probeToggleElement = probeOptions.createChild("img");
        probeToggleElement.classList.add(WebInspector.ProbesSidebarPanel.ProbeToggleStyleClassName);
        probeToggleElement.classList.add(WebInspector.ProbesSidebarPanel.ProbeButtonEnabledStyleClassName);
        probeToggleElement.addEventListener("click", this._probesToggleButtonClicked.bind(this));

        var probeColorButton = probeOptions.createChild("div");
        probeColorButton.style.backgroundColor = WebInspector.ProbesSidebarPanel.DefaultProbeColor;
        probeColorButton.classList.add(WebInspector.ProbesSidebarPanel.ProbeColorStyleClassName);
        probeColorButton.classList.add(WebInspector.ProbesSidebarPanel.ProbeButtonEnabledStyleClassName);
        probeColorButton.addEventListener("click", this._probeColorButtonClicked.bind(this, probeGroup));

        var addProbeValue = probeOptions.createChild("img");
        addProbeValue.classList.add(WebInspector.ProbesSidebarPanel.AddProbeValueStyleClassName);
        addProbeValue.addEventListener("click", this._probeAddButtonClicked.bind(this, probeGroup.lineNumber));

        var probesSectionGroup = new WebInspector.DetailsSectionGroup([probesRow]);
        
        var probesSection = new WebInspector.DetailsSection("probe", WebInspector.UIString("Probe %s:%d").format(probeGroup.url.split("/").lastValue, probeGroup.lineNumber+1), [probesSectionGroup], probeOptions);
        this.contentElement.appendChild(probesSection.element);

        probeGroup.color = probeGroup.color;

    },

    _updateExistingTable: function(probeGroup, dataTable)
    {
        console.log("Update Table");
    },

    _removeProbe: function(event, probe)
    {
    	//Probably just use probeManager.removeProbe(probe) then this._probeRemoved
    	console.log("Remove Probe.");
    },

    _groupAdded: function(event)
    {
        var probeGroup = event.data;
        // Assert group doens't already exist?
        probeGroup.addEventListener(WebInspector.ProbeGroupObject.Event.ProbesChanged, this._groupChanged, this);
        this._addTable(probeGroup);
    },

    _groupChanged: function(event)
    {
        var probeGroup = event.data;
        // Assert group already exists?
        this._updateExistingTable(probeGroup, this._probeGroups[probeGroup.url + ":" + probeGroup.lineNumber]);
    },

    _probeRemoved: function(event)
    {

    },

    _addSampleToTable: function(table, event)
    {
        var newRow = table.createChild("tr");
        var newColumnElement = newRow.createChild("td");
        newColumnElement.classList.add(WebInspector.ProbesSidebarPanel.MainProbeColumnStyleClassName);
        newColumnElement.textContent = event.data.samples.lastValue.value;
    },

    _addNewColumn: function(event)
    {
        console.log("ADD NEW PROBE + COLUMN");
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

    _updateProbe: function(event)
    {
		if (event.keyCode !== 13)
			return;
		event.target.parentElement.textContent = event.target.value;
		// Use event.target.value to modify probes! Or delete if == "".
    },

    _updateColor: function(color, probeGroup, colorButton, popover, event)
    {
        probeGroup.color = color;
        colorButton.style.backgroundColor = color;
        popover.dismiss();
    },

    _probeAddButtonClicked: function(lineNumber, event)
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

    _probesRecordStopButtonClicked: function(event)
    {
    	if (WebInspector.replayManager.replayState === WebInspector.ReplayManager.ReplayState.CanReplay)
    		WebInspector.replayManager.replayToCompletionSoon(true, WebInspector.replayManager.replayState);
    	else
    		WebInspector.replayManager.pausePlaybackSoon();
    }
};

WebInspector.ProbesSidebarPanel.prototype.__proto__ = WebInspector.NavigationSidebarPanel.prototype;

