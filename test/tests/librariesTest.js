describe("Zotero.Libraries", function () {
	let groupName = 'test',
		group,
		builtInLibraries;
	before(function* () {
		builtInLibraries = [
			Zotero.Libraries.userLibraryID,
		];
		
		group = yield createGroup({ name: groupName });
	});
	
	it("should provide user library ID as .userLibraryID", function () {
		assert.isDefined(Zotero.Libraries.userLibraryID);
		assert(Number.isInteger(Zotero.Libraries.userLibraryID), ".userLibraryID is an integer");
		assert.isAbove(Zotero.Libraries.userLibraryID, 0);
	});
	
	describe("#getAll()", function () {
		it("should return an array of Zotero.Library instances", function () {
			let libraries = Zotero.Libraries.getAll();
			assert.isArray(libraries);
			assert(libraries.every(library => library instanceof Zotero.Library));
		})
		
		it("should return all libraries in sorted order", async function () {
			// Add/remove a few group libraries beforehand to ensure that data is kept in sync
			let library = await createGroup();
			let tempLib = await createGroup();
			await tempLib.eraseTx();
			
			var libraries = Zotero.Libraries.getAll();
			var ids = libraries.map(library => library.libraryID);
			var dbIDs = await Zotero.DB.columnQueryAsync("SELECT libraryID FROM libraries");
			assert.sameMembers(ids, dbIDs);
			assert.equal(dbIDs.length, ids.length, "returns correct number of IDs");
			
			// Check sort
			assert.equal(ids[0], Zotero.Libraries.userLibraryID);
			
			var last = "";
			var collation = Zotero.getLocaleCollation();
			for (let i = 2; i < libraries.length; i++) {
				let current = libraries[i].name;
				assert.isAbove(
					collation.compareString(1, current, last),
					0,
					`'${current}' should sort after '${last}'`
				);
				last = current;
			}
			
			// remove left-over library
			await library.eraseTx();
		});
	});
	
	describe("#exists()", function () {
		it("should return true for all existing IDs", function () {
			let ids = Zotero.Libraries.getAll().map(library => library.libraryID);
			assert.isTrue(ids.reduce(function (res, id) { return res && Zotero.Libraries.exists(id) }, true));
		});
		it("should return false for a non-existing ID", function () {
			assert.isFalse(Zotero.Libraries.exists(-1), "returns boolean false for a negative ID");
			let badID = Zotero.Libraries.getAll().map(lib => lib.libraryID).reduce((a, b) => (a < b ? b : a)) + 1;
			assert.isFalse(Zotero.Libraries.exists(badID), "returns boolean false for a non-existent positive ID");
		});
	});
	describe("#getName()", function () {
		it("should return correct library name for built-in libraries", function () {
			assert.equal(Zotero.Libraries.getName(Zotero.Libraries.userLibraryID), Zotero.getString('pane.collections.library'), "user library name is correct");
		});
		it("should return correct name for a group library", function () {
			assert.equal(Zotero.Libraries.getName(group.libraryID), groupName);
		});
		it("should throw for invalid library ID", function () {
			assert.throws(() => Zotero.Libraries.getName(-1), /^Invalid library ID /);
		});
	});
	describe("#getType()", function () {
		it("should return correct library type for built-in libraries", function () {
			assert.equal(Zotero.Libraries.getType(Zotero.Libraries.userLibraryID), 'user', "user library type is correct");
		});
		it("should return correct library type for a group library", function () {
			assert.equal(Zotero.Libraries.getType(group.libraryID), 'group');
		});
		it("should throw for invalid library ID", function () {
			assert.throws(() => Zotero.Libraries.getType(-1), /^Invalid library ID /);
		});
	});
	describe("#isEditable()", function () {
		it("should always return true for user library", function () {
			assert.isTrue(Zotero.Libraries.isEditable(Zotero.Libraries.userLibraryID));
		});
		it("should return correct state for a group library", async function () {
			group.editable = true;
			await group.saveTx();
			assert.isTrue(Zotero.Libraries.isEditable(group.libraryID));
			
			group.editable = false;
			await group.saveTx();
			assert.isFalse(Zotero.Libraries.isEditable(group.libraryID));
		});
		it("should throw for invalid library ID", function () {
			assert.throws(Zotero.Libraries.isEditable.bind(Zotero.Libraries, -1), /^Invalid library ID /);
		});
		it("should not depend on filesEditable", async function () {
			let editableStartState = Zotero.Libraries.isEditable(group.libraryID),
				filesEditableStartState = Zotero.Libraries.isFilesEditable(group.libraryID);
			
			// Test all combinations
			// E: true, FE: true => true
			await Zotero.Libraries.setEditable(group.libraryID, true);
			await Zotero.Libraries.setFilesEditable(group.libraryID, true);
			assert.isTrue(Zotero.Libraries.isEditable(group.libraryID));
			
			// E: false, FE: true => false
			await Zotero.Libraries.setEditable(group.libraryID, false);
			assert.isFalse(Zotero.Libraries.isEditable(group.libraryID));
			
			// E: false, FE: false => false
			await Zotero.Libraries.setFilesEditable(group.libraryID, false);
			assert.isFalse(Zotero.Libraries.isEditable(group.libraryID));
			
			// E: true, FE: false => true
			await Zotero.Libraries.setEditable(group.libraryID, true);
			assert.isTrue(Zotero.Libraries.isEditable(group.libraryID));
			
			// Revert settings
			await Zotero.Libraries.setFilesEditable(group.libraryID, filesEditableStartState);
			await Zotero.Libraries.setEditable(group.libraryID, editableStartState);
		});
	});
	describe("#setEditable()", function () {
		it("should not allow changing editable state of built-in libraries", async function () {
			for (let i=0; i<builtInLibraries.length; i++) {
				assert.ok(await getPromiseError(Zotero.Libraries.setEditable(builtInLibraries[i])));
			}
		});
		it("should allow changing editable state for group library", async function () {
			let startState = Zotero.Libraries.isEditable(group.libraryID);
			await Zotero.Libraries.setEditable(group.libraryID, !startState);
			assert.equal(Zotero.Libraries.isEditable(group.libraryID), !startState, 'changes state');
			
			await Zotero.Libraries.setEditable(group.libraryID, startState);
			assert.equal(Zotero.Libraries.isEditable(group.libraryID), startState, 'reverts state');
		});
		it("should throw for invalid library ID", async function () {
			assert.match((await getPromiseError(Zotero.Libraries.setEditable(-1))).message, /^Invalid library ID /);
		});
	});
	describe("#isFilesEditable()", function () {
		it("should throw for invalid library ID", function () {
			assert.throws(Zotero.Libraries.isFilesEditable.bind(Zotero.Libraries, -1), /^Invalid library ID /);
		});
	});
	describe("#setFilesEditable()", function () {
		it("should not allow changing files editable state of built-in libraries", async function () {
			for (let i=0; i<builtInLibraries.length; i++) {
				assert.ok(await getPromiseError(Zotero.Libraries.setFilesEditable(builtInLibraries[i])));
			}
		});
		it("should allow changing files editable state for group library", async function () {
			let startState = Zotero.Libraries.isFilesEditable(group.libraryID),
				editableStartState = Zotero.Libraries.isEditable(group.libraryID);
			
			// Since filesEditable is false for all non-editable libraries
			await Zotero.Libraries.setEditable(group.libraryID, true);
			
			await Zotero.Libraries.setFilesEditable(group.libraryID, !startState);
			assert.equal(Zotero.Libraries.isFilesEditable(group.libraryID), !startState, 'changes state');
			
			await Zotero.Libraries.setFilesEditable(group.libraryID, startState);
			assert.equal(Zotero.Libraries.isFilesEditable(group.libraryID), startState, 'reverts state');
			
			await Zotero.Libraries.setEditable(group.libraryID, editableStartState);
		});
		it("should throw for invalid library ID", async function () {
			assert.match((await getPromiseError(Zotero.Libraries.setFilesEditable(-1))).message, /^Invalid library ID /);
		});
	});
	describe("#isGroupLibrary()", function () {
		it("should return false for non-group libraries", function () {
			for (let i=0; i<builtInLibraries.length; i++) {
				let id = builtInLibraries[i],
					type = Zotero.Libraries.getType(id);
				assert.isFalse(Zotero.Libraries.isGroupLibrary(id), "returns false for " + type + " library");
			}
		});
		
		it("should return true for group library", function () {
			assert.isTrue(Zotero.Libraries.isGroupLibrary(group.libraryID));
		})
		
		it("should throw for invalid library ID", function () {
			assert.throws(Zotero.Libraries.isGroupLibrary.bind(Zotero.Libraries, -1), /^Invalid library ID /);
		});
	});
	describe("#hasTrash()", function () {
		it("should return true for all library types", function () {
			assert.isTrue(Zotero.Libraries.hasTrash(Zotero.Libraries.userLibraryID));
			assert.isTrue(Zotero.Libraries.hasTrash(group.libraryID));
		});
		it("should throw for invalid library ID", function () {
			assert.throws(Zotero.Libraries.hasTrash.bind(Zotero.Libraries, -1), /^Invalid library ID /);
		});
	});
})
