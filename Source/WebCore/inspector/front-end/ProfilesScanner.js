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


WebInspector.ProfilesScanner = function(model) {
    WebInspector.TimelapseScanner.call(this, model, "profile-cpu", "CPU Profile");

    this._scannedProfilesCount = 0;
};

WebInspector.ProfilesScanner.prototype = {

    // attach one listener per recording that will clear all profiles when a recording is unloaded.
    _initializeModelListeners: function()
    {
        if (this._didInitializeModelListeners)
            return;
        
        this._model.onceEventListener(WebInspector.TimelapseModel.Events.RecordingUnloaded, function() {
            WebInspector.panels.profiles.clearProfiles(true);
            this._didSetupModelListeners = false;
            this._scannedProfilesCount = 0;
        }, this);
        
        this._didSetupPanelListeners = true;
    },

    scanDidStart: function(cb)
    {
        if (!WebInspector.panels.profiles)
            WebInspector.inspectorView.panel("profiles");

        this._initializeModelListeners();
        cb();
    },

    willEnterRegion: function(cb)
    {
        var panel = WebInspector.panels.profiles;
        
        var startProfilingAndContinue = function() {
            var profileType = panel.getProfileType(WebInspector.CPUProfileType.TypeId);
            profileType.startRecordingProfile();
            
            cb();
        };

        if (!panel.profilerEnabled) {
            panel.onceEventListener(WebInspector.ProfileType.Events.ProfilerEnabled,
                                    startProfilingAndContinue, this);
            panel.enableProfiler();
            return;
        }

        startProfilingAndContinue();
    },
    
    willExitRegion: function(cb)
    {
        var panel = WebInspector.panels.profiles;
        var cpuProfileId = WebInspector.CPUProfileType.TypeId;
        var profileType = panel.getProfileType(cpuProfileId);

        panel.onceEventListener(WebInspector.ProfileType.Events.ProfileAdded, function(event) {
            var profile = event.data;
            profile.setIsPinned(true);
            var profileCount = ++this._scannedProfilesCount;
            profile.setDisplayName(WebInspector.UIString("Scanned Profile %d", profileCount));
            // this will force profile data to be serialised to the frontend immediately, and show the scanned profile.
            panel.showProfile(profile); // profile.view() will also force serialization, but not change view.
            
            if (WebInspector.inspectorView.currentPanel() !== panel) {
                var toolbarItem = WebInspector.toolbar.getItemForPanelName(panel.name);
                if (toolbarItem) {
                    toolbarItem.classList.add("pulsing-result");
                    panel.onceEventListener(WebInspector.Panel.Events.PanelShown,
                                            function() {
                                                this.classList.remove("pulsing-result");
                                            }, toolbarItem);
                }
            }
        
            cb();
        }, this);

        if (!profileType.isRecordingProfile()) {
            console.error("Tried to stop profiling, but profiler wasn't capturing a profile. Giving up.");
            return cb();
        }

        // actually stop the profiler.
        profileType.stopRecordingProfile();
    },
    
    shouldScanInitialLoad: function()
    {
        return false;
    },
    
    scanRegion: function(startIndex, endIndex)
    {
        this.linearScanForRegion(startIndex, endIndex);
    },

    __proto__: WebInspector.TimelapseScanner.prototype
};
