"use strict";

/* import-globals-from ../../shared/livemark-store.js */
/* import-globals-from ../../shared/settings.js */

window.addEventListener("load", function() {
  document.title = chrome.i18n.getMessage("rss_subscription_default_title");
  main();
});

function setPreviewContent(html) {
  // Normal loading just requires links to the css and the js file.
  const frame = document.getElementById("preview");
  const sheetUrl = chrome.extension.getURL("pages/reader/reader.css");
  const scriptUrl = chrome.extension.getURL("pages/reader/reader.js");
  frame.srcdoc = `<html>
  <head><link rel="stylesheet" href="${sheetUrl}"></head>
  <body>
    ${html}
    <script src="${scriptUrl}"></script>
  </body>
  </html>`;
}

/**
* The main function. fetches the feed data.
*/
async function main() {
  await LivemarkStore.init();
  const queryString = location.search.substring(1).split("&");
  const feedUrl = decodeURIComponent(queryString[0]);
  try {
    const response = await fetch(feedUrl);
    const body = await response.text();
    const {title, siteUrl, error} = parseFeed(body);
    if (error) {
      setPreviewContent(`<main id="error">${error}</main>`);
      return;
    }

    document.title = title;
    document.querySelector("#title").textContent = title;
    document.querySelector("#subscribe-button").addEventListener("click", async () => {
      const folderId = await Settings.getDefaultFolder();
      await LivemarkStore.add({
        title,
        feedUrl,
        siteUrl,
        parentId: folderId,
        maxItems: 25,
      });

      const [folderProps] = await browser.bookmarks.get(folderId);
      alert(`Livemark added to ${folderProps.title},
please go to the options page to edit it.`);
    });
    embedAsIframe(body);
  } catch (e) {
    const error = chrome.i18n.getMessage("rss_subscription_error_fetching");
    setPreviewContent(`<main id="error">${error}</main>`);
  }
  // document.getElementById('feedUrl').href = 'view-source:' + feedUrl;
}

function getFeedSiteUrl(doc) {
  const element = doc.querySelector("link[rel=alternate]") ?
    doc.querySelector("link[rel=alternate]")
    : doc.querySelector("link");

  if (element) {
    return element.href ? element.href : element.textContent;
  }
  return null;
}

function embedAsIframe(rssText) {
  const iframe = document.getElementById("preview");
  iframe.onload = () => {
    iframe.contentWindow.postMessage(rssText, "*");
  };
  setPreviewContent("");
}

// Handles parsing the feed data we got back from XMLHttpRequest.
function parseFeed(responseText) {
  // If the XMLHttpRequest object fails to parse the feed we make an attempt
  // ourselves, because sometimes feeds have html/script code appended below a
  // valid feed, which makes the feed invalid as a whole even though it is
  // still parsable.
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(responseText, "text/xml");
  if (!doc) {
    return {
      error: chrome.i18n.getMessage("rss_subscription_not_valid_feed")
    };
  }

  // We must find at least one 'entry' or 'item' element before proceeding.
  let entries = doc.getElementsByTagName("entry");
  if (entries.length == 0) {
    entries = doc.getElementsByTagName("item");
  }
  if (entries.length == 0) {
    return {
      error: chrome.i18n.getMessage("rss_subscription_no_entries"),
    };
  }

  // Figure out what the title of the whole feed is.
  const {textContent: title} = doc.getElementsByTagName("title")[0];

  return {
    title,
    siteUrl: getFeedSiteUrl(doc),
  };
}
