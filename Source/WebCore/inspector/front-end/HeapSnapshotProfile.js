/*
 * Copyright (C) 2011 Google Inc. All rights reserved.
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
WebInspector.HeapSnapshotProfileType = function()
{
    WebInspector.ProfileType.call(this, WebInspector.HeapSnapshotProfileType.TypeId, WebInspector.UIString("Take Heap Snapshot"));
}

WebInspector.HeapSnapshotProfileType.TypeId = "HEAP";

WebInspector.HeapSnapshotProfileType.prototype = {
    get buttonTooltip()
    {
        return WebInspector.UIString("Take heap snapshot.");
    },

    /**
     * @override
     * @param {WebInspector.ProfilesModel} model
     * @return {boolean}
     */
    buttonClicked: function(model)
    {
        model.takeHeapSnapshot();
        return true;
    },

    get treeItemTitle()
    {
        return WebInspector.UIString("HEAP SNAPSHOTS");
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
        return WebInspector.UIString("Heap snapshot profiles show memory distribution among your page's JavaScript objects and related DOM nodes.");
    },

    /**
     * @override
     * @param {string=} title
     * @return {WebInspector.ProfileHeader}
     */
    createTemporaryProfile: function(title)
    {
        title = title || WebInspector.UIString("Snapshotting\u2026");
        return new WebInspector.HeapProfileHeader(this, title);
    },

    /**
     * @override
     * @param {HeapProfilerAgent.ProfileHeader} profile
     * @return {WebInspector.ProfileHeader}
     */
    createProfile: function(profile)
    {
        return new WebInspector.HeapProfileHeader(this, profile.title, profile.uid, profile.maxJSObjectId || 0);
    },

    __proto__: WebInspector.ProfileType.prototype
}

/**
 * @constructor
 * @extends {WebInspector.ProfileHeader}
 * @param {!WebInspector.ProfileType} type
 * @param {string} title
 * @param {number=} uid
 * @param {number=} maxJSObjectId
 */
WebInspector.HeapProfileHeader = function(type, title, uid, maxJSObjectId)
{
    WebInspector.ProfileHeader.call(this, type, title, uid);
    this.maxJSObjectId = maxJSObjectId;
    /**
     * @type {WebInspector.OutputStream}
     */
    this._receiver = null;
    /**
     * @type {WebInspector.HeapSnapshotProxy}
     */
    this._snapshotProxy = null;
    this._totalNumberOfChunks = 0;
}

