/*
 *  Copyright (C) 2013, Brian Burg.
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
 * @extends {WebInspector.ProfileType}
 */
WebInspector.CPUProfileType = function()
{
    WebInspector.ProfileType.call(this, WebInspector.CPUProfileType.TypeId, WebInspector.UIString("Collect JavaScript CPU Profile"));
    this._recording = false;
    WebInspector.CPUProfileType.instance = this;
}

WebInspector.CPUProfileType.TypeId = "CPU";

WebInspector.CPUProfileType.prototype = {
    get buttonTooltip()
    {
        return this._recording ? WebInspector.UIString("Stop CPU profiling.") : WebInspector.UIString("Start CPU profiling.");
    },

    /**
     * @override
     * @return {boolean}
     */
    buttonClicked: function()
    {
        if (this._recording) {
            this.stopRecordingProfile();
            return false;
        } else {
            this.startRecordingProfile();
            return true;
        }
    },

    get treeItemTitle()
    {
        return WebInspector.UIString("CPU PROFILES");
    },

    get description()
    {
        return WebInspector.UIString("CPU profiles show where the execution time is spent in your page's JavaScript functions.");
    },

    isRecordingProfile: function()
    {
        return this._recording;
    },

    startRecordingProfile: function()
    {
        this._recording = true;
        WebInspector.userMetrics.ProfilesCPUProfileTaken.record();
        ProfilerAgent.start();
    },

    stopRecordingProfile: function()
    {
        this._recording = false;
        ProfilerAgent.stop();
    },

    setRecordingProfile: function(isProfiling)
    {
        this._recording = isProfiling;
    },

    /**
     * @override
     * @param {string=} title
     * @return {WebInspector.ProfileHeader}
     */
    createTemporaryProfile: function(title)
    {
        title = title || WebInspector.UIString("Recording\u2026");
        return new WebInspector.CPUProfileHeader(this, title);
    },

    /**
     * @override
     * @param {ProfilerAgent.ProfileHeader} profile
     * @return {WebInspector.ProfileHeader}
     */
    createProfile: function(profile)
    {
        return new WebInspector.CPUProfileHeader(this, profile.title, profile.uid);
    },

    __proto__: WebInspector.ProfileType.prototype
}

/**
 * @constructor
 * @extends {WebInspector.ProfileHeader}
 * @param {!WebInspector.CPUProfileType} type
 * @param {string} title
 * @param {number=} uid
 */
WebInspector.CPUProfileHeader = function(type, title, uid)
{
    WebInspector.ProfileHeader.call(this, type, title, uid);
    this._profileData = null;
    this._displayName = title;
}

WebInspector.CPUProfileHeader.prototype = {
    /**
     * @override
     */
    createSidebarTreeElement: function()
    {
        this._sidebarTreeElement = new WebInspector.ProfileSidebarTreeElement(this, "profile-sidebar-tree-item");
        return this._sidebarTreeElement;
    },

    /**
     * @override
     * @param {string} name
     */
    setDisplayName: function(name)
    {
        this._displayName = name;
        if (this._sidebarTreeElement)
            this._sidebarTreeElement.mainTitle = name;
    },

    /**
     * @override
     * @param {WebInspector.ProfilesPanel} profilesPanel
     */
    createView: function(profilesPanel)
    {
        return new WebInspector.CPUProfileView(this);
    },

    /**
     * @override
     */
    canPinAcrossLoads: function()
    {
        return true;
    },
    
    loadData: function(cb)
    {
        if (this._profileData)
            return cb();
        
        ProfilerAgent.getCPUProfile(this.uid, this._profileDataLoaded.bind(this, cb));
    },
    
    /**
     * @param {?function} callback
     * @param {?Protocol.Error} error
     * @param {ProfilerAgent.CPUProfile} profile
     */
    _profileDataLoaded: function(cb, error, profile)
    {
        if (error || !profile.head)
            return cb();
        
        this._profileData = profile;
        cb();
    },
    
    get data()
    {
        return this._profileData || false;
    },

    __proto__: WebInspector.ProfileHeader.prototype
}
