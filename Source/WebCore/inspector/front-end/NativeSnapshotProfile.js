/*
 * Copyright (C) 2012 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
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
WebInspector.NativeSnapshotProfileType = function()
{
    WebInspector.ProfileType.call(this, WebInspector.NativeSnapshotProfileType.TypeId, WebInspector.UIString("Take Native Heap Snapshot"));
    this._nextProfileUid = 1;
}

WebInspector.NativeSnapshotProfileType.TypeId = "NATIVE_SNAPSHOT";

WebInspector.NativeSnapshotProfileType.prototype = {
    get buttonTooltip()
    {
        return WebInspector.UIString("Capture native heap graph.");
    },

    /**
     * @override
     * @param {WebInspector.ProfilesModel} model
     * @return {boolean}
     */
    buttonClicked: function(model)
    {
        var profileHeader = new WebInspector.NativeSnapshotProfileHeader(this, WebInspector.UIString("Snapshot %d", this._nextProfileUid), this._nextProfileUid);
        ++this._nextProfileUid;
        profileHeader.isTemporary = true;
        model.addProfileHeader(profileHeader);
        profileHeader.load(function() { });

        /**
         * @param {?string} error
         * @param {?MemoryAgent.MemoryBlock} memoryBlock
         */
        function didReceiveMemorySnapshot(error, memoryBlock)
        {
            this.isTemporary = false;
            this.sidebarElement.subtitle = Number.bytesToString(/** @type{number} */(memoryBlock.size));

            var meta = {
              "node_fields": [
                "type",
                "name",
                "id",
                "self_size",
                "edge_count"
              ],
              "node_types": [
                [
                  "hidden",
                  "array",
                  "string",
                  "object",
                  "code",
                  "closure",
                  "regexp",
                  "number",
                  "native",
                  "synthetic"
                ],
                "string",
                "number",
                "number",
                "number",
              ],
              "edge_fields": [
                "type",
                "name_or_index",
                "to_node"
              ],
              "edge_types": [
                [
                  "context",
                  "element",
                  "property",
                  "internal",
                  "hidden",
                  "shortcut",
                  "weak"
                ],
                "string_or_number",
                "node"
              ]
            };

            var edgeFieldCount = meta.edge_fields.length;
            var nodeFieldCount = meta.node_fields.length;
            var nodeIdFieldOffset = meta.node_fields.indexOf("id");
            var toNodeIdFieldOffset = meta.edge_fields.indexOf("to_node");

            var baseToRealNodeIdMap = {};
            for (var i = 0; i < this._baseToRealNodeId.length; i += 2)
                baseToRealNodeIdMap[this._baseToRealNodeId[i]] = this._baseToRealNodeId[i + 1];

            var nodeId2NodeIndex = {};
            for (var i = nodeIdFieldOffset; i < this._nodes.length; i += nodeFieldCount)
                nodeId2NodeIndex[this._nodes[i]] = i - nodeIdFieldOffset;

            // Translate nodeId to nodeIndex.
            var edges = this._edges;
            for (var i = toNodeIdFieldOffset; i < edges.length; i += edgeFieldCount) {
                if (edges[i] in baseToRealNodeIdMap)
                    edges[i] = baseToRealNodeIdMap[edges[i]];
                edges[i] = nodeId2NodeIndex[edges[i]];
            }

            var heapSnapshot = {
                "snapshot": {
                    "meta": meta,
                    node_count: this._nodes.length / nodeFieldCount,
                    edge_count: this._edges.length / edgeFieldCount,
                    root_index: this._nodes.length - nodeFieldCount
                },
                nodes: this._nodes,
                edges: this._edges,
                strings: this._strings
            };

            var chunk = JSON.stringify(heapSnapshot);
            this.transferChunk(chunk);
            this.finishHeapSnapshot();
        }

        MemoryAgent.getProcessMemoryDistribution(true, didReceiveMemorySnapshot.bind(profileHeader));
        return false;
    },

    get treeItemTitle()
    {
        return WebInspector.UIString("NATIVE SNAPSHOT");
    },

    get description()
    {
        return WebInspector.UIString("Native memory snapshot profiles show native heap graph.");
    },

    /**
     * @override
     * @param {string=} title
     * @return {WebInspector.ProfileHeader}
     */
    createTemporaryProfile: function(title)
    {
        title = title || WebInspector.UIString("Snapshotting\u2026");
        return new WebInspector.NativeSnapshotProfileHeader(this, title);
    },

    /**
     * @override
     * @param {ProfilerAgent.ProfileHeader} profile
     * @return {WebInspector.ProfileHeader}
     */
    createProfile: function(profile)
    {
        return new WebInspector.NativeSnapshotProfileHeader(this, profile.title, -1);
    },

    __proto__: WebInspector.ProfileType.prototype
}


/**
 * @constructor
 * @extends {WebInspector.HeapProfileHeader}
 * @param {!WebInspector.NativeSnapshotProfileType} type
 * @param {string} title
 * @param {number=} uid
 */
WebInspector.NativeSnapshotProfileHeader = function(type, title, uid)
{
    WebInspector.HeapProfileHeader.call(this, type, title, uid, 0);
    this._strings = [];
    this._nodes = [];
    this._edges = [];
    this._baseToRealNodeId = [];
}

WebInspector.NativeSnapshotProfileHeader.prototype = {
    /**
     * @override
     * @param {WebInspector.ProfilesPanel} profilesPanel
     */
    createView: function(profilesPanel)
    {
        return new WebInspector.NativeHeapSnapshotView(profilesPanel, this);
    },

    startSnapshotTransfer: function()
    {
    },

    snapshotConstructorName: function()
    {
        return "NativeHeapSnapshot";
    },

    addNativeSnapshotChunk: function(chunk)
    {
        this._strings = this._strings.concat(chunk.strings);
        this._nodes = this._nodes.concat(chunk.nodes);
        this._edges = this._edges.concat(chunk.edges);
        this._baseToRealNodeId = this._baseToRealNodeId.concat(chunk.baseToRealNodeId);
    },

    __proto__: WebInspector.HeapProfileHeader.prototype
}
