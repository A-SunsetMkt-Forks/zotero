/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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


/*
 * Same structure as Zotero.Creators -- make changes in both places if possible
 */
Zotero.Tags = new function () {
	this.MAX_COLORED_TAGS = 9;
	this.MAX_SYNC_LENGTH = 255;
	
	var _initialized = false;
	var _tagsByID = new Map();
	var _idsByTag = new Map();
	var _libraryColors = {};
	var _libraryColorsByName = {};
	var _itemsListImagePromises = {};
	
	
	this.init = async function () {
		await Zotero.DB.queryAsync(
			"SELECT tagID, name FROM tags",
			false,
			{
				onRow: function (row) {
					var tagID = row.getResultByIndex(0);
					var name = row.getResultByIndex(1);
					_tagsByID.set(tagID, name);
					_idsByTag.set(name, tagID);
				}
			}
		);
		_initialized = true;
	};
	
	
	/**
	 * Returns a tag for a given tagID
	 *
	 * @param {Integer} tagID
	 * @return {Promise<String|false>} - A tag name, or false if tag with id not found
	 */
	this.getName = function (tagID) {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Tags not yet loaded");
		}
		
		var name = _tagsByID.get(tagID);
		return name !== undefined ? name : false;
	};
	
	
	/**
	 * Returns the tagID matching given fields, or false if none
	 *
	 * @param {String} name - Tag name
	 * @return {Integer} tagID
	 */
	this.getID = function (name) {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Tags not yet loaded");
		}
		if (arguments.length > 1) {
			throw new Error("Zotero.Tags.getID() no longer takes a second parameter -- use Zotero.Tags.create()");
		}
		
		data = this.cleanData({
			tag: name
		});
		var id = _idsByTag.get(data.tag);
		return id !== undefined ? id : false;
	};
	
	
	/**
	 * Returns the tagID matching given fields, or creates one and returns its id
	 *
	 * Requires a wrapping transaction
	 *
	 * @param {String} name - Tag name
	 * @return {Promise<Integer>} tagID
	 */
	this.create = async function (name) {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Tags not yet loaded");
		}
		
		Zotero.DB.requireTransaction();
		data = this.cleanData({
			tag: name
		});
		var id = this.getID(data.tag);
		if (!id) {
			id = Zotero.ID.get('tags');
			let sql = "INSERT INTO tags (tagID, name) VALUES (?, ?)";
			await Zotero.DB.queryAsync(sql, [id, data.tag]);
			_tagsByID.set(id, data.tag);
			_idsByTag.set(data.tag, id);
		}
		return id;
	};
	
	
	this.getLongTagsInLibrary = async function (libraryID) {
		var sql = "SELECT DISTINCT tagID FROM tags "
			+ "JOIN itemTags USING (tagID) "
			+ "JOIN items USING (itemID) "
			+ "WHERE libraryID=? AND LENGTH(name)>?"
		return await Zotero.DB.columnQueryAsync(sql, [libraryID, this.MAX_SYNC_LENGTH]);
	};
	
	
	/**
	 * Get all tags in library
	 *
	 * @param {Number} libraryID
	 * @param {Number[]} [types] - Tag types to fetch
	 * @return {Promise<Array>}   A promise for an array containing tag objects in API JSON format
	 *                            [{ { tag: "foo" }, { tag: "bar", type: 1 }]
	 */
	this.getAll = async function (libraryID, types) {
		return this.getAllWithin({ libraryID, types });
	};
	
	
	/**
	 * Get all tags within the items of a temporary table of search results
	 *
	 * @param {Object}
	 * @param {Object.Number} libraryID
	 * @param {Object.String} tmpTable - Temporary table with items to use
	 * @param {Object.Number[]} [types] - Array of tag types to fetch
	 * @param {Object.Number[]} [tagIDs] - Array of tagIDs to limit the result to
	 * @return {Promise<Array[]>} - Promise for an array of tag objects in API JSON format
	 */
	this.getAllWithin = async function ({ libraryID, tmpTable, types, tagIDs }) {
		// mozStorage/Proxy are slow, so get in a single column
		var sql = "SELECT DISTINCT tagID || ':' || type FROM itemTags "
			+ "JOIN tags USING (tagID) ";
		var params = [];
		if (libraryID) {
			sql += "JOIN items USING (itemID) WHERE libraryID = ? ";
			params.push(libraryID);
		}
		else {
			sql += "WHERE 1 ";
		}
		if (tmpTable) {
			if (libraryID) {
				throw new Error("tmpTable and libraryID are mutually exclusive");
			}
			sql += "AND itemID IN (SELECT itemID FROM " + tmpTable;
			// TEMP: Match parent attachments for annotation tags
			sql += " UNION SELECT itemID FROM itemAnnotations WHERE parentItemID IN "
				+ "(SELECT itemID FROM " + tmpTable + ")";
			sql += ") ";
		}
		if (types && types.length) {
			sql += "AND type IN (" + new Array(types.length).fill('?').join(', ') + ") ";
			params.push(...types);
		}
		if (tagIDs) {
			sql += "AND tagID IN (" + tagIDs.map(x => parseInt(x)).join(', ') + ") ";
		}
		// Not a perfect locale sort, but speeds up the sort in the tag selector later without any
		// discernible performance cost
		sql += "ORDER BY name COLLATE NOCASE";
		var rows = await Zotero.DB.columnQueryAsync(sql, params, { noCache: !!tmpTable || !!tagIDs });
		return rows.map((row) => {
			var [tagID, type] = row.split(':');
			return this.cleanData({
				tag: Zotero.Tags.getName(parseInt(tagID)),
				type: type
			});
		});
	};
	
	
	/**
	 * Get the items associated with the given tag
	 *
	 * @param  {Number}             tagID
	 * @return {Promise<Number[]>}  A promise for an array of itemIDs
	 */
	this.getTagItems = function (libraryID, tagID) {
		var sql = "SELECT itemID FROM itemTags JOIN items USING (itemID) "
			+ "WHERE tagID=? AND libraryID=?";
		return Zotero.DB.columnQueryAsync(sql, [tagID, libraryID]);
	}
	
	
	this.search = async function (str) {
		var sql = 'SELECT name AS tag, type FROM tags';
		if (str) {
			sql += ' WHERE name LIKE ?';
		}
		var rows = await Zotero.DB.queryAsync(sql, str ? '%' + str + '%' : undefined);
		return rows.map((row) => this.cleanData(row));
	};


	/**
	 * Convert tags (a single tag or an array) in API JSON format to API response JSON format.
	 *
	 * @param {Number} libraryID
	 * @param {Object[]} tags
	 * @param {Object} [options]
	 * @return {Promise<Object[]>}
	 */
	this.toResponseJSON = function (libraryID, tags, options = {}) {
		return Promise.all(tags.map(async (tag) => {
			tag = { ...this.cleanData(tag), type: tag.type };
			let numItems;
			if (tag.type == 0 || tag.type == 1) {
				let sql = "SELECT COUNT(itemID) "
					+ "FROM tags JOIN itemTags USING (tagID) JOIN items USING (itemID) "
					+ `WHERE tagID = ? AND type = ? AND libraryID = ?`;
				numItems = await Zotero.DB.valueQueryAsync(sql, [this.getID(tag.tag), tag.type, libraryID]);
			}
			else {
				let sql = "SELECT COUNT(itemID) "
					+ "FROM tags JOIN itemTags USING (tagID) JOIN items USING (itemID) "
					+ `WHERE tagID = ? AND libraryID = ?`;
				numItems = await Zotero.DB.valueQueryAsync(sql, [this.getID(tag.tag), libraryID]);
			}
			let uri = Zotero.URI.getTagURI(libraryID, tag.tag);
			return {
				tag: tag.tag,
				links: {
					self: {
						href: Zotero.URI.toAPIURL(uri),
						type: 'application/json'
					},
					alternate: Zotero.Users.getCurrentUserID() ? {
						href: uri, // No toWebURL - match dataserver behavior
						type: 'text/html'
					} : undefined
				},
				meta: {
					type: tag.type || 0,
					numItems
				}
			};
		}));
	};
	
	
	/**
	 * Rename a tag and update the tag colors setting accordingly if necessary
	 *
	 * @param {Number} tagID
	 * @param {String} newName
	 * @return {Promise}
	 */
	this.rename = async function (libraryID, oldName, newName) {
		Zotero.debug("Renaming tag '" + oldName + "' to '" + newName + "' in library " + libraryID);
		
		oldName = oldName.trim();
		newName = newName.trim();
		
		if (oldName == newName) {
			Zotero.debug("Tag name hasn't changed", 2);
			return;
		}
		
		var oldTagID = this.getID(oldName);
		if (!oldTagID) {
			throw new Error(`Tag '${oldName}' not found`);
		}
		
		// We need to know if the old tag has a color assigned so that
		// we can assign it to the new name
		var oldColorData = this.getColor(libraryID, oldName);
		
		await Zotero.DB.executeTransaction(async function () {
			var oldItemIDs = await this.getTagItems(libraryID, oldTagID);
			var newTagID = await this.create(newName);
			
			await Zotero.Utilities.Internal.forEachChunkAsync(
				oldItemIDs,
				Zotero.DB.MAX_BOUND_PARAMETERS - 2,
				async function (chunk) {
					let placeholders = chunk.map(() => '?').join(',');
					
					// This is ugly, but it's much faster than doing replaceTag() for each item
					let sql = 'UPDATE OR REPLACE itemTags SET tagID=?, type=0 '
						+ 'WHERE tagID=? AND itemID IN (' + placeholders + ')';
					await Zotero.DB.queryAsync(
						sql, [newTagID, oldTagID].concat(chunk), { noCache: true }
					);
					
					sql = 'UPDATE items SET synced=0, clientDateModified=? '
						+ 'WHERE itemID IN (' + placeholders + ')'
					await Zotero.DB.queryAsync(
						sql, [Zotero.DB.transactionDateTime].concat(chunk), { noCache: true }
					);
					
					await Zotero.Items.reload(oldItemIDs, ['primaryData', 'tags'], true);
				}
			);
			
			var notifierData = {};
			for (let i = 0; i < oldItemIDs.length; i++) {
				notifierData[oldItemIDs[i] + '-' + newTagID] = {
					tag: newName,
					old: {
						tag: oldName
					}
				}
			};
			
			Zotero.Notifier.queue(
				'modify',
				'item-tag',
				oldItemIDs.map(itemID => itemID + '-' + newTagID),
				notifierData
			);
			
			await this.purge(oldTagID);
		}.bind(this));
		
		if (oldColorData) {
			await Zotero.DB.executeTransaction(async function () {
				// Remove color from old tag
				await this.setColor(libraryID, oldName);
				
				// Add color to new tag
				await this.setColor(
					libraryID,
					newName,
					oldColorData.color,
					oldColorData.position
				);
			}.bind(this));
		}
	};
	
	
	/**
	 * @param {Integer} libraryID
	 * @param {Integer[]} tagIDs
	 * @param {Function} [onProgress]
	 * @param {Integer[]} [types]
	 * @return {Promise}
	 */
	this.removeFromLibrary = async function (libraryID, tagIDs, onProgress, types) {
		var d = new Date();
		
		if (!Array.isArray(tagIDs)) {
			tagIDs = [tagIDs];
		}
		if (types && !Array.isArray(types)) {
			types = [types];
		}
		
		var colors = this.getColors(libraryID);
		var done = 0;
		
		await Zotero.Utilities.Internal.forEachChunkAsync(
			tagIDs,
			100,
			async function (chunk) {
				await Zotero.DB.executeTransaction(async function () {
					var rowIDs = [];
					var itemIDs = [];
					var uniqueTags = new Set();
					var notifierIDs = [];
					var notifierData = {};
					
					var sql = 'SELECT IT.ROWID AS rowID, tagID, itemID, type FROM itemTags IT '
						+ 'JOIN items USING (itemID) '
						+ 'WHERE libraryID=? AND tagID IN ('
						+ Array(chunk.length).fill('?').join(', ')
						+ ') ';
					if (types) {
						sql += 'AND type IN (' + types.join(', ') + ') ';
					}
					sql += 'ORDER BY tagID, type';
					var rows = await Zotero.DB.queryAsync(sql, [libraryID, ...chunk]);
					for (let { rowID, tagID, itemID, type } of rows) {
						uniqueTags.add(tagID);
						
						let name = this.getName(tagID);
						if (name === false) {
							continue;
						}
						
						rowIDs.push(rowID);
						itemIDs.push(itemID);
						
						let ids = itemID + '-' + tagID;
						notifierIDs.push(ids);
						notifierData[ids] = {
							libraryID: libraryID,
							tag: name,
							type
						};
						
						// If we're deleting the tag and not just a specific type, also clear any
						// tag color
						if (colors.has(name) && !types) {
							await this.setColor(libraryID, name, false);
						}
					}
					if (itemIDs.length) {
						Zotero.Notifier.queue('remove', 'item-tag', notifierIDs, notifierData);
					}
					
					sql = "DELETE FROM itemTags WHERE ROWID IN (" + rowIDs.join(", ") + ")";
					await Zotero.DB.queryAsync(sql, false, { noCache: true });
					
					await this.purge(chunk);
					
					// Update internal timestamps on all items that had these tags
					await Zotero.Utilities.Internal.forEachChunkAsync(
						Zotero.Utilities.arrayUnique(itemIDs),
						Zotero.DB.MAX_BOUND_PARAMETERS - 1,
						async function (chunk) {
							var sql = 'UPDATE items SET synced=0, clientDateModified=? '
								+ 'WHERE itemID IN (' + Array(chunk.length).fill('?').join(',') + ')';
							await Zotero.DB.queryAsync(
								sql, [Zotero.DB.transactionDateTime].concat(chunk), { noCache: true }
							);
							
							await Zotero.Items.reload(itemIDs, ['primaryData', 'tags'], true);
						}
					);
					
					if (onProgress) {
						done += uniqueTags.size;
						onProgress(done, tagIDs.length);
					}
				}.bind(this));
			}.bind(this)
		);
		
		Zotero.debug(`Removed ${tagIDs.length} ${Zotero.Utilities.pluralize(tagIDs.length, 'tag')} `
			+ `in ${new Date() - d} ms`);
	};
	
	
	/**
	 * @param {Integer} libraryID
	 * @return {Integer[]} - An array of tagIDs
	 */
	this.getAutomaticInLibrary = function (libraryID) {
		var sql = "SELECT DISTINCT tagID FROM itemTags JOIN items USING (itemID) "
			+ "WHERE type=1 AND libraryID=?"
		return Zotero.DB.columnQueryAsync(sql, libraryID);
	};
	
	
	/**
	 * Remove all automatic tags in the given library
	 */
	this.removeAutomaticFromLibrary = async function (libraryID, onProgress) {
		var tagType = 1;
		var tagIDs = await this.getAutomaticInLibrary(libraryID);
		if (onProgress) {
			onProgress(0, tagIDs.length);
		}
		return this.removeFromLibrary(libraryID, tagIDs, onProgress, tagType);
	};
	
	
	/**
	 * Delete obsolete tags from database
	 *
	 * @param {Number|Number[]} [tagIDs] - tagID or array of tagIDs to purge
	 * @return {Promise}
	 */
	this.purge = async function (tagIDs) {
		var d = new Date();
		
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Tags not yet loaded");
		}
		
		if (!tagIDs && !Zotero.Prefs.get('purge.tags')) {
			return;
		}
		
		if (tagIDs) {
			tagIDs = Zotero.flattenArguments(tagIDs);
		}
		
		if (tagIDs && !tagIDs.length) {
			return;
		}
		
		Zotero.DB.requireTransaction();
		
		var sql;
		
		// Use given tags, as long as they're orphaned
		if (tagIDs) {
			sql = "CREATE TEMPORARY TABLE tagDelete (tagID INT PRIMARY KEY)";
			await Zotero.DB.queryAsync(sql);
			await Zotero.Utilities.Internal.forEachChunkAsync(
				tagIDs,
				Zotero.DB.MAX_BOUND_PARAMETERS,
				function (chunk) {
					return Zotero.DB.queryAsync(
						"INSERT OR IGNORE INTO tagDelete VALUES "
							+ Array(chunk.length).fill('(?)').join(', '),
						chunk,
						{
							noCache: true
						}
					);
				}
			);
			
			// Skip tags that are still linked to items
			sql = "DELETE FROM tagDelete WHERE tagID IN (SELECT tagID FROM itemTags)";
			await Zotero.DB.queryAsync(sql);
			
			sql = "SELECT tagID AS id, name FROM tagDelete JOIN tags USING (tagID)";
			var toDelete = await Zotero.DB.queryAsync(sql);
		}
		// Look for orphaned tags
		else {
			sql = "CREATE TEMPORARY TABLE tagDelete AS "
				+ "SELECT tagID FROM tags WHERE tagID NOT IN (SELECT tagID FROM itemTags)";
			await Zotero.DB.queryAsync(sql);
			
			sql = "CREATE INDEX tagDelete_tagID ON tagDelete(tagID)";
			await Zotero.DB.queryAsync(sql);
			
			sql = "SELECT tagID AS id, name FROM tagDelete JOIN tags USING (tagID)";
			var toDelete = await Zotero.DB.queryAsync(sql);
		}
		
		if (!toDelete.length) {
			return Zotero.DB.queryAsync("DROP TABLE tagDelete");
		}
		
		var ids = [];
		notifierData = {};
		for (let i=0; i<toDelete.length; i++) {
			let row = toDelete[i];
			
			Zotero.DB.addCurrentCallback('commit', () => {
				_tagsByID.delete(row.id);
				_idsByTag.delete(row.name);
			});
			
			ids.push(row.id);
			notifierData[row.id] = {
				old: {
					tag: row.name
				}
			};
		}
		
		sql = "DELETE FROM tags WHERE tagID IN (SELECT tagID FROM tagDelete);";
		await Zotero.DB.queryAsync(sql);
		
		sql = "DROP TABLE tagDelete";
		await Zotero.DB.queryAsync(sql);
		
		Zotero.Notifier.queue('delete', 'tag', ids, notifierData);
		
		Zotero.Prefs.set('purge.tags', false);
		
		Zotero.debug(`Purged ${toDelete.length} ${Zotero.Utilities.pluralize(toDelete.length, 'tag')} `
			+ `in ${new Date() - d} ms`);
	};
	
	
	//
	// Tag color methods
	//
	/**
	 *
	 * @param {Integer} libraryID
	 * @param {String} name Tag name
	 * @return {Object|false} An object containing 'color' as a hex string (e.g., '#990000') and
	 *     'position', or false if no colored tag with that name
	 */
	this.getColor = function (libraryID, name) {
		// Cache colors
		this.getColors(libraryID);
		return _libraryColorsByName[libraryID].get(name) || false;
	}
	
	
	/**
	 * Get color data by position (number key - 1)
	 *
	 * @param {Integer} libraryID
	 * @param {Integer} position The position of the tag, starting at 0
	 * @return {Object|false} An object containing 'name' and 'color', or false if no color at
	 *     the given position
	 */
	this.getColorByPosition = function (libraryID, position) {
		this.getColors(libraryID);
		return _libraryColors[libraryID][position] ? _libraryColors[libraryID][position] : false;
	}
	
	
	/**
	 * Get colored tags within a given library
	 *
	 * @param {Integer} libraryID
	 * @return {Map} - A Map with tag names as keys and objects containing 'color' and 'position'
	 *     as values
	 */
	this.getColors = function (libraryID) {
		if (!libraryID) {
			throw new Error("libraryID not provided");
		}
		
		if (_libraryColorsByName[libraryID]) {
			return _libraryColorsByName[libraryID];
		}
		
		var tagColors = Zotero.SyncedSettings.get(libraryID, 'tagColors') || [];
		// Normalize tags from DB, which might not have been normalized properly previously
		tagColors.forEach(x => x.name = x.name.normalize());
		_libraryColors[libraryID] = tagColors;
		_libraryColorsByName[libraryID] = new Map;
		
		// Also create object keyed by name for quick checking for individual tag colors
		for (let i=0; i<tagColors.length; i++) {
			_libraryColorsByName[libraryID].set(tagColors[i].name, {
				color: tagColors[i].color,
				position: i
			});
		}
		
		return _libraryColorsByName[libraryID];
	};
	
	
	/**
	 * Assign a color to a tag
	 *
	 * @return {Promise}
	 */
	this.setColor = async function (libraryID, name, color, position) {
		if (!Number.isInteger(libraryID)) {
			throw new Error("libraryID must be an integer");
		}
		
		this.getColors(libraryID);
		var tagColors = _libraryColors[libraryID];
		
		name = name.trim().normalize();
		
		// Unset
		if (!color) {
			// Trying to clear color on tag that doesn't have one
			if (!_libraryColorsByName[libraryID].has(name)) {
				return;
			}
			
			_libraryColors[libraryID] = tagColors = tagColors.filter(val => val.name != name);
			_libraryColorsByName[libraryID].delete(name);
		}
		else {
			// Get current position if present
			var currentPosition = -1;
			for (let i=0; i<tagColors.length; i++) {
				if (tagColors[i].name == name) {
					currentPosition = i;
					break;
				}
			}
			
			// Remove if present
			if (currentPosition != -1) {
				// If no position was specified, we'll reinsert into the same place
				if (typeof position == 'undefined') {
					position = currentPosition;
				}
				tagColors.splice(currentPosition, 1);
			}
			var newObj = {
				name: name,
				color: color
			};
			// If no position or after end, add at end
			if (typeof position == 'undefined' || position >= tagColors.length) {
				tagColors.push(newObj);
			}
			// Otherwise insert into new position
			else {
				tagColors.splice(position, 0, newObj);
			}
			_libraryColorsByName[libraryID].set(name, {
				color: color,
				position: position
			});
		}
		
		if (tagColors.length) {
			return Zotero.SyncedSettings.set(libraryID, 'tagColors', tagColors);
		}
		else {
			return Zotero.SyncedSettings.clear(libraryID, 'tagColors');
		}
	};
	
	
	/**
	 * Update caches and trigger redrawing of items in the items list
	 * when a 'tagColors' setting is modified
	 */
	this.notify = async function (event, type, ids, extraData) {
		if (type != 'setting') {
			return;
		}
		
		for (let i=0; i<ids.length; i++) {
			let libraryID, setting;
			[libraryID, setting] = ids[i].split("/");
			libraryID = parseInt(libraryID);
			
			if (setting != 'tagColors') {
				continue;
			}
			
			delete _libraryColors[libraryID];
			delete _libraryColorsByName[libraryID];
			
			// Get the tag colors for each library in which they were modified
			let tagColors = Zotero.SyncedSettings.get(libraryID, 'tagColors');
			if (!tagColors) {
				tagColors = [];
			}
			
			let id = libraryID + "/" + setting;
			if ((event == 'modify' || event == 'delete') && extraData[id].changed) {
				var previousTagColors = extraData[id].changed.value;
			}
			else {
				var previousTagColors = [];
			}
			
			var affectedItems = [];
			
			// Get all items linked to previous or current tag colors
			var tagNames = tagColors.concat(previousTagColors).map(val => val.name);
			tagNames = Zotero.Utilities.arrayUnique(tagNames);
			if (tagNames.length) {
				for (let i=0; i<tagNames.length; i++) {
					let tagID = this.getID(tagNames[i]);
					// Colored tags may not exist
					if (tagID) {
						affectedItems = affectedItems.concat(
							await this.getTagItems(libraryID, tagID)
						);
					}
				};
			}
			
			if (affectedItems.length) {
				await Zotero.Notifier.trigger('redraw', 'item', affectedItems, { column: 'title' });
			}
		}
	};
	
	
	this.toggleItemsListTags = async function (items, tagName) {
		if (!items.length) {
			return;
		}
		
		// Color setting can exist without tag. If missing, we have to add the tag.
		var tagID = this.getID(tagName);
		
		return Zotero.DB.executeTransaction(async function () {
			// If all items already have the tag, remove it from all items
			if (tagID && items.every(x => x.hasTag(tagName))) {
				for (let item of items) {
					if (item.removeTag(tagName)) {
						await item.save();
					}
				}
				Zotero.Prefs.set('purge.tags', true);
			}
			// Otherwise add to all items
			else {
				for (let item of items) {
					if (item.addTag(tagName)) {
						await item.save();
					}
				}
			}
		}.bind(this));
	};
	
	
	/**
	 * @param {Zotero.Item[]}
	 * @return {Promise}
	 */
	this.removeColoredTagsFromItems = async function (items) {
		return Zotero.DB.executeTransaction(async function () {
			for (let item of items) {
				let colors = this.getColors(item.libraryID);
				let tags = item.getTags();
				let changed = false;
				for (let tag of tags) {
					if (colors.has(tag.tag)) {
						item.removeTag(tag.tag);
						changed = true;
					}
				}
				if (changed) {
					await item.save({
						skipDateModifiedUpdate: true
					});
				}
			}
		}.bind(this));
	};
	
	
	// Return the first sequence of emojis from a string
	this.extractEmojiForItemsList = function (str) {
		// Split by anything that is not an emoji, Zero Width Joiner, or Variation Selector-16
		// And return first continuous span of emojis
		let re = /[^\p{Extended_Pictographic}\u200D\uFE0F]+/gu;
		return str.split(re).filter(Boolean)[0] || null;
	};

	// Used as parameter for .sort() method on an array of tags
	// Orders colored tags first by their position
	// Then order tags with emojis alphabetically.
	// Then order all remaining tags alphabetically
	this.compareTagsOrder = function (libraryID, tagA, tagB) {
		var collation = Zotero.getLocaleCollation();
		let tagColors = this.getColors(libraryID);
		let colorForA = tagColors.get(tagA);
		let colorForB = tagColors.get(tagB);
		if (colorForA && !colorForB) return -1;
		if (!colorForA && colorForB) return 1;
		if (colorForA && colorForB) {
			return colorForA.position - colorForB.position;
		}
		let emojiForA = Zotero.Utilities.Internal.containsEmoji(tagA);
		let emojiForB = Zotero.Utilities.Internal.containsEmoji(tagB);
		if (emojiForA && !emojiForB) return -1;
		if (!emojiForA && emojiForB) return 1;
		return collation.compareString(1, tagA, tagB);
	};
	
	/**
	 * Compare two API JSON tag objects
	 */
	this.equals = function (data1, data2, options = {}) {
		if (!options.skipClean) {
			data1 = this.cleanData(data1);
			data2 = this.cleanData(data2);
		}
		return data1.tag === data2.tag
			&& ((!data1.type && !data2.type) || data1.type === data2.type);
	},
	
	
	this.cleanData = function (data) {
		// Validate data
		if (data.tag === undefined) {
			throw new Error("Tag data must contain 'tag' property");
		}
		if (data.type !== undefined && data.type != 0 && data.type != 1) {
			throw new Error("Tag 'type' must be 0 or 1");
		}
		
		var cleanedData = {};
		cleanedData.tag = (data.tag + '').trim().normalize();
		if (data.type) {
			cleanedData.type = parseInt(data.type);
		}
		return cleanedData;
	}
}

