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

const UserInitiatedProfileName = "org.webkit.profiles.user-initiated";

/**
 * @constructor
 * @extends {WebInspector.Object}
 */
WebInspector.ProfilesModel = function()
{
    /** @type {!Array.<!WebInspector.ProfileHeader>} */
    this._profiles = [];
    this._profilerEnabled = !Capabilities.profilerCausesRecompilation;
    
    this._profileTypesByIdMap = {};
    this._profilesIdMap = {};
    this._profilesWereRequested = false;
    
    this._registerProfileType(new WebInspector.CPUProfileType());
    if (!WebInspector.WorkerManager.isWorkerFrontend())
        this._registerProfileType(new WebInspector.CSSSelectorProfileType());
    if (Capabilities.heapProfilerPresent)
        this._registerProfileType(new WebInspector.HeapSnapshotProfileType());
    if (WebInspector.experimentsSettings.nativeMemorySnapshots.isEnabled()) {
        this._registerProfileType(new WebInspector.NativeMemoryProfileType());
        this._registerProfileType(new WebInspector.NativeSnapshotProfileType());
    }
    if (WebInspector.experimentsSettings.canvasInspection.isEnabled())
        this._registerProfileType(new WebInspector.CanvasProfileType());

    InspectorBackend.registerProfilerDispatcher(new WebInspector.ProfilerDispatcher(this));
    InspectorBackend.registerHeapProfilerDispatcher(new WebInspector.HeapProfilerDispatcher(this));
    InspectorBackend.registerMemoryDispatcher(new WebInspector.MemoryDispatcher(this));
        
    if (this._profilerEnabled)
        this._populateProfiles();
};

