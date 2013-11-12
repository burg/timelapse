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

// A ProbeSetObject clusters several ProbeObjects which are located at the
// same statement (i.e., url + raw source position).
WebInspector.ProbeSetObject = function(breakpoint)
{
    console.assert(breakpoint instanceof WebInspector.Breakpoint, "Unknown breakpoint argument: ", breakpoint);

    WebInspector.Object.call(this);
    this._breakpoint = breakpoint;
    this._probes = [];
    this._probesById = new Map;
    this._selected = false;

    this._createDataTable();

    WebInspector.Frame.addEventListener(WebInspector.Frame.Event.MainResourceDidChange, this._mainResourceChanged, this);
    WebInspector.ProbeObject.addEventListener(WebInspector.ProbeObject.Event.SampleAdded, this._sampleCollected, this);
    WebInspector.Breakpoint.addEventListener(WebInspector.Breakpoint.Event.ResolvedStateDidChange, this._breakpointResolvedStateDidChange, this);
    WebInspector.replayManager.addEventListener(WebInspector.ReplayManager.Event.RecordingLoaded, this.clearSamples, this);
    WebInspector.replayManager.addEventListener(WebInspector.ReplayManager.Event.RecordingUnloaded, this.clearSamples, this);
    WebInspector.debuggerManager.addEventListener(WebInspector.DebuggerManager.Event.Paused, this._checkSelected, this);
    WebInspector.debuggerManager.addEventListener(WebInspector.DebuggerManager.Event.Resumed, this._unselected, this);
}

WebInspector.Object.addConstructorFunctions(WebInspector.ProbeSetObject);

WebInspector.ProbeSetObject.Event = {
    Selected: "probe-set-selected",
    Unselected: "probe-set-unselected",
    ProbeAdded: "probe-set-probe-added",
    ProbeRemoved: "probe-set-probe-removed",
    ResolvedStateDidChange: "probe-set-resolved-state-did-change",
    SamplesCleared: "probe-set-samples-cleared",
};

WebInspector.ProbeSetObject.SampleObjectTitle = "Object";

WebInspector.ProbeSetObject.prototype = {
    constructor: WebInspector.ProbeSetObject,
    __proto__: WebInspector.Object.prototype,

    // Public

   get breakpoint()
   {
        return this._breakpoint;
   },

    get probes()
    {
        return this._probes.slice();
    },

    get selected()
    {
        return this._selected;
    },

    get dataTable()
    {
        return this._dataTable;
    },

    clear: function()
    {
        this._probes.forEach(function(probe) {
            WebInspector.probeManager.removeProbe(probe);
        });
    },

    clearSamples: function()
    {
        this._probes.forEach(function(probe) { probe.clearSamples(); });

        this._createDataTable();
        this.dispatchEventToListeners(WebInspector.ProbeSetObject.Event.SamplesCleared, this);
    },

    createProbe: function(expression)
    {
        // This will fire ProbeManager.Event.ProbeAdded, then ProbeObject.Event.ExpressionChanged.
        var newAction = this.breakpoint.createAction(WebInspector.BreakpointAction.Type.Probe);
        newAction.data = expression;
    },

    // Protected (called by ProbeManager.js)

    addProbe: function(probe)
    {
        console.assert(probe instanceof WebInspector.ProbeObject, "Tried to add non-probe ", probe, " to probe group", this);
        console.assert(probe.breakpoint === this.breakpoint, "Probe and ProbeSet must have same breakpoint.", probe, this);

        this._probes.push(probe);
        this._probesById.set(probe.id, probe);

        this.dataTable.addProbe(probe);
        this.dispatchEventToListeners(WebInspector.ProbeSetObject.Event.ProbeAdded, probe);
    },

    removeProbe: function(probe)
    {
        console.assert(probe instanceof WebInspector.ProbeObject, "Tried to remove non-probe ", probe, " to probe group", this);
        console.assert(this._probes.indexOf(probe) != -1, "Tried to remove probe", probe, " not in group ", this);
        console.assert(this._probesById.has(probe.id), "Tried to remove probe", probe, " not in group ", this);

        this._probes.splice(this._probes.indexOf(probe), 1);
        this._probesById.delete(probe.id);
        this.dataTable.removeProbe(probe);
        this.dispatchEventToListeners(WebInspector.ProbeSetObject.Event.ProbeRemoved, probe);
    },

    willRemove: function()
    {
        console.assert(!this._probes.length, "ProbeSetObject.willRemove called, but probes still associated with group: ", this._probes);

        WebInspector.ProbeObject.removeEventListener(WebInspector.ProbeObject.Event.SampleAdded, this._sampleCollected, this);
    },

    // Private

    _mainResourceChanged: function()
    {
        this.dataTable.mainResourceChanged();
    },

    _createDataTable: function()
    {
        if (this.dataTable)
            this.dataTable.willRemove();

        if (WebInspector.replayManager.isReplaying || WebInspector.replayManager.canReplay)
            this._dataTable = new WebInspector.ProbeSetReplayDataTable(this);
        else
            this._dataTable = new WebInspector.ProbeSetDataTable(this);
    },

    _sampleCollected: function(event)
    {
        var sample = event.data;
        console.assert(sample instanceof WebInspector.ProbeSampleObject, "Tried to add non-sample to probe group: ", sample);

        var probe = event.target;
        if (!this._probesById.has(probe.id))
            return;

        console.assert(this.dataTable);
        this.dataTable.addSampleForProbe(probe, sample);
    },

    _breakpointResolvedStateDidChange: function(event)
    {
        this.dispatchEventToListeners(WebInspector.ProbeSetObject.Event.ResolvedStateDidChange);
    },

    _checkSelected: function(event)
    {
        var activeSourceCodeLocation = WebInspector.debuggerManager.activeCallFrame.sourceCodeLocation;
        if (!activeSourceCodeLocation.isEqual(this.breakpoint.sourceCodeLocation))
            return;
        this._selected = true;
        this.dispatchEventToListeners(WebInspector.ProbeSetObject.Event.SelectStateDidChange);

    },

    _unselected: function(event)
    {
        if (!this._selected)
            return;
        this._selected = false;
        this.dispatchEventToListeners(WebInspector.ProbeSetObject.Event.SelectStateDidChange);
    }
};
