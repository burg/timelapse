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


WebInspector.TimelapseBreakpointScanner = function(model) {
    WebInspector.TimelapseScanner.call(this, model);
};

WebInspector.TimelapseBreakpointScanner.prototype = {
    scanRegion: function(startIndex, endIndex)
    {
        var model = this._model;
        var timelapseEvents = WebInspector.TimelapseModel.Events;
        var scanner = this;
        var scannerEvents = WebInspector.TimelapseScanner.Events;

        var currentIndex = model.currentMarkIndex;
        var breakpointHitIndex = model.breakpointTracker.breakpointHitIndex;
        var allRecords = model.loadedRecording.allRecords;
        var task = new WebInspector.ReplayTask("ScanBreakpointsInRegion("+startIndex+","+endIndex+")");

        var breakpointAutoResumeCallback = function(event) {
            // prevent debugger wait from propagating; resume.
            event.preventDefault();
            if (model.debuggerPaused)
                DebuggerAgent.resume();
        };
        
        var createPreventDefaultCallback = function(callback) {
            return function(innerCb, event) {
                event.preventDefault(); innerCb();
            // provide dummy thisObj argument, since it will be
            // adjusted by dispatchEventToListeners() anyway.
            }.bind(null, callback);
        };
        
        task.chain("notifyScanningStarted", function(cb) {
            WebInspector.debuggerModel.enableDebugger();
            scanner._scanning = true;
            model.addEventListener(timelapseEvents.DebuggerWaiting, breakpointAutoResumeCallback, model);
            scanner.dispatchEventToListeners(scannerEvents.ScanStarted);
            cb();
        });
        
        /* Case: playback is paused inside the region to be scanned. */
        if (startIndex <= currentIndex && endIndex > currentIndex) {
            task.chain("ScanFromCursorToRegionEnd("+endIndex+")", function(cb) {
                model.onceEventListener(timelapseEvents.InputWaiting,
                                        createPreventDefaultCallback(cb), task);
                model.startReplayUpToMarkIndexTask(endIndex, true).run();
            });
            if (startIndex > allRecords[0].mark.index) {
                task.chain("SeekToRegionBegin("+startIndex+")", function(cb) {
                    model.onceEventListener(timelapseEvents.InputWaiting,
                                            createPreventDefaultCallback(cb), task);
                    model.startReplayUpToMarkIndexTask(startIndex, false).run();
                });
            }

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
        }
        /* Case: playback is paused outside of the region to be scanned, or stopped. */
        else {
            if (startIndex > allRecords[0].mark.index) {
                task.chain("SeekToRegionBegin("+startIndex+")", function(cb) {
                    model.onceEventListener(timelapseEvents.InputWaiting,
                                            createPreventDefaultCallback(cb), task);
                    model.startReplayUpToMarkIndexTask(startIndex, false).run();
                });
            }

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
            model.removeEventListener(timelapseEvents.DebuggerWaiting, breakpointAutoResumeCallback, model);
            scanner._scanning = false;
            scanner.dispatchEventToListeners(scannerEvents.ScanStopped);
            cb();
        };
        
        task.chain("NotifyScanningDone", notifyScanningDoneStep)
            .orCancel(notifyScanningDoneStep);
        
        model.scheduler.enqueue(task);
    },
    
    __proto__: WebInspector.TimelapseScanner.prototype
};

WebInspector.TimelapseBreakpointDataProvider = function(recording, displayName, color)
{
    WebInspector.DataProvider.call(this, recording, "breakpoint",
                                   WebInspector.DataProvider.Types.BreakpointHits);

    var tracker = WebInspector.timelapseModel.breakpointTracker;

    this._displayName = displayName;
    this._color = color;
    this._intervals = tracker.exploredIntervals;
    this._initializeRecords();

    var events = WebInspector.TimelapseBreakpointTracker.Events;
    tracker.addEventListener(events.BreakpointHit,     this._onBreakpointHit, this);
    tracker.addEventListener(events.BreakpointAdded,   this._onBreakpointsInvalidated, this);
    tracker.addEventListener(events.BreakpointRemoved, this._onBreakpointsInvalidated, this);
}

WebInspector.TimelapseBreakpointDataProvider.prototype = {
    get counterNoun()
    {
	return "Hits";
    },

    enable: function()
    {
	WebInspector.debuggerModel.setBreakpointsActive(true);
	WebInspector.DataProvider.prototype.enable.call(this);
    },

    disable: function()
    {
	WebInspector.debuggerModel.setBreakpointsActive(false);
	WebInspector.DataProvider.prototype.disable.call(this);
    },

    get exploredIntervals()
    {
	return this._intervals;
    },

    _initializeRecords: function()
    {
	var records = WebInspector.timelapseModel.breakpointTracker.records;
	this._records = [];

	// flatten existing records from BreakpointTracker
	for (var i = 0; i < records.length; i++) {
	    var hits = records[i].hits;
	    for (var j = 0; j < hits.length; j++) {
		if (typeof hits[j] === "undefined")
		    continue;
		this._records.push({
		    breakpoint: hits[j],
		    mark: records[i].mark,
		    type: WebInspector.TimelapseAgent.RecordType.BreakpointHit,
		    hitIndex: j
		});
	    }
	}
    },

    _onBreakpointHit: function(event)
    {
	// Breakpoints can be detected in any order, so keep records sorted
	var record = event.data;

	function breakpointRecordComparator(a, b) {
	    if (a.mark.index > b.mark.index) return 1;
	    if (a.mark.index < b.mark.index) return -1;
	    return a.hitIndex - b.hitIndex;
	}

	var idx = binarySearch(record, this._records, breakpointRecordComparator);
	if (idx >= 0)
	    return;
	this._records.splice(-(idx + 1), 0, record);

	this.dispatchEventToListeners(WebInspector.DataProvider.Events.DataChanged, this);
    },

    _onBreakpointsInvalidated: function(event)
    {
	// neutralize ourselves, and notify clients that we became worthless.
	this._removeEventListeners(event);
	this.dispatchEventToListeners(WebInspector.DataProvider.Events.Invalidated, this);
    },

    _removeEventListeners: function(event)
    {
	var tracker = WebInspector.timelapseModel.breakpointTracker;
	var events = WebInspector.TimelapseBreakpointTracker.Events;
	tracker.removeEventListener(events.BreakpointHit, this._onBreakpointHit, this);
	tracker.removeEventListener(events.BreakpointAdded, this._removeEventListeners, this);
	tracker.removeEventListener(events.BreakpointRemoved, this._removeEventListeners, this);
    },
    
    __proto__: WebInspector.TimelapseInputDataProvider.prototype
};