WebInspector.ProfilesModel.prototype = {
    /**
     * @param {WebInspector.ProfileType} profileType
     */
    _registerProfileType: function(profileType)
    {
        this._profileTypesByIdMap[profileType.id] = profileType;
        this.dispatchEventToListeners(WebInspector.ProfilesModel.Events.ProfileTypeAdded, profileType);
    },

    /**
     * @param {string} typeId
     * @return {!Array.<!WebInspector.ProfileHeader>}
     */
    getProfiles: function(typeId)
    {
        var result = [];
        var profilesCount = this._profiles.length;
        for (var i = 0; i < profilesCount; ++i) {
            var profile = this._profiles[i];
            if (!profile.isTemporary && profile.profileType().id === typeId)
                result.push(profile);
        }
        return result;
    },
    
    getProfileForURL: function(url)
    {
        var match = url.match(WebInspector.ProfileURLRegExp);
        if (!match)
            return false;
        return this._profilesIdMap[this._makeKey(Number(match[3]), match[1])] || false;
    },
    
    /**
     * @param {string} typeId
     */
    getProfileType: function(typeId)
    {
        return this._profileTypesByIdMap[typeId];
    },

    getProfileTypes: function()
    {
        var types = [];
        for (var type in this._profileTypesByIdMap)
            types.push(this._profileTypesByIdMap[type])
            
        return types;
    },

    get profilerEnabled()
    {
        return this._profilerEnabled;
    },

    enableProfiler: function()
    {
        if (this._profilerEnabled)
            return;
        this._toggleProfiling(false);
    },

    disableProfiler: function()
    {
        if (!this._profilerEnabled)
            return;
        this._toggleProfiling(false);
    },
    
    /**
     * @param {boolean} always
     */
    toggleProfiling: function(always)
    {
        if (this._profilerEnabled) {
            WebInspector.settings.profilerEnabled.set(false);
            ProfilerAgent.disable(this._profilerWasDisabled.bind(this));
        } else {
            WebInspector.settings.profilerEnabled.set(always);
            ProfilerAgent.enable(this._profilerWasEnabled.bind(this));
        }
    },
    
    /**
     * @param {number} id
     * @param {string} profileTypeId
     * @return {string}
     */
    _makeKey: function(id, profileTypeId)
    {
        return id + '/' + escape(profileTypeId);
    },
    
    /**
     * @param {string} profileType
     * @param {boolean} isProfiling
     */
    setRecordingProfile: function(profileType, isProfiling)
    {
        // this function is called by individual ProfileTypes to communicate their status.
        var profileTypeObject = this.getProfileType(profileType);
        profileTypeObject.setRecordingProfile(isProfiling);

        var event = (isProfiling) ? WebInspector.ProfilesModel.Events.CaptureStarted
                                  : WebInspector.ProfilesModel.Events.CaptureFinished;
        this.dispatchEventToListeners(event, profileTypeObject);

        if (isProfiling && !this.findTemporaryProfile(profileType))
                this.addProfileHeader(profileTypeObject.createTemporaryProfile());
        else
            this._removeTemporaryProfile(profileType);
    },

    takeHeapSnapshot: function()
    {
        var profileTypeObject = this.getProfileType(WebInspector.HeapSnapshotProfileType.TypeId);
        this.dispatchEventToListeners(WebInspector.ProfilesModel.Events.CaptureStarted, profileTypeObject);
    
        var temporaryRecordingProfile = this.findTemporaryProfile(WebInspector.HeapSnapshotProfileType.TypeId);
        if (!temporaryRecordingProfile)
            this.addProfileHeader(profileTypeObject.createTemporaryProfile());

        function done() {
            this.dispatchEventToListeners(WebInspector.ProfilesModel.Events.CaptureFinished, profileTypeObject);
        }
        HeapProfilerAgent.takeHeapSnapshot(true, done.bind(this));
        WebInspector.userMetrics.ProfilesHeapProfileTaken.record();
    },
    
    /**
     * @param {WebInspector.ProfileHeader} profile
     */
    addProfileHeader: function(profile)
    {
        this._removeTemporaryProfile(profile.profileType().id);

        var profileType = profile.profileType();
        var typeId = profileType.id;

        this._profiles.push(profile);
        this._profilesIdMap[this._makeKey(profile.uid, typeId)] = profile;

//        if (profile.isTemporary)
//            return;

        this.dispatchEventToListeners(WebInspector.ProfilesModel.Events.ProfileAdded, profile);
        
        // FIXME: (Issue #197, #193): store heatmap providers on TimelapseRecording or ScriptsPanel
        var timelapseModel = WebInspector.timelapseModel;
        var timelapseEvents = WebInspector.TimelapseModel.Events;
        if (typeId === WebInspector.CPUProfileType.TypeId) {
            timelapseModel.dispatchEventToListeners(timelapseEvents.ProfilerHeatmapProviderAdded,
                                                    new WebInspector.ProfileHeatmapProvider(profile));
        }
    },

    /**
     * @param {WebInspector.ProfileHeader} profile
     */
    removeProfileHeader: function(profile)
    {
        for (var i = 0; i < this._profiles.length; ++i) {
            if (this._profiles[i].uid === profile.uid) {
                profile = this._profiles[i];
                this._profiles.splice(i, 1);
                profile.dispose(this);
                break;
            }
        }
        delete this._profilesIdMap[this._makeKey(profile.uid, profile.profileType().id)];

        if (!profile.isTemporary) {
            if (profile.profileType().id == WebInspector.HeapSnapshotProfileType.TypeId)
                HeapProfilerAgent.removeProfile(profile.uid);
            else
                ProfilerAgent.removeProfile(profile.profileType().id, profile.uid);
        }
       
        this.dispatchEventToListeners(WebInspector.ProfilesModel.Events.ProfileRemoved, profile);
    },
    
    clearProfiles: function(overridePinnedSetting)
    {
        for (var i = this._profiles.length-1; i >= 0; --i) {
            var profile = this._profiles[i];
            if (overridePinnedSetting || !profile.isPinned())
                this.removeProfileHeader(profile);
        }

        // return to non-recording state.
        this._profilesWereRequested = false;
        this._populateProfiles();
    },
    
    /**
     * @param {string} typeId
     * @return {WebInspector.ProfileHeader}
     */
    findTemporaryProfile: function(typeId)
    {
        var profilesCount = this._profiles.length;
        for (var i = 0; i < profilesCount; ++i)
            if (this._profiles[i].profileType().id === typeId && this._profiles[i].isTemporary)
                return this._profiles[i];
        return null;
    },

    /**
     * @param {string} typeId
     */
    _removeTemporaryProfile: function(typeId)
    {
        var temporaryProfile = this.findTemporaryProfile(typeId);
        if (temporaryProfile)
            this.removeProfileHeader(temporaryProfile);
    },

    /**
     * @param {string} typeId
     * @param {number} uid
     */
    getProfile: function(typeId, uid)
    {
        return this._profilesIdMap[this._makeKey(uid, typeId)];
    },
    
    // This method is idempotent because of this._profilesWereRequested.
    // it corresponds to a flag in ProfilerAgent which decides whether to send
    // profile headers as they are created.
    _populateProfiles: function()
    {
        if (!this.profilerEnabled || this._profilesWereRequested)
            return;

        /**
         * @param {?string} type
         * @param {?string} error
         * @param {Array.<ProfilerAgent.ProfileHeader>} profileHeaders
         */
        function populateCallback(type, error, profileHeaders) {
            if (error)
                return;
            profileHeaders.sort(function(a, b) { return a.uid - b.uid; });
            var profileHeadersLength = profileHeaders.length;
            for (var i = 0; i < profileHeadersLength; ++i) {
                var profileHeader = profileHeaders[i];
                var profileType = this.getProfileType(type || profileHeader.typeId);
                this.addProfileHeader(profileType.createProfile(profileHeader));
            }
        }

        ProfilerAgent.getProfileHeaders(populateCallback.bind(this, null));
        HeapProfilerAgent.getProfileHeaders(populateCallback.bind(this, WebInspector.HeapSnapshotProfileType.TypeId));

        this._profilesWereRequested = true;
    },

    // These methods are called by the various backend dispatchers (below)
    _profilerWasEnabled: function()
    {
        if (this.profilerEnabled)
            return;

        this._profilerEnabled = true;
        this._populateProfiles();

        this.dispatchEventToListeners(WebInspector.ProfilesModel.Events.ProfilerEnabled);
    },

    _profilerWasDisabled: function()
    {
        if (!this.profilerEnabled)
            return;

        this._profilerEnabled = false;
        
        this.dispatchEventToListeners(WebInspector.ProfilesModel.Events.ProfilerDisabled);
    },

    /**
     * @param {number} done
     * @param {number} total
     */
    _reportHeapSnapshotProgress: function(done, total)
    {
        this._model.dispatchEventToListeners(WebInspector.ProfilesModel.Events.HeapSnapshotProgress,
         { "done": done, "total": total });
    },

    /**
     * @param {number} uid
     * @param {string} chunk
     */
    _addHeapSnapshotChunk: function(uid, chunk)
    {
        var profile = this._profilesIdMap[this._makeKey(uid, WebInspector.HeapSnapshotProfileType.TypeId)];
        if (!profile)
            return;
        profile.transferChunk(chunk);
    },

    /**
     * @param {number} uid
     */
    _finishHeapSnapshot: function(uid)
    {
        var profile = this._profilesIdMap[this._makeKey(uid, WebInspector.HeapSnapshotProfileType.TypeId)];
        if (!profile)
            return;
        profile.finishHeapSnapshot();
    },

    __proto__: WebInspector.Object.prototype,
}

