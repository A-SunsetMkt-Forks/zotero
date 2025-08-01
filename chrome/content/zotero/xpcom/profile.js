/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2016 Center for History and New Media
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
var { OS } = ChromeUtils.importESModule("chrome://zotero/content/osfile.mjs");

Zotero.Profile = {
	dir: OS.Constants.Path.profileDir,
	
	getDefaultInProfilesDir: async function (profilesDir) {
		var profilesIni = OS.Path.join(profilesDir, "profiles.ini");
		
		try {
			var iniContents = await Zotero.File.getContentsAsync(profilesIni);
		}
		catch (e) {
			if (e.name == 'NotFoundError') {
				return false;
			}
			throw e;
		}
		
		// cheap and dirty ini parser
		var curSection = null;
		var defaultSection = null;
		var nSections = 0;
		for (let line of iniContents.split(/(?:\r?\n|\r)/)) {
			let tline = line.trim();
			if(tline[0] == "[" && tline[tline.length-1] == "]") {
				curSection = {};
				if(tline != "[General]") nSections++;
			} else if(curSection && tline != "") {
				let equalsIndex = tline.indexOf("=");
				let key = tline.substr(0, equalsIndex);
				let val = tline.substr(equalsIndex+1);
				curSection[key] = val;
				if(key == "Default" && val == "1") {
					defaultSection = curSection;
				}
			}
		}
		if (!defaultSection && curSection) defaultSection = curSection;
		
		if (!defaultSection || !defaultSection.Path) return false;
		
		var defaultProfile = defaultSection.IsRelative === "1"
			? OS.Path.join(profilesDir, ...defaultSection.Path.split("/"))
			: defaultSection.Path;
		
		try {
			// Note: exists() returns false on no access, so use stat() instead
			await OS.File.stat(defaultProfile);
		}
		catch (e) {
			if (e instanceof OS.File.Error) {
				if (e.becauseNoSuchFile) {
					return false;
				}
				throw e;
			}
		}
		return [defaultProfile, nSections > 1];
	},
	
	
	getProfilesDir: function () {
		return PathUtils.parent(this.dir);
	},
	
	
	/**
	 * Get the path to the Firefox Profiles directory, which may or may not exist
	 *
	 * @return {String|null} - Path, or null if none due to filesystem location
	 */
	getOtherAppProfilesDir: function () {
		var dir = PathUtils.parent(PathUtils.parent(PathUtils.parent(this.dir)));
		if (dir === '' || dir == '.') {
			return null;
		}
		
		if (Zotero.isWin) {
			dir = OS.Path.join(PathUtils.parent(dir), "Mozilla", "Firefox");
		}
		else if (Zotero.isMac) {
			dir = OS.Path.join(dir, "Firefox");
		}
		else {
			dir = OS.Path.join(dir, ".mozilla", "firefox");
		}
		
		return OS.Path.join(dir, "Profiles");
	},
	
	
	/**
	 * Find other profile directories (for this app or the other app) using the given data directory
	 *
	 * @param {String} dataDir
	 * @param {Boolean} [includeOtherApps=false] - Check Firefox profiles
	 * @return {String[]}
	 */
	findOtherProfilesUsingDataDirectory: async function (dataDir, includeOtherApps = true) {
		let otherAppProfiles = includeOtherApps ? await this._findOtherAppProfiles() : [];
		let otherProfiles = (await this._findOtherProfiles()).concat(otherAppProfiles);
		
		// First get profiles pointing at this directory
		for (let i = 0; i < otherProfiles.length; i++) {
			let dir = otherProfiles[i];
			let prefs = await Zotero.File.getContentsAsync(OS.Path.join(dir, "prefs.js"));
			prefs = prefs.trim().split(/(?:\r\n|\r|\n)/);
			
			let keep = prefs.some(line => line.includes("extensions.zotero.useDataDir") && line.includes("true"))
				&& prefs.some(line => line.match(/extensions\.zotero\.(lastD|d)ataDir/) && line.includes(dataDir));
			if (!keep) {
				otherProfiles.splice(i, 1);
				i--;
			}
		}
		
		// If the parent of the source directory is a profile directory from the other app, add that
		// to the list, which addresses the situation where the source directory is a custom
		// location for the current profile but is a default in the other app (meaning it wouldn't
		// be added above).
		let dataDirParent = PathUtils.parent(dataDir);
		if (otherAppProfiles.includes(dataDirParent) && !otherProfiles.includes(dataDirParent)) {
			otherProfiles.push(dataDirParent);
		}
		
		if (otherProfiles.length) {
			Zotero.debug("Found other profiles pointing to " + dataDir);
			Zotero.debug(otherProfiles);
		}
		else {
			Zotero.debug("No other profiles point to " + dataDir);
		}
		
		return otherProfiles;
	},
	
	
	updateProfileDataDirectory: async function (profileDir, oldDir, newDir) {
		let prefsFile = OS.Path.join(profileDir, "prefs.js");
		let prefsFileTmp = OS.Path.join(profileDir, "prefs.js.tmp");
		Zotero.debug("Updating " + prefsFile + " to point to new data directory");
		let contents = await Zotero.File.getContentsAsync(prefsFile);
		contents = contents
			.trim()
			.split(/(?:\r\n|\r|\n)/)
			// Remove existing lines
			.filter(line => !line.match(/extensions\.zotero\.(useD|lastD|d)ataDir/));
		// Shouldn't happen, but let's make sure we don't corrupt the prefs file
		let safeVal = newDir.replace(/["]/g, "");
		contents.push(
			`user_pref("extensions.zotero.dataDir", "${safeVal}");`,
			`user_pref("extensions.zotero.lastDataDir", "${safeVal}");`,
			'user_pref("extensions.zotero.useDataDir", true);'
		);
		let lineSep = Zotero.isWin ? "\r\n" : "\n";
		contents = contents.join(lineSep) + lineSep;
		await OS.File.writeAtomic(
			prefsFile,
			contents,
			{
				tmpPath: prefsFileTmp,
				encoding: 'utf-8'
			}
		);
	},
	
	
	/**
	 * @return {Boolean} - True if accessible or skipped, false if not
	 */
	checkFirefoxProfileAccess: async function () {
		try {
			let profilesDir = Zotero.Profile.getOtherAppProfilesDir();
			if (!profilesDir) {
				return true;
			}
			let profilesParent = PathUtils.parent(profilesDir);
			Zotero.debug("Looking for Firefox profile in " + profilesParent);
			let defProfile = await this.getDefaultInProfilesDir(profilesParent);
			if (defProfile) {
				let profileDir = defProfile[0];
				Zotero.debug("Found default profile at " + profileDir);
				let prefsFile = OS.Path.join(profileDir, "prefs.js");
				await Zotero.File.getContentsAsync(prefsFile);
				let dir = OS.Path.join(profileDir, Zotero.DataDirectory.legacyDirName);
				Zotero.debug("Checking for 'zotero' subdirectory");
				if ((await OS.File.stat(dir)).isDir) {
					let dbFilename = Zotero.DataDirectory.getDatabaseFilename();
					let dbFile = OS.Path.join(dir, dbFilename);
					Zotero.debug("Checking database access within 'zotero' subdirectory");
					(await OS.File.stat(dbFile)).lastModificationDate;
				}
				else {
					Zotero.debug("'zotero' is not a directory!");
				}
			}
			else {
				Zotero.debug("No default profile found");
			}
		}
		catch (e) {
			if (e.name == 'NotFoundError' || (e instanceof OS.File.Error && e.becauseNoSuchFile)) {
				return true;
			}
			Zotero.debug(e, 2)
			return false
		}
		return true;
	},
	
	
	readPrefsFromFile: async function (prefsFile) {
		var sandbox = new Components.utils.Sandbox("http://www.example.com/");
		Components.utils.evalInSandbox(
			"var prefs = {};"+
			"function user_pref(key, val) {"+
				"prefs[key] = val;"+
			"}"
		, sandbox);
		
		(await Zotero.File.getContentsAsync(prefsFile))
			.split(/\n/)
			.filter((line) => {
				// Strip comments
				return !line.startsWith('#')
					// Only process lines in our pref branch
					&& line.includes(ZOTERO_CONFIG.PREF_BRANCH);
			})
			// Process each line individually
			.forEach((line) => {
				try {
					Zotero.debug("Processing " + line);
					Components.utils.evalInSandbox(line, sandbox);
				}
				catch (e) {
					Zotero.logError("Error processing prefs line: " + line);
				}
			});
		
		return sandbox.prefs;
	},
	
	
	//
	// Private methods
	//
	
	/**
	 * Get all profile directories within the given directory
	 *
	 * @return {String[]} - Array of paths
	 */
	_getProfilesInDir: async function (profilesDir) {
		var dirs = [];
		await Zotero.File.iterateDirectory(profilesDir, async function (entry) {
			// entry.isDir can be false for some reason on Travis, causing spurious test failures
			if (Zotero.automatedTest && !entry.isDir && (await OS.File.stat(entry.path)).isDir) {
				Zotero.debug("Overriding isDir for " + entry.path);
				entry.isDir = true;
			}
			if (entry.isDir && (await OS.File.exists(OS.Path.join(entry.path, "prefs.js")))) {
				dirs.push(entry.path);
			}
		});
		return dirs;
	},
	
	
	/**
	 * Find other profile directories for this app (Firefox or Zotero)
	 *
	 * @return {Promise<String[]>} - Array of paths
	 */
	_findOtherProfiles: async function () {
		var profileDir = this.dir;
		var profilesDir = this.getProfilesDir();
		return (await this._getProfilesInDir(profilesDir)).filter(dir => dir != profileDir);
	},
	
	
	/**
	 * Find profile directories for the other app (Firefox or Zotero)
	 *
	 * @return {Promise<String[]>} - Array of paths
	 */
	_findOtherAppProfiles: async function () {
		var dir = this.getOtherAppProfilesDir();
		return dir && (await OS.File.exists(dir)) ? this._getProfilesInDir(dir) : [];
	}
};
