/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2015 Center for History and New Media
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
 * Constructor for FeedItem object
 */
Zotero.FeedItem = function (itemTypeOrID, params = {}) {
	Zotero.FeedItem._super.call(this, itemTypeOrID);
	
	this._feedItemReadTime = null;
	this._feedItemTranslatedTime = null;
	
	Zotero.Utilities.Internal.assignProps(this, params, ['guid']);
};

Zotero.extendClass(Zotero.Item, Zotero.FeedItem);

Zotero.FeedItem.prototype._objectType = 'feedItem';
Zotero.FeedItem.prototype._containerObject = 'feed';

Zotero.defineProperty(Zotero.FeedItem.prototype, 'isFeedItem', {
	value: true
});

Zotero.defineProperty(Zotero.FeedItem.prototype, 'guid', {
	get: function () { return this._feedItemGUID; },
	set: function (val) {
		if (this.id) throw new Error('Cannot set GUID after item ID is already set');
		if (typeof val != 'string') throw new Error('GUID must be a non-empty string');
		this._feedItemGUID = val;
	}
});

Zotero.defineProperty(Zotero.FeedItem.prototype, 'isRead', {
	get: function () {
		return !!this._feedItemReadTime;
	},
	set: function (read) {
		if (!read != !this._feedItemReadTime) {
			// changed
			if (read) {
				this._feedItemReadTime = Zotero.Date.dateToSQL(new Date(), true);
			} else {
				this._feedItemReadTime = null;
			}
			this._changed.feedItemData = true;
		}
	}
});
//
Zotero.defineProperty(Zotero.FeedItem.prototype, 'isTranslated', {
	get: function () {
		return !!this._feedItemTranslatedTime;
	}, 
	set: function (state) {
		if (state != !!this._feedItemTranslatedTime) {
			if (state) {
				this._feedItemTranslatedTime = Zotero.Date.dateToSQL(new Date(), true);
			} else {
				this._feedItemTranslatedTime = null;
			}
			this._changed.feedItemData = true;
		}
	}
});

Zotero.FeedItem.prototype.loadPrimaryData = async function (reload, failOnMissing) {
	if (this.guid && !this.id) {
		// fill in item ID
		this.id = await this.ObjectsClass.getIDFromGUID(this.guid);
	}
	await Zotero.FeedItem._super.prototype.loadPrimaryData.apply(this, arguments);
};

Zotero.FeedItem.prototype.setField = function (field, value) {
	if (field == 'libraryID') {
		// Ensure that it references a feed
		if (!Zotero.Libraries.get(value).isFeed) {
			throw new Error('libraryID must reference a feed');
		}
	}
	
	return Zotero.FeedItem._super.prototype.setField.apply(this, arguments);
}

Zotero.FeedItem.prototype.fromJSON = function (json) {
	// Spaghetti to handle weird date formats in feedItems
	let val = json.date;
	if (val) {
		let d = Zotero.Date.sqlToDate(val, true);
		if (!d || isNaN(d.getTime())) {
			d = Zotero.Date.isoToDate(val);
		}
		if ((!d || isNaN(d.getTime())) && Zotero.Date.isHTTPDate(val)) {
			d = new Date(val);
		}
		if (!d || isNaN(d.getTime())) {
			d = Zotero.Date.strToDate(val);
			if (d) {
				json.date = [d.year, Zotero.Utilities.lpad(d.month+1, '0', 2), Zotero.Utilities.lpad(d.day, '0', 2)].join('-');
			} else {
				Zotero.logError("Discarding invalid date '" + json.date
					+ "' for item " + this.libraryKey);
				delete json.date;
			}
		} else {
			json.date = Zotero.Date.dateToSQL(d, true);
		}
	}
	Zotero.FeedItem._super.prototype.fromJSON.apply(this, arguments);
}

Zotero.FeedItem.prototype._initSave = async function (env) {
	if (!this.guid) {
		throw new Error('GUID must be set before saving ' + this._ObjectType);
	}
	
	let proceed = await Zotero.FeedItem._super.prototype._initSave.apply(this, arguments);
	if (!proceed) return proceed;
	
	if (env.isNew) {
		// verify that GUID doesn't already exist for a new item
		var item = await this.ObjectsClass.getIDFromGUID(this.guid);
		if (item) {
			throw new Error('Cannot create new item with GUID ' + this.guid + '. Item already exists.');
		}
		
		// Register GUID => itemID mapping in cache on commit
		if (!env.transactionOptions) env.transactionOptions = {};
		var superOnCommit = env.transactionOptions.onCommit;
		env.transactionOptions.onCommit = () => {
			if (superOnCommit) superOnCommit();
			this.ObjectsClass._setGUIDMapping(this.guid, this._id);
		};
	}
	
	return proceed;
};

Zotero.FeedItem.prototype._saveData = async function (env) {
	await Zotero.FeedItem._super.prototype._saveData.apply(this, arguments);
	
	if (this._changed.feedItemData || env.isNew) {
		var sql = "REPLACE INTO feedItems VALUES (?,?,?,?)";
		await Zotero.DB.queryAsync(
			sql,
			[
				this.id,
				this.guid,
				this._feedItemReadTime,
				this._feedItemTranslatedTime
			]
		);
		
		this._clearChanged('feedItemData');
	}
};

