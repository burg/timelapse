/*
 * Copyright (C) 2008 Apple Inc. All Rights Reserved.
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
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @constructor
 * @param {!WebInspector.ProfileType} profileType
 * @param {string} title
 * @param {number=} uid
 */
WebInspector.ProfileHeader = function(profileType, title, uid)
{
    this._profileType = profileType;
    this.title = title;
    if (uid === undefined) {
        this.uid = -1;
        this.isTemporary = true;
    } else {
        this.uid = uid;
        this.isTemporary = false;
    }
    this._fromFile = false;
    this._isPinned = false;
}

WebInspector.ProfileHeader.prototype = {
    /**
     * @return {!WebInspector.ProfileType}
     */
    profileType: function()
    {
        return this._profileType;
    },

    /**
     * Must be implemented by subclasses.
     * @return {WebInspector.ProfileSidebarTreeElement}
     */
    createSidebarTreeElement: function()
    {
        throw new Error("Needs implemented.");
    },

    /**
     * @return {?WebInspector.View}
     */
    existingView: function()
    {
        return this._view;
    },

    /**
     * @return {!WebInspector.View}
     */
    view: function()
    {
        if (!this._view)
            this._view = this.createView(WebInspector.ProfilesPanel._instance);
        return this._view;
    },

    /**
     * @param {WebInspector.ProfilesPanel} profilesPanel
     * @return {!WebInspector.View}
     */
    createView: function(profilesPanel)
    {
        throw new Error("Not implemented.");
    },

    /**
     * @param {!WebInspector.ProfilesPanel} profilesPanel
     */
    dispose: function(profilesPanel)
    {
    },

    /**
     * @param {Function} callback
     */
    load: function(callback)
    {
    },

    /**
     * @return {boolean}
     */
    canSaveToFile: function()
    {
        return false;
    },

    saveToFile: function()
    {
        throw new Error("Needs implemented");
    },

    /**
     * @param {File} file
     */
    loadFromFile: function(file)
    {
        throw new Error("Needs implemented");
    },

    /**
     * @return {boolean}
     */
    fromFile: function()
    {
        return this._fromFile;
    },

    /**
     * @return {boolean}
     */
    canPinAcrossLoads: function()
    {
        return false;
    },
    
    /**
     * @return {boolean}
     */
    isPinned: function()
    {
        return this.canPinAcrossLoads() && this._isPinned;
    },

    /**
     * @return {boolean}
     */    
    setIsPinned: function(shouldPin)
    {
        if (this.canPinAcrossLoads())
            this._isPinned = shouldPin;
        
        return this._isPinned;
    }
}