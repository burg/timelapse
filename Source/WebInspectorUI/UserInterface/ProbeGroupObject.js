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

WebInspector.ProbeGroupObject = function(url, lineNumber)
{
    WebInspector.Object.call(this);
	this._url = url;
	this._lineNumber = lineNumber;
	this._probes = [];
	this._color = WebInspector.ProbeGroupObject.DefaultProbeColor;
	this._gutterElement = document.createElement("div");
	this._gutterElement.classList.add(WebInspector.ProbeGroupObject.ProbeGutterStyleClassName);
	this._gutterElement.style.backgroundColor = this._color;
	this._gutterElement.textContent = this._lineNumber + 1;
}

WebInspector.ProbeGroupObject.Event = {
    ProbesChanged: "probe-group-probes-changed"
};

WebInspector.ProbeGroupObject.ProbeGutterStyleClassName = "probe-gutter";
WebInspector.ProbeGroupObject.DefaultProbeColor = "Yellow";

WebInspector.ProbeGroupObject.prototype = {
    constructor: WebInspector.ProbeGroupObject,
    __proto__: WebInspector.Object.prototype,

    // Public

    get url()
    {
        return this._url;
    },

    get lineNumber()
    {
        return this._lineNumber;
    },

    get probes()
    {
        return this._probes;
    },

    get color()
    {
    	return this._color;
    },

    set color(value)
    {
        this._color = value;
		this._gutterElement.style.backgroundColor = this._color;
		WebInspector.contentBrowser.currentContentView.responseContentView.textEditor._codeMirror.doc.cm.setGutterMarker(this._lineNumber, "CodeMirror-linenumbers", this._gutterElement);
    },

    enable: function()
    {
    	//Enable All probes in probe group?
    },

    disable: function()
    {
    	//Disable all probes in group?
    },

    addProbe: function(probe)
    {
    	this._probes[probe.probeId] = probe;
		this.dispatchEventToListeners(WebInspector.ProbeGroupObject.Event.ProbesChanged, this)
    }
};
