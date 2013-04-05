/**
 * @constructor
 * @extends {WebInspector.ProfileType}
 */
WebInspector.NativeMemoryProfileType = function()
{
    WebInspector.ProfileType.call(this, WebInspector.NativeMemoryProfileType.TypeId, WebInspector.UIString("Capture Native Memory Distribution"));
    this._nextProfileUid = 1;
}

WebInspector.NativeMemoryProfileType.TypeId = "NATIVE_MEMORY_DISTRIBUTION";
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

WebInspector.NativeMemoryProfileType.prototype = {
    get buttonTooltip()
    {
        return WebInspector.UIString("Capture native memory distribution.");
    },

    /**
     * @override
     * @param {WebInspector.ProfilesModel} model
     * @return {boolean}
     */
    buttonClicked: function(model)
    {
        var profileHeader = new WebInspector.NativeMemoryProfileHeader(this, WebInspector.UIString("Snapshot %d", this._nextProfileUid), this._nextProfileUid);
        ++this._nextProfileUid;
        profileHeader.isTemporary = true;
        model.addProfileHeader(profileHeader);
        /**
         * @param {?string} error
         * @param {?MemoryAgent.MemoryBlock} memoryBlock
         */
        function didReceiveMemorySnapshot(error, memoryBlock)
        {
            if (memoryBlock.size && memoryBlock.children) {
                var knownSize = 0;
                for (var i = 0; i < memoryBlock.children.length; i++) {
                    var size = memoryBlock.children[i].size;
                    if (size)
                        knownSize += size;
                }
                var otherSize = memoryBlock.size - knownSize;

                if (otherSize) {
                    memoryBlock.children.push({
                        name: "Other",
                        size: otherSize
                    });
                }
            }
            profileHeader._memoryBlock = memoryBlock;
            profileHeader.isTemporary = false;
            profileHeader.sidebarElement.subtitle = Number.bytesToString(/** @type{number} */(memoryBlock.size));
        }
        MemoryAgent.getProcessMemoryDistribution(false, didReceiveMemorySnapshot.bind(this));
        return false;
    },

    get treeItemTitle()
    {
        return WebInspector.UIString("MEMORY DISTRIBUTION");
    },

    /**
     * @return {string} format
     */
    defaultNameFormat: function()
    {
        return WebInspector.UIString("Snapshot %d");
    },

    get description()
    {
        return WebInspector.UIString("Native memory snapshot profiles show memory distribution among browser subsystems");
    },

    /**
     * @override
     * @param {string=} title
     * @return {WebInspector.ProfileHeader}
     */
    createTemporaryProfile: function(title)
    {
        title = title || WebInspector.UIString("Snapshotting\u2026");
        return new WebInspector.NativeMemoryProfileHeader(this, title);
    },

    /**
     * @override
     * @param {ProfilerAgent.ProfileHeader} profile
     * @return {WebInspector.ProfileHeader}
     */
    createProfile: function(profile)
    {
        return new WebInspector.NativeMemoryProfileHeader(this, profile.title, -1);
    },

    __proto__: WebInspector.ProfileType.prototype
}

/**
 * @constructor
 * @extends {WebInspector.ProfileHeader}
 * @param {!WebInspector.NativeMemoryProfileType} type
 * @param {string} title
 * @param {number=} uid
 */
WebInspector.NativeMemoryProfileHeader = function(type, title, uid)
{
    WebInspector.ProfileHeader.call(this, type, title, uid);

    /**
     * @type {MemoryAgent.MemoryBlock}
     */
    this._memoryBlock = null;
}

WebInspector.NativeMemoryProfileHeader.prototype = {
    /**
     * @override
     */
    createSidebarTreeElement: function()
    {
        return new WebInspector.ProfileSidebarTreeElement(this, "heap-snapshot-sidebar-tree-item");
    },

    /**
     * @override
     * @param {WebInspector.ProfilesPanel} profilesPanel
     */
    createView: function(profilesPanel)
    {
        return new WebInspector.NativeMemorySnapshotView(this);
    },

    __proto__: WebInspector.ProfileHeader.prototype
}
