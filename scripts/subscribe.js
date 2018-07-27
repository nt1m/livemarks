"use strict";

/* import-globals-from common.js */
/* import-globals-from options_utils.js */
/* import-globals-from settings.js */

window.addEventListener("load", function() {
  document.title = chrome.i18n.getMessage("rss_subscription_default_title");
  i18nReplace("rss_subscription_feed_preview");
  i18nReplaceImpl("feedUrl", "rss_subscription_feed_link", "");

  $("#save").click(function() {
    validateAndSaveFeeds(true);
    return false;
  });

  chrome.bookmarks.getTree(function(topNode) {
    const folders = getAllBookmarkFolders(topNode[0].children);
    // add folders to the options drop down
    populateParentFolders(folders);
    // add a feed id to the possiable new entry
    $(".feed .id:first").val(getUniqueFeedId());
  });

  main();
});

function setPreviewContent(html) {
  // Normal loading just requires links to the css and the js file.
  const frame = document.getElementById("preview");
  const sheet = `<link rel="stylesheet" href="${chrome.extension.getURL("styles/reader.css")}">`;
  const script = `<script src="${chrome.extension.getURL("scripts/iframe.js")}"></script>`;
  frame.srcdoc = "<html>" + sheet + html + script + "</html>";
}

/**
* The main function. fetches the feed data.
*/
async function main() {
  const queryString = location.search.substring(1).split("&");
  const feedUrl = decodeURIComponent(queryString[0]);
  try {
    const response = await fetch(feedUrl);
    const body = await response.text();
    const {title, siteUrl, error} = parseFeed(body);
    if (error) {
      setPreviewContent(`<div id="error">${error}</div>`);
      return;
    }

    document.querySelector(".name").value = title;
    document.querySelector(".siteUrl").value = siteUrl;
    document.querySelector(".feedUrl").value = feedUrl;
    embedAsIframe(body);
  } catch (e) {
    const error = chrome.i18n.getMessage("rss_subscription_error_fetching");
    setPreviewContent(`<div id="error">${error}</div>`);
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
