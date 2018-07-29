"use strict";

/* import-globals-from livemark-store.js */

/* exported Settings */
const Settings = {
  async getDefaultFolder() {
    const folders = await getAllBookmarkFolders();
    const folder = await getSetting("defaultFolder", folders[0].id);

    // check if folder exists
    try {
      const query = await browser.bookmarks.get(folder);
      if (query.length === 0) {
        return folders[0].id;
      }
    } catch (e) {
      return folders[0].id;
    }
    return folder;
  },

  setDefaultFolder(newValue) {
    return setSetting("defaultFolder", newValue);
  },

  getPollInterval() {
    return getSetting("pollInterval", 5);
  },

  setPollInterval(newValue) {
    if (newValue < 1) {
      newValue = 1;
    }
    return setSetting("pollInterval", newValue);
  },

  getReadPrefix() {
    return getSetting("readPrefix", "");
  },

  setReadPrefix(newValue) {
    return setSetting("readPrefix", newValue);
  },

  getUnreadPrefix() {
    return getSetting("unreadPrefix", "");
  },

  setUnreadPrefix(newValue) {
    return setSetting("unreadPrefix", newValue);
  },

  addChangeListener(callback) {
    return browser.storage.onChanged.addListener(changes => {
      changes = Object.assign({}, changes);
      for (const change in changes) {
        if (!change.startsWith("settings.")) {
          delete changes[change];
        }
      }
      if (Object.keys(changes).length > 0) {
        callback(changes);
      }
    });
  },
};

async function getSetting(setting, fallback) {
  try {
    const found = await browser.storage.local.get("settings." + setting);
    if (found.hasOwnProperty("settings." + setting)) {
      return found["settings." + setting];
    }
    return fallback;
  } catch (e) {
    return fallback;
  }
}

async function setSetting(setting, value) {
  await browser.storage.local.set({["settings." + setting]: value});
}

// gets all the bookmark folders
async function getAllBookmarkFolders() {
  const [rootTree] = await browser.bookmarks.getTree();
  const folders = [];
  const visitChildren = async (tree) => {
    for (const child of tree) {
      if (child.type !== "folder" || !child.id) {
        continue;
      }

      // if the folder belongs to a feed then skip it and its children
      const isLivemark = await LivemarkStore.isLivemarkFolder(child.id);
      if (isLivemark) {
        continue;
      }

      folders.push(child);
      await visitChildren(child.children);
    }
  };
  await visitChildren(rootTree.children);
  return folders;
}
