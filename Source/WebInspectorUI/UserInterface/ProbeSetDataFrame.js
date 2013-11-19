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

WebInspector.ProbeSetDataFrame = function(index)
{
    this.count = 0;
    this.index = index;
    this._separator = false;
};

Object.defineProperty(WebInspector.ProbeSetDataFrame, "compare",
{
    value: function(a, b) {
        console.assert(a instanceof WebInspector.ProbeSetDataFrame, a);
        console.assert(b instanceof WebInspector.ProbeSetDataFrame, b);

        return a.index - b.index;
    }
});

WebInspector.ProbeSetDataFrame.MissingValue = "?";

WebInspector.ProbeSetDataFrame.prototype = {
    constructor: WebInspector.ProbeSetDataFrame,

    // Public

    get key()
    {
        return "%d".format(this.index);
    },

    get isSeparator()
    {
        return this._separator;
    },

    set isSeparator(value)
    {
        this._separator = !!value;
    },

    addSampleForProbe: function(probe, sample)
    {
        this[probe.id] = sample;
        this.count++;
    },

    missingKeys: function(probeSet)
    {
        return probeSet.probes.filter(function(probe) {
            return !this.hasOwnProperty(probe.id);
        }.bind(this));
    },

    isComplete: function(probeSet)
    {
        return !this.missingKeys(probeSet).length;
    },

    fillMissingValues: function(probeSet)
    {
        var keys = this.missingKeys(probeSet);
        for (var i = 0; i < keys.length; ++i)
            this[keys[i]] = WebInspector.ProbeSetDataFrame.MissingValue;
    }
};

WebInspector.ProbeSetReplayDataFrame = function(markIndex, hitCount)
{
    WebInspector.ProbeSetDataFrame.call(this, 0);
    this.markIndex = markIndex;
    this.hitCount = hitCount;
};

Object.defineProperty(WebInspector.ProbeSetReplayDataFrame, "compare",
{
    value: function(a, b) {
        console.assert(a instanceof WebInspector.ProbeSetReplayDataFrame, a);
        console.assert(b instanceof WebInspector.ProbeSetReplayDataFrame, b);

        if (a.markIndex !== b.markIndex)
            return a.markIndex - b.markIndex;

        return a.hitCount - b.hitCount;
    }
});

WebInspector.ProbeSetReplayDataFrame.prototype = {
    constructor: WebInspector.ProbeSetReplayDataFrame,
    __proto__: WebInspector.ProbeSetDataFrame.prototype,

    // Public

    get key()
    {
        return "%d,%d".format(this.markIndex, this.hitCount);
    },

    get compareFunction()
    {
        return WebInspector.ProbeSetReplayDataFrame.compare;
    }
};
