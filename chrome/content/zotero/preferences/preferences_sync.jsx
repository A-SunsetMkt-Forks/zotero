/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2008–2013 Center for History and New Media
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

"use strict";

const { ZOTERO_CONFIG } = ChromeUtils.importESModule('resource://zotero/config.mjs');
var React = require('react');
var ReactDOM = require('react-dom');
var VirtualizedTable = require('components/virtualized-table');
var { renderCell } = VirtualizedTable;

Zotero_Preferences.Sync = {
	checkmarkChar: '\u2705',
	noChar: '\uD83D\uDEAB',
	
	init: async function () {
		this.storeLastStorageSettings();
		this.updateStorageSettingsUI();
		this.updateStorageSettingsGroupsUI();

		var username = Zotero.Users.getCurrentUsername() || Zotero.Prefs.get('sync.server.username') || " ";
		var apiKey = await Zotero.Sync.Data.Local.getAPIKey();
		this.displayFields(apiKey ? username : "");
		
		var pass = await Zotero.Sync.Runner.getStorageController('webdav').getPassword();
		if (pass) {
			document.getElementById('storage-password').value = pass;
		}
		
		if (apiKey) {
			try {
				var keyInfo = await Zotero.Sync.Runner.checkAccess(
					Zotero.Sync.Runner.getAPIClient({apiKey}),
					{timeout: 5000}
				);
				this.displayFields(keyInfo.username);
			}
			catch (e) {
				// API key wrong/invalid
				if (e instanceof Zotero.Error && e.error == Zotero.Error.ERROR_API_KEY_INVALID) {
					Zotero.alert(
						window,
						Zotero.getString('general.error'),
						Zotero.getString('sync.error.apiKeyInvalid', Zotero.clientName)
					);
					this.unlinkAccount(false);
				}
				else {
					throw e;
				}
			}
		}

		document.getElementById('storage-url-prefix').addEventListener('synctopreference', () => {
			this.unverifyStorageServer();
		});
	},
	
	displayFields: function (username) {
		document.getElementById('sync-unauthorized').hidden = !!username;
		document.getElementById('sync-authorized').hidden = !username;
		document.getElementById('sync-reset').hidden = !username;
		document.getElementById('sync-username').value = username;
		document.getElementById('sync-password').value = '';
		document.getElementById('sync-username-textbox').value = Zotero.Prefs.get('sync.server.username');

		var img = document.getElementById('sync-status-indicator');
		img.removeAttribute('verified');
		img.removeAttribute('animated');
	},


	credentialsChange: function (_event) {
		var username = document.getElementById('sync-username-textbox');
		var password = document.getElementById('sync-password');
		var syncAuthButton = document.getElementById('sync-auth-button');
		
		syncAuthButton.setAttribute('disabled', !(username.value.length && password.value.length));
	},
	
	
	credentialsKeyPress: function (event) {
		if (event.keyCode == 13) {
			this.linkAccount(event);
			event.preventDefault();
		}
	},
	
	
	trimUsername: function () {
		var tb = document.getElementById('sync-username-textbox');
		var username = tb.value;
		var trimmed = username.trim();
		if (username != trimmed) {
			tb.value = trimmed;
		}
	},
	
	
	_secmodDeleted: false,
	linkAccount: async function(event) {
		this.trimUsername();
		var username = document.getElementById('sync-username-textbox').value;
		var password = document.getElementById('sync-password').value;

		if (!username.length || !password.length) {
			this.updateSyncIndicator();
			return;
		}

		// Try to acquire API key with current credentials
		this.updateSyncIndicator('animated');
		try {
			var json = await Zotero.Sync.Runner.createAPIKeyFromCredentials(username, password);
		}
		catch (e) {
			// On "User canceled primary password entry", delete secmod.db and restart
			//
			// It seems like this can happen when people have a very old profile directory (e.g.,
			// from 2013 in 2024)
			if (e.message.includes("User canceled primary password entry")) {
				Zotero.logError(e);
				let profileDir = Zotero.Profile.dir;
				let secmodPath = PathUtils.join(profileDir, 'secmod.db');
				if (!this._secmodDeleted && !((await IOUtils.exists(secmodPath)))) {
					Zotero.debug("secmod.db doesn't exist");
					setTimeout(function () {
						Zotero.Sync.Runner.alert(e);
					});
					throw e;
				}
				Zotero.debug("Deleting secmod.db", 2);
				await IOUtils.remove(secmodPath);
				// Once we've deleted, keep showing the restart message
				this._secmodDeleted = true;
				
				let index = Zotero.Prompt.confirm({
					title: Zotero.getString('general.restartRequired'),
					text: "Login information could not be saved.\n\n"
						+ Zotero.getString('general.pleaseRestartAndTryAgain', Zotero.appName),
					button0: Zotero.getString('general.restartNow'),
					button1: Services.prompt.BUTTON_TITLE_CANCEL
				});
				
				if (index == 0) {
					Zotero.Utilities.Internal.quit(true);
					return;
				}
				return;
			}
			
			setTimeout(function () {
				Zotero.Sync.Runner.alert(e);
			});
			throw e;
		}
		finally {
			this.updateSyncIndicator();
		}
		
		// Invalid credentials
		if (!json) {
			Zotero.alert(window,
				Zotero.getString('general.error'),
				Zotero.getString('sync.error.invalidLogin')
			);
			return;
		}
		
		var ok = await Zotero.Sync.Data.Local.checkUser(
			window,
			json.userID,
			json.username,
			json.displayName
		);
		if (!ok) {
			// createAPIKeyFromCredentials will have created an API key,
			// but user decided not to use it, so we remove it here.
			Zotero.Sync.Runner.deleteAPIKey();
			return;
		}

		Zotero.Prefs.set('sync.server.username', username);

		// It shouldn't be possible for a sync to be in progress if the user wasn't logged in,
		// but check to be sure
		if (!Zotero.Sync.Runner.syncInProgress) {
			// Clear any displayed sync errors
			Zotero.Sync.Runner.updateIcons([]);
		}
		window.addEventListener('beforeunload', () => {
			Zotero.Sync.Runner.setSyncTimeout(1);
		});
		
		this.displayFields(json.username);
	},

	/**
	 * Updates the auth indicator icon, depending on status
	 * @param {string} status
	 */
	updateSyncIndicator: function (status) {
		var img = document.getElementById('sync-status-indicator');
		
		img.removeAttribute('animated');
		if (status == 'animated') {
			img.setAttribute('animated', true);
		}
	},

	unlinkAccount: async function(showAlert=true) {
		if (showAlert) {
			var check = {value: false};
			var ps = Services.prompt;
			var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING) +
				(ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
			var index = ps.confirmEx(
				null,
				Zotero.getString('general.warning'),
				Zotero.getString('account.unlinkWarning', Zotero.clientName),
				buttonFlags,
				Zotero.getString('account.unlinkWarning.button'), null, null,
				Zotero.getString('account.unlinkWarning.removeData', Zotero.clientName),
				check
			);
			if (index == 0) {
				if (check.value) {
					var resetDataDirFile = PathUtils.join(Zotero.DataDirectory.dir, 'reset-data-directory');
					await Zotero.File.putContentsAsync(resetDataDirFile, '');

					await Zotero.Sync.Runner.deleteAPIKey();
					Zotero.Prefs.clear('sync.server.username');
					return Zotero.Utilities.Internal.quitZotero(true);
				}
			} else {
				return;
			}
		}

		this.displayFields();
		Zotero.Prefs.clear('sync.librariesToSync');
		await Zotero.Sync.Runner.deleteAPIKey();
	},
	
	
	showLibrariesToSyncDialog: function() {
		var io = {};
		window.openDialog('chrome://zotero/content/preferences/librariesToSync.xhtml',
			"zotero-preferences-librariesToSyncDialog", "chrome,modal,centerscreen", io);
	},
	
	
	toggleLibraryToSync: function (index) {
		if (typeof index != "number") {
			index = this._tree.selection.focused;
		}
		if (index == -1 || !this._rows[index].editable) return;
		const row = this._rows[index];
		this._rows[index].checked = !this._rows[index].checked;
		this._tree.invalidateRow(index);
		
		var librariesToSkip = JSON.parse(Zotero.Prefs.get('sync.librariesToSkip') || '[]');
		var indexOfId = librariesToSkip.indexOf(row.id);
		if (indexOfId == -1) {
			librariesToSkip.push(row.id);
		}
		else {
			librariesToSkip.splice(indexOfId, 1);
		}
		Zotero.Prefs.set('sync.librariesToSkip', JSON.stringify(librariesToSkip));
	},
	
	
	initLibrariesToSync: async function () {
		const columns = [
			{
				dataKey: "checked",
				label: "zotero.preferences.sync.librariesToSync.sync",
				fixedWidth: true,
				// TODO: Specify in ems?
				width: '50'
			},
			{
				dataKey: "name",
				label: "zotero.preferences.sync.librariesToSync.library"
			}
		];
		this._rows = [];
		let renderItem = (index, selection, oldDiv=null, columns) => {
			const row = this._rows[index];
			let div;
			if (oldDiv) {
				div = oldDiv;
				div.innerHTML = "";
			}
			else {
				div = document.createElement('div');
				div.className = "row";
				div.addEventListener('dblclick', () => {
					this.toggleLibraryToSync(index);
				});
			}
			div.classList.toggle('selected', selection.isSelected(index));

			for (let column of columns) {
				if (column.dataKey === 'checked') {
					let span = document.createElement('span');
					span.className = `cell ${column.className}`;
					if (row.id != 'loading') {
						span.innerText = row.checked ? this.checkmarkChar : this.noChar;
						span.style.textAlign = 'center';
					}
					span.addEventListener('mousedown', () => {
						this.toggleLibraryToSync(index);
					});
					span.style.pointerEvents = 'initial';
					div.appendChild(span);
				}
				else {
					div.appendChild(renderCell(index, row[column.dataKey], column));
				}
			}
			return div;
		}
		let handleKeyDown = (e) => {
			if (e.key == ' ') {
				this.toggleLibraryToSync();
				return false;
			}
		};
		await new Promise((resolve) => {
			ReactDOM.createRoot(document.getElementById("libraries-to-sync-tree")).render(
				<VirtualizedTable
					getRowCount={() => this._rows.length}
					id="librariesToSync-table"
					ref={(ref) => {
						this._tree = ref;
						resolve();
					}}
					renderItem={renderItem}
					showHeader={true}
					columns={columns}
					staticColumns={true}
					getRowString={index => this._rows[index].name}
					disableFontSizeScaling={true}
					onKeyDown={handleKeyDown}
				/>
			);
		});
		
		var addRow = function (libraryName, id, checked=false, editable=true) {
			this._rows.push({
				name: libraryName,
				id,
				checked,
				editable
			});
			this._tree.invalidate();
		}.bind(this);
		
		// Add loading row while we're loading a group list
		var loadingLabel = Zotero.getString("zotero.preferences.sync.librariesToSync.loadingLibraries");
		addRow(loadingLabel, "loading", false, false);

		var apiKey = await Zotero.Sync.Data.Local.getAPIKey();
		var client = Zotero.Sync.Runner.getAPIClient({ apiKey });
		var groups = [];
		try {
			// Load up remote groups
			var keyInfo = await Zotero.Sync.Runner.checkAccess(client, {timeout: 5000});
			groups = await client.getGroups(keyInfo.userID);
		}
		catch (e) {
			// Connection problems
			if ((e instanceof Zotero.HTTP.UnexpectedStatusException)
					|| (e instanceof Zotero.HTTP.TimeoutException)
					|| (e instanceof Zotero.HTTP.BrowserOfflineException)) {
				Zotero.alert(
					window,
					Zotero.getString('general.error'),
					Zotero.getString('sync.error.checkConnection', Zotero.clientName)
				);
			}
			else {
				throw e;
			}
			document.getElementsByTagName('dialog')[0].acceptDialog();
		}

		// Remove the loading row
		this._rows = [];
		this._tree.invalidate();

		var librariesToSkip = JSON.parse(Zotero.Prefs.get('sync.librariesToSkip') || '[]');
		// Add default rows
		addRow(Zotero.getString("pane.collections.libraryAndFeeds"), "L" + Zotero.Libraries.userLibraryID,
			librariesToSkip.indexOf("L" + Zotero.Libraries.userLibraryID) == -1);
		
		// Sort groups
		var collation = Zotero.getLocaleCollation();
		groups.sort((a, b) => collation.compareString(1, a.data.name, b.data.name));
		// Add group rows
		for (let group of groups) {
			addRow(group.data.name, "G" + group.id, librariesToSkip.indexOf("G" + group.id) == -1);
		}
	},
	
	
	_lastStorageProtocol: null,
	_lastStorageURL: null,
	
	storeLastStorageSettings: function () {
		this._lastStorageProtocol = Zotero.Prefs.get('sync.storage.protocol');
		this._lastStorageURL = Zotero.Prefs.get('sync.storage.url');
	},
	
	
	updateStorageSettingsUI: async function() {
		this.unverifyStorageServer();
		
		var protocol = Zotero.Prefs.get('sync.storage.protocol');
		var enabled = Zotero.Prefs.get('sync.storage.enabled');
		
		var storageSettings = document.getElementById('storage-settings');
		var protocolMenu = document.getElementById('storage-protocol');
		var settings = document.getElementById('storage-webdav-settings');
		var sep = document.getElementById('storage-separator');
		
		if (!enabled || protocol == 'zotero') {
			settings.hidden = true;
			sep.hidden = false;
		}
		else {
			settings.hidden = false;
			sep.hidden = true;
		}
		
		document.getElementById('storage-user-download-mode').disabled = !enabled;
		this.updateStorageTerms();
	},
	
	
	updateStorageSettingsGroupsUI: function () {
		setTimeout(() => {
			var enabled = Zotero.Prefs.get('sync.storage.groups.enabled');
			document.getElementById('storage-groups-download-mode').disabled = !enabled;
			this.updateStorageTerms();
		});
	},
	
	
	updateStorageTerms: function () {
		var terms = document.getElementById('storage-terms');
		
		var libraryEnabled = Zotero.Prefs.get('sync.storage.enabled');
		var storageProtocol = Zotero.Prefs.get('sync.storage.protocol');
		var groupsEnabled = Zotero.Prefs.get('sync.storage.groups.enabled');
		
		terms.hidden = !((libraryEnabled && storageProtocol == 'zotero') || groupsEnabled);
	},
	
	
	onStorageSettingsKeyPress: async function(event) {
		if (event.keyCode == 13) {
			await this.verifyStorageServer();
		}
	},
	
	
	onStorageSettingsChange: async function() {
		var oldProtocol = this._lastStorageProtocol;
		var oldURL = this._lastStorageURL;
		
		// Necessary for pref to update
		await Zotero.Promise.delay(1);
		var newProtocol = Zotero.Prefs.get('sync.storage.protocol');
		
		var newURL = Zotero.Prefs.get('sync.storage.url').trim()
			// Strip scheme, leading '://' or '//' (#3483), and trailing '/zotero'
			.replace(/(^https?:\/\/|^:?\/\/|\/zotero\/?$|\/$)/g, '')
		Zotero.Prefs.set('sync.storage.url', newURL);
		
		if (oldProtocol != newProtocol || oldURL != newURL) {
			await Zotero.Sync.Storage.Local.resetAllSyncStates(Zotero.Libraries.userLibraryID);
		}
		
		if (oldProtocol == 'webdav') {
			this.unverifyStorageServer();
			// The controller is getting replaced anyway, but this removes the WebDAV URL from
			// Zotero.HTTP.CookieBlocker
			Zotero.Sync.Runner.getStorageController('webdav').clearCachedCredentials();
			Zotero.Sync.Runner.resetStorageController(oldProtocol);
			
			var username = document.getElementById('storage-username').value;
			var password = document.getElementById('storage-password').value;
			if (username) {
				// Get a new controller
				await Zotero.Sync.Runner.getStorageController('webdav').setPassword(password);
			}
		}
		
		if (oldProtocol == 'zotero' && newProtocol == 'webdav') {
			var sql = "SELECT COUNT(*) FROM settings "
				+ "WHERE setting='storage' AND key='zfsPurge' AND value='user'";
			if (!Zotero.DB.valueQueryAsync(sql)) {
				var account = Zotero.Sync.Server.username;
				var index = Zotero.Prompt.confirm({
					title: Zotero.getString('zotero.preferences.sync.purgeStorage.title'),
					text: Zotero.getString('zotero.preferences.sync.purgeStorage.desc'),
					button0: Zotero.getString('zotero.preferences.sync.purgeStorage.confirmButton'),
					button1: Zotero.getString('zotero.preferences.sync.purgeStorage.cancelButton'),
					buttonDelay: true,
				});
				
				if (index == 0) {
					var sql = "INSERT OR IGNORE INTO settings VALUES (?,?,?)";
					await Zotero.DB.queryAsync(sql, ['storage', 'zfsPurge', 'user']);
					
					try {
						await Zotero.Sync.Storage.ZFS.purgeDeletedStorageFiles();
						Services.prompt.alert(
							null,
							Zotero.getString("general.success"),
							"Attachment files from your personal library have been removed from the Zotero servers."
						);
					}
					catch (e) {
						Zotero.logError(e);
						Services.prompt.alert(
							null,
							Zotero.getString("general.error"),
							"An error occurred. Please try again later."
						);
					}
				}
			}
		}
		
		this.updateStorageSettingsUI();
		this.storeLastStorageSettings();
	},
	
	
	verifyStorageServer: async function() {
		// onchange weirdly isn't triggered when clicking straight from a field to the button,
		// so we have to trigger this here (and we don't trigger it for Enter in
		// onStorageSettingsKeyPress()).
		await this.onStorageSettingsChange();
		
		Zotero.debug("Verifying storage");
		
		var verifyButton = document.getElementById("storage-verify");
		var abortButton = document.getElementById("storage-abort");
		var progressMeter = document.getElementById("storage-progress");
		var urlField = document.getElementById("storage-url");
		var usernameField = document.getElementById("storage-username");
		var passwordField = document.getElementById("storage-password");
		
		// These don't get set until window close on Windows/Linux (no instantApply),
		// so set them explicitly when verifying
		Zotero.Prefs.set('sync.storage.url', urlField.value);
		Zotero.Prefs.set('sync.storage.username', usernameField.value);
		
		verifyButton.hidden = true;
		abortButton.hidden = false;
		progressMeter.hidden = false;
		
		var success = false;
		var request = null;
		
		var controller = Zotero.Sync.Runner.getStorageController('webdav');
		
		try {
			await controller.checkServer({
				// Get the XMLHttpRequest for possible cancelling
				onRequest: r => request = r
			})
			
			success = true;
		}
		catch (e) {
			if (e instanceof controller.VerificationError) {
				switch (e.error) {
				case "NO_URL":
					urlField.focus();
					break;
				
				case "NO_USERNAME":
					usernameField.focus();
					break;
				
				case "NO_PASSWORD":
				case "AUTH_FAILED":
					passwordField.focus();
					break;
				}
			}
			success = await controller.handleVerificationError(e);
		}
		finally {
			verifyButton.hidden = false;
			abortButton.hidden = true;
			progressMeter.hidden = true;
		}
		
		if (success) {
			Zotero.debug("WebDAV verification succeeded");
			
			Zotero.alert(
				window,
				Zotero.getString('sync.storage.serverConfigurationVerified'),
				Zotero.getString('sync.storage.fileSyncSetUp')
			);
		}
		else {
			Zotero.logError("WebDAV verification failed");
		}
		
		abortButton.onclick = function () {
			if (request) {
				Zotero.debug("Cancelling verification request");
				request.onreadystatechange = undefined;
				request.abort();
				verifyButton.hidden = false;
				abortButton.hidden = true;
				progressMeter.hidden = true;
			}
		}
	},
	
	
	unverifyStorageServer: function () {
		Zotero.debug("Unverifying storage");
		Zotero.Prefs.set('sync.storage.verified', false);
	},
	
	
	//
	// Reset pane
	//
	initResetPane: function () {
		//
		// Build library selector
		//
		var libraryMenu = document.getElementById('sync-reset-library-menu');
		// Some options need to be disabled when certain libraries are selected
		libraryMenu.onchange = (event) => {
			this.onResetLibraryChange(parseInt(event.target.value));
		}
		this.onResetLibraryChange(Zotero.Libraries.userLibraryID);
		document.querySelectorAll('#sync-reset-radiogroup radio')
			.forEach(radio => radio.removeAttribute('selected'));
		var libraries = Zotero.Libraries.getAll()
			.filter(x => x.libraryType == 'user' || x.libraryType == 'group');
		Zotero.Utilities.Internal.buildLibraryMenu(libraryMenu, libraries);
		// Disable read-only libraries, at least until there are options that make sense for those
		Array.from(libraryMenu.querySelectorAll('menuitem'))
			.filter(x => x.getAttribute('data-editable') == 'false')
			.forEach(x => x.disabled = true);
		
		for (let row of document.querySelectorAll('#sync-reset-radiogroup > *')) {
			row.addEventListener('click', function (event) {
				// Ignore clicks if disabled
				if (this.hasAttribute('disabled')) {
					event.stopPropagation();
					return;
				}
				document.getElementById('sync-reset-button').disabled = false;
			});
		}
	},
	
	
	onResetLibraryChange: function (libraryID) {
		var library = Zotero.Libraries.get(libraryID);
		var section = document.getElementById('reset-file-sync-history');
		var radio = section.querySelector('radio');
		if (library.filesEditable) {
			section.removeAttribute('disabled');
			radio.disabled = false;
		}
		else {
			section.setAttribute('disabled', '');
			// If radio we're disabling is already selected, select the first one in the list
			// instead
			if (radio.selected) {
				document.querySelector('#sync-reset-radiogroup > div:first-child radio').selected = true;
			}
			radio.disabled = true;
		}
	},
	
	
	reset: async function () {
		var ps = Services.prompt;
		
		if (Zotero.Sync.Runner.syncInProgress) {
			Zotero.alert(
				null,
				Zotero.getString('general.error'),
				Zotero.getString('sync.error.syncInProgress')
					+ "\n\n"
					+ Zotero.getString('general.operationInProgress.waitUntilFinishedAndTryAgain')
			);
			return;
		}
		
		var libraryID = document.getElementById('sync-reset-library-menu').value;
		var library = Zotero.Libraries.get(libraryID);
		var action = Array.from(document.querySelectorAll('#sync-reset-radiogroup radio'))
			.filter(x => x.selected)[0]
			.getAttribute('value');
		
		switch (action) {
			/*case 'full-sync':
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
					+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
					+ ps.BUTTON_POS_1_DEFAULT;
				var index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					// TODO: localize
					"On the next sync, Zotero will compare all local and remote data and merge any "
						+ "data that does not exist in both locations.\n\n"
						+ "This option is not necessary during normal usage and should "
						+ "generally be used only to troubleshoot specific issues as recommended "
						+ "by Zotero support staff.",
					buttonFlags,
					Zotero.getString('general.reset'),
					null, null, null, {}
				);
				
				switch (index) {
				case 0:
					let libraries = Zotero.Libraries.getAll().filter(library => library.syncable);
					await Zotero.DB.executeTransaction(async function () {
						for (let library of libraries) {
							library.libraryVersion = -1;
							await library.save();
						}
					});
					break;
					
					// Cancel
				case 1:
					return;
				}
				
				break;
			
			case 'restore-from-server':
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
									+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
									+ ps.BUTTON_POS_1_DEFAULT;
				var index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					Zotero.getString('zotero.preferences.sync.reset.restoreFromServer', account),
					buttonFlags,
					Zotero.getString('zotero.preferences.sync.reset.replaceLocalData'),
					null, null, null, {}
				);
				
				switch (index) {
					case 0:
						// TODO: better error handling
						
						// Verify username and password
						var callback = async function () {
							Zotero.Schema.stopRepositoryTimer();
							Zotero.Sync.Runner.clearSyncTimeout();
							
							Zotero.DB.skipBackup = true;
							
							await Zotero.File.putContentsAsync(
								PathUtils.join(Zotero.DataDirectory.dir, 'restore-from-server'),
								''
							);
							
							var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING);
							var index = ps.confirmEx(
								null,
								Zotero.getString('general.restartRequired'),
								Zotero.getString('zotero.preferences.sync.reset.restartToComplete'),
								buttonFlags,
								Zotero.getString('general.restartNow'),
								null, null, null, {}
							);
							
							var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
									.getService(Components.interfaces.nsIAppStartup);
							appStartup.quit(Components.interfaces.nsIAppStartup.eRestart | Components.interfaces.nsIAppStartup.eAttemptQuit);
						};
						
						// TODO: better way of checking for an active session?
						if (Zotero.Sync.Server.sessionIDComponent == 'sessionid=') {
							Zotero.Sync.Server.login()
							.then(callback)
							.done();
						}
						else {
							callback();
						}
						break;
					
					// Cancel
					case 1:
						return;
				}
				break;*/
			
			case 'restore-to-server':
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
					+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
					+ ps.BUTTON_POS_1_DEFAULT;
				var index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					Zotero.getString(
						'zotero.preferences.sync.reset.restoreToServer',
						[Zotero.clientName, library.name, ZOTERO_CONFIG.DOMAIN_NAME]
					),
					buttonFlags,
					Zotero.getString('zotero.preferences.sync.reset.restoreToServer.button'),
					null, null, null, {}
				);
				
				switch (index) {
					case 0:
						var resetButton = document.getElementById('sync-reset-button');
						resetButton.disabled = true;
						try {
							await Zotero.Sync.Runner.sync({
								libraries: [libraryID],
								resetMode: Zotero.Sync.Runner.RESET_MODE_TO_SERVER
							});
						}
						finally {
							resetButton.disabled = false;
						}
						break;
					
					// Cancel
					case 1:
						return;
				}
				
				break;
			
			
			case 'reset-file-sync-history':
				var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
					+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
					+ ps.BUTTON_POS_1_DEFAULT;
				var index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					Zotero.getString(
						'zotero.preferences.sync.reset.fileSyncHistory',
						[Zotero.clientName, library.name]
					),
					buttonFlags,
					Zotero.getString('general.reset'),
					null, null, null, {}
				);
				
				switch (index) {
					case 0:
						await Zotero.Sync.Storage.Local.resetAllSyncStates(libraryID);
						ps.alert(
							null,
							Zotero.getString('general.success'),
							Zotero.getString(
								'zotero.preferences.sync.reset.fileSyncHistory.cleared',
								library.name
							)
						);
						break;
					
					// Cancel
					case 1:
						return;
				}
				
				break;
			
			default:
				throw new Error(`Invalid action '${action}' in handleSyncReset()`);
		}
	}
};
