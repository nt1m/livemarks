"use strict";

/* import-globals-from settings.js */

// loads the feed configuration in the options page
function loadFeedConfig() {
  const feedConfig = getFeedConfig();

  setupExportLink(feedConfig);

  for (const feed of feedConfig) {
    addFeed(feed);
  }

  $("#poll_interval").val(getPollInterval());
}

function setupExportLink(feedConfig) {
  let exportData = 'data:text/xml;charset=utf-8,<?xml version="1.0" encoding="UTF-8"?><opml version="1.0"><head><title>Your livemarks</title></head><body><outline title="RSS Feeds" text="RSS Feeds">';

  for (const feed of feedConfig) {
    exportData += '<outline text="' + escapeXML(feed.name) + '" title="' + escapeXML(feed.name) + '" type="rss" xmlUrl="' + escapeXML(feed.feedUrl) + '" htmlUrl="' + escapeXML(feed.siteUrl) + '"/>';
  }
  exportData += "</outline></body></opml>";
  $("#export-feeds").attr("href", exportData);
}

function escapeXML(str) {
  return str.replace(/"/g, "&quot;");
}

function addNewFeed(url) {
  // add protocol if missing
  if (!/^http[s]?:\/\//ig.test(url)) {
    url = "http://" + url;
  }

  const start = url.indexOf("//") + 2;
  let end = url.indexOf("/", start);
  const folderName = url.substring(start, (end > start ? end : undefined));

  end = url.lastIndexOf("/", start);
  const siteUrl = url.substring(0, (end > start ? end : undefined));

  addFeed({feedUrl: url, siteUrl, name: folderName});
}

// appends a feed to the options page
function addFeed(feed) {
  const newFeed = $(".feed:hidden:last").clone();

  // set the new fields values if they were passed in
  for (const field in feed) {
    if (feed[field] !== undefined) {
      $(newFeed.find("." + field)[0]).val(feed[field]);
    }
  }

  // if we are adding a new empty feed then assign a feed id
  if (feed === undefined) {
    $(newFeed.find(".id")[0]).val(getUniqueFeedId());
  }

  newFeed.toggle();
  $("#feeds").append(newFeed);

  newFeed.find(".delete").click(function() {
    $(this).parent().parent().parent().parent().remove(); // delete the feed item

    // if all feeds are removed then toggle no feed class
    if ($(".feed:visible").length === 0) {
      $("body").addClass("no-feeds");
    }

    return false;
  });

  $("body").removeClass("no-feeds");

  return false;
}

// populates the parent folder drop down on the options page
function populateParentFolders(folders) {
  const parentFolderIdSelect = $(".feed:last").find("select.parentFolderId");

  for (const id in folders) {
    parentFolderIdSelect.append($("<option></option>")
      .attr("value", id)
      .text(folders[id]));
  }
}

// saves or appends to the current settings with the feeds on the page
function validateAndSaveFeeds(appendFeeds) {
  // if we are only appending a feed then use the current config as the base
  let config;
  if (appendFeeds) {
    config = getFeedConfig();
  } else {
    config = [];
  }

  // validate the feed input
  const hasErrors = validateAndAddFeeds(config);

  // check if we are on the options page to validate the poll interval as well
  let pollInterval = null;
  if ($("#poll_interval").length > 0) {
    pollInterval = getValidatedPollInterval();
  }

  if (!hasErrors && pollInterval !== undefined) {
    // save the poll interval if set or get the existing if not
    if (pollInterval !== null) {
      localStorage.poll_interval = pollInterval;
    } else {
      pollInterval = getPollInterval();
    }

    // reset the interval to use the new setting or if no change then just
    // to restart the interval so it doesn't start before our change actions can complete
    const {LivemarkManager} = chrome.extension.getBackgroundPage();
    LivemarkManager.pollInterval = pollInterval;

    // get any folder ids that have been set since page load
    getExistingFolderIds(config);

    // before we update the background process we may need to preform some
    // actions like requesting the initital pull of feeds or moving folders
    performSettingChangeActions(config);

    // save the settings back to local storage
    saveFeedConfig(config);
    setupExportLink(config);

    alert("settings were saved");

    // update the background.html process
    LivemarkManager.feeds = config;
    return true;
  }
  alert("correct the errors and re-save.");

  return false;
}

// preforms validation and adds the feeds to the config argument
function validateAndAddFeeds(config) {
  let hasErrors = false;
  const feeds = $(".feed:visible");
  for (let feed of feeds) {
    feed = $(feed);
    if (feed.length > 0) {
      // get the clean input
      const feedInput = getCleanedFeedInput(feed);

      const errors = validateFeedInput(feedInput, config);

      let errorMessages = "";
      // display errors
      for (const field in errors) {
        const error = errors[field];

        feed.find("." + field).addClass("error");

        errorMessages += "<li>" + error;

        hasErrors = true;
      }

      feed.find(".feed_errors").html(errorMessages);

      // set a unique feed id if not set
      if (feedInput.id === null) {
        feedInput.id = getUniqueFeedId();
      }

      // add the current settings to save
      config.push(feedInput);
    }
  }

  return hasErrors;
}

function getValidatedPollInterval() {
  // validate the poll interval if changed
  const pollInterval = $("#poll_interval").val();
  if (!/^[0-9]+$/.test(pollInterval) || pollInterval < 5) {
    $("#poll_interval_status").addClass("error");
    $("#poll_interval_status").html("must be a whole number and at least 5 minutes");
    return null;
  }
  // remove error messages
  $("#poll_interval_status").removeClass("error");
  $("#poll_interval_status").html("");

  return pollInterval;
}

// validates the configuration of a single feed based on its values and the current config
function validateFeedInput(input, config) {
  const errors = {};

  if (!feedNameUnique(input.name, config)) {
    errors.name = "duplicate feed name, needs to be unique";
  }
  if (input.name == "") {
    errors.name = "every feed needs a name.";
  }

  let error = validateUrlField(input.siteUrl, "site url");
  if (error) {
    errors.siteUrl = error;
  }

  error = validateUrlField(input.feedUrl, "feed url");
  if (error) {
    errors.feedUrl = error;
  }

  if (!/^[0-9]+$/.test(input.maxItems)) {
    errors.maxItems = "the max feed items should be a whole number";
  } else if (input.maxItems == 0) {
    errors.maxItems = "you must display at least one feed item";
  }

  return errors;
}

// validates that the url is valid and returns the error message if not
function validateUrlField(url, fieldName) {
  let error;
  if (url.feedUrl == "") {
    error = "every " + fieldName + " needs a url to pull from";
  } else if (!/^http[s]{0,1}:\/\//.test(url)) {
    error = "the " + fieldName + " needs a protocol defined(ie: <b>http://)";
  } else if (!/^http[s]{0,1}:\/\/\S/.test(url)) {
    error = "the " + fieldName + " needs a valid url(ie: <b>http://</b>your_url.com)";
  }

  return error;
}

// cleans the users input and retuns it as a dict
const fieldNames = ["name", "parentFolderId", "maxItems", "feedUrl", "siteUrl", "folderId", "id"];
function getCleanedFeedInput(feedNode) {
  const feedInput = {};

  for (const fieldName of fieldNames) {
    let field = feedNode.find("." + fieldName)[0];

    if ((fieldName == "folderId" || fieldName == "id") && (field === undefined || field.value == "")) {
      field = new Object();
      field.value = null;
    } else if (field.tagName !== "select") {
      field.value = field.value.trim();
    }

    // set the max length to 25 if left blank
    if (fieldName == "max_items" && field.value == "") {
      field.value = 25;
    }

    feedInput[fieldName] = field.value;
  }
  return feedInput;
}

/* feed import code */
// load the input file when selected
function handleFileSelect(evt) {
  const file = evt.target.files[0]; // FileList object
  const reader = new FileReader();

  // call back to capture the file information.
  reader.onload = readImportFile;
  reader.onerror = importErrorHandler;

  // Read the xml
  reader.readAsText(file);
}

// read the import file and add any feeds it contains
function readImportFile(e) {
  const importFeeds = $(e.target.result).find('outline[type="rss"]');
  if (importFeeds.length === 0) {
    alert("No feeds found");
    return;
  }

  // add each feed item to the page
  for (const feed of importFeeds) {
    addFeed(parseFeedInfoFromXml(feed));
  }

  importSuccess(importFeeds.length);
}

// parses a feed object from a feed defined by an xml outline
function parseFeedInfoFromXml(xmlOutline) {
  return {
    "name": xmlOutline.getAttribute("text"),
    "feedUrl": xmlOutline.getAttribute("xmlUrl"),
    "siteUrl": xmlOutline.getAttribute("htmlUrl")
  };
}

// display any errors that occurred durring reading
function importErrorHandler(evt) {
  let msg = "An error occurred reading this file.";
  switch (evt.target.error.code) {
    case evt.target.error.NOT_FOUND_ERR:
      msg = "File Not Found!";
      break;
    case evt.target.error.NOT_READABLE_ERR:
      msg = "File is not readable";
      break;
  }

  alert(msg);
}

// clear the error area
function importSuccess(feedsAdded) {
  alert("feeds loaded, make any changes and click save");
}

// gets all the bookmark folders
function getAllBookmarkFolders(node, feeds) {
  const folders = [];
  for (const i in node) {
    if (!node[i].children) {
      continue;
    }

    // if the folder belongs to a feed then skip it and its children
    if (doesFolderBelongToFeed(node[i].id, feeds)) {
      continue;
    }

    folders[node[i].id] = node[i].title;
    const temFolders = getAllBookmarkFolders(node[i].children, feeds);
    for (const id in temFolders) {
      if (!doesFolderBelongToFeed(id, feeds)) {
        folders[id] = temFolders[id];
      }
    }
  }
  return folders;
}

// returns if the folder id belongs to a configured feed
function doesFolderBelongToFeed(folderId, feeds) {
  for (const i in feeds) {
    if (folderId === feeds[i].folderId) {
      return true;
    }
  }

  return false;
}

