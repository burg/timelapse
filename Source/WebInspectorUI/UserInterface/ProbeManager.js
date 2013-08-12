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

WebInspector.ProbeManager = function()
{
    WebInspector.Object.call(this);

    ProbeAgent.enable();

    this._probesEnabledSetting = new WebInspector.Setting("probes-enabled", true);
    ProbeAgent.setProbesActive(this._probesEnabledSetting.value);

    this._probes = {};
    this._probeGroups = {};
}

WebInspector.ProbeManager.Event = {
    ProbeAdded: "probe-manager-probe-added",
    ProbeRemoved: "probe-manager-probe-removed",
    ProbeDisabled: "probe-manager-probe-disabled",
    ProbeEnabled: "probe-manager-probe-enabled",
    ProbeResolved: "probe-manager-probe-resolved",
    ProbeGroupAdded: "probe-manager-probe-group-added",
    ProbeGroupRemoved: "probe-manager-probe-group-removed",
};

WebInspector.ProbeManager.prototype = {
    constructor: WebInspector.ProbeManager,
    __proto__: WebInspector.Object.prototype,

    // Public

    get probeGroups()
    {
        return this._probeGroups;
    },

    get probesEnabled()
    {
        return this._probesEnabledSetting.value;
    },

    set probesEnabled(enabled)
    {
        if (this._probesEnabledSetting.value === enabled)
            return;

        this._probesEnabledSetting.value = enabled;

        ProbeAgent.setProbesActive(enabled);
    },

    enableProbe: function(probe)
    {
        console.assert(probe === this._probes[probe.probeId], "Can't enable unknown probe: ", probe);
        if (probe.enabled)
            return;

        ProbeAgent.enableProbe(probe.probeId);
    },

    disableProbe: function(probe)
    {
        console.assert(probe === this._probes[probe.probeId], "Can't disable unknown probe: ", probe);
        if (!probe.enabled)
            return;

        ProbeAgent.disableProbe(probe.probeId);
    },

    removeProbe: function(probe)
    {
        console.assert(probe === this._probes[probe.probeId], "Can't remove unknown probe: ", probe);
        ProbeAgent.removeProbe(probe.probeId);
    },

    // Protected (called by WebInspector.ProbeObserver)

    addProbeSample: function(sample)
    {
        console.assert(sample.probeId in this._probes, "Unknown probe id specified for sample: ", sample);
        var probe = this._probes[sample.probeId];
        probe.addSample(new WebInspector.ProbeSampleObject(sample.sampleId, sample.batchId, sample.timestamp, sample.payload));
    },

    probeAdded: function(probe)
    {
        console.assert(!(probe.probeId in this._probes), "Probe with id", probe.probeId, " already exists:");

        var probeObject = new WebInspector.ProbeObject(probe.probeId, probe.url, probe.lineNumber, probe.columnNumber, probe.expression);
        this._probes[probe.probeId] = probeObject;

        if (this._probeGroups[probeObject.groupKey])
            this._probeGroups[probeObject.groupKey].addProbe(probeObject);
        else {
            var probeGroup = new WebInspector.ProbeGroupObject(probeObject.url, probeObject.position);
            probeGroup.addProbe(probeObject);
            this._probeGroups[probeObject.groupKey] = probeGroup;
            this.dispatchEventToListeners(WebInspector.ProbeManager.Event.ProbeGroupAdded, probeGroup);
        }

        this.dispatchEventToListeners(WebInspector.ProbeManager.Event.ProbeAdded, probeObject);
        ProbeAgent.getProbeSamples(probeObject.probeId, this._didReceiveSamples.bind(this));
    },

    probeRemoved: function(probeId)
    {
        console.assert(probeId in this._probes, "Unknown probe id requseted: ", probeId);
        var probe = this._probes[probeId];
        delete this._probes[probeId];

        if (this._probeGroups[probe.groupKey]) {
            var probeGroup = this._probeGroups[probe.groupKey];
            probeGroup.removeProbe(probe);

            if (!probeGroup.probes.length) {
                probeGroup.willRemove();
                delete this._probeGroups[probe.groupKey];
                this.dispatchEventToListeners(WebInspector.ProbeManager.Event.ProbeGroupRemoved, probeGroup);
            }
        }

        this.dispatchEventToListeners(WebInspector.ProbeManager.Event.ProbeRemoved, probe);
    },

    probeEnabled: function(probeId)
    {
        console.assert(probeId in this._probes, "Unknown probe id requested: ", probeId);
        var probe = this._probes[probeId];
        probe.enabled = true;
        this.dispatchEventToListeners(WebInspector.ProbeManager.Event.ProbeEnabled, probe);
    },

    probeDisabled: function(probeId)
    {
        console.assert(probeId in this._probes, "Unknown probe id requested: ", probeId);
        var probe = this._probes[probeId];
        probe.enabled = false;
        this.dispatchEventToListeners(WebInspector.ProbeManager.Event.ProbeDisabled, probe);
    },

    probeResolved: function(probeId, scriptId)
    {
        console.assert(probeId in this._probes, "Unknown probe id requested: ", probeId);
        var probe = this._probes[probeId];
        probe.resolved = true;
        probe.sourceCode = WebInspector.debuggerManager.scriptForIdentifier(scriptId);
        this.dispatchEventToListeners(WebInspector.ProbeManager.Event.ProbeResolved, probe);    
    },

    allProbesCleared: function()
    {
        for (var key in this._probes) {
            var probe = this._probes[key];
            delete this._probes[key];
            this.dispatchEventToListeners(WebInspector.ProbeManager.Event.ProbeRemoved, probe);
        }
    },

    // Private

    _clearSamplesForProbe: function(probe)
    {
        probe.samples = [];
    },

    _didReceiveSamples: function(error, samples)
    {
        if (error) {
            console.error("Problem when loading data for probe with id ", this.probeId, ": ", error);
            return;
        }

        if (!samples.length)
            return;

        console.log("DEBUG: Received array of probe samples: ", samples);
        // Clear existing samples, since we just received all active samples en-masse.

        var probe = this._probes[samples[0].probeId];
        this._clearSamplesForProbe(probes);
        samples.map(this.addProbeSample.bind(this));
    }
};
