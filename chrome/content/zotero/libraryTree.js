/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
					http://zotero.org
	
	This file is part of Zotero.
	
	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
	
	***** END LICENSE BLOCK *****
*/

const { TreeSelectionStub } = require('components/virtualized-table');
const React = require('react');

/**
 * Common methods for Zotero.ItemTree and Zotero.CollectionTree
 * @type {Zotero.LibraryTree}
 */
var LibraryTree = class LibraryTree extends React.Component {
	constructor(props) {
		super(props);
		this._rows = [];
		this._rowMap = {};

		this.domEl = props.domEl;
		this._ownerDocument = props.domEl.ownerDocument;
		
		this.onSelect = this.createEventBinding('select');
		this.onRefresh = this.createEventBinding('refresh');
	}
	
	get window() {
		return this._ownerDocument.defaultView;
	}
	
	get selection() {
		return this.tree ? this.tree.selection : TreeSelectionStub;
	}

	get rowCount() {
		return this._rows.length;
	}
	
	waitForSelect() {
		return this._waitForEvent('select');
	}

	componentDidCatch(error, info) {
		// Async operations might attempt to update the react components
		// after window close in tests, which will cause unnecessary crashing
		// so we set an unintialized flag that we check in select functions
		// like #notify
		if (this._uninitialized) return;
		Zotero.debug("ItemTree: React threw an error");
		Zotero.logError(error);
		Zotero.debug(info);
		if (this.type == 'item') Zotero.Prefs.clear('lastViewedFolder');
		Zotero.crash();
	}
	
	focus() {
		this.tree.focus();
		// If no rows selected, select first visible row
		if (!this.tree.selection.count) {
			this.tree.selection.select(
				// TODO: Return -1 when no rows, and skip selection here
				this.tree._jsWindow.getFirstVisibleRow()
			);
		}
	}

	getParentIndex = (index) => {
		var thisLevel = this.getLevel(index);
		if (thisLevel == 0) return -1;
		for (var i = index - 1; i >= 0; i--) {
			if (this.getLevel(i) < thisLevel) {
				return i;
			}
		}
		return -1;
	}

	getLevel(index) {
		return this._rows[index].level;
	}

	/**
	 * Return a reference to the tree row at a given row
	 *
	 * @return {TreeRow}
	 */
	getRow(index) {
		return this._rows[index];
	}

	/**
	 * Return the index of the row with a given ID (e.g., "C123" for collection 123)
	 *
	 * @param {String} - Row id
	 * @return {Integer|false}
	 */
	getRowIndexByID(id) {
		if (!(id in this._rowMap)) {
			Zotero.debug(`${this.name}: Trying to access a row with invalid ID ${id}`)
			return false;
		}
		return this._rowMap[id];
	}

	/**
	 * Add a tree row to the main array, update the row count, tell the treebox that the row
	 * count changed, and update the row map
	 *
	 * @param {TreeRow} treeRow
	 * @param {Number} [beforeRow] - Row index to insert new row before
	 */
	_addRow(treeRow, beforeRow, skipRowMapRefresh) {
		this._rows.splice(beforeRow, 0, treeRow);
		if (!skipRowMapRefresh) {
			// Increment all rows in map at or above insertion point
			for (let i in this._rowMap) {
				if (this._rowMap[i] >= beforeRow) {
					this._rowMap[i]++;
				}
			}
			// Add new row to map
			this._rowMap[treeRow.id] = beforeRow;
		}
	}

	_removeRows(rows) {
		rows = Zotero.Utilities.arrayUnique(rows);
		rows.sort((a, b) => a - b);
		for (let i = rows.length - 1; i >= 0; i--) {
			this._removeRow(rows[i], true);
		}
		this._refreshRowMap();
	}

	/**
	 * Remove a row from the main array and parent row children arrays,
	 * delete the row from the map, and optionally update all rows above it in the map
	 */
	_removeRow(index, skipMapUpdate, skipSelectionUpdate) {
		var id = this.getRow(index).id;
		let level = this.getLevel(index);

		// Maintain selection unless specified otherwise
		if (!skipSelectionUpdate && index <= this.selection.focused) {
			this.selection.select(this.selection.focused - 1);
		}

		this._rows.splice(index, 1);
		if (index != 0
			&& this.getLevel(index - 1) < level
			&& (!this._rows[index] || this.getLevel(index) != level)) {
			this._rows[index - 1].isOpen = false;
		}

		delete this._rowMap[id];
		if (!skipMapUpdate) {
			for (let i in this._rowMap) {
				if (this._rowMap[i] > index) {
					this._rowMap[i]--;
				}
			}
		}
	}

	_refreshRowMap() {
		var rowMap = {};
		for (var i = 0; i < this.rowCount; i++) {
			let row = this.getRow(i);
			let id = row.id;
			if (rowMap[id] !== undefined) {
				Zotero.debug(`WARNING: _refreshRowMap(): ${this.type} row ${rowMap[id]} already found for item ${id} at ${i}`, 2);
				Zotero.debug(new Error().stack, 2);
			}
			rowMap[id] = i;
		}
		this._rowMap = rowMap;
	}

	_onSelectionChange = async () => {
		if (!this._uninitialized && this.props.onSelectionChange) {
			try {
				await Zotero.Promise.resolve(this.props.onSelectionChange(this.selection));
			} catch (e) {}
			this.runListeners('select');
		}
	}
	
	_onSelectionChangeDebounced = Zotero.Utilities.debounce(this._onSelectionChange, 100)

	handleTwistyMouseUp = (event, index) => {
		this.toggleOpenState(index);
		event.stopPropagation();
		this.tree.focus();
	}
	
	// The caller has to ensure the tree is redrawn
	ensureRowIsVisible(index) {
		this.tree && this.tree.scrollToRow(index);
	}

	_updateHeight = () => {
		this.forceUpdate(() => {
			if (this.tree) {
				this.tree.rerender();
			}
		});
	}

	updateHeight = Zotero.Utilities.debounce(this._updateHeight, 200);

	updateFontSize() {
		this.tree.updateFontSize();
	}

	setDropEffect(event, effect) {
		// On Windows (in Fx26), Firefox uses 'move' for unmodified drags
		// and 'copy'/'link' for drags with system-default modifier keys
		// as long as the actions are allowed by the initial effectAllowed set
		// in onDragStart, regardless of the effectAllowed or dropEffect set
		// in onDragOver. It doesn't seem to be possible to use 'copy' for
		// the default and 'move' for modified, as we need to in the collections
		// tree. To prevent inaccurate cursor feedback, we set effectAllowed to
		// 'copy' in onDragStart, which locks the cursor at 'copy'. ('none' still
		// changes the cursor, but 'move'/'link' do not.) It'd be better to use
		// the unadorned 'move', but we use 'copy' instead because with 'move' text
		// can't be dragged to some external programs (e.g., Chrome, Notepad++),
		// which seems worse than always showing 'copy' feedback.
		//
		// However, since effectAllowed is enforced, leaving it at 'copy'
		// would prevent our modified 'move' in the collections tree from working,
		// so we also have to set effectAllowed here (called from onDragOver) to
		// the same action as the dropEffect. This allows the dropEffect setting
		// (which we use in the tree's canDrop() and drop() to determine the desired
		// action) to be changed, even if the cursor doesn't reflect the new setting.
		if (Zotero.isWin || Zotero.isLinux) {
			event.dataTransfer.effectAllowed = effect;
		}
		event.dataTransfer.dropEffect = effect;
	}
};

Zotero.Utilities.Internal.makeClassEventDispatcher(LibraryTree);

module.exports = LibraryTree;

