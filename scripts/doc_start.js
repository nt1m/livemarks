"use strict";

/* import-globals-from sniff_common.js */

debugMsg(logLevels.info, "Running script at document_start");

// See if the current document is a feed document and if so, let
// the extension know that we should show the subscribe page instead.
if (containsFeed(document)) {
  chrome.runtime.sendMessage({msg: "feedDocument", href: location.href});
}
