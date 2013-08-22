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

// A ProbeGroupObject clusters several ProbeObjects which are located at the
// same statement (i.e., url + raw source position).
WebInspector.ProbeGroupObject = function(url, position)
{
    console.assert(position instanceof WebInspector.SourceCodePosition, "Unknown position argument: ", position);

    WebInspector.Object.call(this);
    this._url = url;
    this._position = position;
    this._probes = [];
    this._probesByUid = {};
    this._dataTable = [];
    this._prevBatchId = 0;
    this._rowCount = 0;
    this._enabled = false;
    this._resolved = false;
    this._hasNewSamples = false;

    WebInspector.Frame.addEventListener(WebInspector.Frame.Event.MainResourceDidChange, this.addDataSeparator, this);
    WebInspector.ProbeObject.addEventListener(WebInspector.ProbeObject.Event.SampleAdded, this._addSampleData, this);
    WebInspector.probeManager.addEventListener(WebInspector.ProbeManager.Event.ProbeResolveStateDidChange, this._resolveStateDidChange, this);
    WebInspector.replayManager.addEventListener(WebInspector.ReplayManager.Event.RecordingLoaded, this.clearSamples, this);
    WebInspector.replayManager.addEventListener(WebInspector.ReplayManager.Event.RecordingUnloaded, this.clearSamples, this);
}

WebInspector.Object.addConstructorFunctions(WebInspector.ProbeGroupObject);

WebInspector.ProbeGroupObject.Event = {
    ProbeAdded: "probe-group-probe-added",
    ProbeRemoved: "probe-group-probe-removed",
    RowUpdated: "probe-group-row-updated",
    WillRemove: "probe-group-will-remove",
    Enabled: "probe-group-enabled",
    Disabled: "probe-group-disabled",
    ResolveStateDidChange: "probe-group-resolve-state-did-change",
    SamplesCleared: "probe-group-samples-cleared"
};

WebInspector.ProbeGroupObject.DefaultGroupKey = "indeterminate-group";
WebInspector.ProbeGroupObject.SampleObjectTitle = "Object";

