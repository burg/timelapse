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
    this._profile.loadData(this._dataLoaded.bind(this));
    this._highlightsByURL = {};
    
    this._resetAggregations();
    
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
    
    _resetAggregations: function()
    {
                
        this._urlToCallUIDMap = {};
        this._callUIDToStatsMap = {};
        this._totalCalls = 0;
    },
    
    _dataLoaded: function()
    {
        if (!this._profile.data)
            return;
        
        console.log("re-aggregating data...");
        this._resetAggregations();
        
        var head = this._profile.data.head;
        this._processNode(head);
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
        
        if (!this._urlToCallUIDMap[node.url])
            this._urlToCallUIDMap[node.url] = {};
        this._urlToCallUIDMap[node.url][node.callUID] = node.lineNumber;
        
        if (!this._callUIDToStatsMap[node.callUID]) {
            this._callUIDToStatsMap[node.callUID] = {
                selfTime: 0.0,
                totalTime: 0.0,
                numberOfCalls: 0,
                nodeCount: 0,
                functionName: null,
            };
        }
    
        var bin = this._callUIDToStatsMap[node.callUID];
        bin.selfTime  += node.selfTime;
        bin.totalTime += node.totalTime;
        bin.numberOfCalls += node.numberOfCalls;
        bin.nodeCount += 1;
        bin.functionName = node.functionName;

        this._totalCalls += node.numberOfCalls;
    
        for (var i = 0; i < node.children.length; ++i) {
            this._processNode(node.children[i]);
        }
    },

    _canHighlightSourceFrame: function(sourceFrame)
    {
        return sourceFrame &&
               sourceFrame instanceof WebInspector.JavaScriptSourceFrame;
    },

    _decideStyleForUID: function(callUID)
    {
        //var fnData = this._callUIDToStatsMap[uid];
        return "profiles-heatmap-value-1";
    },

    setHeatmapMode: function(mode)
    {
        if (!WebInspector.ProfileHeatmapProvider.Modes[mode])
            return;
        
        if (this._activeMode === mode)
            return;
        
        this._activeMode = mode;
        this._dataLoaded();
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

        var url = sourceFrame.url;
        console.log("adding highlights for resource: "+url);

        var oldHighlights = this._highlightsByURL[url] || [];
        this._highlightsByURL[url] = [];
        for (var i = 0; i < oldHighlights.length; ++i) {
            sourceFrame.textEditor.removeHighlight(oldHighlights[i]);
        }

        var fnToLineMap = this._urlToCallUIDMap[url] || {};
        for (uid in fnToLineMap) {
            var lineNumber = Math.max(0, fnToLineMap[uid]-1 || 0);
            var styleClass = this._decideStyleForUID(uid);
            var functionName = this._callUIDToStatsMap[uid].functionName || "(anonymous function)";
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