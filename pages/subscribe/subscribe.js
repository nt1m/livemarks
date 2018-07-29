"use strict";

/* import-globals-from ../../shared/feed-parser.js */
/* import-globals-from ../../shared/livemark-store.js */
/* import-globals-from ../../shared/settings.js */

window.addEventListener("load", function() {
  document.title = "Feed preview";
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

function embedAsIframe(rssText) {
  const iframe = document.getElementById("preview");
  iframe.onload = () => {
    iframe.contentWindow.postMessage(rssText, "*");
  };
  setPreviewContent("");
}

/**
* The main function. fetches the feed data.
*/
async function main() {
  await LivemarkStore.init();
  const queryString = location.search.substring(1).split("&");
  const feedUrl = decodeURIComponent(queryString[0]);
  try {
    const feed = await FeedParser.getFeed(feedUrl);
    const {title, siteUrl, items} = feed;
    if (items.length == 0) {
      setPreviewContent("<main id=\"error\">No feed entries found</main>");
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
    embedAsIframe(feed);
  } catch (e) {
    console.log(e);
    setPreviewContent("<main id=\"error\">Failed to fetch feed</main>");
  }
  // document.getElementById('feedUrl').href = 'view-source:' + feedUrl;
}

