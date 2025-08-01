"use strict";

var { NetUtil } = ChromeUtils.importESModule("resource://gre/modules/NetUtil.sys.mjs");

describe("Zotero.Server", function () {
	var serverPath;
	
	before(function* () {
		serverPath = 'http://127.0.0.1:' + Zotero.Server.port;
	});
	
	describe('DataListener', function () {
		describe("_processEndpoint()", function () {
			describe("1 argument", function () {
				it("integer return", async function () {
					var called = false;
					
					var endpoint = "/test/" + Zotero.Utilities.randomString();
					var handler = function () {};
					handler.prototype = {
						supportedMethods: ["POST"],
						supportedDataTypes: "*",
						
						init: function (options) {
							called = true;
							assert.isObject(options);
							assert.propertyVal(options.headers, "Accept-Charset", "UTF-8");
							return 204;
						}
					};
					Zotero.Server.Endpoints[endpoint] = handler;
					
					let req = await Zotero.HTTP.request(
						"POST",
						serverPath + endpoint,
						{
							headers: {
								"Accept-Charset": "UTF-8",
								"Content-Type": "application/json"
							},
							responseType: "text",
							body: JSON.stringify({
								foo: "bar"
							})
						}
					);
					
					assert.ok(called);
					assert.equal(req.status, 204);
				});
				
				it("array return", async function () {
					var called = false;
					
					var endpoint = "/test/" + Zotero.Utilities.randomString();
					var handler = function () {};
					handler.prototype = {
						supportedMethods: ["GET"],
						supportedDataTypes: "*",
						
						init: function (options) {
							called = true;
							assert.isObject(options);
							return [201, "text/plain", "Test"];
						}
					};
					Zotero.Server.Endpoints[endpoint] = handler;
					
					let req = await Zotero.HTTP.request(
						"GET",
						serverPath + endpoint,
						{
							responseType: "text"
						}
					);
					
					assert.ok(called);
					assert.equal(req.status, 201);
					assert.equal(req.getResponseHeader("Content-Type"), "text/plain");
					assert.equal(req.responseText, "Test");
				});
				
				it("integer promise return", async function () {
					var called = false;
					
					var endpoint = "/test/" + Zotero.Utilities.randomString();
					var handler = function () {};
					handler.prototype = {
						supportedMethods: ["GET"],
						supportedDataTypes: "*",
						
						init: async function (options) {
							called = true;
							assert.isObject(options);
							return 204;
						}
					};
					Zotero.Server.Endpoints[endpoint] = handler;
					
					let req = await Zotero.HTTP.request(
						"GET",
						serverPath + endpoint,
						{
							responseType: "text"
						}
					);
					
					assert.ok(called);
					assert.equal(req.status, 204);
				});
				
				it("array promise return", async function () {
					var called = false;
					
					var endpoint = "/test/" + Zotero.Utilities.randomString();
					var handler = function () {};
					handler.prototype = {
						supportedMethods: ["GET"],
						supportedDataTypes: "*",
						
						init: async function (options) {
							called = true;
							assert.isObject(options);
							return [201, "text/plain", "Test"];
						}
					};
					Zotero.Server.Endpoints[endpoint] = handler;
					
					let req = await Zotero.HTTP.request(
						"GET",
						serverPath + endpoint,
						{
							responseType: "text"
						}
					);
					
					assert.ok(called);
					assert.equal(req.status, 201);
					assert.equal(req.getResponseHeader("Content-Type"), "text/plain");
					assert.equal(req.responseText, "Test");
				});
			});
			
			describe("multipart/form-data", function () {
				it("should support text", async function () {
					var called = false;
					var endpoint = "/test/" + Zotero.Utilities.randomString();

					Zotero.Server.Endpoints[endpoint] = function () {};
					Zotero.Server.Endpoints[endpoint].prototype = {
						supportedMethods: ["POST"],
						supportedDataTypes: ["multipart/form-data"],
						
						init: function (options) {
							called = true;
							assert.isObject(options);
							assert.property(options.headers, "Content-Type");
							assert(options.headers["Content-Type"].startsWith("multipart/form-data; boundary="));
							assert.isArray(options.data);
							assert.equal(options.data.length, 1);
							
							let expected = {
								header: "Content-Disposition: form-data; name=\"foo\"",
								body: "bar",
								params: {
									name: "foo"
								}
							};
							assert.deepEqual(options.data[0], expected);
							return 204;
						}
					};

					let formData = new FormData();
					formData.append("foo", "bar");

					let req = await Zotero.HTTP.request(
						"POST",
						serverPath + endpoint,
						{
							headers: {
								"Content-Type": "multipart/form-data"
							},
							body: formData
						}
					);

					assert.ok(called);
					assert.equal(req.status, 204);
				});
				
				it("should support binary", async function () {
					let called = false;
					let endpoint = "/test/" + Zotero.Utilities.randomString();
					let file = getTestDataDirectory();
					file.append('test.png');
					let contents = await Zotero.File.getBinaryContentsAsync(file);

					Zotero.Server.Endpoints[endpoint] = function () {};
					Zotero.Server.Endpoints[endpoint].prototype = {
						supportedMethods: ["POST"],
						supportedDataTypes: ["multipart/form-data"],
						
						init: function (options) {
							called = true;
							assert.isObject(options);
							assert.property(options.headers, "Content-Type");
							assert(options.headers["Content-Type"].startsWith("multipart/form-data; boundary="));
							assert.isArray(options.data);
							assert.equal(options.data.length, 1);
							assert.equal(options.data[0].header, "Content-Disposition: form-data; name=\"image\"; filename=\"test.png\"\r\nContent-Type: image/png");
							let expected = {
								name: "image",
								filename: "test.png",
								contentType: "image/png"
							};
							assert.deepEqual(options.data[0].params, expected);
							assert.equal(options.data[0].body, contents);
							
							return 204;
						}
					};

					let image = await File.createFromFileName(OS.Path.join(getTestDataDirectory().path, 'test.png'));
					let formData = new FormData();
					formData.append("image", image);

					let req = await Zotero.HTTP.request(
						"POST",
						serverPath + endpoint,
						{
							headers: {
								"Content-Type": "multipart/form-data"
							},
							body: formData
						}
					);

					assert.ok(called);
					assert.equal(req.status, 204);
				});

				it("should support an empty body", async function () {
					var called = false;
					var endpoint = "/test/" + Zotero.Utilities.randomString();

					Zotero.Server.Endpoints[endpoint] = function () {};
					Zotero.Server.Endpoints[endpoint].prototype = {
						supportedMethods: ["POST"],
						supportedDataTypes: ["multipart/form-data"],

						init: function (options) {
							called = true;
							assert.isObject(options);
							assert.property(options.headers, "Content-Type");
							assert(options.headers["Content-Type"].startsWith("multipart/form-data; boundary="));
							assert.isArray(options.data);
							assert.equal(options.data.length, 1);

							let expected = {
								header: "Content-Disposition: form-data; name=\"foo\"",
								body: "",
								params: {
									name: "foo"
								}
							};
							assert.deepEqual(options.data[0], expected);
							return 204;
						}
					};

					let formData = new FormData();
					formData.append("foo", "");

					let req = await Zotero.HTTP.request(
						"POST",
						serverPath + endpoint,
						{
							headers: {
								"Content-Type": "multipart/form-data"
							},
							body: formData
						}
					);

					assert.ok(called);
					assert.equal(req.status, 204);
				});
			});
			describe("application/pdf", function () {
				it('should provide a stream', async function () {
					let called = false;
					let endpoint = "/test/" + Zotero.Utilities.randomString();
					let file = getTestDataDirectory();
					file.append('test.pdf');
					let contents = await Zotero.File.getBinaryContentsAsync(file);

					Zotero.Server.Endpoints[endpoint] = function () {};
					Zotero.Server.Endpoints[endpoint].prototype = {
						supportedMethods: ["POST"],
						supportedDataTypes: ["application/pdf"],

						init: function (options) {
							called = true;
							assert.isObject(options);
							assert.property(options.headers, "Content-Type");
							assert(options.headers["Content-Type"].startsWith("application/pdf"));
							assert.isFunction(options.data.available);
							let data = NetUtil.readInputStreamToString(options.data, options.headers['content-length']);
							assert.equal(data, contents);

							return 204;
						}
					};

					let pdf = await File.createFromFileName(OS.Path.join(getTestDataDirectory().path, 'test.pdf'));

					let req = await Zotero.HTTP.request(
						"POST",
						serverPath + endpoint,
						{
							headers: {
								"Content-Type": "application/pdf",
							},
							body: pdf
						}
					);

					assert.ok(called);
					assert.equal(req.status, 204);
				});

				it('should decode UTF-8 quoted-printable encoded custom headers', async function () {
					let called = false;
					let endpoint = "/test/" + Zotero.Utilities.randomString();
					let file = getTestDataDirectory();
					file.append('test.pdf');

					// Create RFC 2047 Q-encoded header value
					let originalText = "Hello 🌐";
					
					// Convert to UTF-8 bytes then Q-encode
					const utf8Bytes = new TextEncoder().encode(originalText);
					let encoded = '';
					
					for (let byte of utf8Bytes) {
						// Encode spaces as underscores, other special chars as =XX
						if (byte === 32) { // space
							encoded += '_';
						}
						else if (byte >= 33 && byte <= 126 && byte !== 61 && byte !== 63 && byte !== 95) {
							// Printable ASCII except =, ?, _
							encoded += String.fromCharCode(byte);
						}
						else {
							encoded += '=' + byte.toString(16).toUpperCase().padStart(2, '0');
						}
					}
					let rfc2047Header = `=?utf-8?Q?${encoded}?=`;

					Zotero.Server.Endpoints[endpoint] = function () {};
					Zotero.Server.Endpoints[endpoint].prototype = {
						supportedMethods: ["POST"],
						supportedDataTypes: ["application/pdf"],

						init: function (options) {
							called = true;
							assert.isObject(options);
							assert.property(options.headers, "custom-header");
							// The encoded header should decode back to the original text
							assert.equal(options.headers["custom-header"], originalText);

							return 204;
						}
					};

					let pdf = await File.createFromFileName(OS.Path.join(getTestDataDirectory().path, 'test.pdf'));

					let req = await Zotero.HTTP.request(
						"POST",
						serverPath + endpoint,
						{
							headers: {
								"Content-Type": "application/pdf",
								// Use the dynamically created RFC 2047 Q-encoded header
								"Custom-Header": rfc2047Header
							},
							body: pdf
						}
					);

					assert.ok(called);
					assert.equal(req.status, 204);
				});
			});
		});
	});
});
