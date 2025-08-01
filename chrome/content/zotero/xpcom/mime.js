/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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

Zotero.MIME = new function () {
	this.isTextType = isTextType;
	this.getPrimaryExtension = getPrimaryExtension;
	this.sniffForBinary = sniffForBinary;
	this.hasNativeHandler = hasNativeHandler;
	
	// Magic numbers -- see https://en.wikipedia.org/wiki/List_of_file_signatures
	var _snifferEntries = [
		["%PDF-", "application/pdf"],
		["%!PS-Adobe-", 'application/postscript', 0],
		["%! PS-Adobe-", 'application/postscript', 0],
		["From", 'text/plain', 0],
		[">From", 'text/plain', 0],
		["#!", 'text/plain', 0],
		["<?xml", 'text/xml', 0],
		["<!DOCTYPE html", 'text/html', 0],
		["<html", 'text/html', 0],
		["GIF8", 'image/gif', 0],
		["\u0089PNG", 'image/png', 0],
		["\u00FF\u00D8\u00FF\u00DB", "image/jpeg", 0],
		["\u00FF\u00D8\u00FF\u00E0\u0000\u0010\u004A\u0046\u0049\u0046\u0000\u0001", "image/jpeg", 0],
		["\u00FF\u00D8\u00FF\u00EE", "image/jpeg", 0],
		["\u00FF\u00D8\u00FF\u00E1", "image/jpeg", 0],
		["\u00FF\u00D8\u00FF\u00E0", "image/jpeg", 0],
		["FLV", "video/x-flv", 0],
		["\u0000\u0000\u0001\u0000", "image/vnd.microsoft.icon", 0],
		["SQLite format 3\u0000", "application/x-sqlite3", 0],
		["mimetypeapplication/epub+zip", "application/epub+zip", 30],
		// MP3 without ID3 tag or with ID3v1 tag
		["\U00FF\U00FB", "audio/mpeg", 0],
		["\U00FF\U00F3", "audio/mpeg", 0],
		["\U00FF\U00F2", "audio/mpeg", 0],
		// MP3 with ID3v2 container
		["ID3", "audio/mpeg", 0],
	];
	
	var _extensions = {
		// MS Office
		'doc': 'application/msword',
		'dot': 'application/msword',
		'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'dotx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
		'docm': 'application/vnd.ms-word.document.macroEnabled.12',
		'dotm': 'application/vnd.ms-word.template.macroEnabled.12',
		'xls': 'application/vnd.ms-excel',
		'xlt': 'application/vnd.ms-excel',
		'xla': 'application/vnd.ms-excel',
		'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'xltx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
		'xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
		'xltm': 'application/vnd.ms-excel.template.macroEnabled.12',
		'xlam': 'application/vnd.ms-excel.addin.macroEnabled.12',
		'xlsb': 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
		'ppt': 'application/vnd.ms-powerpoint',
		'pot': 'application/vnd.ms-powerpoint',
		'pps': 'application/vnd.ms-powerpoint',
		'ppa': 'application/vnd.ms-powerpoint',
		'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'potx': 'application/vnd.openxmlformats-officedocument.presentationml.template',
		'ppsx': 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
		'ppam': 'application/vnd.ms-powerpoint.addin.macroEnabled.12',
		'pptm': 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
		'potm': 'application/vnd.ms-powerpoint.template.macroEnabled.12',
		'ppsm': 'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',
		
		// OpenOffice/LibreOffice
		'odt': 'application/vnd.oasis.opendocument.text',
		
		'pdf': 'application/pdf',
		'epub': 'application/epub+zip',
		
		'mp3': 'audio/mpeg',
		'aac': 'audio/aac',
		'mp4': 'video/mp4',
		'mpeg': 'video/mpeg',
	};
	
	var _textTypes = {
		'application/xhtml+xml': true,
		'application/xml': true,
		'application/x-javascript': true
	};
	
	var _webPageTypes = [
		'text/html',
		'application/xhtml+xml'
	]
	
	// MIME types handled natively by Gecko
	// DEBUG: There's definitely a better way of getting these
	var _nativeMIMETypes = {
		'text/html': true,
		'text/css': true,
		'text/xml': true,
		'application/xhtml+xml': true,
		'application/xml': true,
		'text/plain': true,
		'application/x-javascript': true
	};
	
	// Extensions of text files (generally XML) to force to be external
	var _externalTextExtensions = {
		graffle: true,
		mm: true,
		opml: true,
		bib: true
	};
	
	
	
	function isTextType(mimeType) {
		return mimeType.substr(0, 5) == 'text/' || mimeType in _textTypes;
	}
	
	this.isWebPageType = function (mimeType) {
		return _webPageTypes.indexOf(mimeType) != -1;
	}
	
	/*
	 * Our own wrapper around the MIME service's getPrimaryExtension() that
	 * works a little better
	 */
	function getPrimaryExtension(mimeType, ext) {
		// Enforce some extensions
		switch (mimeType) {
			case 'text/html':
			case 'application/xhtml+xml':
				return 'html';
			
			case 'application/pdf':
			case 'application/x-pdf':
			case 'application/acrobat':
			case 'applications/vnd.pdf':
			case 'text/pdf':
			case 'text/x-pdf':
				return 'pdf';
			
			case 'image/jpg':
			case 'image/jpeg':
				return 'jpg';
			
			case 'image/gif':
				return 'gif';
			
			case 'application/msword':
			case 'application/doc':
			case 'application/vnd.msword':
			case 'application/vnd.ms-word':
			case 'application/winword':
			case 'application/word':
			case 'application/x-msw6':
			case 'application/x-msword':
				return 'doc';
			
			case 'application/vnd.oasis.opendocument.text':
			case 'application/x-vnd.oasis.opendocument.text':
				return 'odt';
			
			case 'video/flv':
			case 'video/x-flv':
				return 'flv';
			
			case 'image/tif':
			case 'image/tiff':
			case 'image/x-tif':
			case 'image/x-tiff':
			case 'application/tif':
			case 'application/x-tif':
			case 'application/tiff':
			case 'application/x-tiff':
				return 'tiff';
			
			case 'application/zip':
			case 'application/x-zip':
			case 'application/x-zip-compressed':
			case 'application/x-compress':
			case 'application/x-compressed':
			case 'multipart/x-zip':
				return 'zip';
				
			case 'video/quicktime':
			case 'video/x-quicktime':
				return 'mov';
				
			case 'video/avi':
			case 'video/msvideo':
			case 'video/x-msvideo':
				return 'avi';
				
			case 'audio/wav':
			case 'audio/x-wav':
			case 'audio/wave':
				return 'wav';
				
			case 'audio/aiff':
			case 'audio/x-aiff':
			case 'sound/aiff':
				return 'aiff';

			case 'application/epub+zip':
				return 'epub';
		}
		
		try {
			ext = Components.classes["@mozilla.org/mime;1"]
				.getService(Components.interfaces.nsIMIMEService)
				.getPrimaryExtension(mimeType, ext);
		}
		// nsIMIMEService.getPrimaryExtension() doesn't work on Linux and
		// throws an error if it can't find an extension
		catch (e) {}
		
		return ext ? ext : '';
	}
	
	
	/*
	 * Searches string for magic numbers
	 */
	this.sniffForMIMEType = function (str) {
		for (let [magic, type, offset] of _snifferEntries) {
			let match = false;
			// If an offset is defined, match only from there
			if (offset != undefined) {
				if (str.substr(offset).indexOf(magic) == 0) {
					match = true;
				}
			}
			// Otherwise allow match anywhere in sample
			// (200 bytes from getSample() by default)
			else if (str.indexOf(magic) != -1) {
				match = true;
			}
			
			if (match) {
				return type;
			}
		}
		
		return false;
	}
	
	
	/*
	 * Searches string for embedded nulls
	 *
	 * Returns 'application/octet-stream' or 'text/plain'
	 */
	function sniffForBinary(str){
		for (var i=0; i<str.length; i++){
			if (!_isTextCharacter(str.charAt(i))){
				return 'application/octet-stream';
			}
		}
		return 'text/plain';
	}
	
	
	/*
	 * Try to determine the MIME type of a string, using a few different
	 * techniques
	 *
	 * ext is an optional file extension hint if data sniffing is unsuccessful
	 */
	this.getMIMETypeFromData = function (str, ext){
		var mimeType = this.sniffForMIMEType(str);
		if (mimeType){
			Zotero.debug('Detected MIME type ' + mimeType);
			return mimeType;
		}
		
		if (ext) {
			mimeType = this.getMIMETypeFromExtension(ext);
			if (mimeType) {
				return mimeType;
			}
		}
		
		var mimeType = sniffForBinary(str);
		Zotero.debug('Cannot determine MIME type from magic number or extension -- settling for ' + mimeType);
		return mimeType;
	}
	
	
	this.getMIMETypeFromExtension = function (ext) {
		var type = false;
		
		if (_extensions[ext]) {
			var type = _extensions[ext];
		}
		else {
			try {
				var type = Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"]
					.getService(Components.interfaces.nsIMIMEService).getTypeFromExtension(ext);
			}
			catch (e) {}
		}
		
		Zotero.debug("Got MIME type " + type + " from extension '" + ext + "'");
		return type;
	}
	
	
	/*
	 * Try to determine the MIME type of the file, using a few different
	 * techniques
	 */
	this.getMIMETypeFromFile = async function (file) {
		var str = await Zotero.File.getSample(file);
		var ext = Zotero.File.getExtension(file);
		
		return this.getMIMETypeFromData(str, ext);
	};
	
	
	/**
	 * @param {String} url
	 * @param {Zotero.CookieSandbox} [cookieSandbox]
	 * @return {Promise}
	 */
	this.getMIMETypeFromURL = async function (url, cookieSandbox) {
		var xmlhttp = await Zotero.HTTP.request(
			"HEAD",
			url,
			{
				cookieSandbox,
				successCodes: false
			}
		);
		
		if (xmlhttp.status != 200 && xmlhttp.status != 204) {
			Zotero.debug("Attachment HEAD request returned with status code "
				+ xmlhttp.status + " in Zotero.MIME.getMIMETypeFromURL()", 2);
			var mimeType = '';
		}
		else {
			var mimeType = xmlhttp.channel.contentType;
		}
		
		var nsIURL = Services.io.newURI(url).QueryInterface(Ci.nsIURL);
		
		// Override MIME type to application/pdf if extension is .pdf --
		// workaround for sites that respond to the HEAD request with an
		// invalid MIME type (https://www.zotero.org/trac/ticket/460)
		//
		// Downloaded file is inspected in attachment code and deleted if actually HTML
		if (nsIURL.fileName.match(/pdf$/) || url.match(/pdf$/)) {
			mimeType = 'application/pdf';
		}
		
		var ext = nsIURL.fileExtension;
		var hasNativeHandler = Zotero.MIME.hasNativeHandler(mimeType, ext);
		
		return [mimeType, hasNativeHandler];
	}
	
	
	/*
	 * Determine if a MIME type can be handled natively
	 * or if it needs to be passed off to a plugin or external helper app
	 *
	 * ext is an optional extension hint (only needed for text files
	 * that should be forced to open externally)
	 *
	 * Note: it certainly seems there should be a more native way of doing this
	 * without replicating all the Mozilla functionality
	 *
	 * Note: nsIMIMEInfo provides a hasDefaultHandler() method, but it doesn't
	 * do what we need
	 */
	function hasNativeHandler(mimeType, ext) {
		if (_nativeMIMETypes[mimeType]){
			Zotero.debug('MIME type ' + mimeType + ' can be handled natively');
			return true;
		}
		return false;
	}
	
	
	/*
	 * Detect whether a character is text
	 * 
	 * Based on RFC 2046 Section 4.1.2. Treat any char 0-31
	 * except the 9-13 range (\t, \n, \v, \f, \r) and char 27 (used by
     * encodings like Shift_JIS) as non-text
	 *
	 * This is the logic used by the Mozilla sniffer.
	 */
	function _isTextCharacter(chr){
		var chr = chr.charCodeAt(0);
		return chr > 31 || (9 <= chr && chr <=13 ) || chr == 27;
	}
}
