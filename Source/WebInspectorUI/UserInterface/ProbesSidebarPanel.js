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

    //WebInspector.probeManager.addEventListener(WebInspector.ProbesManager.Event.ProbeAdded, this._probeAdded, this);
    //WebInspector.probeManager.addEventListener(WebInspector.ProbesManager.Event.ProbeRemoved, this._probeRemoved, this);

	this._navigationBar = new WebInspector.NavigationBar;
    this.element.appendChild(this._navigationBar.element);

    this._probesRecordStopButtonItem = new WebInspector.ToggleButtonNavigationItem("probes-record-stop", WebInspector.UIString("Click to play"), WebInspector.UIString("Click to pause"), "Images/Resume.pdf", "Images/Pause.pdf", 16, 16);
    this._probesRecordStopButtonItem.addEventListener(WebInspector.ButtonNavigationItem.Event.Clicked, this._probesRecordStopButtonClicked, this);
    this._navigationBar.addNavigationItem(this._probesRecordStopButtonItem);

    // Add this offset-sections class name so the sticky headers don't overlap the navigation bar.
    this.element.classList.add(WebInspector.ProbesSidebarPanel.OffsetSectionsStyleClassName);

    this.filterBar.placeholder = WebInspector.UIString("Filter Probes List");

    this._probesContentTreeOutline = this.contentTreeOutline;
    this._probesContentTreeOutline.onselect = this._treeElementSelected.bind(this);
    this._probesContentTreeOutline.ondelete = this._probeTreeOutlineDeleteTreeElement.bind(this);
    this._probesContentTreeOutline.oncontextmenu = this._probeTreeOutlineContextMenuTreeElement.bind(this);

    // Note: I think for probes we will want to get rid of the content tree outline and row
    // and add directly to the group seeing as each probe will only have one associated table?
    // Left for now because it impacts many later functions.
	var dataTable = this._probesContentTreeOutline.element.createChild("table");
	var tableHeader = dataTable.createChild("tr");
	var mainObject = tableHeader.createChild("th");
	mainObject.textContent = "$0";
	mainObject.addEventListener("click", this._changeProbeValue.bind(this));
	var foo = tableHeader.createChild("th");
	foo.textContent = "$0.foo";
	foo.addEventListener("click", this._changeProbeValue.bind(this));
	var bar = tableHeader.createChild("th");
	bar.textContent = "$0.bar";
	bar.addEventListener("click", this._changeProbeValue.bind(this));
	var baz = tableHeader.createChild("th")
	baz.textContent = "$0.baz";
	baz.addEventListener("click", this._changeProbeValue.bind(this));

	var tableRowOne = dataTable.createChild("tr");
	tableRowOne.createChild("td").textContent = "Object T1";
	tableRowOne.createChild("td").textContent = "Foo T1";
	tableRowOne.createChild("td").textContent = "Bar T1";
	tableRowOne.createChild("td").textContent = "Baz T1";
	var tableRowTwo = dataTable.createChild("tr");
	tableRowTwo.createChild("td").textContent = "Object T2";
	tableRowTwo.createChild("td").textContent = "Foo T2";
	tableRowTwo.createChild("td").textContent = "Bar T2";
	tableRowTwo.createChild("td").textContent = "Baz T2";
	var tableRowThree = dataTable.createChild("tr");
	tableRowThree.createChild("td").textContent = "Object T3";
	tableRowThree.createChild("td").textContent = "Foo T3";
	tableRowThree.createChild("td").textContent = "Bar T3";
	tableRowThree.createChild("td").textContent = "Baz T3";

    var probesRow = new WebInspector.DetailsSectionRow;
    probesRow.element.appendChild(this._probesContentTreeOutline.element);

	var probeOptions = document.createElement("div");
	probeOptions.classList.add(WebInspector.ProbesSidebarPanel.ProbeOptionsStyleClassName);

    var removeProbeButton = probeOptions.createChild("img");
    removeProbeButton.classList.add(WebInspector.ProbesSidebarPanel.ProbeRemoveStyleClassName); 
    removeProbeButton.classList.add(WebInspector.ProbesSidebarPanel.ProbeButtonEnabledStyleClassName);
    removeProbeButton.addEventListener("click", this._removeProbe.bind(this));

    var probeToggleElement = probeOptions.createChild("img");
    probeToggleElement.classList.add(WebInspector.ProbesSidebarPanel.ProbeToggleStyleClassName);
    if (true/*WebInspector.probeManager.probesEnabled*/)
        probeToggleElement.classList.add(WebInspector.ProbesSidebarPanel.ProbeButtonEnabledStyleClassName);
    probeToggleElement.addEventListener("click", this._probesToggleButtonClicked.bind(this));


    var probesGroup = new WebInspector.DetailsSectionGroup([probesRow]);
    var probesSection = new WebInspector.DetailsSection("probe", WebInspector.UIString("Probe %d").format(1), [probesGroup], probeOptions);
    this.contentElement.appendChild(probesSection.element);

    //WebInspector.Probe.addEventListener(WebInspector.Probe.Event.DisplayLocationDidChange, this._probeDisplayLocationDidChange, this);

};

