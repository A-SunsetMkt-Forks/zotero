"use strict";

describe("Zotero.Relations", function () {
	describe("#getByPredicateAndObject()", function () {
		it("should return items matching predicate and object", async function () {
			var item = createUnsavedDataObject('item');
			item.setRelations({
				"dc:relation": [
					"http://zotero.org/users/1/items/SHREREMS"
				],
				"owl:sameAs": [
					"http://zotero.org/groups/1/items/SRRMGSRM",
					"http://zotero.org/groups/1/items/GSMRRSSM"
				]
			})
			await item.saveTx();
			var objects = await Zotero.Relations.getByPredicateAndObject(
				'item', 'owl:sameAs', 'http://zotero.org/groups/1/items/SRRMGSRM'
			);
			assert.lengthOf(objects, 1);
			assert.equal(objects[0], item);
		})
	})
	
	describe("#updateUser", function () {
		beforeEach(function* () {
			yield Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='account'");
			yield Zotero.Users.init();
		})
		
		it("should update relations using local user key to use userID", async function () {
			var item1 = await createDataObject('item');
			var item2 = createUnsavedDataObject('item');
			item2.addRelatedItem(item1);
			await item2.save();
			
			var rels = item2.getRelationsByPredicate(Zotero.Relations.relatedItemPredicate);
			assert.include(rels[0], "/users/local");
			
			await Zotero.DB.executeTransaction(async function () {
				await Zotero.Relations.updateUser(null, 1);
			})
			
			var rels = item2.getRelationsByPredicate(Zotero.Relations.relatedItemPredicate);
			assert.include(rels[0], "/users/1");
		})
		
		it("should update relations from one userID to another", async function () {
			await Zotero.Users.setCurrentUserID(1);
			
			var item1 = await createDataObject('item');
			var item2 = createUnsavedDataObject('item');
			item2.addRelatedItem(item1);
			await item2.save();
			
			var rels = item2.getRelationsByPredicate(Zotero.Relations.relatedItemPredicate);
			assert.include(rels[0], "/users/1");
			
			await Zotero.DB.executeTransaction(async function () {
				await Zotero.Relations.updateUser(1, 2);
			});
			
			var rels = item2.getRelationsByPredicate(Zotero.Relations.relatedItemPredicate);
			assert.include(rels[0], "/users/2");
		})
	})
})
