/*
 *  Copyright (C) 2013, University of Washington. All rights reserved.
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

WebInspector.RecordingsManager = function()
{
    WebInspector.Object.call(this);

    // this manager is not reset when the main frame reloads,
    // so initialization is inlined into the constructor.

    this._sessions = [];
    this._sessionsByUID = {};

    this._recordings = [];
    this._recordingsByUID = {};

    // load recordings and sessions that may already be available on backend.
    ReplayAgent.getAvailableRecordings(this._updateAvailableRecordings.bind(this));
    ReplayAgent.getAvailableSessions(this._updateAvailableSessions.bind(this));
}

WebInspector.RecordingsManager.Event = {
    SessionAdded: "recordings-manager-session-added",
    SessionRemoved: "recordings-manager-session-removed",
    RecordingAdded: "recordings-manager-recording-added",
    RecordingRemoved: "recordings-manager-recording-removed",
    RecordingAddedToSession: "recordings-manager-recording-added-to-session",
    RecordingRemovedFromSession: "recordings-manager-recording-removed-from-session"
};

WebInspector.RecordingsManager.prototype = {
    constructor: WebInspector.RecordingsManager,
    __proto__: WebInspector.Object.prototype,

    // Public

    get sessions() {
        return this._sessions.slice();
    },

    get recordings() {
        return this._recordings.slice();
    },

    loadFromFile: function(file)
    {
        // TODO(Issue #269): implement deserialization API in WebInspector.RecordingsManager.
        console.error("Loading recording from file not supported.");
    },

    saveToFile: function(recording, filename)
    {
        if (!InspectorFrontendHost.canSave()) {
            console.error("Saving a recording to file not supported.");
            return;
        }

        filename = filename || recording.filename() || WebInspector.UIString("SavedRecording.webreplay");

        ReplayAgent.getSerializedRecording(recording.uid, function(error, data) {
            if (error) {
                console.error("Couldn't save recording to disk: " + error);
                return;
            }

            InspectorFrontendHost.save(filename, JSON.stringify(data), true);
        });
    },

    addSession: function(uid)
    {
        console.assert(uid >= 0, "tried to add session with invalid uid: "+uid);

        if (this._sessionsByUID[uid])
            return;

        // asynchronously load all data for each new session as it's added, and
        // defer any events that cause the data to be accessed.
        var newSession = new WebInspector.CaptureSessionObject(uid);
        this._sessionsByUID[uid] = newSession;
        this._sessions.push(newSession);

        var loadDataForSession = function(session, error, data) {
            if (error) {
                console.error("Couldn't load data for session "+session.uid+":"+error);
                return;
            }

            session.loadData(data);
            this.dispatchEventToListeners(WebInspector.RecordingsManager.Event.SessionAdded, session);
        };

        ReplayAgent.getSerializedSession(uid, loadDataForSession.bind(this, newSession));
    },

    removeSession: function(uid)
    {
        // FIXME: implement this.
    },

    getSessionWithUID: function(uid)
    {
        console.assert(uid >= 0, "invalid uid in request for session.");
        console.assert(this._sessionsByUID[uid], "no session exists with the requested uid: "+uid);
        return this._sessionsByUID[uid];
    },

    addRecording: function(uid)
    {
        console.assert(uid > 0, "tried to add recording with invalid uid: "+uid);

        if (this._recordingsByUID[uid])
            return;

        // for now, just asynchronously load all data for each new recording as
        // it's added, and defer any events that cause the data to be accessed.
        // In the future, we could change the protocol so that the actual action data is
        // loaded lazily (in the case that it's too big for the inspector protocol)
        var newRecording = new WebInspector.SerializedRecordingObject(uid);
        this._recordingsByUID[uid] = newRecording;
        this._recordings.push(newRecording);

        var loadDataForRecording = function(recording, error, data) {
            if (error) {
                console.error("Couldn't load data for recording "+recording.uid+":"+error);
                return;
            }

            recording.loadData(data);
            this.dispatchEventToListeners(WebInspector.RecordingsManager.Event.RecordingAdded, recording);
        };

        ReplayAgent.getSerializedRecording(uid, loadDataForRecording.bind(this, newRecording));
    },

    removeRecording: function(recording)
    {
        // FIXME: implement this (see old RecordingsModel.js).
        // It depends on AsyncTaskScheduler to safely remove recordings that may be already loaded.
    },

    getRecordingWithUID: function(uid)
    {
        console.assert(uid > 0, "invalid uid in request for recording.");
        console.assert(this._recordingsByUID[uid], "no recording exists with the requested uid: "+uid);
        return this._recordingsByUID[uid];
    },

    addRecordingToSession: function(sessionId, recordingId, recordingIndex)
    {
        var session = this.getSessionWithUID(sessionId);
        var recording = this.getRecordingWithUID(recordingId);
        session.insert(recordingIndex, recording);
        this.dispatchEventToListeners(WebInspector.RecordingsManager.Event.RecordingAddedToSession, {
            session: session,
            recording: recording
        });
    },

    removeRecordingFromSession: function(sessionId, recordingIndex)
    {
        var session = this.getSessionWithUID(sessionId);
        var recording = session.recordings[recordingIndex];
        session.remove(recordingIndex);
        this.dispatchEventToListeners(WebInspector.RecordingsManager.Event.RecordingRemovedFromSession, {
            session: session,
            recording: recording
        });
    },

    // Private

    _deleteEntryForSession: function(session)
    {
        this._sessions.splice(this._sessions.indexOf(session), 1);
        delete this._sessionsByUID[session.uid];
    },

    _updateAvailableSessions: function(error, data)
    {
        for (var i = 0; i < data.length; ++i) {
            this.addSession(data[i]);
        }
    },

    _deleteEntryForRecording: function(recording)
    {
        this._recordings.splice(this._recordings.indexOf(recording), 1);
        delete this._recordingsByUID[recording.uid];
    },

    _updateAvailableRecordings: function(error, data)
    {
        for (var i = 0; i < data.length; ++i) {
            this.addRecording(data[i]);
        }
    }
}
