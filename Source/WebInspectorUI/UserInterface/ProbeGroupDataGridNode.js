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

WebInspector.ProbeGroupDataGridNode = function(frame, probeGroup)
{
	console.assert(frame instanceof WebInspector.ProbeGroupDataFrame, "Wrong object passed as probe group data frame: ", frame);
	console.assert(probeGroup instanceof WebInspector.ProbeGroupObject, "Wrong object passed as probe group: ", probeGroup);

    WebInspector.DataGridNode.call(this, this._cellDataFromFrame(frame, probeGroup));
    this.frame = frame;
    this._element = document.createElement("tr");
    this._element._dataGridNode = this;
    this._element.classList.add("revealed");
};

WebInspector.ProbeGroupDataGridNode.prototype = {
    constructor: WebInspector.ProbeGroupDataGridNode,
    __proto__: WebInspector.DataGridNode.prototype,

    // Public

    updateCellsFromFrame: function(frame, probeGroup)
    {
    	this.data = this._cellDataFromFrame(frame, probeGroup);
    },

    // Private

    _cellDataFromFrame: function(frame, probeGroup)
    {
		var probes = probeGroup.probes;
		var cellData = {};
		for (var i = 0; i < probes.length; ++i) {
			var probeId = probes[i].probeId;
			var sample = frame[probeId];
			if (!sample.object) {
				cellData[probeId] = sample;
				continue;
			}

			switch (sample.object.type) {
			case "array":
	            console.log("TODO: display probe with type=(array): ", sample.object);
	            cellData[probeId] = "[Array]";
	            break;
	        case "object":
				cellData[probeId] = new WebInspector.ObjectPropertiesSection(sample.object, WebInspector.ProbeGroupObject.SampleObjectTitle).element;
				break;
			default:
				cellData[probeId] = sample.object.value;
			}
		}
		return cellData;
    },
};
