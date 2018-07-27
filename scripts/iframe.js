"use strict";

/* The maximum number of feed items to show in the preview. */
const maxFeedItems = 10;

/* The maximum number of characters to show in the feed item title. */
const maxTitleCount = 1024;

window.addEventListener("message", function(e) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(e.data, "text/xml");

  if (doc) {
    buildPreview(doc);
  } else {
    /* Already handled in subscribe.html */
  }
});

function buildPreview(doc) {
  /* Now parse the rest. Some use <entry> for each feed item, others use
     <channel><item>. */
  const container = document.createElement("main");

  let entries = doc.getElementsByTagName("entry");
  if (entries.length == 0) {
    entries = doc.getElementsByTagName("item");
  }

  for (let i = 0; i < entries.length && i < maxFeedItems; ++i) {
    const item = entries.item(i);

    /* Grab the title for the feed item. */
    let itemTitle = item.getElementsByTagName("title")[0];
    if (itemTitle) {
      itemTitle = itemTitle.textContent;
    } else {
      itemTitle = "Unknown title";
    }

    /* Ensure max length for title. */
    if (itemTitle.length > maxTitleCount) {
      itemTitle = itemTitle.substring(0, maxTitleCount) + "...";
    }

    /* Grab the description.
       TODO(aa): Do we need to check for type=html here? */
    let itemDesc = item.getElementsByTagName("description")[0];
    if (!itemDesc) {
      itemDesc = item.getElementsByTagName("summary")[0];
    }
    if (!itemDesc) {
      itemDesc = item.getElementsByTagName("content")[0];
    }

    if (itemDesc) {
      itemDesc = itemDesc.textContent;
    } else {
      itemDesc = "";
    }

    /* Grab the link URL. */
    const itemLink = item.getElementsByTagName("link");
    let link = "";
    if (itemLink.length > 0) {
      link = itemLink[0].childNodes[0];
      if (link) {
        link = itemLink[0].childNodes[0].nodeValue;
      } else {
        link = itemLink[0].getAttribute("href");
      }
    }

    const itemContainer = document.createElement("div");
    itemContainer.classList = "item";

    /* If we found a link we'll create an anchor element,
    otherwise just use a bold headline for the title. */
    const anchor = (link != "") ? document.createElement("a") :
      document.createElement("strong");
    anchor.id = "anchor_" + String(i);
    if (link != "") {
      anchor.href = link;
    }
    anchor.textContent = itemTitle;
    anchor.target = "_blank";
    anchor.className = "item_title";

    const span = document.createElement("span");
    span.id = "desc_" + String(i);
    span.className = "item_desc";
    span.innerHTML = itemDesc;

    itemContainer.appendChild(anchor);
    itemContainer.appendChild(span);

    container.appendChild(itemContainer);
    document.body.appendChild(container);
  }
}
