/*
 *  Copyright (C) 2013, University of Washington. All rights reserved.
 *
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

/**
 * @constructor
 * @extends {WebInspector.Object}
 */
WebInspector.DataProvider = function(name, type)
{
    WebInspector.Object.call(this);

    this._name = name;
    this._type = type;
    this._enabled = true;
};

WebInspector.DataProvider.DefaultColor = WebInspector.Color.fromRGB(0, 0, 0);
WebInspector.DataProvider.DefaultCounterNoun = "Records";

WebInspector.DataProvider.Event = {
    Enabled: "data-provider-enabled",
    Disabled: "data-provider-disabled",
    WillRemove: "data-provider-will-remove"
};

WebInspector.DataProvider.prototype = {
    constructor: WebInspector.DataProvider,
    __proto__: WebInspector.Object.prototype,

    // Public

    get name()
    {
        return this._name;
    },

    get displayName()
    {
        return this._name;
    },

    get counterNoun()
    {
        return WebInspector.DataProvider.DefaultCounterNoun;
    },

    get color()
    {
        return WebInspector.DataProvider.DefaultColor;
    },

    get enabled()
    {
        return this._enabled;
    },

    set enabled(flag)
    {
        if (this.enabled == flag)
            return;

        this._enabled = flag;
        var eventName = WebInspector.DataProvider.Event[(flag) ? "Enabled" : "Disabled"];
        this.dispatchEventToListeners(eventName, this);
    },

    // This event notifies listeners that they should stop listening to this provider.
    willRemove: function()
    {
        this.dispatchEventToListeners(WebInspector.DataProvider.Event.WillRemove, this);

        if (this.hasAnyEventListeners()){
            console.error("Provider still has listeners after dispatching WillRemove event:");
            console.error(this);
            console.error(this._listeners);
        }
    }
};
