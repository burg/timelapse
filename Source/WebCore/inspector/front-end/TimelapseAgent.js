/*
 *  Copyright (C) 2012, Brian Burg.
 *  Copyright (C) 2012, University of Washington. All rights reserved.
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

/**
 * @constructor
 */
WebInspector.TimelapseAgent = function() {
    // Not implemented.
};

// Must be kept in sync with InspectorTimelapseAgent.h
WebInspector.TimelapseAgent.RecordType = {
    MousePress: "MousePress",
    MouseRelease: "MouseRelease",
    MouseMove: "MouseMove",
    MouseWheel: "MouseWheel",
    KeyPress: "KeyPress",
    Scroll: "Scroll",

    WindowActive: "WindowActive",
    WindowInactive: "WindowInactive",
    WindowFocused: "WindowFocused",
    WindowUnfocused: "WindowUnfocused",

    ReceiveResource: "ReceiveResource",
    
    TimerFire: "TimerFire",
    
    FrameNavigated: "FrameNavigated",
    CaptureBegin: "CaptureBegin",
    CaptureEnd: "CaptureEnd",
    BreakpointHit: "BreakpointHit"
};


// TODO: move this stuff to the presentation model
var makeCoords = function(data) {
    return "(" + (data.x || 0) + "," + (data.y || 0) + ")";
};

var makeModKeys = function(data) {
    str = "";
    if (data.shiftKey) str += "<SHIFT> ";
    if (data.altKey) str += "<ALT> ";
    if (data.ctrlKey) str += "<CTRL> ";
    if (data.metaKey) str += "<META> ";
    return str;
};

var makeButton = function(button) {
    if (button == -1) return ""; // No button
    if (button == 0) return "Left Button";
    if (button == 1) return "Middle Button";
    if (button == 2) return "Right Button";
    return "";
};

WebInspector.TimelapseAgent.RecordPreview = {
    MousePress: function(data)
    {
	return "Coords: " + makeCoords(data) + "; Keys: " + makeModKeys(data) + makeButton(data);
    },
    MouseRelease: function (data)
    {
	return "Coords: " + makeCoords(data) + "; Keys: " + makeModKeys(data) + makeButton(data);
    },
    MouseMove: function (data)
    {
	return "Coords: " + makeCoords(data) + "; Keys: " + makeModKeys(data) + makeButton(data);
    },
    MouseWheel: function (data)
    {
	return "Coords: " + makeCoords(data) + "; Keys: " + makeModKeys(data) + makeButton(data) + "; Scroll: delta of (" + data.deltaX + "," + data.deltaY + "), ticks of (" + data.ticksX + "," + data.ticksY + ")";
    },
    KeyPress: function (data)
    {
	return "Keys: " + data.text + " and modifiers " + makeModKeys(data);
    },
    Scroll: function (data) { return " "; }, // TODO

    WindowActive: function (data) { return " "; },
    WindowInactive: function (data) { return " "; },
    WindowFocused: function (data) { return " "; },
    WindowUnfocused: function (data) { return " "; },

    ReceiveResource: function (data) { return data.url; },
    
    TimerFire: function (data) { return "Fired"; },
    
    FrameNavigated: function(data) { return data.url; },
    CaptureBegin: function (data) { return " "; },
    CaptureEnd: function (data) { return " "; }
};