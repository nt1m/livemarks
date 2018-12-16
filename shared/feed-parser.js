"use strict";

/* exported FeedParser */
const FeedParser = {
  fetchXML(url) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("GET", url, true);
      request.timeout = 5000; // time in milliseconds

      request.addEventListener("load", (event) => {
        if (request.responseXML) {
          resolve(request.responseXML);
        } else if (request.status === 200) {
          reject(new Error(`no XML data (${url})`));
        } else {
          reject(new Error(`${request.status}: ${request.statusText} (${url})`));
        }
      });
      request.addEventListener("error", (event) => {
        reject(new Error(`${request.status}: ${request.statusText} (${url})`));
      });
      request.addEventListener("timeout", (event) => {
        reject(new Error(`timeout (${url})`));
      });

      request.overrideMimeType("text/xml");
      request.send();
    });
  },
  async getFeed(url) {
    const doc = await this.fetchXML(url);
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
      return element ? element.textContent.trim() : null;
    };

    const channel = doc.querySelector("channel");

    const feed = {
      type: "rss",
      title: getTextFromElement("title", channel),
      url: getTextFromElement("link", channel),
      description: getTextFromElement("description", channel),
      language: getTextFromElement("language", channel),
      updated: getTextFromElement("lastBuildDate", channel)
        || getTextFromElement("pubDate", channel)
    };

    const rssTag = doc.querySelector("rss");
    if (rssTag) {
      feed.version = rssTag.getAttribute("version");
    } else {
      feed.version = "1.0";
    }

    feed.items = [...doc.querySelectorAll("item")].map(item => {
      let media;

      const allContent = item.getElementsByTagName("media:content");
      if (allContent.length) {
        media = Array.from(allContent, content => {
          return {
            url: content.getAttribute("url"),
            size: content.getAttribute("fileSize"),
            type: content.getAttribute("type"),
          };
        });
      } else {
        const enclosure = item.querySelector("enclosure");
        if (enclosure) {
          media = [{
            url: enclosure.getAttribute("url"),
            size: enclosure.getAttribute("length"),
            type: enclosure.getAttribute("type"),
          }];
        }
      }

      return {
        title: getTextFromElement("title", item),
        url: getTextFromElement("link", item),
        description: getTextFromElement("description", item),
        updated: getTextFromElement("pubDate", item),
        id: getTextFromElement("guid", item),
        media
      };
    });

    if (!feed.updated) {
      feed.updated = feed.items[0].updated;
    }
    return feed;
  },
  parseAtom(doc) {
    const getTextFromElement = (selector, target = doc) => {
      const element = target.querySelector(selector);
      return element ? element.textContent.trim() : null;
    };

    const getHrefFromElement = (selector, target = doc) => {
      const element = target.querySelector(selector);
      if (element) {
        return element.getAttribute("href") ||
               element.getAttributeNS("http://www.w3.org/2005/Atom", "href");
      }
      return null;
    };

    const channel = doc.querySelector("feed");

    const feed = {
      type: "atom",
      title: getTextFromElement("title", channel),
      url: getHrefFromElement("link[rel=alternate]", channel)
        || getHrefFromElement("link:not([rel=self])", channel),
      description: getTextFromElement("subtitle", channel),
      language: channel.getAttribute("xml:lang"),
      updated: getTextFromElement("updated", channel)
            || getTextFromElement("published", channel)
    };

    feed.items = [...doc.querySelectorAll("entry")].map(item => {
      return {
        title: getTextFromElement("title", item),
        url: getHrefFromElement("link[rel=alternate]", item)
          || getHrefFromElement("link", item),
        description: getTextFromElement("content", item),
        updated: getTextFromElement("updated", item)
              || getTextFromElement("published", item),
        id: getTextFromElement("id", item)
      };
    });

    if (!feed.updated) {
      feed.updated = feed.items[0].updated;
    }
    return feed;
  }
};
