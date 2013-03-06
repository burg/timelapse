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


WebInspector.TimelapseScanner = function(model, name, label, shouldDisplay) {
    this._model = model;
    this._scanning = false;
    this._scannerName = name || "(unnamed scanner)";
    this._scannerLabel = label || "(unnamed scanner)";
    this._displayable = (typeof shouldDisplay === "undefined") ? true : shouldDisplay;
};

WebInspector.TimelapseScanner.Events = {
    ScanStarted: "ScanStarted",
    ScanStopped: "ScanStopped"
};

WebInspector.TimelapseScanner.prototype = {
    get isScanning()
    {
        return this._scanning;
    },
    
    get isDisplayable()
    {
        return this._displayable;
    },
    
    get name()
    {
        return this._scannerName;
    },
    
    get label()
    {
        return this._scannerLabel;
    },
    
    // Subclasses override these to implement different scans.
    willEnterRegion: function(cb)
    {
        cb();
    },

    willExitRegion: function(cb)
    {
        cb();
    },

    scanDidStart: function(cb)
    {
        cb();
    },

    scanWillStop: function(cb)
    {
        cb();
    },
    
    // Public API
    scanRegion: function()
    {
        throw new Error("Not implemented.");
    },
    
    // helpers that implement the scanner's particular scan
    linearScanForRegion: function(startIndex, endIndex)
    {
        var model = this._model;
        var timelapseEvents = WebInspector.TimelapseModel.Events;
        var scanner = this;

        var currentIndex = model.currentMarkIndex;
        var breakpointHitIndex = model.breakpointTracker.breakpointHitIndex;
        var allRecords = model.loadedRecording.allRecords;
        var task = new WebInspector.ReplayTask("LinearScanForRegion("+startIndex+","+endIndex+")");
        
        task.chain("notifyScanStarted", this._notifyScanStarted, this);
        task.chain("scanDidStart", this.scanDidStart, this);
        task.chain("SeekToRegionBegin("+startIndex+")", function(cb) {
            model.onceEventListener(timelapseEvents.InputWaiting,
                                    this._createPreventDefaultCallback(cb), this);
            model.startReplayUpToMarkIndexTask(startIndex, true).run();
        }, this);

        task.chain("willEnterRegion", this.willEnterRegion, this);
        // Workaround: currently there is no way to force replay up to the current mark index.
        if (currentIndex == endIndex) {
            var endRecordIndex = model.loadedRecording.recordIndexFromMarkIndex(endIndex);
            var prevIndex = allRecords[endRecordIndex - 1].mark.index;
            task.chain("ScanToMarkPrecedingRegionEnd("+prevIndex+")", function(cb) {
                model.onceEventListener(timelapseEvents.InputWaiting,
                                        this._createPreventDefaultCallback(cb), this);
                model.startReplayUpToMarkIndexTask(prevIndex, true).run();
            }, this);
            // if this is the last step, then don't prevent default action of InputWaiting
            task.chain("ScanToRegionEnd("+endIndex+")", function(cb) {
                model.onceEventListener(timelapseEvents.InputWaiting, cb, task);
                model.startReplayUpToMarkIndexTask(endIndex, true).run();
            });
        } else {
            task.chain("ScanToRegionEnd("+endIndex+")", function(cb) {
                model.onceEventListener(timelapseEvents.InputWaiting,
                                        this._createPreventDefaultCallback(cb), this);
                model.startReplayUpToMarkIndexTask(endIndex, true).run();
            }, this);
        }
        task.chain("willExitRegion", this.willExitRegion, this);

        // TODO: (Issue #165): use savepoints to restore back to cursor.
        if (model.debuggerPaused) {
            task.chain("SeekToCursorBreakpoint("+currentIndex+"."+breakpointHitIndex+")", function(cb) {
                model.replayToBreakpointHitTask(currentIndex, breakpointHitIndex, false).run(cb);
            });
        } else if (currentIndex != endIndex) {
            task.chain("SeekToCursor("+currentIndex+")", function(cb) {
                model.onceEventListener(timelapseEvents.InputWaiting, cb, task);
                model.startReplayUpToMarkIndexTask(currentIndex, false).run();
            });
        }
        
        task.chain("scanWillStop", this.scanWillStop, this);
        task.chain("notifyScanStopped", this._notifyScanStopped, this);
        task.orCancel(this._notifyScanStopped, this);

        model.scheduler.enqueue(task);
    },

    segmentedScanForRegion: function(startIndex, endIndex)
    {
        /* Case: playback is paused outside of the region to be scanned, or stopped. */
        if (startIndex > currentIndex || endIndex <= currentIndex)
            return this.linearScanForRegion(startIndex, endIndex);

        /* Case: playback is paused inside the region to be scanned. */
        var model = this._model;
        var timelapseEvents = WebInspector.TimelapseModel.Events;
        var scanner = this;
        
        var currentIndex = model.currentMarkIndex;
        var breakpointHitIndex = model.breakpointTracker.breakpointHitIndex;
        var allRecords = model.loadedRecording.allRecords;

        var task = new WebInspector.ReplayTask("SegmentedScanForRegion("+startIndex+","+endIndex+")");

        task.chain("notifyScanStarted", this._notifyScanStarted, this);
        task.chain("scanDidStart", this.scanDidStart, this);
        task.chain("willEnterRegion", this.willEnterRegion, this);
        task.chain("ScanFromCursorToRegionEnd("+endIndex+")", function(cb) {
            model.onceEventListener(timelapseEvents.InputWaiting,
                                    this._createPreventDefaultCallback(cb), this);
            model.startReplayUpToMarkIndexTask(endIndex, true).run();
        }, this);
        task.chain("willExitRegion", this.willExitRegion, this);

        if (startIndex > allRecords[0].mark.index) {
            task.chain("SeekToRegionBegin("+startIndex+")", function(cb) {
                model.onceEventListener(timelapseEvents.InputWaiting,
                                        this._createPreventDefaultCallback(cb), this);
                model.startReplayUpToMarkIndexTask(startIndex, true).run();
            }, this);
        }

        task.chain("willEnterRegion", this.willEnterRegion, this);
        // TODO: (Issue #165): use savepoints to restore back to cursor.
        if (model.debuggerPaused) {
            task.chain("ScanFromRegionBeginToCursorBreakpoint("+currentIndex+"."+breakpointHitIndex+")", function(cb) {
                model.replayToBreakpointHitTask(currentIndex, breakpointHitIndex, true).run(cb);
            });
        } else {
            task.chain("ScanFromRegionBeginToCursor("+currentIndex+")", function(cb) {
                model.onceEventListener(timelapseEvents.InputWaiting, cb, task);
                model.startReplayUpToMarkIndexTask(currentIndex, true).run();
            });
        }
        task.chain("willExitRegion", this.willExitRegion, this);
        task.chain("scanWillStop", this.scanWillStop, this);
        task.chain("notifyScanStopped", this._notifyScanStopped, this);
        task.orCancel(this._notifyScanStopped, this);

        model.scheduler.enqueue(task);
    },

    _notifyScanStarted: function(cb)
    {
        this._scanning = true;
        this.dispatchEventToListeners(WebInspector.TimelapseScanner.Events.ScanStarted);
        cb();
    },

    _notifyScanStopped: function(cb)
    {
        this._scanning = false;
        this.dispatchEventToListeners(WebInspector.TimelapseScanner.Events.ScanStopped);
        cb();
    },

    _createPreventDefaultCallback: function(cb)
    {
        return function(innerCb, event) {
            event.preventDefault(); innerCb();
        }.bind(undefined, cb);
    },
    
    __proto__: WebInspector.Object.prototype
};