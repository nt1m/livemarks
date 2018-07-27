"use strict";

async function doesParentFolderExist(feed) {
  const bookmarks = await browser.bookmarks.get(feed.parentFolderId);
  return bookmarks.length == 1;
}

// Finds a feeds folder if it exists based on its id or its name and parent folder
async function getLivemarkFolder(feed) {
  if (feed.folderId !== null) {
    const bookmarks = await browser.bookmarks.get(feed.folderId);

    if (bookmarks.length == 1) {
      return bookmarks[0];
    }
  }

  // check for parent
  for (const child in await browser.bookmarks.getChildren(feed.parentFolderId)) {
    if (child.title === feed.name) {
      const children = await browser.bookmarks.getChildren(child.id);
      if (children.length > 1 && children[1].type === "separator") {
        return child;
      }
    }
  }

  // feed folder wasn't found in its parent
  return null;
}
