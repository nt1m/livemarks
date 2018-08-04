"use strict";

/* exported exportOPML */
function exportOPML(feeds) {
  const escapeXML = (str) => str.replace(/"/g, "&quot;");
  const opmlFeeds = feeds.map(({ title, feedUrl, siteUrl }) => {
    return `<outline 
      text="${escapeXML(title)}"
      title="${escapeXML(title)}"
      type="rss"
      xmlUrl="${escapeXML(feedUrl)}"
      htmlUrl="${escapeXML(siteUrl)}"
/>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>Your livemarks</title>
  </head>
  <body>
    <outline title="RSS Feeds" text="RSS Feeds">
      ${opmlFeeds.join("\n")}
    </outline>
  </body>
</opml>`;
}

/* exported importOPML */
function importOPML(opml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(opml, "text/xml");
  const importedFeeds = [...doc.querySelectorAll("outline[type='rss']")];
  return importedFeeds.map(outline => ({
    "title": outline.getAttribute("text"),
    "feedUrl": outline.getAttribute("xmlUrl"),
    "siteUrl": outline.getAttribute("htmlUrl"),
  }));
}
