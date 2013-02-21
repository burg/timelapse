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

/**
 * @constructor
 * @extends {WebInspector.Panel}
 */
WebInspector.RecordingsPanel = function()
{
    WebInspector.Panel.call(this, "recordings");
    this.registerRequiredCSS("recordingsPanel.css");

    this.createSidebarViewWithTree();

    this._model = WebInspector.timelapseModel;
    this._model.addEventListener(WebInspector.TimelapseModel.Events.RecordingUnloaded, this._recordingUnloaded, this);
    this._model.addEventListener(WebInspector.TimelapseModel.Events.RecordingLoaded, this._recordingLoaded, this);

    this._registerShortcuts();
};

WebInspector.RecordingsPanel.prototype = {
    get toolbarItemLabel()
    {
        return WebInspector.UIString("Recordings");
    },

    _recordingUnloaded: function()
    {
        WebInspector.Panel.prototype.reset.call(this);
        this.searchCanceled();
        
        if (this._dataGrid) {
            this._dataGrid.detach();
            this._dataGrid.dispose();
            delete this._dataGrid;
        }
    },

    _recordingLoaded: function()
    {
        this.searchCanceled();
      
        this._dataGrid = new WebInspector.RecordingInputsGrid(this._model, this._model.loadedRecording);
        this._dataGrid.show(this.splitView.mainElement);
    },

    _registerShortcuts: function()
    {
	// Next/previous input.
    var handlerPrev = function() {
	    if (!this._model.inputPaused) return;
	    var grid = this._dataGrid;
	    grid.replayToPreviousNode.call(grid);
	};
    var handlerNext = function() {
	    if (!this._model.inputPaused) return;
	    var grid = this._dataGrid;
	    grid.replayToNextNode.call(grid);
	};

    var shortcut = WebInspector.KeyboardShortcut;
    var shortcutPrev = shortcut.makeDescriptor("P", shortcut.Modifiers.Alt);
    var shortcutNext = shortcut.makeDescriptor("N", shortcut.Modifiers.Alt);
    this.registerShortcuts(shortcutPrev, handlerPrev.bind(this));
    this.registerShortcuts(shortcutNext, handlerNext.bind(this));

    var keys = [shortcutPrev, shortcutNext];
    var section = WebInspector.shortcutsScreen.section(WebInspector.UIString("Recordings Panel"));
    section.addRelatedKeys(keys, WebInspector.UIString("Replay to previous/next input"));
    },
};

WebInspector.RecordingsPanel.prototype.__proto__ = WebInspector.Panel.prototype;
