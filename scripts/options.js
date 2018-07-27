"use strict";

/* import-globals-from options_utils.js */

// init method of the options page
document.addEventListener("DOMContentLoaded", function() {
  $("#add").click(function() {
    const url = prompt("Enter Feed URL");

    if (url) {
      addNewFeed(url);
    }
    return false;
  });
  $("#save").click(function() {
    validateAndSaveFeeds();
    return false;
  });

  $("#import-feeds").click(function() {
    $("#files").click();
  });
  $("#files").bind("change", handleFileSelect);

  chrome.bookmarks.getTree(function(topNode) {
    const feeds = getFeedConfig();
    const folders = getAllBookmarkFolders(topNode[0].children, feeds);

    // add folders to the options drop down
    populateParentFolders(folders);
    loadFeedConfig();
  });
});

