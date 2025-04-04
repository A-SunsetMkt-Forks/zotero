// Adapted from Mozilla editMenuOverlay.js
// Modified to wrap <menupopup> in a <popupset>

// -*- indent-tabs-mode: nil; js-indent-level: 2 -*-

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// update menu items that rely on focus or on the current selection
function goUpdateGlobalEditMenuItems(force) {
  // Don't bother updating the edit commands if they aren't visible in any way
  // (i.e. the Edit menu isn't open, nor is the context menu open, nor have the
  // cut, copy, and paste buttons been added to the toolbars) for performance.
  // This only works in applications/on platforms that set the gEditUIVisible
  // flag, so we check to see if that flag is defined before using it.
  if (!force && typeof gEditUIVisible != "undefined" && !gEditUIVisible) {
    return;
  }

  goUpdateCommand("cmd_undo");
  goUpdateCommand("cmd_redo");
  goUpdateCommand("cmd_cut");
  goUpdateCommand("cmd_copy");
  goUpdateCommand("cmd_paste");
  goUpdateCommand("cmd_selectAll");
  goUpdateCommand("cmd_delete");
  goUpdateCommand("cmd_switchTextDirection");
}

// update menu items that relate to undo/redo
function goUpdateUndoEditMenuItems() {
  goUpdateCommand("cmd_undo");
  goUpdateCommand("cmd_redo");
}

// update menu items that depend on clipboard contents
function goUpdatePasteMenuItems() {
  goUpdateCommand("cmd_paste");
}

// Inject the commandset here instead of relying on preprocessor to share this across documents.
window.addEventListener(
  "DOMContentLoaded",
  () => {
    let container =
      document.querySelector("commandset") || document.documentElement;
    let fragment = MozXULElement.parseXULToFragment(`
      <commandset id="editMenuCommands">
        <commandset id="editMenuCommandSetAll" commandupdater="true" events="focus,select" />
        <commandset id="editMenuCommandSetUndo" commandupdater="true" events="undo" />
        <commandset id="editMenuCommandSetPaste" commandupdater="true" events="clipboard" />
        <command id="cmd_undo" internal="true"/>
        <command id="cmd_redo" internal="true" />
        <command id="cmd_cut" internal="true" />
        <command id="cmd_copy" internal="true" />
        <command id="cmd_paste" internal="true" />
        <command id="cmd_delete" />
        <command id="cmd_selectAll" internal="true" />
        <command id="cmd_switchTextDirection" />
      </commandset>
    `);

    let editMenuCommandSetAll = fragment.querySelector(
      "#editMenuCommandSetAll"
    );
    editMenuCommandSetAll.addEventListener("commandupdate", function() {
      goUpdateGlobalEditMenuItems();
    });

    let editMenuCommandSetUndo = fragment.querySelector(
      "#editMenuCommandSetUndo"
    );
    editMenuCommandSetUndo.addEventListener("commandupdate", function() {
      goUpdateUndoEditMenuItems();
    });

    let editMenuCommandSetPaste = fragment.querySelector(
      "#editMenuCommandSetPaste"
    );
    editMenuCommandSetPaste.addEventListener("commandupdate", function() {
      goUpdatePasteMenuItems();
    });

    fragment.firstElementChild.addEventListener("command", event => {
      let commandID = event.target.id;
      goDoCommand(commandID);
    });

    container.appendChild(fragment);
  },
  { once: true }
);

function goBuildEditContextMenu() {
    let popup = document.getElementById("textbox-contextmenu");
    if (!popup) {
        MozXULElement.insertFTLIfNeeded("toolkit/global/textActions.ftl");
        MozXULElement.insertFTLIfNeeded("browser/menubar.ftl");
        document.documentElement.appendChild(
            MozXULElement.parseXULToFragment(`
              <popupset>
                <menupopup id="textbox-contextmenu" class="textbox-contextmenu">
                  <menuitem data-l10n-id="text-action-undo" command="cmd_undo" data-action="undo"></menuitem>
                  <menuitem data-l10n-id="text-action-redo" command="cmd_redo" data-action="redo"></menuitem>
                  <menuseparator></menuseparator>
                  <menuitem data-l10n-id="text-action-cut" command="cmd_cut" data-action="cut"></menuitem>
                  <menuitem data-l10n-id="text-action-copy" command="cmd_copy" data-action="copy"></menuitem>
                  <menuitem data-l10n-id="text-action-paste" command="cmd_paste" data-action="paste"></menuitem>
                  <menuitem data-l10n-id="text-action-delete" command="cmd_delete" data-action="delete"></menuitem>
                  <menuitem data-l10n-id="text-action-select-all" command="cmd_selectAll" data-action="selectAll"></menuitem>
                  <menuseparator></menuseparator>
                  <menuitem data-l10n-id="menu-edit-bidi-switch-text-direction" command="cmd_switchTextDirection" data-action="switchTextDirection"></menuitem>
                </menupopup>
              </popupset>
            `)
        );
        popup = document.documentElement.lastElementChild.firstElementChild;
    }
    
	let menuitemSwitchTextDirection = popup.querySelector("[command='cmd_switchTextDirection']");
	let showSwitchTextDirection = Services.prefs.getBoolPref("bidi.browser.ui", false);
	menuitemSwitchTextDirection.hidden = !showSwitchTextDirection;
	menuitemSwitchTextDirection.previousElementSibling.hidden = !showSwitchTextDirection;
    
    return popup;
}

// Support context menus on html textareas in the parent process:
window.addEventListener("contextmenu", e => {
  const HTML_NS = "http://www.w3.org/1999/xhtml";
  let needsContextMenu =
    e.composedTarget.ownerDocument == document &&
    !e.defaultPrevented &&
    e.composedTarget.parentNode.nodeName != "moz-input-box" &&
    ((["textarea", "input"].includes(e.composedTarget.localName) &&
      e.composedTarget.namespaceURI == HTML_NS) ||
      e.composedTarget.closest("search-textbox"));

  if (!needsContextMenu) {
    return;
  }

  let popup = goBuildEditContextMenu();
  goUpdateGlobalEditMenuItems(true);
  popup.openPopupAtScreen(e.screenX, e.screenY, true, e);
  // Don't show any other context menu at the same time. There can be a
  // context menu from an ancestor too but we only want to show this one.
  e.preventDefault();
});
