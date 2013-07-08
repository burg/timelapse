/*
 *  Copyright (C) 2013, University of Washington. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of the University of Washington nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
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

WebInspector.LineGraphMarker = function(adjustable)
{
    WebInspector.Object.call(this);
    this._adjustable = adjustable;

    this.element = document.createElement("div");
    if (adjustable)
        this.element.classList.add("adjustable");
    // TODO: install drag listeners

    this.visible = false;
    this.enabled = true;
};

WebInspector.LineGraphMarker.Event = {
    Moved: "line-graph-marker-moved"
};

WebInspector.LineGraphMarker.prototype = {
    constructor: WebInspector.LineGraphMarker,
    __proto__: WebInspector.Object.prototype,

    // Public

    shown: function()
    {
        this.visible = true;
    },

    closed: function()
    {
        this.visible = false;
    },

    updateLayout: function()
    {
    },

    animateFrame: function()
    {
        if (this.element.parentElement === null)
            return;

        // TODO: use requestAnimationFrame to decide when to update.
        var parentWidth = this.element.parentElement.clientWidth;
        // subtract slider width when computing largest possible (left) position
        var maxPercent = (parentWidth - this.element.offsetWidth) / parentWidth;
        this.element.style.left = Number.constrain(this.position, 0.0, maxPercent);
    },

    get position()
    {
        return this._position;
    },

    set position(pos)
    {
        this.setPosition(pos);
    },

    setPosition: function(percent, suppressEvents)
    {
        this._position = Number.constrain(percent, 0.0, 1.0);
        // TODO: use requestAnimationFrame to decide when to update.
        this.animateFrame();
        if (!suppressEvents)
            this.dispatchEventToListeners(WebInspector.LineGraphMarker.Event.Moved);
    },

    get visible()
    {
        return this._visible;
    },

    set visible(value)
    {
        this._visible = !!value;
        if (value)
            this.element.classList.remove("hidden");
        else
            this.element.classList.add("hidden");
    },

    get enabled()
    {
        return this._enabled;
    },

    set enabled(value)
    {
        this._enabled = !!value;
        if (value)
            this.element.classList.remove("disabled");
        else
            this.element.classList.add("disabled");
    }
};