WebInspector.ProfilesModel.Events = {
    ProfilerEnabled: "ProfilerEnabled",
    ProfilerDisabled: "ProfilerDisabled",

    CaptureStarted: "CaptureStarted",
    CaptureFinished: "CaptureFinished",

    ProfileAdded: "ProfileAdded",
    ProfileRemoved: "ProfileRemoved",

    ProfileTypeAdded: "ProfileTypeAdded",

    HeapSnapshotProgress: "HeapSnapshotProgress"
};

/**
 * @constructor
 * @implements {MemoryAgent.Dispatcher}
 * @param {WebInspector.ProfilesModel} model
 */
WebInspector.MemoryDispatcher = function(model)
{
    this._model = model;
}

WebInspector.MemoryDispatcher.prototype = {

    /**
     * @override
     * @param {MemoryAgent.HeapSnapshotChunk} chunk
     */
    addNativeSnapshotChunk: function(chunk)
    {
        var profile = this._model.findTemporaryProfile(WebInspector.NativeSnapshotProfileType.TypeId);
        if (!profile)
            return;
        profile.addNativeSnapshotChunk(chunk);
    }
}

/**
 * @constructor
 * @implements {ProfilerAgent.Dispatcher}
 * @param {WebInspector.ProfilesModel} model
 */
