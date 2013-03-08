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

WebInspector.ProfileHeatmapProvider = function(profile) {
    // FIXME: passing undefined as the recording, since we have no recording context
    WebInspector.DataProvider.call(this, undefined, "profile-heatmap",
                                   WebInspector.DataProvider.Types.ProfileHeatmap);
    
    this._profile = profile;
    this.setHeatmapMode(WebInspector.ProfileHeatmapProvider.DefaultMode);
};

WebInspector.ProfileHeatmapProvider.Modes = {
    None: "None",
    CallCount: "CallCount",
    SelfTime: "SelfTime",
    TotalTime: "TotalTime",
};

WebInspector.ProfileHeatmapProvider.DefaultMode = WebInspector.ProfileHeatmapProvider.Modes.None;

WebInspector.ProfileHeatmapProvider.prototype = {
    _canHighlightSourceFrame: function(sourceFrame)
    {
        return sourceFrame && sourceFrame instanceof WebInspector.JavaScriptSourceFrame;
    },

    setHeatmapMode: function(mode)
    {
        if (!WebInspector.ProfileHeatmapProvider.Modes[mode])
            return;
        
        if (this._activeMode === mode)
            return;
        
        this._activeMode = mode;
        this.dispatchEventToListeners(WebInspector.DataProvider.Events.DataChanged);
    },

    get activeMode()
    {
        return this._activeMode;
    },

    addhighlightsForSourceFrame: function(sourceFrame)
    {
        if (!this._canHighlightSourceFrame(sourceFrame))
            return;
    
        console.log("adding highlights");
    },

    removehighlightsForSourceFrame: function(sourceFrame)
    {
        if (!this._canHighlightSourceFrame(sourceFrame))
            return;

        console.log("removing highlights");
    },

    __proto__: WebInspector.DataProvider.prototype, 
};