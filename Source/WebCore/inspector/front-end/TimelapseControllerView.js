/*
 *  Copyright (C) 2012, Brian Burg, Jake Bailey.
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
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseControllerView = function()
{
    WebInspector.View.call(this);

    this.element.id = "timelapse-controller-view";

    this._model = WebInspector.timelapseModel;
    this._presentationModel = WebInspector.timelapsePresentationModel;

    var eventNames = WebInspector.TimelapseModel.EventTypes;
    this._model.addEventListener(eventNames.RecordingDidStop, this._recordingDidStop, this);

    this._recordingView = new WebInspector.TimelapseRecordingView(this);
    this._replayingView = new WebInspector.TimelapseReplayingView(this);
}

WebInspector.TimelapseControllerView.prototype = {
    reset: function()
    {
	this._recordingView.clear();
	this._replayingView.clear();

	if (this._replayingView.isShowing)
	    this._replayingView.detach();

	this._recordingView.show(this.element);
    },

    _recordingDidStop: function() {
	// if nothing was recorded, don't even show the replay view.
	// the recording view knows to change its message in this situation.
	if (this._model.allRecords.length == 0)
	    return;

	this._recordingView.detach();
	this._replayingView.show(this.element);
    }
}

WebInspector.TimelapseControllerView.prototype.__proto__ = WebInspector.View.prototype;

/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseRecordingView = function()
{
    WebInspector.View.call(this);

    this._model = WebInspector.timelapseModel;
    this._presentationModel = WebInspector.timelapsePresentationModel;

    this.element.id = "timelapse-recording-view";

    this._messagePanel = document.createElement("div");
    this._messagePanel.className = "timelapse-recording-message";
    this._messagePanel.addEventListener("click", this._onMessagePanelClicked.bind(this), true);
    this.element.appendChild(this._messagePanel);

    var eventNames = WebInspector.TimelapseModel.EventTypes;
    this._model.addEventListener(eventNames.RecordingWillStart, this._onRecordingWillStart, this);
    this._model.addEventListener(eventNames.RecordingDidStart, this._onRecordingDidStart, this);
    this._model.addEventListener(eventNames.RecordingWillStop, this._onRecordingWillStop, this);
    this._model.addEventListener(eventNames.RecordingDidStop, this._onRecordingDidStop, this);

    WebInspector.resourceTreeModel.addEventListener(WebInspector.ResourceTreeModel.EventTypes.MainFrameNavigated, this._onMainFrameNavigated, this);

    this._scrollview = new WebInspector.TimelapseScrollview();
    this._scrollview.show(this.element);
};

WebInspector.TimelapseRecordingView.prototype = {
    wasShown: function()
    {
	this.refresh();
    },

    refresh: function()
    {
	this._scrollview.refresh();
	this._scrollview.onResize();
    },

    clear: function()
    {
	this._scrollview.reset();
	this._messagePanel.textContent = "Click to Record.";
    },

    _onRecordingWillStart: function()
    {
	this._messagePanel.textContent = "Initializing...";
	this._messagePanel.classList.add("message-pulse");
    },

    _onRecordingDidStart: function()
    {
	this._messagePanel.textContent = "Reloading page...";
    },

    _onMainFrameNavigated: function()
    {
	if (this._model.recording)
	    this._messagePanel.textContent = "Recording... Click again to stop.";
    },

    _onRecordingWillStop: function()
    {
	this._messagePanel.textContent = "Working...";
    },

    _onRecordingDidStop: function()
    {
	this._messagePanel.classList.remove("message-pulse");

	if (this._model.allRecords.length == 0)
	    this._messagePanel.textContent = "Nothing was recorded. Please try again.";
    },

    _onMessagePanelClicked: function(event)
    {
	if (this._model.recording)
	    this._model.stopRecording();

	if (!this._model.recording && !this._model.replaying)
	    this._model.startRecording();
    }
};

WebInspector.TimelapseRecordingView.prototype.__proto__ = WebInspector.View.prototype;


/**
 * @constructor
 * @extends {WebInspector.View}
 */
WebInspector.TimelapseReplayingView = function()
{
    WebInspector.View.call(this);

    this.element.id = "timelapse-replaying-view";

    this._model = WebInspector.timelapseModel;
    this._presentationModel = WebInspector.timelapsePresentationModel;

    this._miniview = new WebInspector.TimelapseMiniview();
    this._miniview.show(this.element);

    this._overviewWindow = new WebInspector.TimelapseOverview();
    this._overviewWindow.show(this.element);

    var labelContainer = document.createElement("div");
    labelContainer.className = "timelapse-timeline-labels";

    var order = this._presentationModel.categoryOrder;
    var height = this._presentationModel.timelineHeight;
    for (var i = 0; i < order.length; i++) {
	var key = order[i];
	var label = new WebInspector.TimelapseTimelineLabel(this._presentationModel.categories[key]);
	label.element.style.setProperty("top", height*i + "px");
	labelContainer.appendChild(label.element);
    }
    this.element.appendChild(labelContainer);
};

WebInspector.TimelapseReplayingView.prototype = {
    wasShown: function()
    {
	this._overviewWindow.refresh();
	this._miniview.refresh();
	this._miniview.onResize();
    },

    refresh: function()
    {
	this._overviewWindow.refresh();
	this._miniview.refresh();
	this._miniview.onResize();
    },

    clear: function()
    {
	this._overviewWindow.reset();
	this._miniview.reset();
    }
};

WebInspector.TimelapseReplayingView.prototype.__proto__ = WebInspector.View.prototype;

/**
 * @constructor
 * @extends {WebInspector.Object}
 */
WebInspector.TimelapseTimelineLabel = function(category)
{
    WebInspector.Object.call(this);

    this._presentationModel = WebInspector.timelapsePresentationModel;
    this.category = category;

    this.element = document.createElement("div");
    this.element.className = "timelapse-timeline-label-wrapper timelapse-category-" + category.name;
    this.element.style.setProperty("background-color", category.color.toString());

    var label = document.createElement("div");
    label.className = "timelapse-timeline-label timelapse-category-" + category.name;
    label.textContent = category.title;
    label.title = category.title;
    label.addEventListener("click", this._onLabelClicked.bind(this), false);
    this.element.appendChild(label);

    var events = WebInspector.TimelapsePresentationModel.EventTypes;
    this._presentationModel.addEventListener(events.FilterChanged, this.refresh, this);
};

WebInspector.TimelapseTimelineLabel.prototype = {
    _onLabelClicked: function()
    {
	this._presentationModel.toggleCategory(this.category);
    },

    refresh: function()
    {
	if (this.category.disabled)
	    this.disable();
	else
	    this.enable();
    },

    enable: function()
    {
	this.element.classList.remove("disabled");
    },

    disable: function()
    {
	this.element.classList.add("disabled");
    }
};

WebInspector.TimelapseTimelineLabel.prototype.__proto__ = WebInspector.Object.prototype;
