"use strict";

var feedOptionCount = 2;
var siteBookmarkPrefix = 'Open "';
var siteBookmarkPostfix = '"';
var seperator = ". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .";

var feeds = [];
var intervalId;

// run the script
init();

// sets the feeds to poll and sync
function setFeeds(updatedFeeds) {
  feeds = updatedFeeds;
}

// sets the polling interval
function setPollInterval(interval) {
  window.clearInterval(intervalId);
  // double check the interval since this could hose the browser
  if (!interval >= 5) {
    interval = 5;
  }
  intervalId = window.setInterval(updateFeeds, 1000 * 60 * interval);
}

// sets up the feeds and starts polling
function init() {
  feeds = getFeedConfig();
  // set up a interval to pull
  // double check the interval since this could hose the browser
  intervalId = window.setInterval(updateFeeds, 1000 * 60 * getPollInterval());
  // poll right away for the first time
  updateFeeds();
}

// polls each configured feed with a delay between each to reduce load all at once
function updateFeeds() {
  for (const feed of feeds) {
    updateFeedBookmarks(feed);
  }
}

// updates the feeds bookmarks(folder and items)
function updateFeedBookmarks(feed) {
  chrome.bookmarks.getTree(function(bookmarkTree) {
    const folder = getBookmarkFolder(bookmarkTree, feed);

    if (folder === null) {
      if (!doesParentFolderExist(bookmarkTree, feed)) {
        // if the parent doesn't exist then alert the user
        logError("the parent folder wasn't found for feed: " + feed.name +
          " please check and resave your settings");
        return;
      }

      if (doesFolderBelongToFeed(feed.parentFolderId, feeds)) {
        // if the parent folder is actually another feeds folder that could cause issues
        logError("feed: " + feed.name + " has its parent folder set to the" +
          " folder of another feed.  This would cause issues.  You must change it before a" +
          " sync will occur");
        return;
      }
      // the folder doesn't exist, we need to create it
      // this call is async, it will call poll feeds for us
      createFeedFolder(feed);
      return;
    } else if (feed.folderId === null) {
      // the feed folder was found so save its id for next poll
      feed.folderId = folder.id;
      addFolderIdToFeedSettings(feed);
    } else if (feed.parentFolderId !== folder.parentId) {
      // the feeds folder was moved to a different location
      // update the settings
      feed.parentFolderId = folder.parentId;
      addParentIdToFeedSettings(feed);
    }

    if (doesFolderBelongToFeed(feed.parentFolderId, feeds)) {
      // if the parent folder is actually another feeds folder that could cause issues
      logError("feed: " + feed.name + " has its parent folder set to the" +
          " folder of another feed.  This would cause issues.  You must change it before a" +
          " sync will occur");
      return;
    }

    // poll the feed
    pollFeed(folder, feed);
  });
}

// this is an async function that will call the pollfeeds once its done
function createFeedFolder(feed) {
  chrome.bookmarks.create({"parentId": feed.parentFolderId,
    "title": feed.name},
  function(newFolder) {
    // TODO: need to handle if the parent folder doesn't exist

    // log error to user
    if (isError(newFolder)) {
      return;
    }

    // add the folder id to the feeds config
    feed.folderId = newFolder.id;
    addFolderIdToFeedSettings(feed);

    newFolder.children = [];
    // poll the feed folder
    pollFeed(newFolder, feed);
  });
}

// pulls the feed
function pollFeed(feedFolder, feed) {
  const success = function(jFeed) {
    if (jFeed.items === undefined) {
      displayError(feed.name + " was polled but contained no entries");
    } else if (hasFeedUpdated(feed, jFeed)) {
      addFeedSeperator(feedFolder, feed, jFeed);
    }
  };

  const error = function(errorText) {
    displayError('feed "' + feed.feedUrl + '" couldn\'t be pulled.  The error was: ' + errorText);
  };
  const poll = function() {
    // poll the feed using the JQuery library
    jQuery.getFeed({
      url: feed.feedUrl,
      success,
      error,
    });
  };

  // delay and then poll the feeds
  // if(waitDelay === undefined)
  poll();
  // else
  // window.setTimeout(poll, waitDelay);
}

// adds the feed options seperator if it doesn't
// exist already
function addFeedSeperator(feedFolder, feed, jFeed) {
  if (doesSeperatorBookmarkExists(feedFolder)) {
    addFeedSiteUrlBookmark(feedFolder, feed, jFeed, 0);
  } else {
    addFeedItemToEnd(feedFolder, feed, jFeed, {title: seperator, url: "about:blank"}, addFeedSiteUrlBookmark);
  }
}

// adds the feed options seperator if it doesn't
// exist already
function addFeedSiteUrlBookmark(feedFolder, feed, jFeed) {
  if (doesSiteUrlBookmarkExist(feed, feedFolder)) {
    updateSiteUrlBookmark(feedFolder, feed);
    syncFeedBookmarksByRemoving(feedFolder, feed, jFeed, 0);
  } else {
    addFeedItemToEnd(feedFolder, feed, jFeed, {title: siteBookmarkPrefix + feed.name + siteBookmarkPostfix,
      url: feed.siteUrl}, addFeedSiteUrlBookmark);
  }
}

