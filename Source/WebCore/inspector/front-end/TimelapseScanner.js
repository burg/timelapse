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


WebInspector.TimelapseScanner = function(model) {
    this._model = model;
    this._scanning = false;
};

WebInspector.TimelapseScanner.Events = {
    ScanStarted: "ScanStarted",
    ScanStopped: "ScanStopped"
};

WebInspector.TimelapseScanner.CallbackNames = {
    PreScan:     "PreScan",
    PostScan:    "PostScan",
    EnterRegion: "EnterRegion",
    ExitRegion:  "ExitRegion"
};

WebInspector.TimelapseScanner.prototype = {
    _checkScannerCallbacks: function(callbacks)
    {
        var dummyFn = function(cb) { cb(); };
        for (var f in WebInspector.TimelapseScanner.CallbackNames) {
            if (!(f in callbacks) || typeof callbacks[f] !== "function")
                callbacks[f] = dummyFn;
        }
    },

    get isScanning()
    {
        return this._scanning;
    },
    
    scanRegion: function()
    {
        console.error("scanRegion() not reimplemented for this scanner!");
    },
    
    linearScanForRegion: function(startIndex, endIndex, enterRegionFn, exitRegionFn)
    {
        console.error("notImplemented!");
    },
    
    // {enter,exit}RegionFn must take the continuation callback as the first argument, and call when done.
    segmentedScanForRegion: function(startIndex, endIndex, callbacks)
    {
        var model = this._model;
        var timelapseEvents = WebInspector.TimelapseModel.Events;
        var scanner = this;
        var scannerEvents = WebInspector.TimelapseScanner.Events;

        this._checkScannerCallbacks(callbacks);

        var currentIndex = model.currentMarkIndex;
        var breakpointHitIndex = model.breakpointTracker.breakpointHitIndex;
        var allRecords = model.loadedRecording.allRecords;
        var task = new WebInspector.ReplayTask("SegmentedScanInRegion("+startIndex+","+endIndex+")");
        
        var createPreventDefaultCallback = function(callback) {
            return function(innerCb, event) {
                event.preventDefault(); innerCb();
            // provide dummy thisObj argument, since it will be
            // adjusted by dispatchEventToListeners() anyway.
            }.bind(null, callback);
        };
        
        task.chain("notifyScanningStarted", function(cb) {
            scanner._scanning = true;
            scanner.dispatchEventToListeners(scannerEvents.ScanStarted);
            cb();
        });
        task.chain("PreScan", callbacks.PreScan);
        /* Case: playback is paused inside the region to be scanned. */
        if (startIndex <= currentIndex && endIndex > currentIndex) {
            task.chain("EnterRegion", callbacks.EnterRegion);
            task.chain("ScanFromCursorToRegionEnd("+endIndex+")", function(cb) {
                model.onceEventListener(timelapseEvents.InputWaiting,
                                        createPreventDefaultCallback(cb), task);
                model.startReplayUpToMarkIndexTask(endIndex, true).run();
            });
            task.chain("ExitRegion", callbacks.ExitRegion);
            if (startIndex > allRecords[0].mark.index) {
                task.chain("SeekToRegionBegin("+startIndex+")", function(cb) {
                    model.onceEventListener(timelapseEvents.InputWaiting,
                                            createPreventDefaultCallback(cb), task);
                    model.startReplayUpToMarkIndexTask(startIndex, true).run();
                });
            }

            task.chain("EnterRegion", callbacks.EnterRegion);
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
            task.chain("ExitRegion", callbacks.ExitRegion);
        }
        /* Case: playback is paused outside of the region to be scanned, or stopped. */
        else {
            if (startIndex > allRecords[0].mark.index) {
                task.chain("SeekToRegionBegin("+startIndex+")", function(cb) {
                    model.onceEventListener(timelapseEvents.InputWaiting,
                                            createPreventDefaultCallback(cb), task);
                    model.startReplayUpToMarkIndexTask(startIndex, true).run();
                });
            }
            task.chain("EnterRegion", callbacks.EnterRegion);

            // Workaround: currently there is no way to force replay up to the current mark index.
            if (currentIndex == endIndex) {
                var endRecordIndex = model.loadedRecording.recordIndexFromMarkIndex(endIndex);
                var prevIndex = allRecords[endRecordIndex - 1].mark.index;
                task.chain("ScanToMarkPrecedingRegionEnd("+prevIndex+")", function(cb) {
                    model.onceEventListener(timelapseEvents.InputWaiting,
                                            createPreventDefaultCallback(cb), task);
                    model.startReplayUpToMarkIndexTask(prevIndex, true).run();
                });
                // if this is the last step, then don't prevent default action of InputWaiting
                task.chain("ScanToRegionEnd("+endIndex+")", function(cb) {
                    model.onceEventListener(timelapseEvents.InputWaiting, cb, task);
                    model.startReplayUpToMarkIndexTask(endIndex, true).run();
                });
            } else {
                task.chain("ScanToRegionEnd("+endIndex+")", function(cb) {
                    model.onceEventListener(timelapseEvents.InputWaiting,
                                            createPreventDefaultCallback(cb), task);
                    model.startReplayUpToMarkIndexTask(endIndex, true).run();
                });
            }
            task.chain("ExitRegion", callbacks.ExitRegion);

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
        }

        var notifyScanningDoneStep = function(cb) {
            scanner._scanning = false;
            scanner.dispatchEventToListeners(scannerEvents.ScanStopped);
            cb();
        };
        
        task.chain("PostScan", callbacks.PostScan);
        task.chain("NotifyScanningDone", notifyScanningDoneStep)
            .orCancel(notifyScanningDoneStep);
        model.scheduler.enqueue(task);

    },
    
    __proto__: WebInspector.Object.prototype
};