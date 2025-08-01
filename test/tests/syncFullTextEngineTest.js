"use strict";

describe("Zotero.Sync.Data.FullTextEngine", function () {
	var apiKey = Zotero.Utilities.randomString(24);
	var baseURL = "http://local.zotero/";
	var engine, server, client, caller, stub, spy;
	
	var responses = {};
	
	var setup = async function (options = {}) {
		server = sinon.fakeServer.create();
		server.autoRespond = true;
		
		const { ConcurrentCaller } = ChromeUtils.importESModule("resource://zotero/concurrentCaller.mjs");
		var caller = new ConcurrentCaller(1);
		caller.setLogger(msg => Zotero.debug(msg));
		caller.stopOnError = true;
		
		var client = new Zotero.Sync.APIClient({
			baseURL,
			apiVersion: options.apiVersion || ZOTERO_CONFIG.API_VERSION,
			apiKey,
			caller,
			background: options.background || true
		});
		
		var engine = new Zotero.Sync.Data.FullTextEngine({
			apiClient: client,
			libraryID: options.libraryID || Zotero.Libraries.userLibraryID,
			stopOnError: true
		});
		
		return { engine, client, caller };
	};
	
	function setResponse(response) {
		setHTTPResponse(server, baseURL, response, responses);
	}
	
	function generateContent() {
		return new Array(10).fill("").map(x => Zotero.Utilities.randomString()).join(" ");
	}
	
	//
	// Tests
	//
	beforeEach(function* () {
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		
		Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		
		yield Zotero.Users.setCurrentUserID(1);
		yield Zotero.Users.setCurrentUsername("testuser");
	})
	
	describe("Full-Text Syncing", function () {
		it("should skip full-text download if main library version is the same", async function () {
			({ engine, client, caller } = await setup());
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 10;
			await library.saveTx();
			await Zotero.Fulltext.setLibraryVersion(library.id, 10);
			await engine.start();
		});
		
		it("should download full-text into a new library and subsequent updates", async function () {
			({ engine, client, caller } = await setup());
			
			var item = await createDataObject('item');
			var attachment = new Zotero.Item('attachment');
			attachment.parentItemID = item.id;
			attachment.attachmentLinkMode = 'imported_file';
			attachment.attachmentContentType = 'application/pdf';
			attachment.attachmentFilename = 'test.pdf';
			await attachment.saveTx();
			
			var content = generateContent()
			var spy = sinon.spy(Zotero.Fulltext, "registerContentProcessor")
			
			var itemFullTextVersion = 10;
			var libraryVersion = 15;
			
			// Set main library version to new version
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = libraryVersion;
			await library.saveTx();
			
			setResponse({
				method: "GET",
				url: "users/1/fulltext?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": libraryVersion
				},
				json: {
					[attachment.key]: itemFullTextVersion
				}
			});
			setResponse({
				method: "GET",
				url: `users/1/items/${attachment.key}/fulltext`,
				status: 200,
				headers: {
					"Last-Modified-Version": itemFullTextVersion
				},
				json: {
					content,
					indexedPages: 1,
					totalPages: 1
				}
			});
			await engine.start();
			
			var dir = Zotero.Attachments.getStorageDirectory(attachment).path;
			var unprocessed = OS.Path.join(dir, '.zotero-ft-unprocessed');
			assert.isTrue(await OS.File.exists(unprocessed));
			var data = JSON.parse(await Zotero.File.getContentsAsync(unprocessed));
			assert.propertyVal(data, 'text', content);
			assert.propertyVal(data, 'indexedPages', 1);
			assert.propertyVal(data, 'totalPages', 1);
			assert.propertyVal(data, 'version', itemFullTextVersion);
			assert.equal(
				await Zotero.FullText.getLibraryVersion(item.libraryID),
				libraryVersion
			);
			
			sinon.assert.calledOnce(spy);
			spy.restore();
			
			//
			// Get new content
			//
			({ engine, client, caller } = await setup());
			
			item = await createDataObject('item');
			attachment = new Zotero.Item('attachment');
			attachment.parentItemID = item.id;
			attachment.attachmentLinkMode = 'imported_file';
			attachment.attachmentContentType = 'application/pdf';
			attachment.attachmentFilename = 'test.pdf';
			await attachment.saveTx();
			
			content = generateContent()
			spy = sinon.spy(Zotero.Fulltext, "registerContentProcessor")
			
			itemFullTextVersion = 17;
			var lastLibraryVersion = libraryVersion;
			libraryVersion = 20;
			
			// Set main library version to new version
			library.libraryVersion = libraryVersion;
			await library.saveTx();
			
			setResponse({
				method: "GET",
				url: "users/1/fulltext?format=versions&since=" + lastLibraryVersion,
				status: 200,
				headers: {
					"Last-Modified-Version": libraryVersion
				},
				json: {
					[attachment.key]: itemFullTextVersion
				}
			});
			setResponse({
				method: "GET",
				url: `users/1/items/${attachment.key}/fulltext`,
				status: 200,
				headers: {
					"Last-Modified-Version": itemFullTextVersion
				},
				json: {
					content,
					indexedPages: 1,
					totalPages: 1
				}
			});
			await engine.start();
			
			var dir = Zotero.Attachments.getStorageDirectory(attachment).path;
			var unprocessed = OS.Path.join(dir, '.zotero-ft-unprocessed');
			assert.isTrue(await OS.File.exists(unprocessed));
			var data = JSON.parse(await Zotero.File.getContentsAsync(unprocessed));
			assert.propertyVal(data, 'text', content);
			assert.propertyVal(data, 'indexedPages', 1);
			assert.propertyVal(data, 'totalPages', 1);
			assert.propertyVal(data, 'version', itemFullTextVersion);
			assert.equal(
				await Zotero.FullText.getLibraryVersion(item.libraryID),
				libraryVersion
			);
			
			sinon.assert.calledOnce(spy);
			spy.restore();
		})
		
		it("should handle remotely missing full-text content", async function () {
			({ engine, client, caller } = await setup());
			
			var item = await createDataObject('item');
			var attachment = new Zotero.Item('attachment');
			attachment.parentItemID = item.id;
			attachment.attachmentLinkMode = 'imported_file';
			attachment.attachmentContentType = 'application/pdf';
			attachment.attachmentFilename = 'test.pdf';
			await attachment.saveTx();
			
			var itemFullTextVersion = 10;
			var libraryVersion = 15;
			setResponse({
				method: "GET",
				url: "users/1/fulltext?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": libraryVersion
				},
				json: {
					[attachment.key]: itemFullTextVersion
				}
			});
			setResponse({
				method: "GET",
				url: `users/1/items/${attachment.key}/fulltext`,
				status: 404,
				headers: {
					"Last-Modified-Version": itemFullTextVersion
				},
				text: ""
			});
			await engine.start();
		})
		
		it("should upload new full-text content and subsequent updates", async function () {
			// https://github.com/cjohansen/Sinon.JS/issues/607
			var fixSinonBug = ";charset=utf-8";
			
			var library = Zotero.Libraries.userLibrary;
			var libraryID = library.id;
			library.libraryVersion = 5;
			await library.saveTx();
			
			({ engine, client, caller } = await setup());
			
			var item = await createDataObject('item');
			
			var attachment1 = new Zotero.Item('attachment');
			attachment1.parentItemID = item.id;
			attachment1.attachmentLinkMode = 'imported_file';
			attachment1.attachmentContentType = 'text/html';
			attachment1.attachmentFilename = 'test.html';
			attachment1.attachmentCharset = 'utf-8';
			attachment1.synced = true;
			await attachment1.saveTx();
			await Zotero.Attachments.createDirectoryForItem(attachment1);
			var path = attachment1.getFilePath();
			var content1 = "A" + generateContent()
			await Zotero.File.putContentsAsync(path, content1);
			
			var attachment2 = new Zotero.Item('attachment');
			attachment2.parentItemID = item.id;
			attachment2.attachmentLinkMode = 'imported_file';
			attachment2.attachmentContentType = 'text/html';
			attachment2.attachmentFilename = 'test.html';
			attachment2.attachmentCharset = 'utf-8';
			attachment2.synced = true;
			await attachment2.saveTx();
			await Zotero.Attachments.createDirectoryForItem(attachment2);
			path = attachment2.getFilePath();
			var content2 = "B" + generateContent()
			await Zotero.File.putContentsAsync(path, content2);
			
			await Zotero.Fulltext.indexItems([attachment1.id, attachment2.id]);
			
			var libraryVersion = 15;
			
			var count = 1;
			setResponse({
				method: "GET",
				url: "users/1/fulltext?format=versions",
				status: 200,
				headers: {
					"Last-Modified-Version": libraryVersion
				},
				json: {}
			});
			server.respond(function (req) {
				if (req.method == "POST") {
					if (req.url == `${baseURL}users/1/fulltext`) {
						assert.propertyVal(
							req.requestHeaders,
							'Content-Type',
							'application/json' + fixSinonBug
						);
						
						let json = JSON.parse(req.requestBody);
						assert.lengthOf(json, 2);
						
						json.sort((a, b) => a.content < b.content ? -1 : 1);
						assert.propertyVal(json[0], 'key', attachment1.key);
						assert.propertyVal(json[0], 'content', content1);
						assert.propertyVal(json[0], 'indexedChars', content1.length);
						assert.propertyVal(json[0], 'totalChars', content1.length);
						assert.propertyVal(json[0], 'indexedPages', 0);
						assert.propertyVal(json[0], 'totalPages', 0);
						assert.propertyVal(json[1], 'key', attachment2.key);
						assert.propertyVal(json[1], 'content', content2);
						assert.propertyVal(json[1], 'indexedChars', content2.length);
						assert.propertyVal(json[1], 'totalChars', content2.length);
						assert.propertyVal(json[1], 'indexedPages', 0);
						assert.propertyVal(json[1], 'totalPages', 0);
						
						req.respond(
							200,
							{
								"Content-Type": "application/json",
								"Last-Modified-Version": ++libraryVersion
							},
							JSON.stringify({
								"successful": {
									"0": {
										key: attachment1.key
									},
									"1": {
										key: attachment2.key
									}
								},
								"unchanged": {},
								"failed": {}
							})
						);
						count--;
					}
				}
			})
			
			await engine.start();
			assert.equal(count, 0);
			assert.equal(await Zotero.FullText.getItemVersion(attachment1.id), libraryVersion);
			assert.equal(await Zotero.FullText.getItemVersion(attachment2.id), libraryVersion);
			assert.equal(await Zotero.Fulltext.getLibraryVersion(libraryID), libraryVersion);
			assert.equal(Zotero.Libraries.userLibrary.libraryVersion, libraryVersion);
			
			//
			// Upload new content
			//
			({ engine, client, caller } = await setup());
			library.libraryVersion = libraryVersion;
			await library.saveTx();
			
			var attachment3 = new Zotero.Item('attachment');
			attachment3.parentItemID = item.id;
			attachment3.attachmentLinkMode = 'imported_file';
			attachment3.attachmentContentType = 'text/html';
			attachment3.attachmentFilename = 'test.html';
			attachment3.attachmentCharset = 'utf-8';
			attachment3.synced = true;
			await attachment3.saveTx();
			await Zotero.Attachments.createDirectoryForItem(attachment3);
			
			path = attachment3.getFilePath();
			var content3 = generateContent()
			await Zotero.File.putContentsAsync(path, content3);
			await Zotero.Fulltext.indexItems([attachment3.id]);
			
			count = 1;
			setResponse({
				method: "GET",
				url: "users/1/fulltext?format=versions&since=" + libraryVersion,
				status: 200,
				headers: {
					"Last-Modified-Version": libraryVersion
				},
				json: {}
			});
			server.respond(function (req) {
				if (req.method == "POST") {
					if (req.url == `${baseURL}users/1/fulltext`) {
						assert.propertyVal(req.requestHeaders, 'Zotero-API-Key', apiKey);
						assert.propertyVal(
							req.requestHeaders,
							'Content-Type',
							'application/json' + fixSinonBug
						);
						
						let json = JSON.parse(req.requestBody);
						assert.lengthOf(json, 1);
						json = json[0];
						assert.propertyVal(json, 'key', attachment3.key);
						assert.propertyVal(json, 'content', content3);
						assert.propertyVal(json, 'indexedChars', content3.length);
						assert.propertyVal(json, 'totalChars', content3.length);
						assert.propertyVal(json, 'indexedPages', 0);
						assert.propertyVal(json, 'totalPages', 0);
						
						req.respond(
							200,
							{
								"Content-Type": "application/json",
								"Last-Modified-Version": ++libraryVersion
							},
							JSON.stringify({
								"successful": {
									"0": {
										key: attachment3.key
									}
								},
								"unchanged": {},
								"failed": {}
							})
						);
						count--;
					}
				}
			})
			
			await engine.start();
			assert.equal(count, 0);
			assert.equal(await Zotero.FullText.getItemVersion(attachment3.id), libraryVersion);
			assert.equal(await Zotero.Fulltext.getLibraryVersion(libraryID), libraryVersion);
			assert.equal(Zotero.Libraries.userLibrary.libraryVersion, libraryVersion);
		})
	});
})
