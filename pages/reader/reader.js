"use strict";

/* The HTML computed by this function is appended into a sandboxed iframe */

function getPreviewHTML({ items }) {
  const container = document.createElement("main");
  for (const item of items) {
    const itemContainer = document.createElement("div");
    itemContainer.classList = "item";

    const anchor = item.url ? document.createElement("a") :
      document.createElement("strong");
    if (item.url) {
      anchor.href = item.url;
    }
    anchor.textContent = item.title;
    anchor.target = "_blank";
    anchor.className = "item_title";

    const span = document.createElement("span");
    span.className = "item_desc";
    span.innerHTML = item.description;

    itemContainer.appendChild(anchor);
    itemContainer.appendChild(span);

    container.appendChild(itemContainer);
  }
  return container.innerHTML;
}
