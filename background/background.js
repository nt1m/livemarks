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

    const next = () => {
      const feed = livemarks.pop();
      if (feed) {
        this.updateLivemark(feed, {
          forceUpdate: changedKeys.includes(feed.id),
        }).finally(next);
      }
    };

    // Only update at most 5 livemarks concurrently.
    livemarks.splice(0, 5).forEach(feed => {
      this.updateLivemark(feed, {
        forceUpdate: changedKeys.includes(feed.id),
      }).finally(next);
    });
  },
  // adds the site url bookmark if it doesn't
  // exist already. Returns whether or not it modified the child list.
  async addFeedSiteUrlBookmark(folder, feed, children) {
    const siteUrlTitle = siteBookmarkPrefix + folder.title + siteBookmarkPostfix;
    let didChange = false;
    if (children.length === 0) {
      await browser.bookmarks.create({
        title: siteUrlTitle,
        url: feed.siteUrl,
        parentId: folder.id,
      });
      didChange = true;
    } else if (children[0].title !== siteUrlTitle ||
               children[0].url !== feed.siteUrl) {
      await browser.bookmarks.update(children[0].id, {
        title: siteUrlTitle,
        url: feed.siteUrl,
      });
      didChange = true;
    }

    if (children.length <= 1 || children[1].type !== "separator") {
      // We don't have a separator or it's in the wrong place, just make a new
      // one. We delete separators found later in the list anyway.
      await browser.bookmarks.create({
        parentId: folder.id,
        title: "",
        type: "separator",
        index: 1,
      });
      didChange = true;
    }
    return didChange;
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

    // Note: We make an effort to avoid unnecessary churn on bookmark
    // creation/deletion, as it give firefox sync a hard time:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1499881

    let children = await browser.bookmarks.getChildren(folder.id);
    let startIndex = 0;

    if (feed.siteUrl) {
      const didChange = await this.addFeedSiteUrlBookmark(folder, feed, children);
      // Changes should be rare, so just refetch the child list if it changed
      // rather than attempting to keep it up to date.
      if (didChange) {
        children = await browser.bookmarks.getChildren(folder.id);
      }
      startIndex = 2;
    }

    // List of children we can overwrite with update.
    const usableChildren = [];

    for (let i = startIndex; i < children.length; ++i) {
      // Remove unexpected separators/folders, since update can't change type.
      const bookmark = children[i];
      if (bookmark.type !== "bookmark") {
        await browser.bookmarks.remove(bookmark.id);
      } else {
        usableChildren.push(bookmark);
      }
    }

    // Filter items with no title and URL.
    const items = feedData.items.filter(item => item.title || item.url);
    const max = Math.min(feed.maxItems, items.length);
    let i = 0;
    for (; i < max; i++) {
      const item = items[i];
      const url = item.url || feed.feedUrl;
      let visits = 0;
      try {
        visits = (await browser.history.getVisits({url})).length;
      } catch (e) {}
      const title = ((visits > 0) ? readPrefix : unreadPrefix) + item.title;
      if (i < usableChildren.length) {
        // There's a child in the right place, see if it has the right data,
        // and update it if not.
        const child = usableChildren[i];
        if (child.url !== url || child.title !== title) {
          await browser.bookmarks.update(child.id, {
            title,
            url
          });
        }
      } else {
        // Out of children, make a new one.
        await browser.bookmarks.create({
          parentId: folder.id,
          title,
          url
        });
      }
    }
    // Delete any children we didn't end up needing.
    for (; i < usableChildren.length; ++i) {
      await browser.bookmarks.remove(usableChildren[i].id);
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

function getSubscribeURL(feedUrl) {
  const url = chrome.extension.getURL("pages/subscribe/subscribe.html");
  return url + "?" + encodeURIComponent(feedUrl);
}

const FeedPreview = {
  async init() {
    // This value needs to be synchronously accessible in the
    // chrome.webRequest.onHeadersReceived listener below.
    this.enabled = await Settings.getFeedPreviewEnabled();

    Settings.addChangeListener(async (changes) => {
      if (changes["settings.feedPreviewEnabled"]) {
        this.enabled = await Settings.getFeedPreviewEnabled();
      }
    });
  },

  show(tabId, url) {
    chrome.tabs.update(tabId, {url: getSubscribeURL(url), loadReplace: true});
  }
};

(async function() {
  await LivemarkUpdater.init();
  await ContextMenu.init();
  await FeedPreview.init();
})();

// A dictionary keyed off of tabId that keeps track of data per tab (for
// example what feedUrl was detected in the tab).
var feedData = {};

browser.runtime.onMessage.addListener(async (request, sender) => {
  if (request.msg == "feeds") {
  // We have received a list of feed urls found on the page.
  // Enable the page action icon.
    feedData[sender.tab.id] = request.feeds;
    chrome.pageAction.show(sender.tab.id);
  }

  if (request.msg == "load-preview") {
    if (FeedPreview.enabled) {
      FeedPreview.show(sender.tab.id, request.url);
    }
  }

  if (request.msg == "get-feed") {
    return FeedParser.getFeed(request.feedUrl);
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
  if (!FeedPreview.enabled) {
    // Feed preview disabled, nothing to do here.
    return;
  }

  const header = details.responseHeaders.find(h => {
    return h.name.toLowerCase() == "content-type";
  });
  if (header === undefined) {
    return;
  }

  // Atom or RSS MIME type, redirect to preview page
  const type = header.value.toLowerCase().replace(/^\s+|\s*(?:;.*)?$/g, "");
  if (type == "application/rss+xml" || type == "application/atom+xml") {
    return {
      redirectUrl: getSubscribeURL(details.url),
    };
  }

  // XML MIME type, try sniffing for feed content
  if (type == "application/xml" || type == "text/xml") {
    const decoder = new TextDecoder("utf-8");
    let str = "";

    const filter = browser.webRequest.filterResponseData(details.requestId);
    filter.ondata = async (event) => {
      filter.write(event.data);

      str += decoder.decode(event.data, {stream: true});
      if (str.includes("<channel") || str.includes("<feed")) {
        filter.disconnect();

        try {
          // Verify that this is actually a feed by parsing it.
          const feed = await FeedParser.getFeed(details.url);
          if (feed.items.length > 0) {
            FeedPreview.show(details.tabId, details.url);
          }
        } catch (e) {}
        return;
      }

      // Stop sniffing after some time.
      if (str.length > 1024) {
        filter.disconnect();
      }
    };
    filter.onstop = (event) => {
      filter.disconnect();
    };
  }
}, {urls: ["<all_urls>"], types: ["main_frame"]}, ["blocking", "responseHeaders"]);
