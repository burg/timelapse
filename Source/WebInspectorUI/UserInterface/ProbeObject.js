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

WebInspector.ProbeSampleObject = function(sampleId, timestamp, value)
{
    this.sampleId = sampleId;
    this.timestamp = timestamp;
    this.value = value;
};

WebInspector.ProbeObject = function(probeId, url, lineNumber, columnNumber, expression)
{
    WebInspector.Object.call(this);
    this._probeId = probeId;
    this._url = url;
    this._lineNumber = lineNumber;
    this._columnNumber = columnNumber;
    this._expression = expression;
    this._enabled = true;
}

WebInspector.ProbeObject.prototype = {
    constructor: WebInspector.ProbeObject,
    __proto__: WebInspector.Object.prototype,

    // Public

    get probeId()
    {
        return this._probeId;
    },

    get samples()
    {
        return this._samples.slice();
    },

    get enabled()
    {
        return this._enabled;
    },

    // Protected

    addSample: function(sample)
    {
        this._samples.push(sample);
        console.log("DEBUG: Added probe sample: ", sample);
    },

    set enabled(value)
    {
        this._enabled = value;
    },

    set samples(value)
    {
        this._samples = value || [];
    },
};
