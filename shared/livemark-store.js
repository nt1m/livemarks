"use strict";

/**
 * Asynchronous ES6 Map that syncs with WebExtension storage
 */
class StoredMap extends Map {
  /**
   * Build a StoredMap
   * @param storageKey The key that will be use to save and retreive the map.
   */
  constructor(storageKey) {
    const getFromStorage = async () => {
      const found = await browser.storage.sync.get(storageKey);
      if (!found.hasOwnProperty(storageKey)) {
        return [];
      }

      return found[storageKey];
    };

    const setupSync = () => {
      browser.storage.onChanged.addListener(async (changes, area) => {
        if (area !== "sync" || !changes.hasOwnProperty(storageKey)) {
          return;
        }
        const objectEquals = (a, b) => {
          for (const key in a) {
            if (!(key in b) || a[key] !== b[key]) {
              return false;
            }
          }
          for (const key in b) {
            if (!(key in a) || a[key] !== b[key]) {
              return false;
            }
          }
          return true;
        };

        const deleted = [];
        const changed = [];
        const stored = new Map(changes[storageKey].newValue);
        for (const key of this.keys()) {
          if (!stored.has(key)) {
            deleted.push(key);
          }
        }

        for (const [key, value] of stored) {
          if (!this.has(key) || !objectEquals(value, this.get(key))) {
            changed.push(key);
          }
        }

        for (const deletion of deleted) {
          super.delete(deletion);
        }

        for (const change of changed) {
          super.set(change, stored.get(change));
        }

        this._emit({ changedKeys: [...deleted, ...changed]});
      });
    };

    const loadFromStorage = async () => {
      const stored = await getFromStorage();
      super(stored);
      this.storageKey = storageKey;
      setupSync();
      return this;
    };

    return loadFromStorage();
  }

  _emit(data, ownChange = false) {
    // already in sync, don't notify
    if (data.changedKeys.length == 0) {
      return;
    }

    if (!this.listeners) {
      this.listeners = new Map();
    }
    for (const listener of this.listeners.keys()) {
      if (!ownChange || this.listeners.get(listener).ownChanges) {
        listener(data);
      }
    }
  }

  addChangeListener(callback, options = { ownChanges: false }) {
    if (!this.listeners) {
      this.listeners = new Map();
    }
    this.listeners.set(callback, options);
  }

  removeChangeListener(callback) {
    if (!this.listeners) {
      this.listeners = new Map();
    }
    this.listeners.delete(callback);
  }

  onceChange(options) {
    return new Promise(resolve => {
      const listener = (event) => {
        this.removeChangeListener(listener);
        resolve(event);
      };
      this.addChangeListener(listener, options);
    });
  }

  async set(k, v) {
    const returnValue = super.set(k, v);
    if (this.storageKey) {
      await browser.storage.sync.set({
        [this.storageKey]: [...this.entries()],
      });
    }
    this._emit({ changedKeys: [k] }, true);
    return returnValue;
  }

  async delete(k) {
    const returnValue = super.delete(k);
    await browser.storage.sync.set({
      [this.storageKey]: [...this.entries()],
    });
    this._emit({ changedKeys: [k] }, true);
    return returnValue;
  }

  async clear() {
    const oldKeys = [...this.keys()];
    super.clear();
    await browser.storage.sync.set({
      [this.storageKey]: [],
    });
    this._emit({ changedKeys: oldKeys }, true);
  }
}

/* exported LivemarkStore */
const LivemarkStore = {
  isLivemarkFolder(id) {
    return this.store.has(id);
  },
  getAll() {
    const keys = [...this.store.keys()];
    return Promise.all(keys.map(id => {
      return this.getDetails(id);
    }));
  },
  async add(feed) {
    const { title, parentId } = feed;
    const bookmark = await browser.bookmarks.create({
      title,
      type: "folder",
      parentId,
    });
    await this.store.set(bookmark.id, {
      feedUrl: feed.feedUrl,
      siteUrl: feed.siteUrl,
      maxItems: feed.maxItems,
    });
  },

  async remove(bookmarkId) {
    try {
      await browser.bookmarks.removeTree(bookmarkId);
    } catch (e) {
      // Bookmark already deleted
    }
    await this.store.delete(bookmarkId);
  },

  async edit(id, feed) {
    const oldFeed = this.store.get(id);
    const [oldBookmark] = await browser.bookmarks.get(id);
    if (!oldBookmark || !oldFeed) {
      return;
    }
    // Handle renames
    if (feed.title && feed.title !== oldBookmark.title) {
      await browser.bookmarks.update(id, {
        "title": feed.title,
      });
    }

    // Folder change
    if (feed.parentId && feed.parentId !== oldBookmark.parentId) {
      await browser.bookmarks.move(id, {
        "parentId": feed.parentId,
      });
    }

    if (feed.siteUrl && feed.siteUrl !== oldFeed.siteUrl) {
      oldFeed.siteUrl = feed.siteUrl;
    }

    if (feed.feedUrl && feed.feedUrl !== oldFeed.feedUrl) {
      oldFeed.feedUrl = feed.feedUrl;
    }

    if (feed.maxItems && feed.maxItems !== oldFeed.maxItems) {
      oldFeed.maxItems = feed.maxItems;
    }

    if (feed.updated && feed.updated !== oldFeed.updated) {
      oldFeed.updated = feed.updated;
    }
    this.store.set(id, oldFeed);
  },

  async getDetails(id) {
    const [{title, parentId}] = await browser.bookmarks.get(id);
    const {feedUrl, siteUrl, maxItems, updated} = this.store.get(id);
    return {
      title,
      feedUrl,
      siteUrl,
      maxItems,
      parentId,
      updated,
      id,
    };
  },

  async init() {
    const found = await browser.storage.local.get("livemarks");
    // Migrate local storage to sync storage
    if (found.hasOwnProperty("livemarks")) {
      if (found.livemarks.length && found.livemarks.length > 0) {
        await browser.storage.sync.set({
          livemarks: found.livemarks,
        });
      }
      await browser.storage.local.remove("livemarks");
    }
    this.store = await new StoredMap("livemarks");
    browser.bookmarks.onRemoved.addListener(id => {
      if (this.isLivemarkFolder(id)) {
        this.remove(id);
      }
    });
  }
};
