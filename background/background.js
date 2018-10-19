"use strict";

/* import-globals-from ../shared/livemark-store.js */
/* import-globals-from ../shared/settings.js */
/* import-globals-from ../shared/feed-parser.js */

const siteBookmarkPrefix = 'Open "';
const siteBookmarkPostfix = '"';

const LivemarkUpdater = {
  async init() {
    await LivemarkStore.init();
    this.updateAllLivemarks = this.updateAllLivemarks.bind(this);
    this.handleSettingsChange = this.handleSettingsChange.bind(this);

    const interval = await Settings.getPollInterval();
    this.intervalId = setInterval(this.updateAllLivemarks, 60 * 1000 * interval);

    LivemarkStore.store.addChangeListener(this.updateAllLivemarks);
    Settings.addChangeListener(this.handleSettingsChange);
    await this.updateAllLivemarks();
  },
  async handleSettingsChange(changes) {
    if (changes["settings.pollInterval"]) {
      clearInterval(this.intervalId);
      const interval = await Settings.getPollInterval();
      this.intervalId = setInterval(this.updateAllLivemarks, 60 * 1000 * interval);
    }
  },
  async updateAllLivemarks({changedKeys = []} = {}) {
    const livemarks = await LivemarkStore.getAll();
    for (const feed of livemarks) {
      try {
        this.updateLivemark(feed, {
          forceUpdate: changedKeys.includes(feed.id),
        });
      } catch (e) {
        console.log("Error getting feed", e);
      }
    }
  },
  // adds the site url bookmark if it doesn't
  // exist already
  async addFeedSiteUrlBookmark(folder, feed) {
    await browser.bookmarks.create({
      title: siteBookmarkPrefix + folder.title + siteBookmarkPostfix,
      url: feed.siteUrl,
      parentId: folder.id,
    });
    await browser.bookmarks.create({
      type: "separator",
      title: "",
      parentId: folder.id,
    });
  },
  async updateLivemark(feed, options) {
    const {
      forceUpdate = false,
    } = options || {};

    const feedData = await FeedParser.getFeed(feed.feedUrl);
    if (feedData.updated && feedData.updated == feed.updated && !forceUpdate) {
      return;
    }
    const [folder] = await browser.bookmarks.get(feed.id);
    let readPrefix = await Settings.getReadPrefix();
    if (readPrefix.length > 0) {
      readPrefix += " ";
    }

    let unreadPrefix = await Settings.getUnreadPrefix();
    if (unreadPrefix.length > 0) {
      unreadPrefix += " ";
    }

    const children = await browser.bookmarks.getChildren(folder.id);
    for (const bookmark of children) {
      await browser.bookmarks.remove(bookmark.id);
    }

    if (feed.siteUrl) {
      await this.addFeedSiteUrlBookmark(folder, feed);
    }
    const max = Math.min(feed.maxItems, feedData.items.length);
    for (let i = 0; i < max; i++) {
      const item = feedData.items[i];
      const visits = await browser.history.getVisits({"url": item.url});
      await browser.bookmarks.create({
        "parentId": folder.id,
        "title": ((visits.length > 0) ? readPrefix : unreadPrefix) + item.title,
        "url": item.url,
      });
    }
    await LivemarkStore.edit(folder.id, {updated: feedData.updated});
  }
};

/* Context menu */

const ContextMenu = {
  async init() {
    const createReloadItem = async () => {
      this.reloadItemId = await browser.menus.create({
        contexts: ["bookmark"],
        title: "Reload Live Bookmark",
      });
    };
    browser.menus.onShown.addListener(async ({bookmarkId}) => {
      if (!LivemarkStore.store.has(bookmarkId)) {
        await browser.menus.remove(this.reloadItemId);
        this.reloadItemId = null;
      } else if (!this.reloadItemId) {
        await createReloadItem();
      }
      await browser.menus.refresh();
    });
    browser.menus.onClicked.addListener(async ({bookmarkId, menuItemId}) => {
      if (LivemarkStore.store.has(bookmarkId) && menuItemId == this.reloadItemId) {
        const feed = await LivemarkStore.getDetails(bookmarkId);
        await LivemarkUpdater.updateLivemark(feed, {forceUpdate: true});
      }
    });
    createReloadItem();
  }
};

LivemarkUpdater.init().then(() => ContextMenu.init());

// A dictionary keyed off of tabId that keeps track of data per tab (for
// example what feedUrl was detected in the tab).
var feedData = {};

browser.runtime.onMessage.addListener(async (request, sender) => {
  if (request.msg == "feedIcon") {
  // We have received a list of feed urls found on the page.
  // Enable the page action icon.
    feedData[sender.tab.id] = request.feeds;
    chrome.pageAction.show(sender.tab.id);
  }

  if (request.msg == "get-feed") {
    return await FeedParser.getFeed(request.feedUrl);
  }

  if (request.msg == "subscribe") {
    const {title, feedUrl, siteUrl} = request;
    const folderId = await Settings.getDefaultFolder();

    await LivemarkStore.add({
      title,
      feedUrl,
      siteUrl,
      parentId: folderId,
      maxItems: 25,
    });

    const [folderProps] = await browser.bookmarks.get(folderId);
    return folderProps.title;
  }
});

chrome.tabs.onRemoved.addListener(function(tabId) {
  delete feedData[tabId];
});

chrome.webRequest.onHeadersReceived.addListener(details => {
  const isRSS = details.responseHeaders.some(header => {
    if (header["name"].toLowerCase() == "content-type") {
      const type = header["value"].toLowerCase().replace(/^\s+|\s*(?:;.*)?$/g, "");
      return type == "application/rss+xml" || type == "application/atom+xml";
    }

    return false;
  });

  if (isRSS) {
    const url = chrome.extension.getURL("pages/subscribe/subscribe.html") + "?" +
                  encodeURIComponent(details.url);
    return {
      redirectUrl: url,
    }
  }
}, {urls: ["<all_urls>"], types: ["main_frame"]}, ["blocking", "responseHeaders"]);
