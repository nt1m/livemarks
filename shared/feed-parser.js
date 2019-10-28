"use strict";

/* exported FeedParser */
const FeedParser = {
  fetchXML(url) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("GET", url, true);
      request.timeout = 10000; // time in milliseconds

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

    // Sometimes the titles or feed description contains HTML.
    const getParsedTextFromElement = (selector, target = doc) => {
      const element = target.querySelector(selector);
      if (element) {
        const parser = new DOMParser();
        const dom = parser.parseFromString(element.textContent, "text/html");
        return dom.documentElement.textContent.trim();
      }
      return null;
    };

    const channel = doc.querySelector("channel");

    const websiteUrl = getTextFromElement("link", channel);
    const feed = {
      type: "rss",
      title: getParsedTextFromElement("title", channel),
      url: websiteUrl,
      description: getParsedTextFromElement("description", channel),
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

      const itemUrl = getTextFromElement("link", item) || getTextFromElement("guid", item);
      return {
        title: getParsedTextFromElement("title", item),
        url: new URL(itemUrl, websiteUrl).href,
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

    // Sometimes the titles or feed description contains HTML.
    const getParsedTextFromElement = (selector, target = doc) => {
      const element = target.querySelector(selector);
      if (element) {
        const parser = new DOMParser();
        const dom = parser.parseFromString(element.textContent, "text/html");
        return dom.documentElement.textContent.trim();
      }
      return null;
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
      title: getParsedTextFromElement("title", channel),
      url: getHrefFromElement("link[rel=alternate]", channel)
        || getHrefFromElement("link:not([rel=self])", channel),
      description: getParsedTextFromElement("subtitle", channel),
      language: channel.getAttribute("xml:lang"),
      updated: getTextFromElement("updated", channel)
            || getTextFromElement("published", channel)
    };

    feed.items = [...doc.querySelectorAll("entry")].map(item => {
      return {
        title: getParsedTextFromElement("title", item),
        url: getHrefFromElement("link[rel=alternate]", item)
          || getHrefFromElement("link", item),
        description: getTextFromElement("content", item)
                  || getTextFromElement("summary", item),
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
