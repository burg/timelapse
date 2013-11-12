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

    // Used to detect deleted probe actions.
    this._knownProbeIdsForBreakpoint = new Map;

    // Main lookup tables for probes and probe sets.
    this._probesById = new Map;
    this._probeSetsByBreakpoint = new Map;

    this._nextProbeId = 0;

    WebInspector.debuggerManager.addEventListener(WebInspector.DebuggerManager.Event.BreakpointAdded, this._breakpointAdded, this);
    WebInspector.debuggerManager.addEventListener(WebInspector.DebuggerManager.Event.BreakpointRemoved, this._breakpointRemoved, this);
    WebInspector.Breakpoint.addEventListener(WebInspector.Breakpoint.Event.ActionsDidChange, this._breakpointActionsChanged, this);

    // Initialize probes for breakpoints that already exist.
    WebInspector.debuggerManager.breakpoints.map(this._breakpointAdded.bind(this));
}

WebInspector.ProbeManager.Event = {
    ProbeSetAdded: "probe-manager-probe-set-added",
    ProbeSetRemoved: "probe-manager-probe-set-removed",
};

WebInspector.ProbeManager.prototype = {
    constructor: WebInspector.ProbeManager,
    __proto__: WebInspector.Object.prototype,

    // Public

    get probeSets()
    {
        var sets = [];
        this._probeSetsByBreakpoint.forEach(function(set) { sets.push(set); });
        return sets;
    },

    getNextProbeId: function()
    {
        return ++this._nextProbeId;
    },

    // Protected (called by WebInspector.DebuggerObserver)

    didSampleProbe: function(sample)
    {
        console.assert(this._probesById.has(sample.probeId), "Unknown probe id specified for sample: ", sample);
        var probe = this._probesById.get(sample.probeId);
        probe.addSample(new WebInspector.ProbeSampleObject(sample.sampleId, sample.batchId, sample.timestamp, sample.payload));
    },

    // Private

    _breakpointAdded: function(breakpointOrEvent)
    {
        var breakpoint;
        if (breakpointOrEvent instanceof WebInspector.Breakpoint)
            breakpoint = breakpointOrEvent;
        else
            breakpoint = breakpointOrEvent.data.breakpoint;
        console.assert(!this._knownProbeIdsForBreakpoint.has(breakpoint));

        this._knownProbeIdsForBreakpoint.set(breakpoint, new Set);
        this._breakpointActionsChanged(breakpoint);
    },

    _breakpointRemoved: function(event)
    {
        var breakpoint = event.data.breakpoint;
        console.assert(this._knownProbeIdsForBreakpoint.has(breakpoint));

        this._breakpointActionsChanged(breakpoint);
        this._knownProbeIdsForBreakpoint.delete(breakpoint);
    },

    _breakpointActionsChanged: function(breakpointOrEvent)
    {
        var breakpoint;
        if (breakpointOrEvent instanceof WebInspector.Breakpoint)
            breakpoint = breakpointOrEvent;
        else
            breakpoint = breakpointOrEvent.target;

        // Sometimes actions change before the added breakpoint is fully dispatched.
        if (!this._knownProbeIdsForBreakpoint.has(breakpoint)) {
            this._breakpointAdded(breakpoint);
            return;
        }

        var knownProbeIds = this._knownProbeIdsForBreakpoint.get(breakpoint);
        var seenProbeIds = new Set;

        breakpoint.probeActions.forEach(function(probeAction) {
            var probeId = probeAction.id;
            console.assert(probeId, "Probe added without id in breakpoint: ", breakpoint);

            seenProbeIds.add(probeId);
            if (!knownProbeIds.has(probeId)) {
                // New probe; find or create relevant probe set.
                knownProbeIds.add(probeId);
                var probeSet = this._getProbeSetForBreakpoint(breakpoint);
                var newProbe = new WebInspector.ProbeObject(probeId, breakpoint, probeAction.data);
                this._probesById.set(probeId, newProbe);
                probeSet.addProbe(newProbe);
                return;
            }

            var probe = this._probesById.get(probeId);
            console.assert(probe, "Probe known but couldn't be found by id: ", probeId);
            // Update probe expression; if it differed, change events will fire.
            probe.expression = probeAction.data;
        }.bind(this));

        // Look for missing probes based on what we saw last.
        knownProbeIds.forEach(function(probeId) {
            if (seenProbeIds.has(probeId))
                return;

            // The probe has gone missing, remove it.
            var probeSet = this._getProbeSetForBreakpoint(breakpoint);
            var probe = this._probesById.get(probeId);
            this._probesById.delete(probeId);
            knownProbeIds.delete(probeId);
            probeSet.removeProbe(probe);

            // Remove the probe set if it has become empty.
            if (!probeSet.probes.length) {
                this._probeSetsByBreakpoint.delete(probeSet.breakpoint);
                probeSet.willRemove();
                this.dispatchEventToListeners(WebInspector.ProbeManager.Event.ProbeSetRemoved, probeSet);
            }
        }.bind(this));
    },

    _getProbeSetForBreakpoint: function(breakpoint)
    {
        if (this._probeSetsByBreakpoint.has(breakpoint))
            return this._probeSetsByBreakpoint.get(breakpoint);

        var newProbeSet = new WebInspector.ProbeSetObject(breakpoint);
        this._probeSetsByBreakpoint.set(breakpoint, newProbeSet);
        this.dispatchEventToListeners(WebInspector.ProbeManager.Event.ProbeSetAdded, newProbeSet);
        return newProbeSet;
    }
};
