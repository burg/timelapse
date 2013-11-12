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

    WebInspector.probeManager.addEventListener(WebInspector.ProbeManager.Event.ProbeSetAdded, this._probeSetAdded, this);
    WebInspector.probeManager.addEventListener(WebInspector.ProbeManager.Event.ProbeSetRemoved, this._probeSetRemoved, this);

    this._probeSetSections = new Map;
    this._currentProbeSet = null;

    // Initialize sidebars for probe sets that already exist.
    WebInspector.probeManager.probeSets.map(this._probeSetAdded.bind(this));
};

WebInspector.ProbeDetailsSidebarPanel.OffsetSectionsStyleClassName  = "offset-sections";

WebInspector.ProbeDetailsSidebarPanel.prototype = {
    constructor: WebInspector.ProbeDetailsSidebarPanel,
    __proto__: WebInspector.DetailsSidebarPanel.prototype,

    // Public

    get currentProbeSet()
    {
        return this._currentProbeSet;
    },

    set currentProbeSet(probeSet)
    {
        if (this._currentProbeSet) {
            oldSection = this._probeSetSections.get(this._currentProbeSet);
            if (oldSection)
                oldSection.element.remove();
        }

        this._currentProbeSet = probeSet;
        var shownSection = this._probeSetSections.get(probeSet);
        this.element.appendChild(shownSection.element);
    },

    inspect: function(objects)
    {
        // Convert to a single item array if needed.
        if (!(objects instanceof Array))
            objects = [objects];

        var probeSetToInspect = null;

        // Iterate over the objects to find a WebInspector.ProbeSetObject to inspect.
        for (var i = 0; i < objects.length; ++i) {
            if (!(objects[i] instanceof WebInspector.ProbeSetObject))
                continue;
            probeSetToInspect = objects[i];
            break;
        }

        this.currentProbeSet = probeSetToInspect;
        return !!this.currentProbeSet;
    },

    // Private

    _probeSetAdded: function(probeSetOrEvent)
    {
        var probeSet;
        if (probeSetOrEvent instanceof WebInspector.ProbeSetObject)
            probeSet = probeSetOrEvent;
        else
            probeSet = probeSetOrEvent.data;
        console.assert(!this._probeSetSections.has(probeSet), "New probe group ", probeSet, " already has its own sidebar.");

        var newSection = new WebInspector.ProbeSetDetailsSection(probeSet);
        this._probeSetSections.set(probeSet, newSection);
    },


    _probeSetRemoved: function(event)
    {
        var probeSet = event.data;
        console.assert(this._probeSetSections.has(probeSet), "Removed probe group ", probeSet, " doesn't have a sidebar.");

        var removedSection = this._probeSetSections.get(probeSet);
        this._probeSetSections.delete(probeSet);
        removedSection.closed();
    }
};
