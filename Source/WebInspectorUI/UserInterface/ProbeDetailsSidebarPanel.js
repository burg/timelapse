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

WebInspector.ProbeDetailsSidebarPanel = function()
{
	WebInspector.DetailsSidebarPanel.call(this, "probe", WebInspector.UIString("Probe"), WebInspector.UIString("Probe"), "Images/NavigationItemProbes.pdf", "6");

    WebInspector.probeManager.addEventListener(WebInspector.ProbeManager.Event.ProbeGroupAdded, this._probeGroupAdded, this);
    WebInspector.probeManager.addEventListener(WebInspector.ProbeManager.Event.ProbeGroupRemoved, this._probeGroupRemoved, this);

    this._probeGroupSectionsByKey = {};
    this._probeGroupSections = [];
};

WebInspector.ProbeDetailsSidebarPanel.OffsetSectionsStyleClassName  = "offset-sections";

WebInspector.ProbeDetailsSidebarPanel.prototype = {
    constructor: WebInspector.ProbeDetailsSidebarPanel,
    __proto__: WebInspector.DetailsSidebarPanel.prototype,

    // Public

    get currentProbeGroup()
    {
        return this._currentProbeGroup;
    },

    set currentProbeGroup(probeGroup)
    {
        this._oldProbeGroup = this._currentProbeGroup;
        if (this._oldProbeGroup)
            this._oldProbeGroupSection = this._probeGroupSectionsByKey[this._oldProbeGroup.groupKey];
        this._currentProbeGroup = probeGroup;
        this._currentProbeGroupSection = this._probeGroupSectionsByKey[probeGroup.groupKey];
        this.needsRefresh()
    },

    inspect: function(objects)
    {
        // Convert to a single item array if needed.
        if (!(objects instanceof Array))
            objects = [objects];

        var probeGroupToInspect = null;

        // Iterate over the objects to find a WebInspector.ProbeGroupObject to inspect.
        for (var i = 0; i < objects.length; ++i) {
            if (!(objects[i] instanceof WebInspector.ProbeGroupObject))
                continue;
            probeGroupToInspect = objects[i];
            break;
        }

        this.probeGroup = probeGroupToInspect;

        return !!this.probeGroup;
    },

    refresh: function()
    {
        if (this._oldProbeGroupSection) {
            this.element.removeChild(this._oldProbeGroupSection.element);
        }
        if (this._currentProbeGroupSection) {
            this.element.appendChild(this._currentProbeGroupSection.element);
        }

    },

    // Private

    _probeGroupAdded: function(event)
    {
        var probeGroup = event.data;
        console.assert(!(probeGroup.groupKey in this._probeGroupSectionsByKey), "New probe group ", probeGroup, " already has its own sidebar.");

        var probeSection = new WebInspector.ProbeGroupDetailsSection(probeGroup);
        this._probeGroupSectionsByKey[probeGroup.groupKey] = probeSection;
        this._probeGroupSections.push(probeSection);
    },


    _probeGroupRemoved: function(event)
    {
        var probeGroup = event.data;
        console.assert(probeGroup.groupKey in this._probeGroupSectionsByKey, "Removed probe group ", probeGroup, " doesn't have a sidebar.");

        var probeGroupSection = this._probeGroupSectionsByKey[probeGroup.groupKey];
        delete this._probeGroupSectionsByKey[probeGroup.groupKey];
        this._probeGroupSections.splice(this._probeGroupSections.indexOf(probeGroupSection), 1);
        this.element.removeChild(probeGroupSection.element);
        probeGroupSection.closed();
    }
};