WebInspector.ProbeGroupObject.prototype = {
    constructor: WebInspector.ProbeGroupObject,
    __proto__: WebInspector.Object.prototype,

    // Public

    // Whether or not probes in this group will cause the debugger to pause.
    get isEnabled()
    {
        return this._enabled;
    },

    get resolved()
    {
        return this._resolved;
    },

    get url()
    {
        return this._url;
    },

    get position()
    {
        return this._position;
    },

    // FIXME: We should not create new source code locations every time this method is called.
    // Instead, a source location should be created when the probe group is resolved and cleared when unresolved.
    get sourceCodeLocation()
    {
        console.assert(this.resolved, "Tried to access ProbeGroupObject.sourceCodeLocation, but the group isn't resolved: ", this);

        var sourceCode = WebInspector.frameResourceManager.resourceForURL(this.url);
        return (sourceCode) ? sourceCode.createSourceCodeLocation(this.position.lineNumber, this.position.columnNumber) : null;
    },

    get probes()
    {
        return this._probes.slice();
    },

    // Group key is set when the first probe is added to the group. It is saved separately
    // so that the group key persists even after all of the probes have been removed.
    get groupKey()
    {
        return this._groupKey || WebInspector.ProbeGroupObject.DefaultGroupKey;
    },


    get hasNewSamples()
    {
        return this._hasNewSamples;
    },

    clear: function()
    {
        for (var i = 0; i < this._probes.length; ++i)
            WebInspector.probeManager.removeProbe(this._probes[i]);
    },

    enable: function()
    {
        if (this.isEnabled)
            return;

        this._enabled = true;
        for (var i = 0; i < this._probes.length; ++i)
            if (!this._probes[i].enabled)
                WebInspector.probeManager.enableProbe(this._probes[i]);
        this.dispatchEventToListeners(WebInspector.ProbeGroupObject.Event.Enabled, this);
    },

    disable: function()
    {
        if (!this.isEnabled)
            return;

        this._enabled = false;
        for (var i = 0; i < this._probes.length; ++i)
            if (this._probes[i].enabled)
                WebInspector.probeManager.disableProbe(this._probes[i]);
        this.dispatchEventToListeners(WebInspector.ProbeGroupObject.Event.Disabled, this);
    },

    clearSamples: function()
    {
        for (var i = 0; i < this._probes.length; ++i)
            WebInspector.probeManager._clearSamplesForProbe(this._probes[i]);

        this._dataTable = [];
        this._hasNewSamples = false;
        this._prevBatchId = 0;
        this._rowCount = 0;
        this.dispatchEventToListeners(WebInspector.ProbeGroupObject.Event.SamplesCleared, this);
    },

    addDataSeparator: function()
    {
        if (!this._hasNewSamples)
            return;
        this._dataTable.push({});
        this._hasNewSamples = false;
        var currentRow = this._dataTable[this._dataTable.length - 1];
        for (var i = 0; i < this._probes.length; ++i)
            currentRow[this._probes[i].probeId] = "";

        var data = {
            row: currentRow,
            index: this._dataTable.length - 1,
            empty: true
        };

        this.dispatchEventToListeners(WebInspector.ProbeGroupObject.Event.RowUpdated, data);
    },

    // Protected (called by ProbeManager.js)

    addProbe: function(probe)
    {
        console.assert(probe instanceof WebInspector.ProbeObject, "Tried to add non-probe ", probe, " to probe group", this);

        this._probes.push(probe);
        this._probesByUid[probe.probeId] = probe;
        if (!this._groupKey)
            this._groupKey = probe.groupKey;

        console.assert(probe.groupKey === this.groupKey, "New probe ", probe, " added to group ", this, " with inconsistent group key.");

        if (this.isEnabled)
            WebInspector.probeManager.enableProbe(probe);
        else
            WebInspector.probeManager.disableProbe(probe);

        for (var i = 0; i < this._dataTable.length - 1; ++i)
            this._dataTable[i][probe.probeId] = "?";

        this.dispatchEventToListeners(WebInspector.ProbeGroupObject.Event.ProbeAdded, probe);
    },

    removeProbe: function(probe)
    {
        console.assert(probe instanceof WebInspector.ProbeObject, "Tried to remove non-probe ", probe, " to probe group", this);
        console.assert(this._probes.indexOf(probe) != -1, "Tried to remove probe", probe, " not in group ", this);
        console.assert(probe.probeId in this._probesByUid, "Tried to remove probe", probe, " not in group ", this);

        this._probes.splice(this._probes.indexOf(probe), 1);
        delete this._probesByUid[probe.probeId];
        this.dispatchEventToListeners(WebInspector.ProbeGroupObject.Event.ProbeRemoved, probe);
        // TODO: adjust data table model to remove column and cells for this removed probe.
    },

    willRemove: function()
    {
        console.assert(!this._probes.length, "ProbeGroupObject.willRemove called, but probes still associated with group: ", this._probes);

        WebInspector.ProbeObject.removeEventListener(WebInspector.ProbeObject.Event.SampleAdded, this._addSampleData, this);
        this.dispatchEventToListeners(WebInspector.ProbeGroupObject.Event.WillRemove);
    },

    // Private

    _addSampleData: function(event)
    {
        var probe = event.target;
        if (!this._probesByUid[probe.probeId])
            return;
        var sample = event.data;
        console.assert(sample instanceof WebInspector.ProbeSampleObject, "Tried to add non-sample to probe group data table", sample);

        if (sample.batchId !== this._prevBatchId) {
            this._dataTable.push({});
            ++this._rowCount;
            if (WebInspector.replayManager.isReplaying) {
                this._dataTable[this._dataTable.length - 1].rowCount = this._rowCount;
                this._dataTable[this._dataTable.length - 1].markIndex = WebInspector.replayManager.currentMarkIndex;
            }
            this._prevBatchId = sample.batchId;
        }

        if (sample.object.type === "array") {
            console.log("TODO: display probe with type=(array): ", sample.object);
            return;
        }

        console.assert(this._dataTable.length, "Not allowed to have an empty data table for probe group", this);

        if (!this._hasNewSamples) {
            this._hasNewSamples = true;
        }

        var columnIdentifier = event.target.probeId;
        var currentRow = this._dataTable[this._dataTable.length - 1];
        if (sample.object.type === "object")
            currentRow[columnIdentifier] = new WebInspector.ObjectPropertiesSection(sample.object, WebInspector.ProbeGroupObject.SampleObjectTitle).element;
        else
            currentRow[columnIdentifier] = sample.object.value;

        var data = {
            row: currentRow,
            index: this._dataTable.length - 1
        };
        this.dispatchEventToListeners(WebInspector.ProbeGroupObject.Event.RowUpdated, data);
    },

    _resolveStateDidChange: function(event)
    {
        var probe = event.data;
        if (!this._probesByUid[probe.probeId])
            return;

        // Only unresolve group when all probes are unresolved.
        var anyProbeIsResolved = false;
        for (var i = 0; i < this._probes.length; ++i)
            if (this._probes[i].resolved)
                anyProbeIsResolved = true;

        if (this._resolved === anyProbeIsResolved)
            return;

        this._resolved = anyProbeIsResolved;
        this.dispatchEventToListeners(WebInspector.ProbeGroupObject.Event.ResolveStateDidChange, this);
    }
};
