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

    this._highlightsByURL = {};
    this._urlToCallUIDMap = {};
    
    this._profile = profile;
    this._profile.loadData(this._checkIfDataLoaded.bind(this));
    
    this.setHeatmapMode(WebInspector.ProfileHeatmapProvider.DefaultMode);
};

WebInspector.ProfileHeatmapProvider.prototype = {
        
    _checkIfDataLoaded: function()
    {
        if (!this._profile.data)
            return;
        
        if (!this._haveAggregatedSourceLocations) {
            this._aggregateSourceLocations(this._profile.data.head);
            this._haveAggregatedSourceLocations = true;
        }
        this.activeMode.aggregateData();
        this.dispatchEventToListeners(WebInspector.DataProvider.Events.DataChanged);
    },

    _canHighlightSourceFrame: function(sourceFrame)
    {
        return sourceFrame &&
               sourceFrame instanceof WebInspector.JavaScriptSourceFrame;
    },

    _decideStyleForUID: function(callUID)
    {
        var bin = this.activeMode.getWeightForUID(callUID);
        return "profiles-heatmap-value-" + Math.floor(bin);
    },

    _aggregateSourceLocations: function(node)
    {
        if (!node)
            return;
    
        if (!this._urlToCallUIDMap[node.url])
            this._urlToCallUIDMap[node.url] = {};
        this._urlToCallUIDMap[node.url][node.callUID] = {
                "lineNumber": node.lineNumber,
                "functionName": node.functionName
        };
        
        for (var i = 0; i < node.children.length; ++i) {
            this._aggregateSourceLocations(node.children[i]);
        }
    },

    setHeatmapMode: function(modeDescriptor)
    {
        if (this._activeMode && this._activeMode.descriptor === modeDescriptor)
            return;
        
        this._activeMode = modeDescriptor.createInstanceForProfile(this.profile);
        this._checkIfDataLoaded();
    },

    get activeMode()
    {
        return this._activeMode;
    },

    get profile()
    {
        return this._profile;
    },

    addhighlightsForSourceFrame: function(sourceFrame)
    {
        if (!this._canHighlightSourceFrame(sourceFrame))
            return;

        var url = sourceFrame.url;
        console.log("adding highlights for resource: "+url);

        var oldHighlights = this._highlightsByURL[url] || [];
        this._highlightsByURL[url] = [];
        for (var i = 0; i < oldHighlights.length; ++i) {
            sourceFrame.textEditor.removeHighlight(oldHighlights[i]);
        }

        var uidToLocationMap = this._urlToCallUIDMap[url] || {};
        for (uid in uidToLocationMap) {
            // FIXME: this will not generate correct highlight range for top-level code.
            var lineNumber = Math.max(0, uidToLocationMap[uid].lineNumber-1);
            var styleClass = this._decideStyleForUID(uid);
            var functionName = uidToLocationMap[uid].functionName || "(anonymous function)";
            var highlight = sourceFrame.highlightFunctionAtLine(lineNumber, functionName, styleClass);
            if (highlight)
                this._highlightsByURL[url].push(highlight);
        }
    },

    removehighlightsForSourceFrame: function(sourceFrame)
    {
        if (!this._canHighlightSourceFrame(sourceFrame))
            return;

        var url = sourceFrame.url;
        console.log("removing highlights for resource: "+url);
        
        var oldHighlights = this._highlightsByURL[url] || [];
        this._highlightsByURL[url] = [];
        for (var i = 0; i < oldHighlights.length; ++i) {
            sourceFrame.textEditor.removeHighlight(oldHighlights[i]);
        }
    },

    __proto__: WebInspector.DataProvider.prototype, 
};

WebInspector.ProfileHeatmapProvider.HeatmapModeDescriptor = function(name, displayName, ctor)
{
    this.name = name;
    this.displayName = displayName;
    this._ctor = ctor;
};

WebInspector.ProfileHeatmapProvider.HeatmapModeDescriptor.prototype = {
    createInstanceForProfile: function(profile)
    {
        console.assert(!this._profile, "Already assigned profile to mode instance");
        return new this._ctor(this, profile);
    },
};

WebInspector.ProfileHeatmapProvider.HeatmapMode = function(descriptor, profile)
{
    this.descriptor = descriptor;
    this.profile = profile;
};

WebInspector.ProfileHeatmapProvider.HeatmapMode.prototype = {
    aggregateData: function()
    {
    },
    
    getWeightForUID: function(callUID)
    {
        return 0;
    }
};

WebInspector.ProfileHeatmapProvider.UnicolorHeatmapMode = function(descriptor, profile)
{
    WebInspector.ProfileHeatmapProvider.HeatmapMode.call(this, descriptor, profile);

    this._urlToCallUIDMap = {};
    this._callUIDToStatsMap = {};
};

WebInspector.ProfileHeatmapProvider.UnicolorHeatmapMode.prototype = {
    aggregateData: function()
    {
        this._processNode(this.profile.data.head);
    },
    
    getWeightForUID: function(callUID)
    {
        if (callUID in this._callUIDToStatsMap)
            return 1;

        return 0;
    },
    
    _exportCSVData: function()
    {
        var columns = [
            "callUID",
            "functionName",
            "selfTime",
            "totalTime",
            "callCount",
            "nodeCount"
        ];
        var output = [columns.join(",")];

        for (uid in this._callUIDToStatsMap) {
            var stats = this._callUIDToStatsMap[uid];
            var row = [
                uid,
                stats.functionName,
                stats.selfTime,
                stats.totalTime,
                stats.numberOfCalls,
                stats.nodeCount,
            ];
            output.push(row.join(","));
        }
        
        return output.join("\n");
    },
    
    _processNode: function(node)
    {
        if (!node)
            return;
                
        if (!this._callUIDToStatsMap[node.callUID]) {
            this._callUIDToStatsMap[node.callUID] = {
                selfTime: 0.0,
                totalTime: 0.0,
                numberOfCalls: 0,
                nodeCount: 0,
                functionName: null,
            };
        }
    
        var stats = this._callUIDToStatsMap[node.callUID];
        stats.selfTime  += node.selfTime;
        stats.totalTime += node.totalTime;
        stats.numberOfCalls += node.numberOfCalls;
        stats.nodeCount += 1;
        stats.functionName = node.functionName;
    
        for (var i = 0; i < node.children.length; ++i) {
            this._processNode(node.children[i]);
        }
    },
};

WebInspector.ProfileHeatmapProvider.Modes = [
    new WebInspector.ProfileHeatmapProvider.HeatmapModeDescriptor("none", "None", WebInspector.ProfileHeatmapProvider.HeatmapMode),
    new WebInspector.ProfileHeatmapProvider.HeatmapModeDescriptor("unicolor", "Unicolor", WebInspector.ProfileHeatmapProvider.UnicolorHeatmapMode),
];
WebInspector.ProfileHeatmapProvider.DefaultMode = WebInspector.ProfileHeatmapProvider.Modes[0];