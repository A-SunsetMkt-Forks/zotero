"use strict";

describe("Zotero.Collection", function () {
	describe("#save()", function () {
		it("should save a new collection", async function () {
			var name = "Test";
			var collection = new Zotero.Collection;
			collection.name = name;
			var id = await collection.saveTx();
			assert.equal(collection.name, name);
			collection = await Zotero.Collections.getAsync(id);
			assert.equal(collection.name, name);
		});
	})
	
	describe("#erase()", function () {
		it("should delete a collection but not its descendant item by default", async function () {
			var collection = await createDataObject('collection');
			var item = await createDataObject('item', { collections: [collection.id] });
			assert.isTrue(collection.hasItem(item.id));
			
			await collection.eraseTx();
			
			assert.isFalse(((await Zotero.Items.getAsync(item.id))).deleted);
		})
		
		it("should delete a collection and trash its descendant items with deleteItems: true", async function () {
			var collection = await createDataObject('collection');
			var item1 = await createDataObject('item', { collections: [collection.id] });
			var item2 = await createDataObject('item', { collections: [collection.id] });
			assert.isTrue(collection.hasItem(item1.id));
			assert.isTrue(collection.hasItem(item2.id));
			
			await collection.eraseTx({ deleteItems: true });
			
			assert.isTrue(((await Zotero.Items.getAsync(item1.id))).deleted);
			assert.isTrue(((await Zotero.Items.getAsync(item2.id))).deleted);
		});
		
		it("should clear collection from item cache", async function () {
			var collection = await createDataObject('collection');
			var item = await createDataObject('item', { collections: [collection.id] });
			assert.lengthOf(item.getCollections(), 1);
			await collection.eraseTx();
			assert.lengthOf(item.getCollections(), 0);
		});
		
		it("should clear subcollection from descendent item cache", async function () {
			var collection = await createDataObject('collection');
			var subcollection = await createDataObject('collection', { parentID: collection.id });
			var item = await createDataObject('item', { collections: [subcollection.id] });
			assert.lengthOf(item.getCollections(), 1);
			await collection.eraseTx();
			assert.lengthOf(item.getCollections(), 0);
		});
		
		it("should clear collection from item cache in deleteItems mode", async function () {
			var collection = await createDataObject('collection');
			var item = await createDataObject('item', { collections: [collection.id] });
			assert.lengthOf(item.getCollections(), 1);
			await collection.eraseTx({ deleteItems: true });
			assert.lengthOf(item.getCollections(), 0);
		});
		
		it("should apply 'skipDeleteLog: true' to subcollections", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection', { parentID: collection1.id });
			var collection3 = await createDataObject('collection', { parentID: collection2.id });
			
			await collection1.eraseTx({ skipDeleteLog: true });
			
			var deleted = await Zotero.Sync.Data.Local.getDeleted('collection', collection1.libraryID);
			
			// No collections should be in the delete log
			assert.notInclude(deleted, collection1.key);
			assert.notInclude(deleted, collection2.key);
			assert.notInclude(deleted, collection3.key);
		});

		it("should send deleted collections to trash", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection', { parentID: collection1.id });
			var collection3 = await createDataObject('collection', { parentID: collection2.id });
			
			collection1.deleted = true;
			await collection1.saveTx();
			
			var deleted = await Zotero.Collections.getDeleted(collection1.libraryID, true);
			
			assert.include(deleted, collection1.id);
			assert.include(deleted, collection2.id);
			assert.include(deleted, collection3.id);
		});

		it("should restore deleted collection", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection');
			var item1 = await createDataObject('item', { collections: [collection1.id, collection2.id] });

			assert.include(item1.getCollections(), collection1.id);

			collection1.deleted = true;
			await collection1.saveTx();

			// Trashed collection does not count as one of item's containers
			assert.notInclude(item1.getCollections(), collection1.id);
			// But it should still return it if includeTrashed=true is passed
			assert.include(item1.getCollections(true), collection1.id);

			// Restore deleted collection
			collection1.deleted = false;
			await collection1.saveTx();

			var deleted = await Zotero.Collections.getDeleted(collection1.libraryID, true);
			
			// Collection is restored from trash
			assert.notInclude(deleted, collection1.id);

			// Item belongs to the restored collection
			assert.include(item1.getCollections(), collection1.id);
		});

		it("should permanently delete collections from trash", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection', { parentID: collection1.id });
			var collection3 = await createDataObject('collection', { parentID: collection2.id, deleted: true });
			var item = await createDataObject('item', { collections: [collection1.id, collection2.id, collection3.id] });
			
			await collection1.eraseTx();
			
			assert.equal(await Zotero.Collections.getAsync(collection1.id), false);
			assert.equal(await Zotero.Collections.getAsync(collection2.id), false);
			assert.equal(await Zotero.Collections.getAsync(collection3.id), false);

			// Erased collections are fully removed as item's containers
			assert.equal(item.getCollections().length, 0);
			assert.equal(item.getCollections(true).length, 0);
		});
	})
	
	describe("#version", function () {
		it("should set object version", async function () {
			var version = 100;
			var collection = new Zotero.Collection
			collection.version = version;
			collection.name = "Test";
			var id = await collection.saveTx();
			assert.equal(collection.version, version);
			collection = await Zotero.Collections.getAsync(id);
			assert.equal(collection.version, version);
		});
	})
	
	describe("#parentKey", function () {
		it("should set parent collection for new collections", async function () {
			var parentCol = new Zotero.Collection
			parentCol.name = "Parent";
			var parentID = await parentCol.saveTx();
			var {libraryID, key: parentKey} = Zotero.Collections.getLibraryAndKeyFromID(parentID);
			
			var col = new Zotero.Collection
			col.name = "Child";
			col.parentKey = parentKey;
			var id = await col.saveTx();
			assert.equal(col.parentKey, parentKey);
			col = await Zotero.Collections.getAsync(id);
			assert.equal(col.parentKey, parentKey);
		});
		
		it("should change parent collection for existing collections", async function () {
			// Create initial parent collection
			var parentCol = new Zotero.Collection
			parentCol.name = "Parent";
			var parentID = await parentCol.saveTx();
			var {libraryID, key: parentKey} = Zotero.Collections.getLibraryAndKeyFromID(parentID);
			
			// Create subcollection
			var col = new Zotero.Collection
			col.name = "Child";
			col.parentKey = parentKey;
			var id = await col.saveTx();
			
			// Create new parent collection
			var newParentCol = new Zotero.Collection
			newParentCol.name = "New Parent";
			var newParentID = await newParentCol.saveTx();
			var {libraryID, key: newParentKey} = Zotero.Collections.getLibraryAndKeyFromID(newParentID);
			
			// Change parent collection
			col.parentKey = newParentKey;
			await col.saveTx();
			assert.equal(col.parentKey, newParentKey);
			col = await Zotero.Collections.getAsync(id);
			assert.equal(col.parentKey, newParentKey);
		});
		
		it("should not mark collection as unchanged if set to existing value", async function () {
			// Create initial parent collection
			var parentCol = new Zotero.Collection
			parentCol.name = "Parent";
			var parentID = await parentCol.saveTx();
			var {libraryID, key: parentKey} = Zotero.Collections.getLibraryAndKeyFromID(parentID);
			
			// Create subcollection
			var col = new Zotero.Collection
			col.name = "Child";
			col.parentKey = parentKey;
			var id = await col.saveTx();
			
			// Set to existing parent
			col.parentKey = parentKey;
			assert.isFalse(col.hasChanged());
		});
		
		it("should not resave a collection with no parent if set to false", async function () {
			var col = new Zotero.Collection
			col.name = "Test";
			var id = await col.saveTx();
			
			col.parentKey = false;
			var ret = await col.saveTx();
			assert.isFalse(ret);
		});
	})
	
	describe("#hasChildCollections()", function () {
		it("should be false if child made top-level", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection', { parentID: collection1.id });
			
			assert.isTrue(collection1.hasChildCollections());
			collection2.parentKey = false;
			await collection2.saveTx();
			assert.isFalse(collection1.hasChildCollections());
		})
		
		it("should be false if child moved to another collection", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection', { parentID: collection1.id });
			var collection3 = await createDataObject('collection');
			
			assert.isTrue(collection1.hasChildCollections());
			collection2.parentKey = collection3.key;
			await collection2.saveTx();
			assert.isFalse(collection1.hasChildCollections());
		});
		
		it("should return false if all child collections are moved to trash", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection', { parentID: collection1.id });
			var collection3 = await createDataObject('collection', { parentID: collection1.id });
			
			assert.isTrue(collection1.hasChildCollections());
			collection2.deleted = true;
			await collection2.saveTx();
			assert.isTrue(collection1.hasChildCollections());
			collection3.deleted = true;
			await collection3.saveTx();
			assert.isFalse(collection1.hasChildCollections());
		});
		
		it("should return true if child collection is in trash and includeTrashed is true", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection', { parentID: collection1.id });
			
			assert.isTrue(collection1.hasChildCollections(true));
			collection2.deleted = true;
			await collection2.saveTx();
			assert.isTrue(collection1.hasChildCollections(true));
		});
	})
	
	describe("#getChildCollections()", function () {
		it("should include child collections", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection', { parentID: collection1.id });
			await collection1.saveTx();
			
			var childCollections = collection1.getChildCollections();
			assert.lengthOf(childCollections, 1);
			assert.equal(childCollections[0].id, collection2.id);
		})
		
		it("should not include collections that have been removed", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection', { parentID: collection1.id });
			await collection1.saveTx();
			
			collection2.parentID = false;
			await collection2.save()
			
			var childCollections = collection1.getChildCollections();
			assert.lengthOf(childCollections, 0);
		})
		
		it("should not include collections in trash by default", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection', { parentID: collection1.id, deleted: true });
			
			var childCollections = collection1.getChildCollections();
			assert.lengthOf(childCollections, 0);
		});
		
		it("should include collections in trash if includeTrashed=true", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection', { parentID: collection1.id, deleted: true });
			
			var childCollections = collection1.getChildCollections(false, true);
			assert.lengthOf(childCollections, 1);
		});
		
		it("should not include collections that have been deleted", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection', { parentID: collection1.id });
			await collection1.saveTx();
			
			await collection2.eraseTx()
			
			var childCollections = collection1.getChildCollections();
			assert.lengthOf(childCollections, 0);
		})
	})
	
	describe("#getChildItems()", function () {
		it("should include child items", async function () {
			var collection = await createDataObject('collection');
			var item = createUnsavedDataObject('item');
			item.addToCollection(collection.key);
			await item.saveTx();
			
			assert.lengthOf(collection.getChildItems(), 1);
		})
		
		it("should not include items in trash by default", async function () {
			var collection = await createDataObject('collection');
			var item = createUnsavedDataObject('item');
			item.deleted = true;
			item.addToCollection(collection.key);
			await item.saveTx();
			
			assert.lengthOf(collection.getChildItems(), 0);
		})
		
		it("should include items in trash if includeTrashed=true", async function () {
			var collection = await createDataObject('collection');
			var item = createUnsavedDataObject('item');
			item.deleted = true;
			item.addToCollection(collection.key);
			await item.saveTx();
			
			assert.lengthOf(collection.getChildItems(false, true), 1);
		})
		
		it("should not include removed items", async function () {
			var col = await createDataObject('collection');
			var item = await createDataObject('item', { collections: [ col.id ] });
			assert.lengthOf(col.getChildItems(), 1);
			item.setCollections([]);
			await item.saveTx();
			Zotero.debug(col.getChildItems());
			assert.lengthOf(col.getChildItems(), 0);
		});
		
		it("should not include deleted items", async function () {
			var col = await createDataObject('collection');
			var item = await createDataObject('item', { collections: [ col.id ] });
			assert.lengthOf(col.getChildItems(), 1);
			await item.erase();
			assert.lengthOf(col.getChildItems(), 0);
		});
		
		it("should not include items emptied from trash", async function () {
			var col = await createDataObject('collection');
			var item = await createDataObject('item', { collections: [ col.id ], deleted: true });
			await item.erase();
			assert.lengthOf(col.getChildItems(), 0);
		});
	})
	
	describe("#fromJSON()", function () {
		it("should ignore unknown property in non-strict mode", function () {
			var json = {
				name: "Collection",
				foo: "Bar"
			};
			var s = new Zotero.Collection();
			s.fromJSON(json);
		});
		
		it("should throw on unknown property in strict mode", function () {
			var json = {
				name: "Collection",
				foo: "Bar"
			};
			var s = new Zotero.Collection();
			var f = () => {
				s.fromJSON(json, { strict: true });
			};
			assert.throws(f, /^Unknown collection property/);
		});
	});
	
	describe("#toJSON()", function () {
		it("should set 'parentCollection' to false when cleared", async function () {
			var col1 = await createDataObject('collection');
			var col2 = await createDataObject('collection', { parentID: col1.id });
			// Create initial JSON with parentCollection
			var patchBase = col2.toJSON();
			// Clear parent collection and regenerate JSON
			col2.parentID = false;
			await col2.saveTx();
			var json = col2.toJSON({ patchBase });
			assert.isFalse(json.parentCollection);
		});
	});
	
	describe("#getDescendents()", function () {
		var collection0, collection1, collection2, collection3, item1, item2, item3;
		
		before(function* () {
			collection0 = yield createDataObject('collection');
			item1 = yield createDataObject('item', { collections: [collection0.id] });
			collection1 = yield createDataObject('collection', { parentKey: collection0.key });
			item2 = yield createDataObject('item', { collections: [collection1.id] });
			collection2 = yield createDataObject('collection', { parentKey: collection1.key });
			collection3 = yield createDataObject('collection', { parentKey: collection1.key });
			item3 = yield createDataObject('item', { collections: [collection2.id] });
			item3.deleted = true;
			yield item3.saveTx();
		});
		
		it("should return a flat array of collections and items", async function () {
			var desc = collection0.getDescendents();
			assert.lengthOf(desc, 5);
			assert.sameMembers(
				desc.map(x => x.type + ':' + x.id + ':' + (x.name || '') + ':' + x.parent),
				[
					'item:' + item1.id + '::' + collection0.id,
					'item:' + item2.id + '::' + collection1.id,
					'collection:' + collection1.id + ':' + collection1.name + ':' + collection0.id,
					'collection:' + collection2.id + ':' + collection2.name + ':' + collection1.id,
					'collection:' + collection3.id + ':' + collection3.name + ':' + collection1.id
				]
			);
		});
		
		it("should return nested arrays of collections and items", async function () {
			var desc = collection0.getDescendents(true);
			assert.lengthOf(desc, 2);
			assert.sameMembers(
				desc.map(x => x.type + ':' + x.id + ':' + (x.name || '') + ':' + x.parent),
				[
					'item:' + item1.id + '::' + collection0.id,
					'collection:' + collection1.id + ':' + collection1.name + ':' + collection0.id,
				]
			);
			var c = desc[0].type == 'collection' ? desc[0] : desc[1];
			assert.lengthOf(c.children, 3);
			assert.sameMembers(
				c.children.map(x => x.type + ':' + x.id + ':' + (x.name || '') + ':' + x.parent),
				[
					'item:' + item2.id + '::' + collection1.id,
					'collection:' + collection2.id + ':' + collection2.name + ':' + collection1.id,
					'collection:' + collection3.id + ':' + collection3.name + ':' + collection1.id
				]
			);
		});
		
		it("should not include deleted items", async function () {
			var col = await createDataObject('collection');
			var item = await createDataObject('item', { collections: [col.id] });
			assert.lengthOf(col.getDescendents(), 1);
			await item.eraseTx();
			assert.lengthOf(col.getDescendents(), 0);
		});

	});
})
