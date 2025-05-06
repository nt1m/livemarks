"use strict";

/* import-globals-from ../../shared/feed-parser.js */
/* import-globals-from ../../shared/livemark-store.js */
/* import-globals-from ../../shared/settings.js */
/* import-globals-from ../../shared/i18n.js */
/* import-globals-from opml-utils.js */

window.onload = async () => {
  await LivemarkStore.init();

  initDialogs();

  document.getElementById("add").addEventListener("click", async () => {
    let feedUrl = prompt(I18N.getMessage("enterFeedURL"));
    if (feedUrl === null) {
      return;
    }
    try {
      feedUrl = new URL(feedUrl);
    } catch (e) {
      alert(e);
      return;
    }

    let feedTitle, siteUrl;
    try {
      const {title, url, items} = await FeedParser.getFeed(feedUrl.href);
      if (items.length == 0) {
        alert(I18N.getMessage("subscribe_noEntriesFound"));
        return;
      }

      feedTitle = title;
      siteUrl = url;
    } catch (e) {
      alert(e);
      return;
    }

    const feed = {
      title: feedTitle,
      feedUrl: feedUrl.href,
      siteUrl,
      parentId: await Settings.getDefaultFolder(),
      maxItems: 25,
    };
    await LivemarkStore.add(feed);
  });

  document.getElementById("settings-toggle")
    .addEventListener("click", showSettingsDialog);

  document.getElementById("import-feeds").addEventListener("change", (event) => {
    const [file] = event.target.files;
    const reader = new FileReader();
    reader.onload = async ({ target }) => {
      try {
        const imported = importOPML(target.result);
        if (imported.length === 0) {
          alert(I18N.getMessage("subscribe_noEntriesFound"));
          return;
        }
        for (const {title, feedUrl, siteUrl} of imported) {
          const feed = {
            title,
            feedUrl,
            siteUrl,
            parentId: await Settings.getDefaultFolder(),
            maxItems: 25,
          };
          await LivemarkStore.add(feed);
        }
        alert(I18N.getMessage("settings_importExport_successImport", imported.length));
      } catch (e) {
        console.log("Error importing OPML file", e);
        alert(I18N.getMessage("settings_importExport_errorImport"));
      }
    };
    reader.readAsText(file);
  });

  document.querySelector("#delete-feed-selection").addEventListener("click", () => {
    FeedMultiSelection.removeSelectedFeeds();
  });

  loadFeeds();
  LivemarkStore.addChangeListener(loadFeeds);
  browser.bookmarks.onChanged.addListener(async (id) => {
    if (await LivemarkStore.isLivemarkFolder(id)) {
      loadFeeds();
    }
  });
  browser.bookmarks.onMoved.addListener(async (id) => {
    if (await LivemarkStore.isLivemarkFolder(id)) {
      loadFeeds();
    }
  });
};

async function showSettingsDialog() {
  const settingsForm = document.querySelector("#settings-form");
  settingsForm.pollInterval.value = await Settings.getPollInterval();
  settingsForm.readPrefix.value = await Settings.getReadPrefix();
  settingsForm.unreadPrefix.value = await Settings.getUnreadPrefix();
  settingsForm.prefixFeedFolder.checked = await Settings.getPrefixFeedFolderEnabled();
  settingsForm.prefixParentFolders.checked = await Settings.getPrefixParentFoldersEnabled();
  settingsForm.feedPreview.checked = await Settings.getFeedPreviewEnabled();
  settingsForm.elements.extensionIcon.value = await Settings.getExtensionIcon();

  settingsForm.prefixParentFolders.disabled = !settingsForm.prefixFeedFolder.checked;

  await populateFolderSelector(settingsForm.defaultFolder);

  const allFeeds = await LivemarkStore.getAll();
  const exportLink = document.getElementById("export-feeds");
  const blob = new Blob([exportOPML(allFeeds)], {type: "text/xml"});
  exportLink.href = URL.createObjectURL(blob);

  toggleDialog("settings-dialog", true);
}

