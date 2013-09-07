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

WebInspector.ProbeGroupDataGrid = function(probeGroup)
{
    console.assert(probeGroup instanceof WebInspector.ProbeGroupObject, "Wrong object passed as probe group: ", probeGroup);
    this._probeGroup = probeGroup;

    var columns = {};
    for (var i = 0; i < this._probeGroup.probes.length; ++i) {
        var probe = this._probeGroup.probes[i];
        var columnIdentifier = probe.probeId;
        columns[columnIdentifier] = { title: probe.expression };
    }
    WebInspector.DataGrid.call(this, columns);

    this._frameNodes = {};

    this._groupListeners = new WebInspector.EventListenerGroup(this, "Static probe group data grid listeners");
    this._groupListeners.register(probeGroup, WebInspector.ProbeGroupObject.Event.ProbeAdded, this._setupProbe);
    this._groupListeners.register(probeGroup, WebInspector.ProbeGroupObject.Event.ProbeRemoved, this._teardownProbe);
    this._groupListeners.register(probeGroup, WebInspector.ProbeGroupObject.Event.SamplesCleared, this._setupData);
    this._groupListeners.install();

    this._setupData();
}

WebInspector.ProbeGroupDataGrid.FadedGridNodeStyleClassName = "faded";

WebInspector.ProbeGroupDataGrid.prototype = {
    constructor: WebInspector.ProbeGroupDataGrid,
    __proto__: WebInspector.DataGrid.prototype,

    // Public

    closed: function()
    {
        var probes = this._probeGroup.probes;
        for (var i = 0; i < probes.length; ++i)
            this._teardownProbe(probes[i]);

        this._groupListeners.uninstall(true);
    },

    addColumn: function(columnIdentifier, column, index)
    {
        if (column.disclosure)
            this.disclosureColumnIdentifier = columnIdentifier;

        var col = document.createElement("col");
        if (column.width)
            col.style.width = column.width;
        column.element = col;

        var cell = document.createElement("th");
        cell.className = columnIdentifier + "-column";
        cell.columnIdentifier = columnIdentifier;
        this._headerTableHeaders[columnIdentifier] = cell;

        var div = document.createElement("div");
        if (column.titleDOMFragment)
            div.appendChild(column.titleDOMFragment);
        else
            div.textContent = column.title;
        cell.appendChild(div);

        if (column.sort) {
            cell.classList.add("sort-" + column.sort);
            this._sortColumnCell = cell;
        }

        if (column.sortable) {
            cell.addEventListener("click", this._clickInHeaderCell.bind(this), false);
            cell.classList.add("sortable");
        }

        if (column.aligned)
            this.aligned[columnIdentifier] = column.aligned;

        if (column.group) {
            this.groups[columnIdentifier] = column.group;
            cell.classList.add("column-group-" + column.group);
        }

        if (column.collapsesGroup) {
            console.assert(column.group !== column.collapsesGroup);

            var divider = document.createElement("div");
            divider.className = "divider";
            cell.appendChild(divider);

            var collapseDiv = document.createElement("div");
            collapseDiv.className = "collapser-button";
            collapseDiv.title = this._collapserButtonCollapseColumnsToolTip();
            collapseDiv.addEventListener("mouseover", this._mouseoverColumnCollapser.bind(this));
            collapseDiv.addEventListener("mouseout", this._mouseoutColumnCollapser.bind(this));
            collapseDiv.addEventListener("click", this._clickInColumnCollapser.bind(this));
            cell.appendChild(collapseDiv);

            cell.collapsesGroup = column.collapsesGroup;
            cell.classList.add("collapser");
        }

        ++this._columnCount;
        if (!index) {
            this._headerTableBody.firstChild.appendChild(cell); // headerRow
            this._headerTableColumnGroup.appendChild(col);

            var td = document.createElement("td");
            td.className = columnIdentifier + "-column";
            var group = column.group;
            if (group)
                td.classList.add("column-group-" + group);
            this._dataTableBody.lastChild.appendChild(td); // fillerRow

            this._dataTableColumnGroup.appendChild(col.cloneNode(true));

            this.columns[columnIdentifier] = column;
            this.columns[columnIdentifier].ordinal = this._columnsArray.length;
            this.columns[columnIdentifier].identifier = columnIdentifier;
            this._columnsArray.push(column);

               this._columnsArray.lastValue.bodyElement = this._dataTableColumnGroup.lastChild;
        } else {
            this._headerTableBody.firstChild.insertBefore(cell, this._headerTableBody.firstChild.children[index]); // headerRow
            this._headerTableColumnGroup.insertBefore(col, this._headerTableColumnGroup.children[index]);

            var td = document.createElement("td");
            td.className = columnIdentifier + "-column";
            var group = column.group;
            if (group)
                td.classList.add("column-group-" + group);
            this._dataTableBody.lastChild.insertBefore(td, this._dataTableBody.lastChild.children[index]); // fillerRow

            this._dataTableColumnGroup.insertBefore(col.cloneNode(true), this._dataTableColumnGroup.children[index]);

            this.columns[columnIdentifier] = column;
            this.columns[columnIdentifier].ordinal = index;
            this.columns[columnIdentifier].identifier = columnIdentifier;
            this._columnsArray.splice(index, 1, column);

               this._columnsArray[index].bodyElement = this._dataTableColumnGroup.children[index];
        }

        this._headerTableColumnGroup.span = this._columnCount;
        this._dataTableColumnGroup.span = this._columnCount;
    },

    removeColumn: function(columnIdentifier, willReplace)
    {
        var column = this.columns[columnIdentifier];
        if (!column)
            return;

        var columnIndex = column.ordinal;

        var headerElement = this._headerTableColumnGroup.children[columnIndex];
        headerElement.parentElement.removeChild(headerElement);

        var headerCells = this._headerTableBody.children;
        for (var i = 0; i < headerCells.length; ++i) {
            var element = headerCells[i].children[columnIndex];
            element.parentElement.removeChild(element);
        }

        var dataElement = this._dataTableColumnGroup.children[columnIndex];
        dataElement.parentElement.removeChild(dataElement);

        var dataCells = this._dataTableBody.children;
        for (var i = 0; i < dataCells.length; ++i) {
            var element = dataCells[i].children[columnIndex];
            element.parentElement.removeChild(element);
        }

        delete this.columns[columnIdentifier];
        this._columnsArray.splice(columnIndex, 1);

        --this._columnCount;
        this._headerTableColumnGroup.span = this._columnCount;
        this._dataTableColumnGroup.span = this._columnCount;

        if (!willReplace) {
            for (var i = columnIndex; i < this._columnsArray.length; ++i)
                --this._columnsArray[i].ordinal;
        }
    },

    changeColumn: function(oldIdentifier, newIdentifier, newColumn)
    {
        var oldColumn = this.columns[oldIdentifier];
        if (!oldColumn)
            return;

        var index = oldColumn.ordinal;

        this.removeColumn(oldIdentifier, true);
        this.addColumn(newIdentifier, newColumn, index);

        var frames = this._data.frames;
        for (var i = 0; i < this._data.frames.length; ++i)
            this._updateNodeForFrame(frames[i]);
    },

    // Private

    _setupProbe: function(event)
    {
        var probe = event.data;
        this.addColumn(probe.probeId, { title: probe.expression });

        var frames = this._data.frames;
        for (var i = 0; i < frames.length; ++i)
            this._updateNodeForFrame(frames[i]);
    },

    _teardownProbe: function(event)
    {
        var probe = event.data;
        this.removeColumn(probe.probeId);

        var frames = this._data.frames;
        for (var i = 0; i < frames.length; ++i)
            this._updateNodeForFrame(frames[i]);
    },

    _setupData: function()
    {
        this._data = this._probeGroup.dataTable;
        var frames = this._data.frames;
        for (var i = 0; i < frames.length; ++i)
            this._updateNodeForFrame(frames[i]);

        this._dataListeners = new WebInspector.EventListenerGroup(this, "Data table event listeners");
        this._dataListeners.register(this._data, WebInspector.ProbeGroupDataTable.Event.FrameInserted, this._dataFrameInserted);
        this._dataListeners.register(this._data, WebInspector.ProbeGroupDataTable.Event.FrameReplaced, this._dataFrameReplaced);
        this._dataListeners.register(this._data, WebInspector.ProbeGroupDataTable.Event.SeparatorInserted, this._dataSeparatorInserted);
        this._dataListeners.register(this._data, WebInspector.ProbeGroupDataTable.Event.SeparatorReplaced, this._dataSeparatorReplaced);
        this._dataListeners.register(this._data, WebInspector.ProbeGroupDataTable.Event.WillRemove, this._teardownData);
        this._dataListeners.install();
    },

    _teardownData: function()
    {
        this._dataListeners.uninstall(true);
        this.removeChildren();
        this._frameNodes = {};
        this._separators = {};
    },

    _updateNodeForFrame: function(frame)
    {
        console.assert(frame instanceof WebInspector.ProbeGroupDataFrame, "Tried to update probe group data grid with non-frame: ", frame);
        if (this._frameNodes[frame.key]) {
            this._frameNodes[frame.key].updateCellsFromFrame(frame, this._probeGroup);
            return;
        }

        var node = new WebInspector.ProbeGroupDataGridNode(frame, this._probeGroup);
        this._frameNodes[frame.key] = node;
        node.dataGrid = this;
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
    },

    _updateNodeForSeparator: function(frame)
    {
        console.assert(this._frameNodes.hasOwnProperty(frame.key), "Tried to add separator for unknown data frame: ", frame);
        this._frameNodes[frame.key].updateCellsForSeparator(frame, this._probeGroup);

        for (var index in this._frameNodes)
            this._frameNodes[index].element.classList.add(WebInspector.ProbeGroupDataGrid.FadedGridNodeStyleClassName);

    },

    _dataFrameInserted: function(event)
    {
        var frame = event.data;
        this._updateNodeForFrame(frame);
    },

    _dataFrameReplaced: function(event)
    {
        var frame = event.data;
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
    }
}
