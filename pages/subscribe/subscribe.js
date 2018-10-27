"use strict";

/* import-globals-from ../reader/reader.js */

window.addEventListener("load", function() {
  document.title = "Feed preview";
  main();
});

function setPreviewContent(html) {
  // Normal loading just requires links to the css and the js file.
  const frame = document.getElementById("preview");
  const sheetUrl = chrome.extension.getURL("pages/reader/reader.css");
  frame.srcdoc = `<html>
  <head>
    <meta charset="utf-8">
    <base target="_blank">
    <link rel="stylesheet" href="${sheetUrl}">
  </head>
  <body>
    ${html}
  </body>
  </html>`;
}

/**
* The main function. fetches the feed data.
*/
async function main() {
  const queryString = location.search.substring(1).split("&");
  const feedUrl = decodeURIComponent(queryString[0]);
  try {
    const feed = await browser.runtime.sendMessage({
      msg: "get-feed",
      feedUrl
    });

    const {title, description, url: siteUrl, items} = feed;
    if (items.length == 0) {
      setPreviewContent("<main id=\"error\">No feed entries found</main>");
      return;
    }

    document.title = title;
    document.querySelector("#title").textContent = title;
    if (description) {
      document.querySelector("#description").textContent = description;
    }
    document.querySelector("#subscribe-button").addEventListener("click", async () => {
      const folderTitle = await browser.runtime.sendMessage({
        msg: "subscribe",
        title,
        feedUrl,
        siteUrl
      });
      alert(`Livemark added to ${folderTitle},
please go to the options page to edit it.`);
    });

    document.querySelector("#feed-url").value = feedUrl;
    document.querySelector("#feed-url").addEventListener("focus", (event) => {
      event.target.select();
      document.execCommand("copy");
    });

    setPreviewContent(`<main>${getPreviewHTML(feed)}</main>`);
  } catch (e) {
    console.log(e);
    setPreviewContent("<main id=\"error\">Failed to fetch feed</main>");
  }
}