function initDialogs() {
  const closesDialog = document.querySelectorAll("#dialog-overlay, .dialog-cancel");
  closesDialog.forEach(el => {
    el.addEventListener("click", () => {
      const openDialog = document.querySelector(".dialog:not([hidden])");
      toggleDialog(openDialog.id, false);
    });
  });

  const settingsForm = document.querySelector("#settings-form");
  settingsForm.addEventListener("change", async (e) => {
    e.preventDefault();
    if (settingsForm.reportValidity()) {
      settingsForm.prefixParentFolders.checked &= settingsForm.prefixFeedFolder.checked;
      settingsForm.prefixParentFolders.disabled = !settingsForm.prefixFeedFolder.checked;

      await Settings.setPollInterval(settingsForm.pollInterval.value);
      await Settings.setReadPrefix(settingsForm.readPrefix.value);
      await Settings.setUnreadPrefix(settingsForm.unreadPrefix.value);
      await Settings.setDefaultFolder(settingsForm.defaultFolder.value);
      await Settings.setPrefixFeedFolderEnabled(settingsForm.prefixFeedFolder.checked);
      await Settings.setPrefixParentFoldersEnabled(settingsForm.prefixParentFolders.checked);
      await Settings.setFeedPreviewEnabled(settingsForm.feedPreview.checked);
      await Settings.setExtensionIcon(settingsForm.elements.extensionIcon.value);
    }
  }, true);
  settingsForm.addEventListener("blur", e => e.preventDefault());
}

async function loadFeeds() {
  toggleDialog("settings-dialog", false);
  toggleDialog("edit-livemark-dialog", false);
  const broken = [];
  const allFeeds = await LivemarkStore.getAll(broken);
  document.getElementById("feeds").textContent = "";
  allFeeds.sort((a, b) => {
    return a.title.localeCompare(b.title);
  }).forEach(feed => addFeedToList(feed, false));

  broken.forEach((feed) => {
    feed.title = I18N.getMessage("settings_brokenLivemark");
    addFeedToList(feed, true);
  });

  FeedMultiSelection.reset();
}

const FeedMultiSelection = {
  selection: new Set(),
  selectAllCheckbox: document.getElementById("select-all-checkbox"),
  async _updateSelectAllCheckboxState() {
    const size = await LivemarkStore.getSize();
    const isEmptySelection = this.selection.size == 0;
    this.selectAllCheckbox.indeterminate = !isEmptySelection && this.selection.size < size;
    this.selectAllCheckbox.checked = !isEmptySelection && this.selection.size == size;
    this.selectAllCheckbox.disabled = size == 0;
    document.getElementById("selection-toolbar").hidden = size == 0;
  },
  addToSelection(feed) {
    this.selection.add(feed);
    this._updateSelectAllCheckboxState();
  },
  addAllToSelection() {
    for (const element of document.querySelectorAll("#feeds > .feed")) {
      this.selection.add(element.feedData);
      element.querySelector(".feed-checkbox").checked = true;
    }
    this._updateSelectAllCheckboxState();
  },
  removeFromSelection(feed) {
    this.selection.delete(feed);
    this._updateSelectAllCheckboxState();
  },
  reset() {
    this.selection.clear();
    for (const element of document.querySelectorAll("#feeds > .feed")) {
      element.querySelector(".feed-checkbox").checked = false;
    }
    this._updateSelectAllCheckboxState();

    // XXX: probably doesn't belong here...
    this.selectAllCheckbox.onchange = () => {
      if (this.selectAllCheckbox.checked) {
        this.addAllToSelection();
      } else {
        this.reset();
      }
    };
  },

  moveSelectedFeeds(folder) {
    // XXX: todo
  },
  async removeSelectedFeeds() {
    for (const feed of this.selection) {
      await LivemarkStore.remove(feed.id);
    }
    this.selection.clear();
  }
};

