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

 WebInspector.ScreenshotTimelineDataGridNode = function(screenshotTimelineRecord, baseStartTime)
{
    WebInspector.DataGridNode.call(this, {});

    this._record = screenshotTimelineRecord;
    this._baseStartTime = baseStartTime || 0;
};

WebInspector.Object.addConstructorFunctions(WebInspector.ScreenshotTimelineDataGridNode);

WebInspector.ScreenshotTimelineDataGridNode.IconStyleClassName = "icon";
WebInspector.ScreenshotTimelineDataGridNode.SubtitleStyleClassName = "subtitle";
WebInspector.ScreenshotTimelineDataGridNode.EmptyImagePlaceholder = "Images/DocumentImage.png";
WebInspector.ScreenshotTimelineDataGridNode.EmptyStringPlaceholder = "\u2014";
WebInspector.ScreenshotTimelineDataGridNode.ScreenshotStyleClassName = "screenshot";
WebInspector.ScreenshotTimelineDataGridNode.EmptyScreenshotStyleClassName = "empty";

WebInspector.ScreenshotTimelineDataGridNode.prototype = {
    constructor: WebInspector.ScreenshotTimelineDataGridNode,
    __proto__: WebInspector.DataGridNode.prototype,

    // Public

    get record()
    {
        return this._record;
    },

    get data()
    {
        return this._record;
    },

    createCellContent: function(columnIdentifier, cell)
    {
        var emptyString = WebInspector.ScreenshotTimelineDataGridNode.EmptyStringPlaceholder;
        var value = this.data[columnIdentifier];

        switch (columnIdentifier) {
        case "eventType":
            return WebInspector.ScreenshotTimelineRecord.EventType.displayName(value);

        case "image":
            var source = value;
            var image = document.createElement("img");
            image.classList.add(WebInspector.ScreenshotTimelineDataGridNode.ScreenshotStyleClassName);

            if (!source) {
                image.src = WebInspector.ScreenshotTimelineDataGridNode.EmptyImagePlaceholder;
                image.classList.add(WebInspector.ScreenshotTimelineDataGridNode.EmptyScreenshotStyleClassName);
            } else {
                image.src = source;
            }

            return image;

        case "x":
        case "y":
            return isNaN(value) ? emptyString : WebInspector.UIString("%d").format(value);

        case "width":
        case "height":
            return isNaN(value) ? emptyString : WebInspector.UIString("%fpx").format(value);

        case "area":
            return isNaN(value) ? emptyString : WebInspector.UIString("%fpx²").format(value);

        case "startTime":
            return isNaN(value) ? emptyString : Number.secondsToString(value - this._baseStartTime);
        }

        return WebInspector.DataGridNode.prototype.createCellContent.call(this, columnIdentifier);
    }
}
