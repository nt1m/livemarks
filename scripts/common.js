"use strict";

/**
*  Returns the default list of feed readers.
*/
function defaultReaderList() {
  // This is the default list, unless replaced by what was saved previously.
  return [];
}

/**
* Check to see if the current item is set as default reader.
*/
function isDefaultReader(url) {
  defaultReader = window.localStorage.defaultReader ?
    window.localStorage.defaultReader : "";
  return url == defaultReader;
}

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
      element.innerText = chrome.i18n.getMessage(msg);
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