function addFeedToList(feed, broken = false) {
  const item = document.createElement("div");
  item.className = "feed card";
  item.feedData = feed;
  if (broken) {
    item.classList.add("broken");
  }

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "feed-checkbox";
  checkbox.onchange = () => {
    if (checkbox.checked) {
      FeedMultiSelection.addToSelection(feed);
    } else {
      FeedMultiSelection.removeFromSelection(feed);
    }
  };
  item.appendChild(checkbox);

  const feedTitle = document.createElement("span");
  feedTitle.textContent = feed.title;
  feedTitle.className = "feed-title";
  item.appendChild(feedTitle);

  const feedUrl = document.createElement("span");
  feedUrl.textContent = feed.feedUrl;
  feedUrl.className = "feed-url";
  item.appendChild(feedUrl);

  const editIcon = document.createElement("button");
  editIcon.title = I18N.getMessage("settings_editFeed");
  editIcon.className = "icon more feed-edit";
  editIcon.onclick = () => {
    if (!broken) {
      showEditFeedDialog(feed);
    } else {
      showSelectFolderDialog(feed);
    }
  };
  item.appendChild(editIcon);
  document.getElementById("feeds").appendChild(item);
}

async function showEditFeedDialog(feed) {
  const dialog = document.querySelector("#edit-livemark-dialog");

  // Prevent race conditions
  toggleDialog(dialog.id, false);

  await populateFolderSelector(dialog.parentId);

  const {title, feedUrl, siteUrl, parentId, maxItems, id} = feed;
  dialog.title.value = title;
  dialog.feedUrl.value = feedUrl;
  dialog.siteUrl.value = siteUrl;
  dialog.parentId.value = parentId;
  dialog.maxItems.value = maxItems;

  const deleteButton = dialog.querySelector(".delete");
  deleteButton.onclick = async (e) => {
    e.preventDefault();
    toggleDialog(dialog.id, false);
    await LivemarkStore.remove(id);
  };
  dialog.onsubmit = async (e) => {
    e.preventDefault();

    const valid = dialog.reportValidity();
    if (valid) {
      toggleDialog(dialog.id, false);
      const formData = new FormData(dialog);
      const props = {};
      for (const [key, value] of formData.entries()) {
        props[key] = value;
      }
      await LivemarkStore.edit(id, props);
    }
  };
  toggleDialog(dialog.id, true);
}

async function showSelectFolderDialog(feed) {
  const dialog = document.querySelector("#select-folder-dialog");

  toggleDialog(dialog.id, false);

  await populateFolderSelector(dialog.livemarkFolder, true);

  const deleteButton = dialog.querySelector(".delete");
  deleteButton.onclick = async (e) => {
    e.preventDefault();
    toggleDialog(dialog.id, false);
    await LivemarkStore.remove(feed.id);
  };

  dialog.onsubmit = async (e) => {
    e.preventDefault();

    const valid = dialog.reportValidity();
    if (valid) {
      toggleDialog(dialog.id, false);

      await LivemarkStore.remove(feed.id);
      await LivemarkStore.addWithBookmark(dialog.livemarkFolder.value, feed);
    }
  };

  toggleDialog(dialog.id, true);
}

async function populateFolderSelector(folderSelector, removeBuiltin = false) {
  const allFolders = await getAllBookmarkFolders();
  const readPrefix = await Settings.getReadPrefix();
  const unreadPrefix = await Settings.getUnreadPrefix();
  folderSelector.textContent = "";
  folderSelector.append(...allFolders.filter(folder => {
    if (removeBuiltin) {
      const builtinIds = ["toolbar_____", "menu________", "unfiled_____", "mobile______"];
      return !builtinIds.includes(folder.id);
    }

    return true;
  }).map(folder => {
    const option = document.createElement("option");
    option.value = folder.id;

    let title = folder.title;
    title = PrefixUtils.removePrefix(readPrefix, title);
    title = PrefixUtils.removePrefix(unreadPrefix, title);

    option.textContent = title;
    return option;
  }));
  folderSelector.value = await Settings.getDefaultFolder();
}

function toggleDialog(id, shown) {
  document.getElementById(id).hidden = !shown;
  document.getElementById("dialog-overlay").hidden = !shown;
}