Zotero.FeedItem.prototype._finalizeErase = async function () {
	// Set for syncing
	let feed = Zotero.Feeds.get(this.libraryID);
	
	return Zotero.FeedItem._super.prototype._finalizeErase.apply(this, arguments);
};

Zotero.FeedItem.prototype.toggleRead = async function (state) {
	state = state !== undefined ? !!state : !this.isRead;
	let changed = this.isRead != state;
	if (changed) {
		this.isRead = state;
		
		await this.saveTx();

		let feed = Zotero.Feeds.get(this.libraryID);
		await feed.updateUnreadCount();
	}
};

/**
 * Uses the item url to translate an existing feed item.
 * If libraryID empty, overwrites feed item, otherwise saves
 * in the library
 * @param libraryID {Integer} save item in library
 * @param collectionID {Integer} add item to collection
 * @return {Promise<FeedItem|Item>} translated feed item
 */
Zotero.FeedItem.prototype.translate = async function (libraryID, collectionID) {
	const { RemoteTranslate } = ChromeUtils.importESModule("chrome://zotero/content/RemoteTranslate.mjs");
	const { HiddenBrowser } = ChromeUtils.importESModule("chrome://zotero/content/HiddenBrowser.mjs");

	Zotero.debug("Translating feed item " + this.id + " with URL " + this.getField('url'), 2);
	if (Zotero.locked) {
		Zotero.debug('Zotero locked, skipping feed item translation');
		return;
	}

	let error = function (e) {  };
	let translate = new RemoteTranslate();
	var win = Services.wm.getMostRecentWindow("navigator:browser");
	let progressWindow = win.ZoteroPane.progressWindow;
	
	if (libraryID) {
		// Show progress notifications when scraping to a library.
		translate.setHandler("done", progressWindow.Translation.doneHandler);
		translate.setHandler("itemDone", progressWindow.Translation.itemDoneHandler());
		if (collectionID) {
			var collection = await Zotero.Collections.getAsync(collectionID);
		}
		progressWindow.show();
		progressWindow.Translation.scrapingTo(libraryID, collection);
	}
	
	// Load document in hidden browser and point the RemoteTranslate to it
	let browser = new HiddenBrowser();
	await browser.load(this.getField('url'));
	try {
		await translate.setBrowser(browser);
		
		// Load translators
		let translators = await translate.detect();
		if (!translators || !translators.length) {
			Zotero.debug("No translators detected for feed item " + this.id + " with URL " + this.getField('url') + 
				' -- cloning item instead', 2);
			let item = await this.clone(libraryID, collectionID, browser);
			progressWindow.Translation.itemDoneHandler()(null, null, item);
			progressWindow.Translation.doneHandler(null, true);
			return;
		}
	
		if (libraryID) {
			let result = await translate.translate({
				libraryID,
				collections: collectionID ? [collectionID] : false
			}).then(items => items ? items[0] : false);
			if (!result) {
				let item = await this.clone(libraryID, collectionID, browser);
				progressWindow.Translation.itemDoneHandler()(null, null, item);
				progressWindow.Translation.doneHandler(null, true);
				return;
			}
			return result;
		}
		
		translate.setHandler('error', error);
		
		let itemData = await translate.translate({ libraryID: false, saveAttachments: false });
		if (itemData.length) {
			itemData = itemData[0];
		}
		else {
			Zotero.debug('Zotero.FeedItem#translate: Translation failed');
			return null;
		}
		
		// clean itemData
		const deleteFields = ['attachments', 'notes', 'id', 'itemID', 'path', 'seeAlso', 'version', 'dateAdded', 'dateModified'];
		for (let field of deleteFields) {
			delete itemData[field];
		}
		
		this.fromJSON(itemData);
		this.isTranslated = true;
		await this.saveTx();
		
		return this;
	}
	finally {
		browser.destroy();
		translate.dispose();
	}
};

/**
 * Clones the feed item (usually, when proper translation is unavailable)
 * @param {Integer} libraryID save item in library
 * @param {Integer} [collectionID] add item to collection
 * @param {Browser} [browser]
 * @return {Promise<FeedItem|Item>} translated feed item
 */
Zotero.FeedItem.prototype.clone = async function (libraryID, collectionID, browser) {
	let dbItem = Zotero.Item.prototype.clone.call(this, libraryID);
	if (collectionID) {
		dbItem.addToCollection(collectionID);
	}
	await dbItem.saveTx();
	
	let item = {title: dbItem.getField('title'), itemType: dbItem.itemType, attachments: []};
	
	// Add snapshot
	if (Zotero.Libraries.get(libraryID).filesEditable && browser) {
		item.attachments = [{title: "Snapshot"}];
		await Zotero.Attachments.importFromDocument({
			browser,
			parentItemID: dbItem.id
		});
	}
	
	return item;
};
