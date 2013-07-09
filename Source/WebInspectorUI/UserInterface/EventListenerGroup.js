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

// This class supports common patterns when using many event listeners.
//
// Event listeners can be associated with DOM nodes and `WebInspector.Object`
// instances using the same `register()` method. The class automatically
// fires listeners with `this` bound to `thisObject` or `defaultThisObject`.
//
// Registered event listeners are not active by default. The `install()`
// and `uninstall()` methods enable and disable all listeners en-masse.
//
// When event listeners in the group are no longer needed, the `unregister()`
// method will remove all listeners and allow them to be garbage-collected.
WebInspector.EventListenerGroup = function(defaultThisObject, name)
{
    this.name = name;
    this._defaultThisObject = defaultThisObject;
    this._listeners = [];
}

WebInspector.EventListenerGroup.prototype = {
    register: function(emitter, eventType, listener, thisObject)
    {
        console.assert(listener, "Missing listener for eventType: " + eventType);
        console.assert(emitter, "Missing event emitter for eventType: " + eventType);
        console.assert(emitter instanceof WebInspector.Object || emitter instanceof Node, "Event emitter (eventType:" + eventType + ") does not implement Node or WebInspector.Object!");

        if (!this._listeners)
            this._listeners = [];

        // if adding DOM event listener, adjust the `this` binding automatically.
        if (emitter instanceof Node)
            listener = listener.bind(thisObject || this._defaultThisObject);

        this._listeners.push({ emitter: emitter,
                               eventType: eventType,
                               listener: listener,
                               thisObject: thisObject
                            });
    },

    unregister: function()
    {
        if (this._listenersAreInstalled)
            this.uninstall();
        this._listeners = [];
    },

    get installed()
    {
        return this._listenersAreInstalled;
    },

    install: function()
    {
        console.assert(!this._listenersAreInstalled, "Already installed listener group: " + this.name);

        this._listenersAreInstalled = true;

        for (var i = 0; i < this._listeners.length; ++i) {
            var data = this._listeners[i];
            if (data.emitter instanceof Node)
                data.emitter.addEventListener(data.eventType, data.listener);
            else
                data.emitter.addEventListener(data.eventType, data.listener, data.thisObject || this._defaultThisObject);
        }
    },

    uninstall: function(unregisterListeners)
    {
        console.assert(this._listenersAreInstalled, "Trying to uninstall listener group " + this.name + ", but it isn't installed.");

        delete this._listenersAreInstalled;

        for (var i = 0; i < this._listeners.length; ++i) {
            var data = this._listeners[i];
         if (data.emitter instanceof Node)
                data.emitter.removeEventListener(data.eventType, data.listener);
            else
                data.emitter.removeEventListener(data.eventType, data.listener, data.thisObject || this._defaultThisObject);
        }

        if (unregisterListeners)
            this._listeners = [];
    },
}
