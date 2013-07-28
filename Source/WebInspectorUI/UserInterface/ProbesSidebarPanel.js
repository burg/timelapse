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

    WebInspector.probeManager.addEventListener(WebInspector.ProbeManager.Event.ProbeGroupAdded, this._probeGroupAdded, this);
    WebInspector.probeManager.addEventListener(WebInspector.ProbeManager.Event.ProbeGroupRemoved, this._probeGroupRemoved, this);

    this._probeGroupSectionsByKey = {};
    this._probeGroupSections = [];
    this._navigationBar = new WebInspector.NavigationBar;
    this.element.appendChild(this._navigationBar.element);

    this._probesRecordStopButtonItem = new WebInspector.ToggleButtonNavigationItem("probes-record-stop", WebInspector.UIString("Click to play"), WebInspector.UIString("Click to pause"), "Images/Resume.pdf", "Images/Pause.pdf", 16, 16);
    this._probesRecordStopButtonItem.addEventListener(WebInspector.ButtonNavigationItem.Event.Clicked, this._probesRecordStopButtonClicked, this);
    this._navigationBar.addNavigationItem(this._probesRecordStopButtonItem);

    // Add this offset-sections class name so the sticky headers don't overlap the navigation bar.
    this.element.classList.add(WebInspector.ProbesSidebarPanel.OffsetSectionsStyleClassName);

    // TODO: (Issue #313): Implement filter/search capabilities for the probes sidebar panel.
    this.filterBar.placeholder = WebInspector.UIString("Filter Probes List");
};

WebInspector.ProbesSidebarPanel.OffsetSectionsStyleClassName  = "offset-sections";
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
    __proto__: WebInspector.NavigationSidebarPanel.prototype,

    // Private

    _probeGroupAdded: function(event)
    {
        var probeGroup = event.data;
        console.assert(!(probeGroup.groupKey in this._probeGroupSectionsByKey), "New probe group ", probeGroup, " already has its own sidebar.");

        var probesSection = new WebInspector.ProbeGroupDetailsSection(probeGroup);
        this._probeGroupSectionsByKey[probeGroup.groupKey] = probesSection;
        this._probeGroupSections.push(probesSection);
        this.contentElement.appendChild(probesSection.element);
    },


    _probeGroupRemoved: function(event)
    {
        var probeGroup = event.data;
        console.assert(probeGroup.groupKey in this._probeGroupSectionsByKey, "Removed probe group ", probeGroup, " doesn't have a sidebar.");

        var probeGroupSection = this._probeGroupSectionsByKey[probeGroup.groupKey];
        delete this._probeGroupSectionsByKey[probeGroup.groupKey];
        this._probeGroupSections.splice(this._probeGroupSections.indexOf(probeGroupSection), 1);
        this.contentElement.removeChild(probeGroupSection.element);
        probeGroupSection.closed();
    },

    _probesRecordStopButtonClicked: function(event)
    {
    	if (WebInspector.replayManager.replayState === WebInspector.ReplayManager.ReplayState.CanReplay)
    		WebInspector.replayManager.replayToCompletionSoon(true, WebInspector.replayManager.replayState);
    	else
    		WebInspector.replayManager.pausePlaybackSoon();
    }
};
