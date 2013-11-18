/*
 * Copyright (C) 2013, University of Washington. All rights reserved.
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

WebInspector.ProbeSetDataGrid = function(probeSet)
{
    console.assert(probeSet instanceof WebInspector.ProbeSetObject, "Wrong object passed as probe set: ", probeSet);
    this.probeSet = probeSet;

    var columns = {};
    this.probeSet.probes.forEach(function(probe) {
        var probeTitle = probe.expression || WebInspector.UIString("(uninitialized)");
        columns[probe.id] = { title: probeTitle };
    });
    WebInspector.DataGrid.call(this, columns);

    this._frameNodes = {};
    this._nodesSinceLastNavigation = [];

    this._listeners = new WebInspector.EventListenerGroup(this, "Static probe set data grid listeners");
    this._listeners.register(probeSet, WebInspector.ProbeSetObject.Event.ProbeAdded, this._setupProbe);
    this._listeners.register(probeSet, WebInspector.ProbeSetObject.Event.ProbeRemoved, this._teardownProbe);
    this._listeners.register(probeSet, WebInspector.ProbeSetObject.Event.SamplesCleared, this._setupData);
    this._listeners.register(probeSet, WebInspector.ProbeSetObject.Event.Selected, this._pausedAtProbeSet);
    this._listeners.register(probeSet, WebInspector.ProbeSetObject.Event.Unselected, this._executionResumed);
    this._listeners.register(WebInspector.ProbeObject, WebInspector.ProbeObject.Event.ExpressionChanged, this._probeExpressionChanged)
    this._listeners.register(this.element, "dblclick", this._gridClicked);
    this._listeners.install();

    this._setupData();
}

WebInspector.ProbeSetDataGrid.DataUpdatedStyleClassName = "data-updated";
WebInspector.ProbeSetDataGrid.FutureFrameStyleClassName = "future-value";
WebInspector.ProbeSetDataGrid.PastFrameStyleClassName = "past-value";
WebInspector.ProbeSetDataGrid.HighlightedFrameStyleClassName = "highlighted";

WebInspector.ProbeSetDataGrid.DataUpdatedAnimationDuration = 300; // milliseconds

WebInspector.ProbeSetDataGrid.prototype = {
    constructor: WebInspector.ProbeSetDataGrid,
    __proto__: WebInspector.DataGrid.prototype,

    // Public

    closed: function()
    {
        this.probeSet.probes.forEach(this._teardownProbe.bind(this));
        this._listeners.uninstall(true);
    },

    addColumn: function(columnIdentifier, column, index)
    {
        if (column.disclosure)
            this.disclosureColumnIdentifier = columnIdentifier;

        var headerColumnGroup = document.createElement("col");
        if (column.width)
            headerColumnGroup.style.width = column.width;
        column.element = headerColumnGroup;

        var headerColumnCell = document.createElement("th");
        headerColumnCell.className = columnIdentifier + "-column";
        headerColumnCell.columnIdentifier = columnIdentifier;
        this._headerTableHeaders[columnIdentifier] = headerColumnCell;

        var columnLabelElement = document.createElement("div");
        if (column.titleDOMFragment)
            columnLabelElement.appendChild(column.titleDOMFragment);
        else
            columnLabelElement.textContent = column.title;
        headerColumnCell.appendChild(columnLabelElement);

        if (column.sort) {
            headerColumnCell.classList.add("sort-" + column.sort);
            this._sortColumnCell = headerColumnCell;
        }

        if (column.sortable) {
            headerColumnCell.addEventListener("click", this._clickInHeaderCell.bind(this), false);
            headerColumnCell.classList.add("sortable");
        }

        if (column.aligned)
            this.aligned[columnIdentifier] = column.aligned;

        if (column.group) {
            this.groups[columnIdentifier] = column.group;
            headerColumnCell.classList.add("column-group-" + column.group);
        }

        if (column.collapsesGroup) {
            console.assert(column.group !== column.collapsesGroup);

            var divider = document.createElement("div");
            divider.className = "divider";
            headerColumnCell.appendChild(divider);

            var collapseDiv = document.createElement("div");
            collapseDiv.className = "collapser-button";
            collapseDiv.title = this._collapserButtonCollapseColumnsToolTip();
            collapseDiv.addEventListener("mouseover", this._mouseoverColumnCollapser.bind(this));
            collapseDiv.addEventListener("mouseout", this._mouseoutColumnCollapser.bind(this));
            collapseDiv.addEventListener("click", this._clickInColumnCollapser.bind(this));
            headerColumnCell.appendChild(collapseDiv);

            headerColumnCell.collapsesGroup = column.collapsesGroup;
            headerColumnCell.classList.add("collapser");
        }

        ++this._columnCount;
        if (!index) {
            this._headerTableBody.firstChild.appendChild(headerColumnCell); // headerRow
            this._headerTableColumnGroup.appendChild(headerColumnGroup);

            var td = document.createElement("td");
            td.className = columnIdentifier + "-column";
            var group = column.group;
            if (group)
                td.classList.add("column-group-" + group);
            //this._dataTableBody.lastChild.appendChild(td); // fillerRow

            this._dataTableColumnGroup.appendChild(headerColumnGroup.cloneNode(true));

            this.columns[columnIdentifier] = column;
            this.columns[columnIdentifier].ordinal = this._columnsArray.length;
            this.columns[columnIdentifier].identifier = columnIdentifier;
            this._columnsArray.push(column);

               this._columnsArray.lastValue.bodyElement = this._dataTableColumnGroup.lastChild;
        } else {
            this._headerTableBody.firstChild.insertBefore(headerColumnCell, this._headerTableBody.firstChild.children[index]); // headerRow
            this._headerTableColumnGroup.insertBefore(headerColumnGroup, this._headerTableColumnGroup.children[index]);

            var td = document.createElement("td");
            td.className = columnIdentifier + "-column";
            var group = column.group;
            if (group)
                td.classList.add("column-group-" + group);
            //this._dataTableBody.lastChild.insertBefore(td, this._dataTableBody.lastChild.children[index]); // fillerRow

            this._dataTableColumnGroup.insertBefore(headerColumnGroup.cloneNode(true), this._dataTableColumnGroup.children[index]);

            this.columns[columnIdentifier] = column;
            this.columns[columnIdentifier].ordinal = index;
            this.columns[columnIdentifier].identifier = columnIdentifier;
            this._columnsArray.splice(index, 1, column);

               this._columnsArray[index].bodyElement = this._dataTableColumnGroup.children[index];
        }

        this._headerTableColumnGroup.span = this._columnCount;
        this._dataTableColumnGroup.span = this._columnCount;
    },

    removeColumn: function(column, willReplace)
    {
        console.assert(column.identifier in this.columns);

        // Update the data grid's column model.
        delete this.columns[column.identifier];
        this._columnsArray.splice(columnIndex, 1);

        --this._columnCount;
        this._headerTableColumnGroup.span = this._columnCount;
        this._dataTableColumnGroup.span = this._columnCount;

        if (!willReplace) {
            for (var i = columnIndex; i < this._columnsArray.length; ++i)
                --this._columnsArray[i].ordinal;
        }

        // Update the view (sometimes manually) to match the model.
        var columnIndex = column.ordinal;
        var headerColumnGroupElement = this._headerTableColumnGroup.children[columnIndex];
        headerColumnGroupElement.remove();

        var headerRows = this._headerTableBody.children;
        for (var i = 0; i < headerRows.length; ++i) {
            var headerElement = headerRows[i].children[columnIndex];
            headerElement.remove();
        }

        var dataColumnGroupElement = this._dataTableColumnGroup.children[columnIndex];
        dataColumnGroupElement.remove();

        this.children.forEach(function(node) { node.refresh(); });

    },

    // Private

    _setupProbe: function(event)
    {
        var probe = event.data;
        this.addColumn(probe.id, {title: probe.expression});

        this._data.frames.forEach(this._updateNodeForFrame.bind(this));
    },

    _teardownProbe: function(event)
    {
        var probe = event.data;
        this.removeColumn(this.columns[probe.id]);

        this._data.frames.forEach(this._updateNodeForFrame.bind(this));
    },

    _setupData: function()
    {
        this._data = this.probeSet.dataTable;
        this._data.frames.forEach(this._updateNodeForFrame.bind(this));

        this._dataListeners = new WebInspector.EventListenerGroup(this, "Data table event listeners");
        this._dataListeners.register(this._data, WebInspector.ProbeSetDataTable.Event.FrameInserted, this._dataFrameInserted);
        this._dataListeners.register(this._data, WebInspector.ProbeSetDataTable.Event.FrameReplaced, this._dataFrameReplaced);
        this._dataListeners.register(this._data, WebInspector.ProbeSetDataTable.Event.SeparatorInserted, this._dataSeparatorInserted);
        this._dataListeners.register(this._data, WebInspector.ProbeSetDataTable.Event.SeparatorReplaced, this._dataSeparatorReplaced);
        this._dataListeners.register(this._data, WebInspector.ProbeSetDataTable.Event.WillRemove, this._teardownData);

        if (WebInspector.replayManager.canReplay || WebInspector.replayManager.isReplaying)
            this._dataListeners.register(WebInspector.replayManager, WebInspector.ReplayManager.Event.CursorChanged, this._replayCursorChanged);

        this._dataListeners.install();
    },

    _teardownData: function()
    {
        this._dataListeners.uninstall(true);
        this.removeChildren();
        this._frameNodes = {};
        this._separators = {};
        delete this._lastUpdatedFrame;
    },

    _updateNodeForFrame: function(frame)
    {
        console.assert(frame instanceof WebInspector.ProbeSetDataFrame, "Tried to update probe group data grid with non-frame: ", frame);
        var node = null;
        if (this._frameNodes[frame.key]) {
            node = this._frameNodes[frame.key];
            node.frame = frame;
            node.refresh();
        } else {
            node = new WebInspector.ProbeSetDataGridNode(this);
            node.frame = frame;
            this._frameNodes[frame.key] = node;
            node.createCells();

            var sortFunction = function(a, b) {
                return a.frame.constructor.compare(a.frame, b.frame);
            };
            var insertionIndex = insertionIndexForObjectInListSortedByFunction(node, this.children, sortFunction);
            if (insertionIndex === this.children.length)
                this.appendChild(node);
            else if (this.children[insertionIndex].frame.key === frame.key) {
                this.removeChild(this.children[insertionIndex]);
                this.insertChild(node, insertionIndex);
            } else
                this.insertChild(node, insertionIndex);
        }
        console.assert(node);

        node.element.classList.add(WebInspector.ProbeSetDataGrid.DataUpdatedStyleClassName);
        window.setTimeout(function() {
            node.element.classList.remove(WebInspector.ProbeSetDataGrid.DataUpdatedStyleClassName);
        }, WebInspector.ProbeSetDataGrid.DataUpdatedAnimationDuration);

        node.element.classList.remove(WebInspector.ProbeSetDataGrid.FutureFrameStyleClassName);
        this._nodesSinceLastNavigation.push(node);
    },

    _updateNodeForSeparator: function(frame)
    {
        console.assert(this._frameNodes.hasOwnProperty(frame.key), "Tried to add separator for unknown data frame: ", frame);
        this._frameNodes[frame.key].updateCellsForSeparator(frame, this.probeSet);

        for (var i = 0; i < this._nodesSinceLastNavigation.length; ++i) {
            var node = this._nodesSinceLastNavigation[i];
            node.element.classList.add(WebInspector.ProbeSetDataGrid.PastFrameStyleClassName);
        }

        this._nodesSinceLastNavigation = [];
    },

    _dataFrameInserted: function(event)
    {
        var frame = event.data;
        this._lastUpdatedFrame = frame;
        this._updateNodeForFrame(frame);
    },

    _dataFrameReplaced: function(event)
    {
        var frame = event.data;
        this._lastUpdatedFrame = frame;
        this._updateNodeForFrame(frame);
    },

    _dataSeparatorInserted: function(event)
    {
        var frame = event.data;
        this._updateNodeForSeparator(frame);
    },

    _dataSeparatorReplaced: function(event)
    {
        var frame = event.data;
        this._updateNodeForSeparator(frame);
    },

    _replayCursorChanged: function()
    {
        // We use the first mark index as a proxy for "beginning of the recording".
        // It would be safer to make sure that this mark actually has the type
        // "BeginSentinel".
        if (WebInspector.replayManager.currentMarkIndex !== 1)
            return;

        this._nodesSinceLastNavigation = [];
        for (var key in this._frameNodes) {
            var elem = this._frameNodes[key].element;
            elem.classList.add(WebInspector.ProbeSetDataGrid.FutureFrameStyleClassName);
            elem.classList.remove(WebInspector.ProbeSetDataGrid.PastFrameStyleClassName);
        }
    },

    _gridClicked: function(event)
    {
        if (!event.target.gridNode || !(WebInspector.replayManager.canReplay || WebInspector.replayManager.isReplaying))
            return;

        WebInspector.replayManager.replayToMarkIndexSoon(event.target.gridNode.frame.markIndex, false, WebInspector.ReplayManager.ReplaySpeed.Normal);
    },

    _pausedAtProbeSet: function(event)
    {
        var lastIndex = this._data.frames.indexOf(this._lastUpdatedFrame);
        var currentFrame = this._data.frames[lastIndex];
        if (!currentFrame || !this._frameNodes[currentFrame.key])
            return;
        node = this._frameNodes[currentFrame.key];
        node.element.classList.add(WebInspector.ProbeSetDataGrid.HighlightedFrameStyleClassName);

    },

    _executionResumed: function(event)
    {
        for (var key in this._frameNodes) {
            var elem = this._frameNodes[key].element;
            elem.classList.remove(WebInspector.ProbeSetDataGrid.HighlightedFrameStyleClassName);
        }
    },

    _probeExpressionChanged: function(event)
    {
        var probe = event.target;
        if (probe.breakpoint !== this.probeSet.breakpoint)
            return;

        var oldColumn = this.columns[probe.id];
        if (!oldColumn)
            return;

        this.removeColumn(oldColumn, true);
        var index = oldColumn.ordinal;
        var newColumn = {title: event.data.newValue};
        this.addColumn(probe.id, newColumn, index);

        this._data.frames.forEach(this._updateNodeForFrame.bind(this));
    }
}
