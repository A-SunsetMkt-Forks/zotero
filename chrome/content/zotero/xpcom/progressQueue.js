/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2018 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
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

Zotero.ProgressQueue = function (options) {
	let _id = options.id;
	let _title = options.title;
	let _columns = options.columns;
	
	let _listeners = {
		empty: [],
		cancel: [],
		rowadded: [],
		nonempty: [],
		rowupdated: [],
		rowdeleted: [],
	};
	let _rows = [];
	
	let _dialog = null;
	
	let _progressQueue = this;
	
	/**
	 * @return {Zotero.ProgressQueueDialog}
	 */
	this.getDialog = function () {
		if(!_dialog) {
			_dialog = new Zotero.ProgressQueueDialog(_progressQueue);
		}
		return _dialog;
	};
	
	/**
	 * @return {Number}
	 */
	this.getID = function () {
		return _id;
	};
	
	
	/**
	 * @return {String}
	 */
	this.getTitle = function () {
		return _title;
	};
	
	
	/**
	 * @return {String[]}
	 */
	this.getColumns = function () {
		return _columns;
	};
	
	
	/**
	 * Add listener
	 * @param {String} name Event name
	 * @param callback
	 */
	this.addListener = function (name, callback) {
		if (!(name in _listeners)) {
			throw new Error(`Invalid event listener "${name}"`);
		}
		_listeners[name].push(callback);
	};
	
	
	/**
	 * Remove listener
	 * @param {String} name Event name
	 */
	this.removeListener = function (name, callback) {
		if (!(name in _listeners)) {
			throw new Error(`Invalid event listener "${name}"`);
		}
		if (!callback) {
			Zotero.debug(`Calling "removeListener" without specifying which callback to remove is deprecated`);
			_listeners[name] = []; // remove all callbacks to simulate previous behaviour
		}
		else {
			_listeners[name] = _listeners[name].filter(existingCallback => existingCallback !== callback);
		}
	};
	
	
	/**
	 * Returns all rows
	 * @return {Object[]}
	 */
	this.getRows = function () {
		return _rows;
	};
	
	
	/**
	 * Returns rows count
	 * @return {Number}
	 */
	this.getTotal = function () {
		return _rows.length;
	};
	
	
	/**
	 * Returns processed rows count
	 * @return {Number}
	 */
	this.getProcessedTotal = function () {
		return _rows.filter(row => row.status > Zotero.ProgressQueue.ROW_PROCESSING).length;
	};
	
	
	/**
	 * Stop processing items
	 */
	this.cancel = function () {
		_rows = [];
		_listeners.empty.forEach(listener => listener());
		_listeners.cancel.forEach(listener => listener());
	};
	
	
	/**
	 * Add item for processing
	 * @param {Zotero.Item} item
	 */
	this.addRow = function (item) {
		this.deleteRow(item.id);
		
		let row = {
			id: item.id,
			status: Zotero.ProgressQueue.ROW_QUEUED,
			fileName: item.getDisplayTitle(),
			message: ''
		};
		
		_rows.push(row);
		
		_listeners.rowadded.forEach(listener => listener(row));
		_listeners.nonempty.forEach(listener => listener());
	};
	
	
	/**
	 * Update row status and message
	 * @param {Number} itemID
	 * @param {Number} status
	 * @param {String} message
	 */
	this.updateRow = function (itemID, status, message) {
		Zotero.debug(`ProgressQueue: updating row ${itemID}, ${status}, ${message}`);
		for (let row of _rows) {
			if (row.id === itemID) {
				row.status = status;
				row.message = message;
				_listeners.rowupdated.forEach(listener => listener({
					id: row.id,
					status,
					message: message || ''
				}));
				return;
			}
		}
	};
	
	
	/**
	 * Delete row
	 * @param {Number} itemID
	 */
	this.deleteRow = function (itemID) {
		let row = _rows.find(x => x.id === itemID);
		if (row) {
			_rows.splice(_rows.indexOf(row), 1);
			_listeners.rowdeleted.forEach(listener => listener({
				id: row.id
			}));
		}
	};
};


Zotero.ProgressQueue.ROW_QUEUED = 1;
Zotero.ProgressQueue.ROW_PROCESSING = 2;
Zotero.ProgressQueue.ROW_FAILED = 3;
Zotero.ProgressQueue.ROW_SUCCEEDED = 4;


Zotero.ProgressQueues = new function () {
	let _queues = [];
	
	/**
	 * @param {Object} options
	 * @return {Zotero.ProgressQueue}
	 */
	this.create = function (options) {
		let queue = new Zotero.ProgressQueue(options);
		_queues.push(queue);
		return queue;
	};
	
	/**
	 * @param {Number} id
	 * @return {Zotero.ProgressQueue}
	 */
	this.get = function (id) {
		return _queues.find(queue => queue.getID() === id);
	};
	
	/**
	 * @return {Zotero.ProgressQueue[]}
	 */
	this.getAll = function () {
		return _queues;
	};
};
