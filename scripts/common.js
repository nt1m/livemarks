"use strict";

/**
* Find an element with |id| and replace the text of it with i18n message with
* |msg| key.
*/
function i18nReplaceImpl(id, msg, attribute) {
  const element = document.getElementById(id);
  if (element) {
    if (attribute) {
      element.setAttribute(attribute, chrome.i18n.getMessage(msg));
    } else {
      element.textContent = chrome.i18n.getMessage(msg);
    }
  }
}

/**
* Same as i18nReplaceImpl but provided for convenience for elements that have
* the same id as the i18n message id.
*/
function i18nReplace(msg) {
  i18nReplaceImpl(msg, msg, "");
}
