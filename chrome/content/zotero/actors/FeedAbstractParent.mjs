ChromeUtils.defineESModuleGetters(globalThis, {
	Zotero: "chrome://zotero/content/zotero.mjs"
});

export class FeedAbstractParent extends JSWindowActorParent {
	async receiveMessage({ name, data }) {
		switch (name) {
			case "getStylesheet": {
				return Zotero.File.getResourceAsync("chrome://zotero/skin/feedAbstract.css");
			}
			
			case "resize": {
				this._resizeBrowser(data.offsetHeight);
				return undefined;
			}
		}
	}
	
	_resizeBrowser(height) {
		let browser = this.browsingContext?.embedderElement;
		if (!browser) return;
		browser.style.height = height + 'px';
	}
}
