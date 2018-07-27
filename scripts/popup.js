"use strict";

document.addEventListener("DOMContentLoaded", function() {
  main();
});

function feedLink(url) {
  const feed_link = document.createElement("a");
  feed_link.href = url;
  feed_link.addEventListener("click", onClick);
  return feed_link;
}

function main() {
  chrome.tabs.query({active: true, currentWindow: true}, function([tab]) {
    const feeds = chrome.extension.getBackgroundPage().feedData[tab.id];
    if (feeds.length == 1) {
      // Only one feed, no need for a bubble; go straight to the subscribe page.
      preview(feeds[0].href);
    } else {
      const content = document.getElementById("content");

      const feed_list = document.createElement("ul");
      feed_list.className = "feedList";
      for (let i = 0; i < feeds.length; ++i) {
        const item = document.createElement("li");
        const link = feedLink(feeds[i].href);
        link.textContent = feeds[i].title;
        item.appendChild(link);
        feed_list.appendChild(item);
      }

      content.appendChild(feed_list);
    }
  });
}

function onClick(event) {
  const a = event.currentTarget;
  preview(a.href);
  event.preventDefault();
}

function preview(feed_url) {
  // See if we need to skip the preview page and subscribe directly.
  let url = "";
  if (window.localStorage && window.localStorage.showPreviewPage == "No") {
    // Skip the preview.
    url = window.localStorage.defaultReader.replace("%s", escape(feed_url));
  } else {
    // Show the preview page.
    url = "subscribe.html?" + encodeURIComponent(feed_url);
  }
  chrome.tabs.create({ url });
  window.close();
}
