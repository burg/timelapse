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

WebInspector.HorizontalMessageSheet = function() {
	WebInspector.Object.call(this);

	this.element = document.createElement("div");
    this.element.classList.add(WebInspector.HorizontalMessageSheet.StyleClassName);

    this._message = this.element.createChild("div");
    this._message.classList.add(WebInspector.HorizontalMessageSheet.MessageStyleClassName);

    this._optionContainer = this.element.createChild("div");
    this._optionContainer.classList.add(WebInspector.HorizontalMessageSheet.OptionContainerStyleClassName);

    this.visible = false;
};

WebInspector.HorizontalMessageSheet.StyleClassName = "message-sheet";
WebInspector.HorizontalMessageSheet.MessageStyleClassName = "message";
WebInspector.HorizontalMessageSheet.OptionContainerStyleClassName = "options";

WebInspector.HorizontalMessageSheet.prototype = {
    constructor: WebInspector.HorizontalMessageSheet,
    __proto__: WebInspector.Object.prototype,

    // Public

    shown: function()
    {
    	// If the message panel is already showing, this means some higher-level
        // event has displayed a message.
        if (this.visible)
        	return;

        this.visible = true;
    },

    hidden: function()
    {
        this.visible = false;
		this.setMessage({ text: "" });
		delete this._messageErrorListeners;
		this.setOptions();
		delete this._optionErrorListeners;
    },

    closed: function()
    {
    },

    get message()
    {
    	return this._message.textContent;
    },

    get visible()
    {
    	return !this.element.classList.contains("hidden");
    },

    set visible(val)
    {
    	if (val)
    		this.element.classList.remove("hidden");
    	else
    		this.element.classList.add("hidden");
    },

    setMessage: function(message)
    {
    	this._message.classList.remove("clickable");

    	if (this._messageErrorListeners)
    		this._messageErrorListeners.uninstall(true);
    	
    	this._message.textContent = message.text;
    	
    	if (!message.callback)
    		return;
    	this._message.classList.add("clickable");
       	this._messageErrorListeners = new WebInspector.EventListenerGroup(this, "MessageSheetMessage recording listeners");
       	this._messageErrorListeners.register(this._message, "click", message.callback);
       	this._messageErrorListeners.install();
    },

    setOptions: function(options)
    {
    	this.element.classList.remove("has-options");
    	if (this._optionErrorListeners)
    		this._optionErrorListeners.uninstall(true);

        this._optionContainer.removeChildren();

        if (!options) 
        	return;
        this.element.classList.add("has-options");
       	this._optionErrorListeners = new WebInspector.EventListenerGroup(this, "MessageSheetOption recording listeners");
    	for (var i = 0; i < options.length; i++) {
    		var option = this._optionContainer.createChild("div");
    		option.textContent = options[i].label;
       	    option.classList.add(options[i].classname);
       	    this._optionErrorListeners.register(option, "click", options[i].callback);
    	}
    	this._optionErrorListeners.install();
    }
};