WebInspector.ProfilerDispatcher = function(model)
{
    this._model = model;
}

WebInspector.ProfilerDispatcher.prototype = {
    /**
     * @param {ProfilerAgent.ProfileHeader} profile
     */
    addProfileHeader: function(profile)
    {
        var profileType = this._model.getProfileType(profile.typeId);
        this._model.addProfileHeader(profileType.createProfile(profile));
    },

    /**
     * @override
     * @param {number} uid
     * @param {string} chunk
     */
    addHeapSnapshotChunk: function(uid, chunk)
    {
        this._model._addHeapSnapshotChunk(uid, chunk);
    },

    /**
     * @override
     * @param {number} uid
     */
    finishHeapSnapshot: function(uid)
    {
        this._model._finishHeapSnapshot(uid);
    },

    /**
     * @override
     * @param {boolean} isProfiling
     */
    setRecordingProfile: function(isProfiling)
    {
        this._model.setRecordingProfile(WebInspector.CPUProfileType.TypeId, isProfiling);
    },

    /**
     * @override
     */
    resetProfiles: function()
    {
        this._model.clearProfiles();
    },

    /**
     * @override
     * @param {number} done
     * @param {number} total
     */
    reportHeapSnapshotProgress: function(done, total)
    {
        this._model._reportHeapSnapshotProgress(done, total);
    }
}

/**
 * @constructor
 * @implements {HeapProfilerAgent.Dispatcher}
 * @param {WebInspector.ProfilesModel} model
 */
WebInspector.HeapProfilerDispatcher = function(model)
{
    this._model = model;
}

WebInspector.HeapProfilerDispatcher.prototype = {
    /**
     * @param {HeapProfilerAgent.ProfileHeader} profile
     */
    addProfileHeader: function(profile)
    {
        var profileType = this._model.getProfileType(WebInspector.HeapSnapshotProfileType.TypeId);
        this._model.addProfileHeader(profileType.createProfile(profile));
    },

    /**
     * @override
     * @param {number} uid
     * @param {string} chunk
     */
    addHeapSnapshotChunk: function(uid, chunk)
    {
        this._model._addHeapSnapshotChunk(uid, chunk);
    },

    /**
     * @override
     * @param {number} uid
     */
    finishHeapSnapshot: function(uid)
    {
        this._model._finishHeapSnapshot(uid);
    },

    /**
     * @override
     */
    resetProfiles: function()
    {
        this._model.clearProfiles();
    },

    /**
     * @override
     * @param {number} done
     * @param {number} total
     */
    reportHeapSnapshotProgress: function(done, total)
    {
        this._model._reportHeapSnapshotProgress(done, total);
    }
}

importScript("ProfileHeader.js");
importScript("ProfileType.js");
importScript("CPUProfileView.js");
importScript("CSSSelectorProfileView.js");
importScript("HeapSnapshot.js");
importScript("HeapSnapshotDataGrids.js");
importScript("HeapSnapshotGridNodes.js");
importScript("HeapSnapshotLoader.js");
importScript("HeapSnapshotProxy.js");
importScript("HeapSnapshotView.js");
importScript("HeapSnapshotWorkerDispatcher.js");
importScript("JSHeapSnapshot.js");
importScript("NativeHeapSnapshot.js");
importScript("NativeMemorySnapshotView.js");
importScript("CanvasProfileView.js");
