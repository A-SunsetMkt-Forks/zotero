/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2022 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org
    
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


Zotero.Plugins = new function () {
	var { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
	var lazy = {};
	ChromeUtils.defineESModuleGetters(lazy, {
		XPIDatabase: "resource://gre/modules/addons/XPIDatabase.sys.mjs",
	});
	const { XPCOMUtils } = ChromeUtils.importESModule("resource://gre/modules/XPCOMUtils.sys.mjs");
	XPCOMUtils.defineLazyServiceGetters(lazy, {
		aomStartup: [
			"@mozilla.org/addons/addon-manager-startup;1",
			"amIAddonManagerStartup",
		],
	});
	var scopes = new Map();
	var observers = new Set();
	var addonVersions = new Map();
	var addonL10nSources = new Map();
	
	const REASONS = {
		APP_STARTUP: 1,
		APP_SHUTDOWN: 2,
		ADDON_ENABLE: 3,
		ADDON_DISABLE: 4,
		ADDON_INSTALL: 5,
		ADDON_UNINSTALL: 6,
		ADDON_UPGRADE: 7,
		ADDON_DOWNGRADE: 8,
		MAIN_WINDOW_LOAD: 9,
		MAIN_WINDOW_UNLOAD: 10,
	};
	
	
	this.init = async function () {
		this._addonObserver.init();
		
		// In Fx102, getActiveAddons(["extension"]) doesn't always return fully loaded addon objects
		// if getAllAddons() hasn't been called, so use getAllAddons() and do the checks ourselves
		var addons = await AddonManager.getAllAddons();
		for (let addon of addons) {
			if (addon.type != 'extension') continue;
			let blockedReason = shouldBlockPlugin(addon);
			if (blockedReason || !addon.isActive) {
				continue;
			}
			addonVersions.set(addon.id, addon.version);
			_loadScope(addon);
			setDefaultPrefs(addon);
			await registerLocales(addon);
			await _callMethod(addon, 'startup', REASONS.APP_STARTUP);
		}
		
		Zotero.addShutdownListener(async () => {
			var { addons } = await AddonManager.getActiveAddons(["extension"]);
			for (let addon of addons) {
				await _callMethod(addon, 'shutdown', REASONS.APP_SHUTDOWN);
			}
		});

		const mainWindowListener = {
			onOpenWindow: function (xulWindow) {
				let domWindow = xulWindow.docShell.domWindow;
				async function onload() {
					domWindow.removeEventListener("load", onload, false);
					if (
						domWindow.location.href
						!== "chrome://zotero/content/zoteroPane.xhtml"
					) {
						return;
					}
					let { addons } = await AddonManager.getActiveAddons(["extension"]);
					for (let addon of addons) {
						await _callMethod(addon, 'onMainWindowLoad', REASONS.MAIN_WINDOW_LOAD, { window: domWindow });
					}
				}
				domWindow.addEventListener("load", onload, false);
			},
			onCloseWindow: async function (xulWindow) {
				let domWindow = xulWindow.docShell.domWindow;
				if (
					domWindow.location.href !== "chrome://zotero/content/zoteroPane.xhtml"
				) {
					return;
				}
				let { addons } = await AddonManager.getActiveAddons(["extension"]);
				for (let addon of addons) {
					await _callMethod(addon, 'onMainWindowUnload', REASONS.MAIN_WINDOW_LOAD, { window: domWindow });
				}
			},
		};
		Services.wm.addListener(mainWindowListener);
	};
	
	
	/**
	 * Adapted from loadBootstrapScope() in Firefox 60 ESR
	 *
	 * https://searchfox.org/mozilla-esr60/source/toolkit/mozapps/extensions/internal/XPIProvider.jsm#4233
	 */
	function _loadScope(addon) {
		if (scopes.has(addon.id)) {
			return;
		}
		var scope = new Cu.Sandbox(
			Services.scriptSecurityManager.getSystemPrincipal(),
			{
				sandboxName: addon.id,
				wantGlobalProperties: [
					"atob",
					"btoa",
					"Blob",
					"crypto",
					"CSS",
					"ChromeUtils",
					"DOMParser",
					"fetch",
					"File",
					"FileReader",
					"TextDecoder",
					"TextEncoder",
					"URL",
					"URLSearchParams",
					"XMLHttpRequest"
				]
			}
		);
		for (let name in REASONS) {
			scope[name] = REASONS[name];
		}
		Object.assign(
			scope,
			{
				Zotero,
				ChromeWorker,
				IOUtils,
				Localization,
				PathUtils,
				Services,
				Worker,
				XMLSerializer,
				
				// Add additional global functions
				setTimeout,
				clearTimeout,
				setInterval,
				clearInterval,
				requestIdleCallback,
				cancelIdleCallback,
			}
		);
		
		// fx140: Shim ChromeUtils.import() in the plugin scope
		// TODO: Do we want this?
		scope.ChromeUtils = new Proxy(scope.ChromeUtils, {
			get(target, property, receiver) {
				if (property === 'import') {
					return function (uri) {
						let esmURI = uri.replace('.jsm', uri.includes('/zotero/') ? '.mjs' : '.sys.mjs');
						Zotero.warn('ChromeUtils.import() has been removed. Use importESModule():\n'
							+ `  ChromeUtils.importESModule("${esmURI}");`);
						return receiver.importESModule(esmURI);
					};
				}
				return Reflect.get(target, property, receiver);
			}
		});
		
		scopes.set(addon.id, scope);
		
		try {
			let uri = addon.getResourceURI().spec + 'bootstrap.js';
			Services.scriptloader.loadSubScriptWithOptions(
				uri,
				{
					target: scope,
					ignoreCache: true
				}
			);
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	
	
	/**
	 * Adapted from callBootstrapMethod() in Firefox 60 ESR
	 *
	 * https://searchfox.org/mozilla-esr60/source/toolkit/mozapps/extensions/internal/XPIProvider.jsm#4343
	 */
	async function _callMethod(addon, method, reason, extraParams) {
		try {
			let id = addon.id;
			Zotero.debug(`Calling bootstrap method '${method}' for plugin ${id} `
				+ `version ${addon.version} with reason ${_getReasonName(reason)}`);

			if (addon.softDisabled) {
				Zotero.debug(`Skipping bootstrap method '${method}' for disabled plugin ${id}`);
				return;
			}
			
			let scope = scopes.get(id);
			
			let func;
			try {
				func = scope[method] || Cu.evalInSandbox(`${method};`, scope);
			}
			catch (e) {}
			
			if (!func) {
				Zotero.warn(`Plugin ${id} is missing bootstrap method '${method}'`);
				return;
			}
			
			let params = {
				id: addon.id,
				version: addon.version,
				rootURI: addon.getResourceURI().spec
			};
			if (extraParams) {
				Object.assign(params, extraParams);
			}
			let result;
			try {
				result = func.call(scope, params, reason);
				// If bootstrap method returns a promise, wait for it
				if (result && result.then) {
					await result;
				}
			}
			catch (e) {
				Zotero.logError(`Error running bootstrap method '${method}' on ${id}`);
				Zotero.logError(e);
			}

			for (let observer of observers) {
				if (observer[method]) {
					try {
						let maybePromise = observer[method](params, reason);
						if (maybePromise && maybePromise.then) {
							await maybePromise;
						}
					}
					catch (e) {
						Zotero.logError(e);
					}
				}
			}

			// TODO: Needed?
			/*if (method == "startup") {
				activeAddon.startupPromise = Promise.resolve(result);
				activeAddon.startupPromise.catch(Cu.reportError);
			}*/
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	
	
	function _getReasonName(reason) {
		for (let i in REASONS) {
			if (reason == REASONS[i]) {
				return i;
			}
		}
		return "UNKNOWN";
	}
	
	
	function _unloadScope(id) {
		scopes.delete(id);
	}
	
	
	this.getRootURI = async function (id) {
		var addon = await AddonManager.getAddonByID(id);
		return addon.getResourceURI().spec;
	};
	
	
	/**
	 * Resolve a URI in the context of a plugin. If the passed URI is relative, it will be resolved relative to the
	 * plugin root URI. If it's absolute, it will be returned unchanged.
	 *
	 * @param {String} id Plugin ID
	 * @param {String | URL} uri
	 * @throws {TypeError} On an invalid URI
	 * @return {Promise<String>}
	 */
	this.resolveURI = async function (id, uri) {
		// We can't use addon.getResourceURI(path) here because that only accepts a relative path
		return new URL(uri, await this.getRootURI(id)).href;
	};
	
	
	this.getName = async function (id) {
		var addon = await AddonManager.getAddonByID(id);
		return addon.name;
	};


	this.getAllPluginIDs = async function () {
		let addons = await AddonManager.getAddonsByTypes(["extension"]);
		return addons.map(addon => addon.id);
	}


	/**
	 * @param {String} id
	 * @param {Number} idealSize In logical pixels (scaled automatically on hiDPI displays)
	 * @returns {Promise<String | null>}
	 */
	this.getIconURI = async function (id, idealSize) {
		var addon = await AddonManager.getAddonByID(id);
		return AddonManager.getPreferredIconURL(
			addon,
			idealSize,
			// This window argument is optional, only used for determining
			// whether to get the hiDPI icon.
			// Use the main window (which we always have, except on non-macOS),
			// falling back to the hidden window (which we always have on macOS).
			Zotero.getMainWindow() || Services.appShell.hiddenDOMWindow
		);
	};
	
	
	function setDefaultPrefs(addon) {
		var branch = Services.prefs.getDefaultBranch("");
		var obj = {
			pref(pref, value) {
				switch (typeof value) {
					case 'boolean':
						branch.setBoolPref(pref, value);
						break;
					case 'string':
						branch.setStringPref(pref, value);
						break;
					case 'number':
						branch.setIntPref(pref, value);
						break;
					default:
						Zotero.logError(`Invalid type '${typeof value}' for pref '${pref}'`);
				}
			}
		};
		try {
			Services.scriptloader.loadSubScript(
				addon.getResourceURI("prefs.js").spec,
				obj
			);
		}
		catch (e) {
			if (!e.toString().startsWith('Error opening input stream')) {
				Zotero.logError(e);
			}
		}
	}
	
	
	function clearDefaultPrefs(addon) {
		var branch = Services.prefs.getDefaultBranch("");
		var obj = {
			pref(pref, _value) {
				if (!branch.prefHasUserValue(pref)) {
					branch.deleteBranch(pref);
				}
			}
		};
		try {
			Services.scriptloader.loadSubScript(
				addon.getResourceURI("prefs.js").spec,
				obj
			);
		}
		catch (e) {
			if (!e.toString().startsWith('Error opening input stream')) {
				Zotero.logError(e);
			}
		}
	}
	
	
	/**
	 * Automatically register l10n sources for a plugin.
	 *
	 * A Fluent file located at
	 *   [plugin root]/locale/en-US/make-it-red.ftl
	 * could be included in an XHTML file as
	 *   <link rel="localization" href="make-it-red.ftl"/>
	 *
	 * Locale subdirectories that match Zotero locales (Services.locale.availableLocales)
	 * are registered as is. Other locales are aliased to a best-fit Zotero locale.
	 * For example, Zotero has an 'eu-ES' locale but no 'eu-FR' locale. If a plugin
	 * included an 'eu-FR' locale instead, 'eu-FR' would be aliased to 'eu-ES',
	 * and 'eu-FR' strings would show if the user's Zotero locale is 'eu-ES'.
	 *
	 * If a plugin doesn't have a locale matching the current Zotero locale, 'en-US'
	 * is used as a fallback. If it doesn't have an 'en-*' locale, Fluent chooses a
	 * fallback arbitrarily. For instance, a plugin with only a 'de' locale would
	 * show German strings even if the user's Zotero locale is 'en-US'.
	 *
	 * @param addon
	 * @returns {Promise<void>}
	 */
	async function registerLocales(addon) {
		let rootURI = addon.getResourceURI();
		let zoteroLocales = Services.locale.availableLocales;
		let pluginLocales;
		try {
			pluginLocales = await readDirectory(rootURI, 'locale', true);
			if (!pluginLocales.length) {
				return;
			}
		}
		catch (e) {
			Zotero.logError(e);
			return;
		}
		
		let matchedLocales = [];
		let unmatchedLocales = [];
		for (let pluginLocale of pluginLocales) {
			(zoteroLocales.includes(pluginLocale) ? matchedLocales : unmatchedLocales)
				.push(pluginLocale);
		}
		
		let sources = [];
		// All locales that exactly match a Zotero locale can be registered at once
		if (matchedLocales.length) {
			sources.push(new L10nFileSource(
				addon.id,
				'app',
				matchedLocales,
				// {locale} is replaced with the locale code
				rootURI.spec + 'locale/{locale}/',
			));
		}
		// Other locales need to be registered individually to create aliases
		for (let unmatchedLocale of unmatchedLocales) {
			let resolvedLocale = Zotero.Utilities.Internal.resolveLocale(unmatchedLocale, zoteroLocales);
			// resolveLocale() returns en-US as a fallback; don't use it unless
			// the unmatched plugin locale is en-*
			if (resolvedLocale === 'en-US' && !unmatchedLocale.startsWith('en')) {
				Zotero.debug(`${addon.id}: No matching locale for ${unmatchedLocale}`);
				continue;
			}
			Zotero.debug(`${addon.id}: Aliasing ${unmatchedLocale} to ${resolvedLocale}`);
			if (sources.some(source => source.locales.includes(resolvedLocale))) {
				Zotero.debug(`${addon.id}: ${resolvedLocale} already registered`);
				continue;
			}
			sources.push(new L10nFileSource(
				addon.id + '-' + unmatchedLocale,
				'app',
				[resolvedLocale],
				// Don't use the {locale} placeholder here - manually specify the aliased locale code
				rootURI.spec + `locale/${unmatchedLocale}/`,
			));
		}
		L10nRegistry.getInstance().registerSources(sources);
		addonL10nSources.set(addon.id, sources.map(source => source.name));
	}
	
	
	function unregisterLocales(addon) {
		let sources = addonL10nSources.get(addon.id);
		if (sources) {
			L10nRegistry.getInstance().removeSources(sources);
			addonL10nSources.delete(addon.id);
		}
	}

	/**
	 * Read the contents of a directory in a plugin.
	 * https://searchfox.org/mozilla-esr115/rev/7a83be92b8356ea63559bc3623b2b91a43f2ae05/toolkit/components/extensions/Extension.sys.mjs#882
	 *
	 * @param {nsIURI} rootURI
	 * @param {string} path
	 * @param {boolean} [directoriesOnly=false]
	 * @returns {Promise<string[]>}
	 */
	async function readDirectory(rootURI, path, directoriesOnly = false) {
		if (rootURI instanceof Ci.nsIFileURL) {
			let uri = Services.io.newURI("./" + path, null, rootURI);
			let fullPath = uri.QueryInterface(Ci.nsIFileURL).file.path;

			let results = [];
			try {
				let children = await IOUtils.getChildren(fullPath);
				for (let child of children) {
					if (!directoriesOnly || (await IOUtils.stat(child)).type == "directory") {
						results.push(PathUtils.filename(child));
					}
				}
			}
			catch (ex) {
				// Fall-through, return what we have.
			}
			return results;
		}

		rootURI = rootURI.QueryInterface(Ci.nsIJARURI);

		// Append the sub-directory path to the base JAR URI and normalize the
		// result.
		let entry = `${rootURI.JAREntry}/${path}/`
			.replace(/\/\/+/g, "/")
			.replace(/^\//, "");
		rootURI = Services.io.newURI(`jar:${rootURI.JARFile.spec}!/${entry}`);

		let results = [];
		for (let name of lazy.aomStartup.enumerateJARSubtree(rootURI)) {
			if (!name.startsWith(entry)) {
				throw new Error("Unexpected ZipReader entry");
			}

			// The enumerator returns the full path of all entries.
			// Trim off the leading path, and filter out entries from
			// subdirectories.
			name = name.slice(entry.length);
			if (name && !/\/./.test(name) && (!directoriesOnly || name.endsWith("/"))) {
				results.push(name.replace("/", ""));
			}
		}

		return results;
	}
	
	
	function getVersionChangeReason(oldVersion, newVersion) {
		return Zotero.Utilities.semverCompare(oldVersion, newVersion) <= 0
			? REASONS.ADDON_UPGRADE
			: REASONS.ADDON_DOWNGRADE;
	}
	

	// TODO: Get blocking list from server
	const BLOCKED_PLUGINS = {
		"zoterostyle@polygon.org": {
			versionRanges: [{
				maxVersion: "4.5.99"
			}],
			reason: "Versions of this plugin prior to version 4.6.0 break the Zotero user interface.",
		}
	};
	function getBlockedPlugins() {
		return BLOCKED_PLUGINS;
	}


	function shouldBlockPlugin(addon) {
		let blockedPlugins = getBlockedPlugins();
		let id = addon.id;
		let version = addon.version;
		let blockedReason = false;
		if (blockedPlugins[id]) {
			for (let blockedVersion of blockedPlugins[id].versionRanges) {
				if (typeof blockedVersion === "string") {
					if (blockedVersion === "*" || blockedVersion === version) {
						blockedReason = blockedPlugins[id].reason;
						break;
					}
					continue;
				}
				else {
					let { minVersion, maxVersion } = blockedVersion;
					if ((!minVersion || Zotero.Utilities.semverCompare(version, minVersion) >= 0)
						&& (!maxVersion || Zotero.Utilities.semverCompare(version, maxVersion) <= 0)) {
						blockedReason = blockedPlugins[id].reason;
						break;
					}
				}
			}
		}
		if (blockedReason) {
			Zotero.warn(`Blocking plugin ${addon.id}: ${blockedReason}`);
		}
		setPluginBlocked(addon, !!blockedReason);
		return blockedReason;
	}


	async function setPluginBlocked(addon, block = true) {
		const addonInternal = addon.__AddonInternal__;
		addonInternal.blocklistState = block
			? Services.blocklist.STATE_BLOCKED
			: Services.blocklist.STATE_NOT_BLOCKED;
		await lazy.XPIDatabase.updateAddonDisabledState(addonInternal, {
			softDisabled: block,
		});
	}


	/**
	 * Add an observer to be notified of lifecycle events on all plugins.
	 *
	 * @param observer
	 * @param {Function} [observer.install]
	 * @param {Function} [observer.startup]
	 * @param {Function} [observer.shutdown]
	 * @param {Function} [observer.uninstall]
	 */
	this.addObserver = function (observer) {
		observers.add(observer);
	};
	
	
	this.removeObserver = function (observer) {
		observers.delete(observer);
	};
	
	
	this._addonObserver = {
		initialized: false,
		
		uninstalling: new Set(),
		
		init() {
			if (!this.initialized) {
				AddonManager.addAddonListener(this);
				this.initialized = true;
			}
		},
		
		async onInstalling(addon) {
			Zotero.debug("Installing plugin " + addon.id);
			
			var currentVersion = addonVersions.get(addon.id);
			if (currentVersion) {
				let existingAddon = await AddonManager.getAddonByID(addon.id);
				let reason = getVersionChangeReason(currentVersion, addon.version);
				if (existingAddon.isActive) {
					await _callMethod(existingAddon, 'shutdown', reason);
				}
				await _callMethod(existingAddon, 'uninstall', reason);
				Services.obs.notifyObservers(null, "startupcache-invalidate");
				unregisterLocales(existingAddon);
				clearDefaultPrefs(existingAddon);
				_unloadScope(existingAddon.id);
				addonVersions.delete(existingAddon.id);
			}
		},
		
		async onInstalled(addon) {
			if (addon.type !== "extension") {
				return;
			}
			Zotero.debug("Installed plugin " + addon.id);

			// Determine if this is a new install, an upgrade, or a downgrade
			let previousVersion = addonVersions.get(addon.id);
			let reason = previousVersion
				? getVersionChangeReason(previousVersion, addon.version)
				: REASONS.ADDON_INSTALL;
			addonVersions.set(addon.id, addon.version);

			let blockedReason = shouldBlockPlugin(addon);
			if (blockedReason) {
				return;
			}
			
			_loadScope(addon);
			setDefaultPrefs(addon);
			await registerLocales(addon);
			await _callMethod(addon, 'install', reason);
			if (addon.isActive) {
				await _callMethod(addon, 'startup', reason);
			}
		},
		
		async onEnabling(addon) {
			if (addon.type !== "extension") {
				return;
			}
			Zotero.debug("Enabling plugin " + addon.id);
			_loadScope(addon);
			setDefaultPrefs(addon);
			await registerLocales(addon);
			await _callMethod(addon, 'startup', REASONS.ADDON_ENABLE);
		},
		
		async onDisabled(addon) {
			if (addon.type !== "extension") {
				return;
			}
			Zotero.debug("Disabling plugin " + addon.id);
			await _callMethod(addon, 'shutdown', REASONS.ADDON_DISABLE);
			unregisterLocales(addon);
			clearDefaultPrefs(addon);
		},
		
		async onUninstalling(addon) {
			Zotero.debug("Uninstalling plugin " + addon.id);
			this.uninstalling.add(addon.id);
			if (addon.isActive) {
				await _callMethod(addon, 'shutdown', REASONS.ADDON_UNINSTALL);
			}
			await _callMethod(addon, 'uninstall', REASONS.ADDON_UNINSTALL);
			Services.obs.notifyObservers(null, "startupcache-invalidate");
			unregisterLocales(addon);
			clearDefaultPrefs(addon);
		},
		
		async onUninstalled(addon) {
			Zotero.debug("Uninstalled plugin " + addon.id);
			_unloadScope(addon.id);
			addonVersions.delete(addon.id);
		},
		
		async onOperationCancelled(addon) {
			if (!this.uninstalling.has(addon.id) || addon.type !== "extension") {
				return;
			}
			Zotero.debug("Cancelled uninstallation of plugin " + addon.id);
			this.uninstalling.delete(addon.id);

			let blockedReason = shouldBlockPlugin(addon);
			if (blockedReason) {
				return;
			}
			
			await _callMethod(addon, 'install', REASONS.ADDON_INSTALL);
			if (addon.isActive) {
				setDefaultPrefs(addon);
				await registerLocales(addon);
				await _callMethod(addon, 'startup', REASONS.ADDON_INSTALL);
			}
		}
	};
};
