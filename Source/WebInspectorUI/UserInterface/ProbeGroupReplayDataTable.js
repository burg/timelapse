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

WebInspector.ProbeGroupReplayDataTable = function(probeGroup)
{
	WebInspector.ProbeGroupDataTable.call(this, probeGroup);

	this._previousMarkIndex = WebInspector.ProbeGroupDataTable.SentinelValue;
	this._hitCount = WebInspector.ProbeGroupDataTable.SentinelValue;
	this._previousFrame = null;
};

WebInspector.ProbeGroupReplayDataTable.prototype = {
	constructor: WebInspector.ProbeGroupReplayDataTable,
	__proto__: WebInspector.ProbeGroupDataTable.prototype,

	// Protected

	createFrame: function()
	{
		var markIndex = WebInspector.replayManager.currentMarkIndex;
		if (this._previousMarkIndex !== markIndex)
			this._hitCount = 0;

		this._hitCount++;
		return new WebInspector.ProbeGroupReplayDataFrame(markIndex, this._hitCount);
	},

	addFrame: function(frame)
	{
		var insertionIndex = insertionIndexForObjectInListSortedByFunction(frame, this._frames, WebInspector.ProbeGroupReplayDataFrame.compare);
		if (this._frames.hasOwnProperty(insertionIndex)) {
			this._frames.splice(insertionIndex, 1, frame);
			this.dispatchEventToListeners(WebInspector.ProbeGroupDataTable.Event.FrameReplaced, frame);
		} else {
			this._frames.splice(insertionIndex, 0, frame);
			this.dispatchEventToListeners(WebInspector.ProbeGroupDataTable.Event.FrameInserted, frame);
		}

		// Save the previous frame so the separator can be placed there.
		this._previousFrame = frame;
	},

	addSeparator: function()
	{
		// Separators must be associated with a frame.
		if (!this._previousFrame)
			return;

		if (this._previousFrame.isSeparator)
			this.dispatchEventToListeners(WebInspector.ProbeGroupDataTable.Event.SeparatorReplaced, this._previousFrame);
		else {
			this._previousFrame.isSeparator = true;
			this.dispatchEventToListeners(WebInspector.ProbeGroupDataTable.Event.SeparatorInserted, this._previousFrame);
		}
	}
};
