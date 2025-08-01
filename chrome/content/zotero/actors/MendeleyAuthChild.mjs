/* global JSWindowActorChild:false */

import { documentIsReady } from "chrome://zotero/content/actors/actorUtils.mjs";  

export class MendeleyAuthChild extends JSWindowActorChild {  
	async receiveMessage(message) {
		let document = this.document;

		// Wait for 'complete'
		await documentIsReady(document);

		switch (message.name) {
			case "login":
				try {
					document.querySelector('input[name="pf.username"]').value = message.data.login;
					document.querySelector("button[value=emailContinue]").removeAttribute("disabled");
					document.querySelector("button[value=emailContinue]").click();
					return true;
				}
				catch (e) {
					this.sendAsyncMessage('debug', { kind: 'error', message: 'Failed to enter login', error: e.message });
				}
				break;
			case "password":
				try {
					document.querySelector('input[name="password"]').value = message.data.password;
					document.querySelector("button[type=submit][value=signin]").removeAttribute("disabled");
					document.querySelector("button[type=submit][value=signin]").click();
					return true;
				}
				catch (e) {
					this.sendAsyncMessage('debug', { kind: 'error', message: 'Failed to enter password', error: e.message });
				}
				break;
		}

		return false;
	}
}
