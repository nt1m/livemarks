"use strict";

var storageLogKey = "log";

function displayMessages() {
  const msgContainer = $("#messages");
  const msgs = getMessages();

  // remove the messages from the page
  if (msgContainer.children().length > 0) {
    msgContainer.children().remove();
  }

  // display no messages item
  if (msgs.length == 0) {
    msgContainer.append("<div class='no_messages'> empty </div>");
  } else {
    // remove the no messages list item
    msgContainer.find(".no_messages").remove();
  }

  // display the messages
  for (let i = 0; i < msgs.length; i++) {
    if (i % 2 == 1) {
      msgContainer.append("<div class='message odd_row'>" + msgs[i] + "</div>");
    } else {
      msgContainer.append("<div class='message'>" + msgs[i] + "</div>");
    }
  }
}

// adds a error message to the log
function logError(msg) {
  let msgs = getMessages();
  // bring this message to the top if it exists already
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i] == msg) {
      msgs = msgs.splice(i, 0);
      break;
    }
  }

  // create the message if this is the first time
  msgs.unshift(msg);
  storeMessages(msgs);
}

// returns the messages from local storage or a new array if nothing was found
function getMessages() {
  let msgs = undefined;
  try {
    msgs = JSON.parse(localStorage[storageLogKey]);
  } catch (e) {
    // no messages yet
    console.log("error getting log messages: " + e);
  }

  if (msgs == undefined) {
    msgs = [];
  }

  return msgs;
}

// saves the messages to local storage
function storeMessages(msgs) {
  localStorage[storageLogKey] = JSON.stringify(msgs);
}

// deletes the pending messages
function deleteMessages() {
  localStorage[storageLogKey] = JSON.stringify([]);
}
