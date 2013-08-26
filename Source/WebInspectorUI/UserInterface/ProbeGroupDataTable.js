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
	WebInspector.Object.call(this);

	this._probeGroup = probeGroup;
	this._frames = [];
	this._separatorIndices = [];
	this._previousBatchId = WebInspector.ProbeGroupDataTable.SentinelValue;
};

WebInspector.ProbeGroupDataTable.Event = {
    FrameAppended: "probe-group-frame-appended",
    FrameReplaced: "probe-group-frame-replaced",
    SeparatorAppended: "probe-group-separator-appended",
	WillRemove: "probe-group-data-table-will-remove"
};

WebInspector.ProbeGroupDataTable.SentinelValue = -1;
WebInspector.ProbeGroupDataTable.UnknownValue = "?";

WebInspector.ProbeGroupDataTable.prototype = {
	constructor: WebInspector.ProbeGroupDataTable,
	__proto__: WebInspector.Object.prototype,

	// Public

	get frames()
	{
		return this._frames.slice();
	},

	get separatorIndices()
	{
		return this._separatorIndices.slice();
	},

	willRemove: function()
	{
		this.dispatchEventToListeners(WebInspector.ProbeGroupDataTable.Event.WillRemove);
		this._frames = [];
		this._separatorIndices = [];
		delete this._probeGroup;
	},

	mainResourceChanged: function()
	{
		this.addSeparator();
	},

	addSampleForProbe: function(probe, sample)
	{
		// Eagerly save the frame if the batch id differs, or we know the frame is full.
		// Create a new frame when the batch id differs.
		if (sample.batchId != this._previousBatchId) {
			if (this._openFrame) {
				this._openFrame.fillMissingValues(this._probeGroup);
				this.addFrame(this._openFrame);
			}
			this._openFrame = this.createFrame();
			this._previousBatchId = sample.batchId;
		}

		console.assert(this._openFrame, "Should always have an open frame before adding sample.", this, probe, sample);
		this._openFrame.addSampleForProbe(probe, sample);
		if (this._openFrame.count == this._probeGroup.probes.length) {
			this.addFrame(this._openFrame);
			this._openFrame = null;
		}
	},

	addProbe: function(probe)
	{
		var frames = this.frames;
		for (var i = 0; i < frames.length; ++i)
			if (!frames[i][probe.probeId])
				frames[i][probe.probeId] = WebInspector.ProbeGroupDataTable.UnknownValue;
	},

	removeProbe: function(probe)
	{
		var frames = this.frames;
		for (var i = 0; i < frames.length; ++i)
			if (frames[i][probe.probeId])
				delete frames[i][probe.probeId];
	},

	// Protected - can be overridden by subclasses.

	createFrame: function()
	{
		return new WebInspector.ProbeGroupDataFrame(this._frames.length);
	},

	addFrame: function(frame)
	{
		this._frames.push(frame);
		this.dispatchEventToListeners(WebInspector.ProbeGroupDataTable.Event.FrameAppended, frame);
	},

	addSeparator: function()
	{
		var index = this._frames.length - 1;
		// Don't add duplicate separators.
		if (this._separatorIndices.length && this._separatorIndices[this._separatorIndices.length - 1] === index)
			return;

		this._separatorIndices.push(index);
		this.dispatchEventToListeners(WebInspector.ProbeGroupDataTable.Event.SeparatorAppended);
	}
};
