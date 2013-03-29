/*
 * Copyright (C) 2011 Google Inc. All Rights Reserved.
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
 * @extends {WebInspector.ProfileType}
 */
WebInspector.CSSSelectorProfileType = function()
{
    WebInspector.ProfileType.call(this, WebInspector.CSSSelectorProfileType.TypeId, WebInspector.UIString("Collect CSS Selector Profile"));
    this._recording = false;
    this._profileUid = 1;
    WebInspector.CSSSelectorProfileType.instance = this;
}

WebInspector.CSSSelectorProfileType.TypeId = "SELECTOR";

WebInspector.CSSSelectorProfileType.prototype = {
    get buttonTooltip()
    {
        return this._recording ? WebInspector.UIString("Stop CSS selector profiling.") : WebInspector.UIString("Start CSS selector profiling.");
    },

    /**
     * @override
     * @param {WebInspector.ProfilesModel} model
     * @return {boolean}
     */
    buttonClicked: function(model)
    {
        if (this._recording) {
            this._stopRecordingProfile(model);
            return false;
        } else {
            this._startRecordingProfile(model);
            return true;
        }
    },

    get treeItemTitle()
    {
        return WebInspector.UIString("CSS SELECTOR PROFILES");
    },

    get description()
    {
        return WebInspector.UIString("CSS selector profiles show how long the selector matching has taken in total and how many times a certain selector has matched DOM elements (the results are approximate due to matching algorithm optimizations.)");
    },

    reset: function()
    {
        this._profileUid = 1;
    },

    setRecordingProfile: function(isProfiling)
    {
        this._recording = isProfiling;
    },

    /**
     * @param {WebInspector.ProfilesModel} model
     */
    _startRecordingProfile: function(model)
    {
        this._recording = true;
        CSSAgent.startSelectorProfiler();
        model.setRecordingProfile(WebInspector.CSSSelectorProfileType.TypeId, true);
    },

    /**
     * @param {WebInspector.ProfilesModel} model
     */
    _stopRecordingProfile: function(model)
    {
        /**
         * @param {?Protocol.Error} error
         * @param {CSSAgent.SelectorProfile} profile
         */
        function callback(error, profile)
        {
            if (error)
                return;

            var uid = this._profileUid++;
            var title = WebInspector.UIString("Profile %d", uid) + String.sprintf(" (%s)", Number.secondsToString(profile.totalTime / 1000));
            var profileHeader = new WebInspector.CSSProfileHeader(this, title, uid, profile);
            model.addProfileHeader(profileHeader);
            model.setRecordingProfile(WebInspector.CSSSelectorProfileType.TypeId, false);
        }

        this._recording = false;
        CSSAgent.stopSelectorProfiler(callback.bind(this));
    },

    /**
     * @override
     * @param {string=} title
     * @return {WebInspector.ProfileHeader}
     */
    createTemporaryProfile: function(title)
    {
        title = title || WebInspector.UIString("Recording\u2026");
        return new WebInspector.CSSProfileHeader(this, title);
    },

    __proto__: WebInspector.ProfileType.prototype
}


/**
 * @constructor
 * @extends {WebInspector.ProfileHeader}
 * @param {!WebInspector.CSSSelectorProfileType} type
 * @param {string} title
 * @param {number=} uid
 * @param {CSSAgent.SelectorProfile=} protocolData
 */
WebInspector.CSSProfileHeader = function(type, title, uid, protocolData)
{
    WebInspector.ProfileHeader.call(this, type, title, uid);
    this._protocolData = protocolData;
}

WebInspector.CSSProfileHeader.prototype = {
    /**
     * @override
     */
    createSidebarTreeElement: function()
    {
        return new WebInspector.ProfileSidebarTreeElement(this, "profile-sidebar-tree-item");
    },

    /**
     * @override
     * @param {WebInspector.ProfilesPanel} profilesPanel
     */
    createView: function(profilesPanel)
    {
        var profile = /** @type {CSSAgent.SelectorProfile} */ (this._protocolData);
        return new WebInspector.CSSSelectorProfileView(profile);
    },

    __proto__: WebInspector.ProfileHeader.prototype
}
