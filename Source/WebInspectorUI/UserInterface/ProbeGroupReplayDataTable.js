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
};

WebInspector.ProbeGroupReplayDataTable.prototype = {
	constructor: WebInspector.ProbeGroupReplayDataTable,
	__proto__: WebInspector.Object.prototype,

	// Protected 

	createFrame: function()
	{
		var frame = new WebInspector.ProbeGroupDataFrame;
		var markIndex = WebInspector.replayManager.currentMarkIndex;		
		if (this._previousMarkIndex !== markIndex)
			this._hitCount = 0;

		this._hitCount++;
		frame.markIndex = markIndex;
		frame.hitCount = this._hitCount;
		return frame;
	},

	addFrame: function(frame)
	{
		// TODO: figure out whether we are prepending, appending, or replacing.

		this._frames.push(frame);
		this.dispatchEventToListeners(WebInspector.ProbeGroupDataTable.Event.FrameAppended, frame);
	},

	addSeparator: function()
	{
		// TODO: figure out whether we are prepending, appending, or replacing.

		var index = this._frames.length - 1;
		// Don't add duplicate separators.
		if (this._separatorIndices.length && this._separatorIndices[this._separatorIndices.length - 1] === index)
			return;

		this._separatorIndices.push(index);
		this.dispatchEventToListeners(WebInspector.ProbeGroupDataTable.Event.SeparatorAppended);	
	}
};
