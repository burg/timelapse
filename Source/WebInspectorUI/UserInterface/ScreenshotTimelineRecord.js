/*
 * Copyright (C) 2013 University of Washington. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
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

 WebInspector.ScreenshotTimelineRecord = function(startTime, image, x, y, width, height)
{
    WebInspector.TimelineRecord.call(this, WebInspector.TimelineRecord.Type.Screenshot, startTime, startTime);

    this._startTime = typeof startTime === "number" ? startTime : NaN;
    this._x = typeof x === "number" ? x : NaN;
    this._y = typeof y === "number" ? y : NaN;
    this._width = typeof width === "number" ? width : NaN;
    this._height = typeof height === "number" ? height : NaN;
    this._image = image;
};

WebInspector.ScreenshotTimelineRecord.EventType = {
    ImageCaptured: "screenshot-image-captured"
};

WebInspector.ScreenshotTimelineRecord.EventType.displayName = function(eventType)
{
    return WebInspector.UIString("Image Captured");
};

WebInspector.ScreenshotTimelineRecord.prototype = {
    constructor: WebInspector.ScreenshotTimelineRecord,

    // Public

    get eventType()
    {
        return WebInspector.ScreenshotTimelineRecord.EventType.ImageCaptured;
    },

    get startTime()
    {
        return this._startTime;
    },

    get x()
    {
        return this._x;
    },

    get y()
    {
        return this._y;
    },

    get width()
    {
        return this._width;
    },

    get height()
    {
        return this._height;
    },

    get area()
    {
        return this._width * this._height;
    },

    get image()
    {
        return this._image;
    }
};

WebInspector.ScreenshotTimelineRecord.prototype.__proto__ = WebInspector.TimelineRecord.prototype;
