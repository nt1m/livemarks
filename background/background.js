"use strict";

/* import-globals-from ../shared/livemark-store.js */
/* import-globals-from ../shared/settings.js */

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
  async updateAllLivemarks() {
    const livemarks = await LivemarkStore.getAll();
    for (const feed of livemarks) {
      const [bookmark] = await browser.bookmarks.get(feed.id);
      const jFeed = await this.getLivemarkItems(feed);

      if (jFeed && jFeed.updated !== feed.updated) {
        this.updateLivemark(bookmark, feed, jFeed);
      }
    }
  },
  getLivemarkItems(feed) {
    return new Promise((resolve, reject) => {
      jQuery.getFeed({
        url: feed.feedUrl,
        success(jFeed) {
          resolve(jFeed);
        },
        error(errorText) {
          reject(errorText);
        },
      });
    });
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
  async updateLivemark(folder, feed, jFeed) {
    const children = await browser.bookmarks.getChildren(folder.id);
    for (const bookmark of children) {
      await browser.bookmarks.remove(bookmark.id);
    }

    if (feed.siteUrl) {
      await this.addFeedSiteUrlBookmark(folder, feed);
    }
    const max = Math.min(feed.maxItems, jFeed.items.length);
    for (let i = 0; i < max; i++) {
      const item = jFeed.items[i];
      await browser.bookmarks.create({
        "parentId": folder.id,
        "title": item.title,
        "url": item.url,
      });
    }
    await LivemarkStore.edit(folder.id, {updated: jFeed.updated});
  }
};

LivemarkUpdater.init();

// A dictionary keyed off of tabId that keeps track of data per tab (for
// example what feedUrl was detected in the tab).
var feedData = {};

chrome.runtime.onMessage.addListener(function(request, sender) {
  if (request.msg == "feedIcon") {
  // We have received a list of feed urls found on the page.
  // Enable the page action icon.
    feedData[sender.tab.id] = request.feeds;
    chrome.pageAction.show(sender.tab.id);
  }
});

chrome.tabs.onRemoved.addListener(function(tabId) {
  delete feedData[tabId];
});
