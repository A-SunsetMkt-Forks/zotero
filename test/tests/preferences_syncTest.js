describe("Sync Preferences", function () {
	var win, doc;
	before(function* () {
		// Load prefs with sync pane
		win = yield loadWindow("chrome://zotero/content/preferences/preferences.xhtml", {
			pane: 'zotero-prefpane-sync'
		});
		doc = win.document;
		yield win.Zotero_Preferences.waitForFirstPaneLoad();
	});

	after(function () {
		win.close();
	});

	describe("Settings", function () {
		describe("Data Syncing", function () {
			var getAPIKeyFromCredentialsStub, deleteAPIKey, indicatorElem, apiKey, apiResponse;

			var setCredentials = async function (username, password, isIncorrectPasword) {
				let usernameElem = doc.getElementById('sync-username-textbox');
				let passwordElem = doc.getElementById('sync-password');
				usernameElem.value = username;
				passwordElem.value = password;
				
				apiKey = Zotero.Utilities.randomString(24);
				apiResponse = {
					key: apiKey,
					username,
					userID: 1,
					access: {}
				};
				
				// Triggered by `change` event for usernameElem and passwordElem
				if (isIncorrectPasword) {
					getAPIKeyFromCredentialsStub.resolves(false);
				}
				else {
					getAPIKeyFromCredentialsStub.resolves(apiResponse);
				}
				await win.Zotero_Preferences.Sync.linkAccount();
			};

			before(function* () {
				getAPIKeyFromCredentialsStub = sinon.stub(
						Zotero.Sync.APIClient.prototype, 'createAPIKeyFromCredentials');
				deleteAPIKey = sinon.stub(Zotero.Sync.APIClient.prototype, 'deleteAPIKey').resolves();
				indicatorElem = doc.getElementById('sync-status-indicator')
				sinon.stub(Zotero, 'alert');
			});

			beforeEach(function* (){
				yield win.Zotero_Preferences.Sync.unlinkAccount(false);
				deleteAPIKey.resetHistory();
				Zotero.alert.reset();
			});
			
			after(function () {
				Zotero.HTTP.mock = null;
				Zotero.alert.restore();
				getAPIKeyFromCredentialsStub.restore();
				deleteAPIKey.restore();
			});

			it("should set API key and display full controls with correct credentials", async function () {
				await setCredentials("Username", "correctPassword");
				
				assert.equal(await Zotero.Sync.Data.Local.getAPIKey(), apiKey);
				assert.equal(doc.getElementById('sync-unauthorized').getAttribute('hidden'), 'true');
			});


			it("should display dialog when credentials incorrect", async function () {
				await setCredentials("Username", "incorrectPassword", true);

				assert.isTrue(Zotero.alert.called);
				assert.equal(await Zotero.Sync.Data.Local.getAPIKey(), "");
				assert.equal(doc.getElementById('sync-authorized').getAttribute('hidden'), 'true');
			});


			it("should delete API key and display auth form when 'Unlink Account' clicked", async function () {
				await setCredentials("Username", "correctPassword");
				assert.equal(await Zotero.Sync.Data.Local.getAPIKey(), apiKey);

				await win.Zotero_Preferences.Sync.unlinkAccount(false);

				assert.isTrue(deleteAPIKey.called);
				assert.equal(await Zotero.Sync.Data.Local.getAPIKey(), "");
				assert.equal(doc.getElementById('sync-authorized').getAttribute('hidden'), 'true');
			});
			
			it("should reset the storage controller when unlinking", async function () {
				await setCredentials("Username", "correctPassword");
				assert.equal(await Zotero.Sync.Data.Local.getAPIKey(), apiKey);
				
				var options = {
					apiClient: Zotero.Sync.Runner.getAPIClient({ apiKey })
				};
				var controller = Zotero.Sync.Runner.getStorageController('zfs', options);
				var apiKey1 = controller.apiClient.apiKey;
				
				await win.Zotero_Preferences.Sync.unlinkAccount(false);
				await setCredentials("Username", "correctPassword");
				
				options = {
					apiClient: Zotero.Sync.Runner.getAPIClient({ apiKey })
				};
				controller = Zotero.Sync.Runner.getStorageController('zfs', options);
				assert.notEqual(controller.apiClient.apiKey, apiKey1);
			});
			
			it("should not unlink on pressing cancel", async function () {
				await setCredentials("Username", "correctPassword");
				
				waitForDialog(null, 'cancel');
				
				await win.Zotero_Preferences.Sync.unlinkAccount();
				assert.equal(await Zotero.Sync.Data.Local.getAPIKey(), apiKey);
				assert.equal(doc.getElementById('sync-unauthorized').getAttribute('hidden'), 'true');
			});
			
			it("should clear sync errors from the toolbar after logging in", async function () {
				let win = await loadZoteroPane();
				
				let syncError = win.document.getElementById('zotero-tb-sync-error');
				
				Zotero.Sync.Runner.updateIcons(new Error("a sync error"));
				assert.isFalse(syncError.hidden);

				getAPIKeyFromCredentialsStub.resolves(apiResponse);
				await setCredentials("Username", "correctPassword");
				assert.isTrue(syncError.hidden);

				win.close();
			});
		})
	})
})