// removes feed bookmarks that no longer exist in current feed
function syncFeedBookmarksByRemoving(feedFolder, feed, jFeed, iter) {
  // remove the bookmarks that dosn't exist in the feed anymore
  if (iter < feedFolder.children.length - feedOptionCount && iter < feed.maxItems) {
    if (!doesItemExistsInFeed(feedFolder.children[iter], jFeed, feed)) {
      removeFeedItem(feedFolder, feed, jFeed, iter, syncFeedBookmarksByRemoving);
    } else {
      syncFeedBookmarksByRemoving(feedFolder, feed, jFeed, ++iter);
    }
  } else {
    // call next step in process which is to order the existing items
    syncFeedBookmarksBySorting(feedFolder, feed, jFeed, 0);
  }
}

// sorts the feed bookmarks to match the new feed
function syncFeedBookmarksBySorting(feedFolder, feed, jFeed, iter) {
  // sort the existing feed items
  if (iter < jFeed.items.length && iter < feed.maxItems) {
    for (let j = 0; j < feedFolder.children.length - feedOptionCount; j++) {
      if (feedItemsMatch(feedFolder.children[j], jFeed.items[iter])) {
        if (j != iter) {
          moveFeedItem(feedFolder, feed, jFeed, iter, j, syncFeedBookmarksBySorting);
          return;
        }
        break;
      }
    }
    syncFeedBookmarksBySorting(feedFolder, feed, jFeed, ++iter);
  } else {
    // call next step in process which is to add the new items to the feed

    syncFeedBookmarksByAdding(feedFolder, feed, jFeed, 0);
  }
}

// adds any feed items that don't exist in the folder
function syncFeedBookmarksByAdding(feedFolder, feed, jFeed, iter) {
  // add the feed items that don't already exist in the correct positions
  if (iter < jFeed.items.length && iter < feed.maxItems) {
    const item = jFeed.items[iter];
    // if the feed item dosn't exist or it doesn't match then we need to create it in that position
    if (feedFolder.children[iter] != undefined && feedItemsMatch(item, feedFolder.children[iter])) {
      syncFeedBookmarksByAdding(feedFolder, feed, jFeed, ++iter);
    } else {
      addFeedItem(feedFolder, feed, jFeed, item, iter, syncFeedBookmarksByAdding);
    }
  }
}

// updates the feeds items if things have changed by removing non-existant,
// sorting and adding items
function hasFeedUpdated(feed, jFeed) {
  // if the feed isn't updated then we don't need to do anything
  if (feed.updated != "" && jFeed.updated != "" && feed.updated === jFeed.updated) {
    return false;
  }

  feed.updated = jFeed.updated;
  return true;
}

// checks if there is an error and displays the error if so
function isError(result) {
  if (result === undefined) {
    // there was a quota limit exception
    displayError("The bookmark API limit was hit");
    return true;
  } return false;
}

// display the quota limit error
function displayError(errorText) {
  // log the msg for the user to see
  logError(errorText);
}

/*
* Copyright (c) 2010 The Chromium Authors. All rights reserved.  Use of this
* source code is governed by a BSD-style license that can be found in the
* LICENSE file.
*/

/* david.j.hamp - removed html to make this only js */

// A dictionary keyed off of tabId that keeps track of data per tab (for
// example what feedUrl was detected in the tab).
var feedData = {};

chrome.runtime.onMessage.addListener(function(request, sender) {
  if (request.msg == "feedIcon") {
  // We have received a list of feed urls found on the page.
  // Enable the page action icon.
    feedData[sender.tab.id] = request.feeds;
    chrome.pageAction.show(sender.tab.id);
  } else if (request.msg == "feedDocument") {
  // We received word from the content script that this document
  // is an RSS feed (not just a document linking to the feed).
  // So, we go straight to the subscribe page in a new tab and
  // navigate back on the current page (to get out of the xml page).
  // We don't want to navigate in-place because trying to go back
  // from the subscribe page takes us back to the xml page, which
  // will redirect to the subscribe page again (we don't support a
  // location.replace equivalant in the Tab navigation system).
    chrome.tabs.executeScript(sender.tab.id, {
      code: `if (history.length > 1) {
        history.go(-1);
      } else {
        window.close();
      }`,
    });
    const url = chrome.extension.getURL("subscribe.html?" + encodeURIComponent(request.href));
    chrome.tabs.create({url, index: sender.tab.index});
  }
});

chrome.tabs.onRemoved.addListener(function(tabId) {
  delete feedData[tabId];
});

// On Linux, popups aren't supported yet, so Chrome will call into us
// when the user clicks on the icon in the OmniBox.
chrome.pageAction.onClicked.addListener(function(tab) {
  chrome.windows.get(tab.windowId, function(window) {
    // We need to know if we are the active window, because the tab may
    // have moved to another window and we don't want to execute this
    // action multiple times.
    if (window.focused) {
      // Create a new tab showing the subscription page with the right
      // feed URL.
      const url = "subscribe.html?" +
    encodeURIComponent(feedData[tab.id][0].href);
      chrome.tabs.create({url, windowId: window.id});
    }
  });
});
