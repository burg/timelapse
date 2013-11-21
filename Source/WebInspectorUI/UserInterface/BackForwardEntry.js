/*
 *  Copyright (C) 2013 University of Washington. All rights reserved.
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

WebInspector.BackForwardEntry = function(contentView, viewStateCookie)
{
    WebInspector.Object.call(this);

    this._contentView = contentView;
    this._scrollPositions = [];
    // Cookies are compared with Object.shallowEqual, so should not store objects or arrays.
    console.assert(viewStateCookie);
    this._viewStateCookie = viewStateCookie;
    // Serialize view state to cookie immediately, since it could be accessed without
    // this entry ever being shown or hidden (i.e., when checking for duplicate entries).
    this.contentView.saveViewStateToCookie(this._viewStateCookie);
};

WebInspector.BackForwardEntry.prototype = {
    constructor: WebInspector.BackForwardEntry,
    __proto__: WebInspector.Object.prototype,

    // Public

    get contentView()
    {
        return this._contentView;
    },

    get viewStateCookie()
    {
        // Cookies are immutable; they represent a specific navigation action.
        return Object.shallowCopy(this._viewStateCookie);
    },

    prepareToShow: function()
    {
        this._restoreViewStateFromCookie();

        this.contentView.visible = true;
        this.contentView.shown();
        this.contentView.updateLayout();
    },

    prepareToHide: function()
    {
        this.contentView.visible = false;
        this.contentView.hidden();

        this.contentView.saveViewStateToCookie(this._viewStateCookie);
        this._saveScrollPositions();
    },

    // Private

    _restoreViewStateFromCookie: function()
    {
        this._restoreScrollPositions();
        this.contentView.restoreViewStateFromCookie(this.viewStateCookie);
    },

    _restoreScrollPositions: function()
    {
        // If no scroll positions are saved, do nothing.
        if (!this._scrollPositions.length)
            return;

        var scrollableElements = this.contentView.scrollableElements || [];
        console.assert(this._scrollPositions.length === scrollableElements.length);

        for (var i = 0; i < scrollableElements.length; ++i) {
            var position = this._scrollPositions[i];
            var element = scrollableElements[i];
            if (!element)
                continue;

            // Restore the top scroll position by either scrolling to the bottom or to the saved position.
            element.scrollTop = position.isScrolledToBottom ? element.scrollHeight : position.scrollTop;

            // Don't restore the left scroll position when scrolled to the bottom. This way the when content changes
            // the user won't be left in a weird horizontal position.
            element.scrollLeft = position.isScrolledToBottom ? 0 : position.scrollLeft;
        }
    },

    _saveScrollPositions: function()
    {
        var scrollableElements = this.contentView.scrollableElements || [];
        var scrollPositions = [];
        for (var i = 0; i < scrollableElements.length; ++i) {
            var element = scrollableElements[i];
            if (!element)
                continue;

            var position = { scrollTop: element.scrollTop, scrollLeft: element.scrollLeft };
            if (this.contentView.shouldKeepElementsScrolledToBottom)
                position.isScrolledToBottom = element.isScrolledToBottom();

            scrollPositions.push(position);
        }

        this._scrollPositions = scrollPositions;
    }
};
