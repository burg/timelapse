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


WebInspector.TimelineScanner = function(model) {
    WebInspector.TimelapseScanner.call(this, model, "timeline", "Timeline Data");
};

WebInspector.TimelineScanner.prototype = {
    scanRegion: function(startIndex, endIndex)
    {
        var model = this._model;
        var timelapseEvents = WebInspector.TimelapseModel.Events;
        var scanner = this;
               
        var callbacks = {
            "EnterRegion": function(cb) {
                if (!WebInspector.panels.timeline)
                    WebInspector.inspectorView.panel("timeline");

                var timelinePanel = WebInspector.panels.timeline;
                timelinePanel._model.startRecord();

                cb();
            },
            "ExitRegion": function(cb) {
                var timelinePanel = WebInspector.panels.timeline;
                console.assert(timelinePanel, "WAT: Couldn't find Timeline panel!");
                
                timelinePanel._model.stopRecord();
                cb();
            }
            // TODO: (Issue #166): add StopScan callback that
            // makes the Timeline panel light up/blink, if
            // it (and new results) are not already visible.
        };
        
        this.linearScanForRegion(startIndex, endIndex, callbacks);
    },

    __proto__: WebInspector.TimelapseScanner.prototype
};
