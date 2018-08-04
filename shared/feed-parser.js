"use strict";

/* exported FeedParser */
const FeedParser = {
  async getFeed(url) {
    const response = await fetch(url);
    const responseText = await response.text();
    const domParser = new DOMParser();
    const doc = domParser.parseFromString(responseText, "text/xml");
    if (!doc) {
      throw new Error("Invalid feed");
    }
    const feed = this.parseFeed(doc);
    feed.feedUrl = url;
    return feed;
  },
  parseFeed(doc) {
    const scripts = doc.querySelectorAll("script");
    [...scripts].forEach(script => script.remove());

    let feed;
    if (doc.querySelector("channel")) {
      feed = this.parseRss(doc);
    } else if (doc.querySelector("feed")) {
      feed = this.parseAtom(doc);
    }
    return feed;
  },
  parseRss(doc) {
    const getTextFromElement = (selector, target = doc) => {
      const element = target.querySelector(selector);
      return element ? element.textContent : null;
    };

    const channel = doc.querySelector("channel");

    const feed = {
      type: "rss",
      title: getTextFromElement("title", channel),
      url: getTextFromElement("link", channel),
      description: getTextFromElement("description", channel),
      language: getTextFromElement("language", channel),
      updated: getTextFromElement("lastBuildDate", channel),
    };

    const rssTag = doc.querySelector("rss");
    if (rssTag) {
      feed.version = rssTag.getAttribute("version");
    } else {
      feed.version = "1.0";
    }

    feed.items = [...doc.querySelectorAll("item")].map(item => {
      return {
        title: getTextFromElement("title", item),
        url: getTextFromElement("link", item),
        description: getTextFromElement("description", item),
        updated: getTextFromElement("pubDate", item),
        id: getTextFromElement("guid", item),
      };
    });
    return feed;
  },
  parseAtom(doc) {
    const getTextFromElement = (selector, target = doc) => {
      const element = target.querySelector(selector);
      return element ? element.textContent : null;
    };

    const getHrefFromElement = (selector, target = doc) => {
      const element = target.querySelector(selector);
      return element ? element.getAttribute("href") : null;
    };

    const channel = doc.querySelector("feed");

    const feed = {
      type: "atom",
      title: getTextFromElement("title", channel),
      url: getHrefFromElement("link:not([rel=self])", channel),
      description: getTextFromElement("subtitle", channel),
      language: channel.getAttribute("xml:lang"),
      updated: getTextFromElement("updated", channel),
    };

    feed.items = [...doc.querySelectorAll("entry")].map(item => {
      return {
        title: getTextFromElement("title", item),
        url: getHrefFromElement("link", item),
        description: getTextFromElement("content", item),
        updated: getTextFromElement("updated", item),
        id: getTextFromElement("id", item),
      };
    });
    return feed;
  }
};
