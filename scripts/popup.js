document.addEventListener('DOMContentLoaded', function () {
  main();
});

function feedLink(url) {
  var feed_link = document.createElement('a');
  feed_link.href = url;
  feed_link.addEventListener("click", onClick);
  return feed_link;
}

function main() {
  chrome.tabs.query({active: true, currentWindow: true}, function([tab]) {
    var feeds = chrome.extension.getBackgroundPage().feedData[tab.id];
    if (feeds.length == 1) {
      // Only one feed, no need for a bubble; go straight to the subscribe page.
      preview(feeds[0].href);
    } else {
      var content = document.getElementById('content');

      var feed_list = document.createElement('ul');
      feed_list.className = "feedList";
      for (var i = 0; i < feeds.length; ++i) {
        var item = document.createElement("li");
        var link = feedLink(feeds[i].href);
        link.textContent = feeds[i].title;
        item.appendChild(link);
        feed_list.appendChild(item);
      }

      content.appendChild(feed_list);
    }
  });
}

function onClick(event) {
  var a = event.currentTarget;
  preview(a.href);
  event.preventDefault();
}

function preview(feed_url) {
  // See if we need to skip the preview page and subscribe directly.
  var url = "";
  if (window.localStorage && window.localStorage.showPreviewPage == "No") {
    // Skip the preview.
    url = window.localStorage.defaultReader.replace("%s", escape(feed_url));
  } else {
    // Show the preview page.
    url = "subscribe.html?" + encodeURIComponent(feed_url);
  }
  chrome.tabs.create({ url: url });
  window.close();
}