WebInspector.HeapProfileHeader.prototype = {
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
        return new WebInspector.HeapSnapshotView(profilesPanel, this);
    },

    /**
     * @override
     * @param {function(WebInspector.HeapSnapshotProxy):void} callback
     */
    load: function(callback)
    {
        if (this._snapshotProxy) {
            callback(this._snapshotProxy);
            return;
        }

        this._numberOfChunks = 0;
        this._savedChunks = 0;
        this._savingToFile = false;
        if (!this._receiver) {
            this._setupWorker();
            this.sidebarElement.subtitle = WebInspector.UIString("Loading\u2026");
            this.sidebarElement.wait = true;
            this.startSnapshotTransfer();
        }
        var loaderProxy = /** @type {WebInspector.HeapSnapshotLoaderProxy} */ (this._receiver);
        loaderProxy.addConsumer(callback);
    },

    startSnapshotTransfer: function()
    {
        HeapProfilerAgent.getHeapSnapshot(this.uid);
    },

    snapshotConstructorName: function()
    {
        return "JSHeapSnapshot";
    },

    _setupWorker: function()
    {
        function setProfileWait(event)
        {
            this.sidebarElement.wait = event.data;
        }
        var worker = new WebInspector.HeapSnapshotWorker();
        worker.addEventListener("wait", setProfileWait, this);
        var loaderProxy = worker.createLoader(this.snapshotConstructorName());
        loaderProxy.addConsumer(this._snapshotReceived.bind(this));
        this._receiver = loaderProxy;
    },

    dispose: function()
    {
        if (this._receiver)
            this._receiver.close();
        else if (this._snapshotProxy)
            this._snapshotProxy.dispose();
    },

    /**
     * @param {number} value
     * @param {number} maxValue
     */
    _updateTransferProgress: function(value, maxValue)
    {
        var percentValue = ((maxValue ? (value / maxValue) : 0) * 100).toFixed(2);
        if (this._savingToFile)
            this.sidebarElement.subtitle = WebInspector.UIString("Saving\u2026 %d\%", percentValue);
        else
            this.sidebarElement.subtitle = WebInspector.UIString("Loading\u2026 %d\%", percentValue);
    },

    _updateSnapshotStatus: function()
    {
        this.sidebarElement.subtitle = Number.bytesToString(this._snapshotProxy.totalSize);
        this.sidebarElement.wait = false;
    },

    /**
     * @param {string} chunk
     */
    transferChunk: function(chunk)
    {
        ++this._numberOfChunks;
        this._receiver.write(chunk, callback.bind(this));
        function callback()
        {
            this._updateTransferProgress(++this._savedChunks, this._totalNumberOfChunks);
            if (this._totalNumberOfChunks === this._savedChunks) {
                if (this._savingToFile)
                    this._updateSnapshotStatus();
                else
                    this.sidebarElement.subtitle = WebInspector.UIString("Parsing\u2026");

                this._receiver.close();
            }
        }
    },

    _snapshotReceived: function(snapshotProxy)
    {
        this._receiver = null;
        if (snapshotProxy)
            this._snapshotProxy = snapshotProxy;
        this._updateSnapshotStatus();
        var worker = /** @type {WebInspector.HeapSnapshotWorker} */ (this._snapshotProxy.worker);
        this.isTemporary = false;
        worker.startCheckingForLongRunningCalls();
    },

    finishHeapSnapshot: function()
    {
        this._totalNumberOfChunks = this._numberOfChunks;
    },

    /**
     * @override
     * @return {boolean}
     */
    canSaveToFile: function()
    {
        return !this.fromFile() && !!this._snapshotProxy && !this._receiver;
    },

    /**
     * @override
     */
    saveToFile: function()
    {
        this._numberOfChunks = 0;

        var fileOutputStream = new WebInspector.FileOutputStream();
        function onOpen()
        {
            this._receiver = fileOutputStream;
            this._savedChunks = 0;
            this._updateTransferProgress(0, this._totalNumberOfChunks);
            HeapProfilerAgent.getHeapSnapshot(this.uid);
        }
        this._savingToFile = true;
        this._fileName = this._fileName || "Heap-" + new Date().toISO8601Compact() + ".heapsnapshot";
        fileOutputStream.open(this._fileName, onOpen.bind(this));
    },

    /**
     * @override
     * @param {File} file
     */
    loadFromFile: function(file)
    {
        this.title = file.name;
        this.sidebarElement.subtitle = WebInspector.UIString("Loading\u2026");
        this.sidebarElement.wait = true;
        this._setupWorker();
        this._numberOfChunks = 0;
        this._savingToFile = false;

        var delegate = new WebInspector.HeapSnapshotLoadFromFileDelegate(this);
        var fileReader = this._createFileReader(file, delegate);
        fileReader.start(this._receiver);
    },

    _createFileReader: function(file, delegate)
    {
        return new WebInspector.ChunkedFileReader(file, 10000000, delegate);
    },

    __proto__: WebInspector.ProfileHeader.prototype
}

/**
 * @constructor
 * @implements {WebInspector.OutputStreamDelegate}
 */
WebInspector.HeapSnapshotLoadFromFileDelegate = function(snapshotHeader)
{
    this._snapshotHeader = snapshotHeader;
}

WebInspector.HeapSnapshotLoadFromFileDelegate.prototype = {
    onTransferStarted: function()
    {
    },

    /**
     * @param {WebInspector.ChunkedReader} reader
     */
    onChunkTransferred: function(reader)
    {
        this._snapshotHeader._updateTransferProgress(reader.loadedSize(), reader.fileSize());
    },

    onTransferFinished: function()
    {
        this._snapshotHeader.finishHeapSnapshot();
    },

    /**
     * @param {WebInspector.ChunkedReader} reader
     */
    onError: function (reader, e)
    {
        switch(e.target.error.code) {
        case e.target.error.NOT_FOUND_ERR:
            this._snapshotHeader.sidebarElement.subtitle = WebInspector.UIString("'%s' not found.", reader.fileName());
        break;
        case e.target.error.NOT_READABLE_ERR:
            this._snapshotHeader.sidebarElement.subtitle = WebInspector.UIString("'%s' is not readable", reader.fileName());
        break;
        case e.target.error.ABORT_ERR:
            break;
        default:
            this._snapshotHeader.sidebarElement.subtitle = WebInspector.UIString("'%s' error %d", reader.fileName(), e.target.error.code);
        }
    }
}
