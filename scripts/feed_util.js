"use strict";

function doesParentFolderExist(tree, feed) {
  const parentFolder = getBookmarkFolderById(tree, feed.parentFolderId);
  return parentFolder !== null;
}

// Finds a feeds folder if it exists based on its id or its name and parent folder
function getBookmarkFolder(tree, feed) {
  let folder = null;
  if (feed.folderId != null) {
    folder = getBookmarkFolderById(tree, feed.folderId);
  }

  if (folder == null) {
    folder = getFeedBasedOnParentFolderId(tree, feed);
  }

  return folder;
}

// finds the folder node that matches the passed in id
function getBookmarkFolderById(tree, id) {
  for (const i in tree) {
    if (tree[i].children !== undefined) {
      if (tree[i].id === id) {
        return tree[i];
      }

      const folder = getBookmarkFolderById(tree[i].children, id);
      if (folder !== null) {
        return folder;
      }
    }
  }

  return null;
}

// returns the feeds folder based on its parent and name
function getFeedBasedOnParentFolderId(tree, feed) {
  const folder = getBookmarkFolderById(tree, feed.parentFolderId);

  // parent folder wasn't found
  if (folder === null) {
    return null;
  }

  let child;
  for (const i in folder.children) {
    child = folder.children[i];
    if (child.children != undefined) {
      // we have a possiable match, to verify check for the separator
      const hasSeparator = child.children.length > 0
        && child.children[1].type === "separator";
      if (child.title === feed.name && hasSeparator) {
        return child;
      }
    }
  }

  // feed folder wasn't found in its parent
  return null;
}
