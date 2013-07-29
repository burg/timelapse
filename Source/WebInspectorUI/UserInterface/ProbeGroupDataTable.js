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

WebInspector.ProbeGroupDataTable = function(probeGroup)
{
    console.assert(probeGroup instanceof WebInspector.ProbeGroupObject, "Tried to create probe group data table with wrong object type", probeGroup);
    WebInspector.Object.call(this);

    this._listeners = new WebInspector.EventListenerGroup(this, "Static probe group data table listeners");

    this._probeGroup = probeGroup;
    this._probeListenersByUid = {};
    this._probeColumnMap = {};
    this._columnCount = -1;
    this._data = [];

    this._listeners.register(probeGroup, WebInspector.ProbeGroupObject.Event.ProbeAdded, this._addProbeToTable);
    this._listeners.register(probeGroup, WebInspector.ProbeGroupObject.Event.ProbeRemoved, this._teardownProbe);

    this.element = document.createElement("div");
    this.element.classList.add(WebInspector.ProbeGroupDataTable.ProbeTableContainerColumnStyleClassName);
    this._tableElement = this.element.createChild("table");
    var tableHeader = this._tableElement.createChild("thead");
    this._tableHeaderRowElement = tableHeader.createChild("tr");
    this._tableBodyElement = this._tableElement.createChild("tbody");

    this._listeners.install();

    this._animateFrameCallback = this.animateFrame.bind(this);

    // Set up probes that already exist in the group.
    var probes = probeGroup.probes;
    for (var i = 0; i < probes.length; ++i)
        this._setupProbe(probes[i]);
};

WebInspector.ProbeGroupDataTable.ProbeTableContainerColumnStyleClassName = "table-container";
WebInspector.ProbeGroupDataTable.MainProbeColumnStyleClassName = "main-column";


WebInspector.ProbeGroupDataTable.prototype = {
    constructor: WebInspector.ProbeGroupDataTable,
    __proto__: WebInspector.Object.prototype,

    // Public

    animateFrame: function(shouldResizeCanvas)
    {
        this._haveEnqueuedAnimationRequest = false;

        if (this.element.parentElement === null)
            return;

        // TODO: update table cells.
    },

    refreshSoon: function(shouldResizeCanvas)
    {
        if (this._haveEnqueuedAnimationRequest)
            return;

        this._haveEnqueuedAnimationRequest = true;
        window.requestAnimationFrame(this._animateFrameCallback);
    },

    closed: function()
    {
        var probes = this._probeGroup.probes;
        for (var i = 0; i < probes.length; ++i)
            this._teardownProbe(probes[i]);

        this._listeners.uninstall(true);
    },

    // Private

    _addProbeToTable: function(event)
    {
        this._setupProbe(event.data);
    },

    _setupProbe: function(probe)
    {
        console.assert(!(probe.probeId in this._probeListenersByUid), "Probe ", probe, " already exists in table ", this);
        ++this._columnCount;
        this._probeColumnMap[probe.probeId] = this._columnCount;

        probe.addEventListener(WebInspector.ProbeObject.Event.SampleAdded, this._addSampleToTable, this);

        var initialExpression = this._tableHeaderRowElement.createChild("th");
        initialExpression.textContent = probe.expression;
        initialExpression.addEventListener("click", this._displayChangeProbeExpressionPrompt.bind(this));
        if (this._probeColumnMap[probe.probeId] === 0)
            initialExpression.classList.add(WebInspector.ProbeGroupDataTable.MainProbeColumnStyleClassName);
    },

    _teardownProbe: function(probe)
    {
        console.assert(probe.probeId in this._probeListenersByUid, "Probe ", probe, " doesn't exist in table ", this);
        probe.removeEventListener(WebInspector.ProbeObject.Event.SampleAdded, this._addSampleToTable, this);
        this.refreshSoon();
    },

    _addSampleToTable: function(event)
    {
        var sample = event.data;
        console.assert(sample instanceof WebInspector.ProbeSampleObject, "Tried to add non-sample to probe group data table", sample);
        var id = event.target.probeId;

        if (!this._data.lastValue || this._data.lastValue.hasOwnProperty(id)) {
            var newDataRow = new Object();
            newDataRow[id] = sample;
            this._data.push(newDataRow);
            var row = this._tableBodyElement.createChild("tr");
            for (var i = 0; i <= this._columnCount; i++) {
                row.createChild("td");
            }
        } else {
            this._data.lastValue[id] = sample;
            var row = this._tableBodyElement.lastChild;
        }

        var cell = row.childNodes[this._probeColumnMap[id]];
        if (this._probeColumnMap[id] === 0)
            cell.classList.add(WebInspector.ProbeGroupDataTable.MainProbeColumnStyleClassName);
        cell.textContent = sample.value;
    },

    _changeProbeExpression: function(event)
    {
        if (event.keyCode !== 13) // "return"
            return;

        var newExpression = event.target.value;
        console.log("TODO: use new expression value: " + newExpression);
        // Use event.target.value to modify probes! Or delete if == "".
    },

    _displayChangeProbeExpressionPrompt: function(event)
    {
        var textBox = document.createElement("input");
        textBox.addEventListener("keypress", this._changeProbeExpression.bind(this));
        textBox.addEventListener("click", (function (event) {event.target.select()}));
        textBox.type = "text";
        textBox.value = WebInspector.UIString("Enter Expression");
        // FIXME: needs to update the model (delete and add a probe) and refresh.
        event.target.innerHTML = "";
        event.target.appendChild(textBox);
    },
};
