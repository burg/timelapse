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

WebInspector.ProbesDataGrid = function(columns, editCallback, deleteCallback)
{
    WebInspector.DataGrid.call(this, columns, editCallback, deleteCallback);

    /*this.filterableColumns = [];

    // Check if any of the cells can be filtered.
    for (var identifier in columns) {
        var scopeBar = columns[identifier].scopeBar;
        if (!scopeBar)
            continue;
        this.filterableColumns.push(identifier);
        scopeBar.columnIdenfifier = identifier;
        scopeBar.addEventListener(WebInspector.ScopeBar.Event.SelectionChanged, this._scopeBarSelectedItemsDidChange, this);
    }

    if (this.filterableColumns.length > 1) {
        console.error("Creating a ProbesDataGrid with more than one filterable column is not yet supported.");
        return;
    }

    var items = [new WebInspector.FlexibleSpaceNavigationItem, this.columns[this.filterableColumns[0]].scopeBar];
    this._navigationBar = new WebInspector.NavigationBar(null, items);
    var container = this.element.appendChild(document.createElement("div"));
    container.className = "navigation-bar-container";
    container.appendChild(this._navigationBar.element);

    this.addEventListener(WebInspector.DataGrid.Event.SelectedNodeChanged, this._dataGridSelectedNodeChanged, this);
    window.addEventListener("resize", this._windowResized.bind(this));*/
}

WebInspector.ProbesDataGrid.prototype = {
    constructor: WebInspector.ProbesDataGrid,

    // Public

    addColumn: function(columnIdentifier, column)
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

        this.headerTableBody.firstChild.appendChild(cell); // headerRow

        ++this._columnCount;

    	this._headerTableColumnGroup.span = this._columnCount;
    	this._headerTableColumnGroup.appendChild(col);

    	if (this.dataTableBody.childNodes) {
    		for (var i = 0; i < this.dataTableBody.childNodes.length - 1; ++i) {
    			var data = new Object();
    			data[columnIdentifier] = "?";
    			var node = new WebInspector.ProbesDataGridNode(data);
    			node.dataGrid = this;
    			this.dataTableBody.childNodes[i].appendChild(node.createCell(columnIdentifier));
    		}
    	}

    	var td = document.createElement("td");
    	td.className = columnIdentifier + "-column";
    	var group = column.group;
    	if (group)
    	    td.classList.add("column-group-" + group);
    	this.dataTableBody.lastChild.appendChild(td); // fillerRow

    	this._dataTableColumnGroup.span = this._columnCount;
    	this._dataTableColumnGroup.appendChild(col);

    	this.columns[columnIdentifier] = column;
    	this.columns[columnIdentifier].ordinal = this._columnsArray.length;
    	this.columns[columnIdentifier].identifier = columnIdentifier;
    	this._columnsArray.push(column);

   	    this._columnsArray.lastValue.bodyElement = this._dataTableColumnGroup.lastChild;
    },

    removeColumn: function(columnIdentifier)
    {
    	var column = this.columns[columnIdentifier];
    	var columnIndex = column.ordinal;

    	//console.log(this._headerTableColumnGroup.childNodes);

    	//this._headerTableColumnGroup.removeChild(column.bodyElement);
    	//this._dataTableColumnGroup.removeChild(column.bodyElement);

    	delete this.columns[columnIdentifier];
    	this._columnsArray.splice(columnIndex, columnIndex);

    	--this._columnCount;
    	this._headerTableColumnGroup.span = this._columnCount;
    	this._dataTableColumnGroup.span = this._columnCount;
    }

    /*get currentCalculator()
    {
        // Implemented by subclasses if they have a graph.
        return null;
    },

    updateCalculatorBoundariesWithRecord: function(record)
    {
        // Implemented by subclasses if they have a graph.
    },

    updateCalculatorBoundariesWithDataGridNode: function(node)
    {
        // Implemented by subclasses if they have a graph.
    },

    updateCalculatorBoundariesWithEventMarker: function(eventMarker)
    {
        // Implemented by subclasses if they have a graph.
    },

    reset: function()
    {
        // May be overridden by subclasses. If so, they should call the superclass.

        this._hidePopover();
    },

    shown: function()
    {
        // Implemented by subclasses.
    },

    hidden: function()
    {
        // May be overridden by subclasses. If so, they should call the superclass.

        this._hidePopover();
    },

    update: function()
    {
        // Implemented by subclasses.
    },


    updateLayout: function()
    {
        WebInspector.DataGrid.prototype.updateLayout.call(this);

        this._navigationBar.updateLayout();
    },

    // Private

    _scopeBarSelectedItemsDidChange: function(event)
    {
        var columnIdentifier = event.target.columnIdenfifier;
        this.dispatchEventToListeners(WebInspector.ProbesDataGrid.Event.FiltersDidChange, {columnIdentifier: columnIdentifier});
    },

    _dataGridSelectedNodeChanged: function(event)
    {
        if (!this.selectedNode) {
            this._hidePopover();
            return;
        }

        var record = this.selectedNode.record;
        if (!record || !record.callFrames || !record.callFrames.length) {
            this._hidePopover();
            return;
        }

        this._showPopoverForSelectedNodeSoon();
    },

    _windowResized: function(event)
    {
        if (this._popover && this._popover.visible)
            this._updatePopoverForSelectedNode(false);
    }*/
}

WebInspector.ProbesDataGrid.prototype.__proto__ = WebInspector.DataGrid.prototype;
