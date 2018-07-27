"use strict";

/* import-globals-from scripts/feed_util.js */
/* import-globals-from scripts/log_utils.js */
/* import-globals-from scripts/settings.js */
/* import-globals-from scripts/options_utils.js */

const siteBookmarkPrefix = 'Open "';
const siteBookmarkPostfix = '"';

var LivemarkManager = {
  _feeds: [],
  get feeds() {
    return this._feeds;
  },
  set feeds(updatedFeeds) {
    this._feeds = updatedFeeds;
    this.updateFeeds();
  },

  _intervalId: null,
  set pollInterval(minutes) {
    if (this._intervalId) {
      window.clearInterval(this._intervalId);
    }
    // double check the interval since this could hose the browser
    if (!minutes >= 5) {
      minutes = 5;
    }
    this._intervalId = window.setInterval(this.updateFeeds, 1000 * 60 * minutes);
  },

  async updateLivemark(feed) {
    const folder = await getBookmarkFolder(feed);

    if (folder === null) {
      if (!await doesParentFolderExist(feed)) {
      // if the parent doesn't exist then alert the user
        logError("the parent folder wasn't found for feed: " + feed.name +
          " please check and resave your settings");
        return;
      }

      if (doesFolderBelongToFeed(feed.parentFolderId, this.feeds)) {
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

    if (doesFolderBelongToFeed(feed.parentFolderId, this.feeds)) {
    // if the parent folder is actually another feeds folder that could cause issues
      logError("feed: " + feed.name + " has its parent folder set to the" +
          " folder of another feed.  This would cause issues.  You must change it before a" +
          " sync will occur");
      return;
    }

    // poll the feed
    pollFeed(folder, feed);
  },
  // polls each configured feed with a delay between each to reduce load all at once
  async updateFeeds() {
    for (const feed of this.feeds) {
      await this.updateLivemark(feed);
    }
  },
  init() {
    this.feeds = getFeedConfig();
    this.pollInterval = getPollInterval();
  }
};
LivemarkManager.init();

// this is an async function that will call the pollfeeds once its done
async function createFeedFolder(feed) {
  const folder = await browser.bookmarks.create({
    "parentId": feed.parentFolderId,
    "title": feed.name
  });
  // TODO: need to handle if the parent folder doesn't exist
  // add the folder id to the feeds config
  feed.folderId = folder.id;
  addFolderIdToFeedSettings(feed);

  folder.children = [];
  // poll the feed folder
  pollFeed(folder, feed);
}

// pulls the feed
function pollFeed(feedFolder, feed) {
  return new Promise((resolve, reject) => {
    jQuery.getFeed({
      url: feed.feedUrl,
      success(jFeed) {
        if (jFeed.items === undefined) {
          displayError(feed.name + " was polled but contained no entries");
        } else if (hasFeedUpdated(feed, jFeed)) {
          populateLivemark(feedFolder, feed, jFeed);
        }
        resolve();
      },
      error(errorText) {
        displayError('feed "' + feed.feedUrl + '" couldn\'t be pulled.  The error was: ' + errorText);
        reject();
      },
    });
  });
}

// adds the site url bookmark if it doesn't
// exist already
async function addFeedSiteUrlBookmark(feedFolder, feed) {
  await browser.bookmarks.create({
    title: siteBookmarkPrefix + feed.name + siteBookmarkPostfix,
    url: feed.siteUrl,
    parentId: feedFolder.id,
  });
  await browser.bookmarks.create({
    type: "separator",
    title: "",
    parentId: feedFolder.id,
  });
}

async function populateLivemark(feedFolder, feed, jFeed) {
  for (const bookmark of await browser.bookmarks.getChildren(feedFolder.id)) {
    await browser.bookmarks.remove(bookmark.id);
  }

  await addFeedSiteUrlBookmark(feedFolder, feed);
  const max = Math.min(feed.maxItems, jFeed.items.length);
  for (let i = 0; i < max; i++) {
    const item = jFeed.items[i];
    await browser.bookmarks.create({
      "parentId": feedFolder.id,
      "title": item.title,
      "url": item.url,
    });
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

// display the quota limit error
function displayError(errorText) {
  // log the msg for the user to see
  logError(errorText);
}

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
