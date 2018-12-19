"use strict";

/* import-globals-from ../reader/reader.js */

window.addEventListener("load", function() {
  main();
});

async function setPreviewContent(html) {
  // Normal loading just requires links to the css and the js file.
  const frame = document.createElement("iframe");
  frame.classList.add("grow");
  frame.sandbox = "allow-popups";

  const error = document.getElementById("tp-error");
  error.hidden = true;

  const sheetUrl = chrome.extension.getURL("pages/reader/reader.css");
  const response = await fetch(sheetUrl);
  const text = await response.text();

  frame.srcdoc = `<html>
  <head>
    <meta charset="utf-8">
    <base target="_blank">
    <style type="text/css">${text}</style>
  </head>
  <body>
    ${html}
  </body>
  </html>`;

  document.getElementById("preview").append(frame);
}

function setShowPermissionPrompt(host) {
  const error = document.getElementById("tp-error");
  const hostSpan = document.getElementById("tp-host");
  const grantBtn = document.getElementById("tp-grant");

  error.hidden = false;
  if (document.querySelector("iframe")) {
    document.querySelector("iframe").remove();
  }
}

/**
* The main function. fetches the feed data.
*/
async function main() {
  const queryString = location.search.substring(1).split("&");
  const feedUrl = decodeURIComponent(queryString[0]);

  document.querySelector("#feed-url").value = feedUrl;
  document.querySelector("#feed-url").addEventListener("focus", (event) => {
    event.target.select();
    document.execCommand("copy");
  });

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

    const viewSourceBtn = document.querySelector("#view-source-button");
    viewSourceBtn.href = "view-source:" + feedUrl;

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

    setPreviewContent(`<main>${getPreviewHTML(feed)}</main>`);
  } catch (e) {
    console.log(e);
    let origin = new URL(feedUrl).origin + "/*";
    let allPermissions = await browser.permissions.getAll();
    if (allPermissions.origins.includes(origin)) {
      setPreviewContent("<main id=\"error\">Failed to fetch feed</main>");
    } else {
      setShowPermissionPrompt(origin);
    }
  }
}