WebInspector.ProbesSidebarPanel.OffsetSectionsStyleClassName  = "offset-sections";
WebInspector.ProbesSidebarPanel.ProbeOptionsStyleClassName = "options";
WebInspector.ProbesSidebarPanel.ProbeToggleStyleClassName = "probe-toggle";
WebInspector.ProbesSidebarPanel.ProbeRemoveStyleClassName = "probe-remove";
WebInspector.ProbesSidebarPanel.ProbeButtonEnabledStyleClassName = "enabled";

WebInspector.ProbesSidebarPanel.prototype = {
    constructor: WebInspector.ProbesSidebarPanel,

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

    _addProbe: function(probe, sourceCode)
    {
    	console.log("Adding Probe");
        //var sourceCode = probe.sourceCodeLocation.displaySourceCode;
        //if (!sourceCode)
        //    return null;

        //var parentTreeElement = this._probesContentTreeOutline.getCachedTreeElement(sourceCode);
        //if (!parentTreeElement) {
        //    if (sourceCode instanceof WebInspector.SourceMapResource)
        //        parentTreeElement = new WebInspector.SourceMapResourceTreeElement(sourceCode);
        //    else if (sourceCode instanceof WebInspector.Resource)
        //        parentTreeElement = new WebInspector.ResourceTreeElement(sourceCode);
        //    else if (sourceCode instanceof WebInspector.Script)
        //        parentTreeElement = new WebInspector.ScriptTreeElement(sourceCode);
        //}

        //if (!parentTreeElement.parent) {
        //    parentTreeElement.hasChildren = true;
        //    parentTreeElement.expand();

        //    this._probesContentTreeOutline.insertChild(parentTreeElement, insertionIndexForObjectInListSortedByFunction(parentTreeElement, this._probesContentTreeOutline.children, this._compareTopLevelTreeElements.bind(this)));
        //}

        //// Mark disabled probes as resolved if there is source code loaded with that URL.
        //// This gives the illusion the probe was resolved, but since we don't send disabled
        //// probes to the backend we don't know for sure. If the user enables the probe
        //// it will be resolved properly.
        //if (probe.disabled)
        //    probe.resolved = true;

        //var probeTreeElement = new WebInspector.ProbeTreeElement(probe);
        //parentTreeElement.insertChild(probeTreeElement, insertionIndexForObjectInListSortedByFunction(probeTreeElement, parentTreeElement.children, this._compareProbeTreeElements));
        //return probeTreeElement;
    },

    _removeProbe: function(event, probe)
    {
    	//Probably just use probeManager.removeProbe(probe) then this._probeRemoved
    	console.log("Remove Probe.");
    },

    _probeAdded: function(event)
    {
        var probe = event.data.probe;
        this._addProbe(probe);
    },

    _probeRemoved: function(event)
    {
        var probe = event.data.probe;

        var probeTreeElement = this._probesContentTreeOutline.getCachedTreeElement(probe);
        console.assert(probeTreeElement);
        if (!probeTreeElement)
            return;

        this._removeProbeTreeElement(probeTreeElement);
    },

    _changeProbeValue: function(event)
    {
    	var textBox = document.createElement("input");
    	textBox.addEventListener("keypress", this._updateProbe.bind(this));
    	textBox.type = "text"
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

    _probesToggleButtonClicked: function(event)
    {
        console.log("Probe toggle clicked");
        //WebInspector.probeManager.probesEnabled = this._probesToggleElement.classList.toggle(WebInspector.ProbesSidebarPanel.ProbeToggleEnabledStyleClassName);
    },

    _probesRecordStopButtonClicked: function(event)
    {
    	if (WebInspector.replayManager.replayState === WebInspector.ReplayManager.ReplayState.CanReplay)
    		WebInspector.replayManager.replayToCompletionSoon(true, WebInspector.replayManager.replayState);
    	else
    		WebInspector.replayManager.pausePlaybackSoon();
    },

    _removeProbeTreeElement: function(probeTreeElement)
    {
        var parentTreeElement = probeTreeElement.parent;
        parentTreeElement.removeChild(probeTreeElement);

        console.assert(parentTreeElement.parent === this._probesContentTreeOutline);

        if (!parentTreeElement.children.length)
            this._probesContentTreeOutline.removeChild(parentTreeElement);
    },

    _treeElementSelected: function(treeElement, selectedByUser)
    {

    },

    _probeTreeOutlineDeleteTreeElement: function(treeElement)
    {

    },

    _probeTreeOutlineContextMenuTreeElement: function(event, treeElement)
    {

    },

    _compareTopLevelTreeElements: function(a, b)
    {
        //if (a === this._allExceptionsProbeTreeElement)
        //    return -1;
        //if (b === this._allExceptionsProbeTreeElement)
        //    return 1;

        //if (a === this._allUncaughtExceptionsProbeTreeElement)
        //    return -1;
        //if (b === this._allUncaughtExceptionsProbeTreeElement)
        //    return 1;

        //return a.mainTitle.localeCompare(b.mainTitle);
    },

    _compareProbeTreeElements: function(a, b)
    {
        //var aLocation = a.probe.sourceCodeLocation;
        //var bLocation = b.probe.sourceCodeLocation;

        //var comparisonResult = aLocation.displayLineNumber - bLocation.displayLineNumber
        //if (comparisonResult !== 0)
        //    return comparisonResult;

        //return aLocation.displayColumnNumber - bLocation.displayColumnNumber;
    }
};

WebInspector.ProbesSidebarPanel.prototype.__proto__ = WebInspector.NavigationSidebarPanel.prototype;

