"use strict";

/* import-globals-from ../../shared/livemark-store.js */
/* import-globals-from ../../shared/settings.js */
/* import-globals-from opml-utils.js */

window.onload = async () => {
  await LivemarkStore.init();

  initDialogs();

  document.getElementById("add").addEventListener("click", async () => {
    let url = prompt("Enter Feed URL");
    if (url) {
      url = new URL(url);
      const feed = {
        title: url.hostname,
        feedUrl: url.href,
        siteUrl: url.origin,
        parentId: await Settings.getDefaultFolder(),
        maxItems: 25,
      };
      await LivemarkStore.add(feed);
    }
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
          alert("No feeds found");
          return;
        }
        for (const feed of imported) {
          await LivemarkStore.add(feed);
        }
        alert(`Successfully imported ${imported.length} feeds.`);
      } catch (e) {
        console.log("Error importing OPML file", e);
        alert("Error importing OPML file");
      }
    };
    reader.readAsText(file);
  });

  loadFeeds();
  LivemarkStore.store.addChangeListener(loadFeeds, { ownChanges: true });
};

async function showSettingsDialog() {
  const settingsForm = document.querySelector("#settings-form");
  settingsForm.pollInterval.value = await Settings.getPollInterval();

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
      await Settings.setPollInterval(settingsForm.pollInterval.value);
      await Settings.setDefaultFolder(settingsForm.defaultFolder.value);
    }
  }, true);
  settingsForm.addEventListener("blur", e => e.preventDefault());
}

async function loadFeeds() {
  const allFeeds = await LivemarkStore.getAll();
  document.getElementById("feeds").textContent = "";
  allFeeds.forEach(addFeedToList);
}

function addFeedToList(feed) {
  const item = document.createElement("div");
  item.className = "feed card";

  const feedTitle = document.createElement("span");
  feedTitle.textContent = feed.title;
  feedTitle.className = "feed-title";
  item.appendChild(feedTitle);

  const feedUrl = document.createElement("span");
  feedUrl.textContent = feed.feedUrl;
  feedUrl.className = "feed-url";
  item.appendChild(feedUrl);

  const editIcon = document.createElement("button");
  editIcon.className = "icon more feed-edit";
  editIcon.onclick = () => showEditFeedDialog(feed);
  item.appendChild(editIcon);
  document.getElementById("feeds").appendChild(item);
}

async function showEditFeedDialog(feed) {
  const dialog = document.querySelector("#edit-livemark-dialog");

  // Prevent race conditions
  toggleDialog(dialog.id, false);

  await populateFolderSelector(dialog.parentId);

  const {title, feedUrl, siteUrl, parentId, id} = feed;
  dialog.title.value = title;
  dialog.feedUrl.value = feedUrl;
  dialog.siteUrl.value = siteUrl;
  dialog.parentId.value = parentId;

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

async function populateFolderSelector(folderSelector) {
  const allFolders = await getAllBookmarkFolders();
  folderSelector.textContent = "";
  folderSelector.append(...allFolders.map(folder => {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.title;
    return option;
  }));
  folderSelector.value = await Settings.getDefaultFolder();
}

function toggleDialog(id, shown) {
  document.getElementById(id).hidden = !shown;
  document.getElementById("dialog-overlay").hidden = !shown;
}
