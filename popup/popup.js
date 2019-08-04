"use strict";

document.addEventListener("DOMContentLoaded", function() {
  main();
});

function getFeeds(tabId) {
  return browser.runtime.sendMessage({
    msg: "get-tab-feeds",
    tabId,
  });
}

async function main() {
  const [tab] = await browser.tabs.query({active: true, currentWindow: true});
  const feeds = await getFeeds(tab.id);
  if (feeds.length == 1) {
    // Only one feed, no need for a bubble; go straight to the subscribe page.
    preview(feeds[0].href);
  } else {
    const content = document.getElementById("content");

    const feedList = document.createElement("ul");
    feedList.className = "feedList";
    for (const feed of feeds) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      const url = feed.href;
      link.href = url;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        preview(url);
      });
      link.textContent = feed.title;
      item.appendChild(link);
      feedList.appendChild(item);
    }

    content.appendChild(feedList);
  }
}

// Show the preview page
function preview(feed_url) {
  const url = "../pages/subscribe/subscribe.html?" + encodeURIComponent(feed_url);
  chrome.tabs.create({ url });
  window.close();
}
