/* author: david hamp-gonsalves */

//Some setting changes require actions to be preformed during 
//save such as polling feeds right away
function performSettingChangeActions(feeds) {
	var oldFeeds = getFeedConfig();

	for(var i=0 ; i < feeds.length ; i++) {
		  //changes only need to happen on feeds that already existed
      //in the config
      var j=0;
		  for(; j < oldFeeds.length ; j++)
    			if(feeds[i].id === oldFeeds[j].id) {
 	    			performFeedSettingChanges(feeds[i], oldFeeds[j]);
	    			break;
	    		}

      if(j === oldFeeds.length)
        //this feed wasn't found so it must be new
        chrome.extension.getBackgroundPage().updateFeedBookmarks(feeds[i]);
	}
  //handle any feeds that were removed	
	performSettingChangeDeletions(feeds, oldFeeds);
}

//handle any moves, renames or reconfigurations of feeds
function performFeedSettingChanges(feed, oldFeed) {
  //if the folderId isn't set we can't do anything
  if(feed.folderId === null)
    return;

	//feed rename
	if(feed.name !== oldFeed.name)
		chrome.bookmarks.update(feed.folderId, {'title': feed.name});
	//folder move
	if(feed.parentFolderId !== oldFeed.parentFolderId) {
		console.log('moving to: ' + feed.parentFolderId);
		chrome.bookmarks.move(feed.folderId, {'parentId': feed.parentFolderId}); 
	}
	//feed url change will wait till the next poll
	//site url change will wait till the next poll
	//max items change will wait till the next poll
	
}

//handle the deletion of folders related to deleted feeds
function performSettingChangeDeletions(feeds, oldFeeds) {
	var deletedFeeds = Array();
	var deletedFeedsString = '';
	var feed;
	//check for feed deletions based on folder id
	for(var i=0 ; i < oldFeeds.length ; i++) {
		feed = oldFeeds[i];
		if(feed.folderId === null)
			//its too risky to delete anything, just leave it for the user to do
			continue;

		var j=0;
		for(; j < feeds.length ; j++)
			if(feed.id === feeds[j].id)
				break;

    if(j === feeds.length) {
      //we've gone through the whole this and didn't find the feed
      //so its been deleted
		  deletedFeedsString += ' - ' + feed.name + '\n'
			deletedFeeds.push(feed);
		}
	}
	
	if(deletedFeedsString.length != 0) {
		deletedFeedsString = 'The respective folders for each listed feed will be deleted: \n' + 
			deletedFeedsString + 'Press cancel if you\'d rather delete them manually.';		
		//if the user confirms, delete the folders
		if(confirm(deletedFeedsString)) {
			for(i in deletedFeeds)
				chrome.bookmarks.removeTree(deletedFeeds[i].folderId);
		}
	}
}

//save the feed config to local storage
function saveFeedConfig(feedConfig) {
	localStorage['feed_config'] = JSON.stringify(feedConfig);
}

//get the configuration for all the feeds
function getFeedConfig() {
    var feedConfig;
    try{
        feedConfig = localStorage.getItem('feed_config');
        if(feedConfig !== null)
          feedConfig = JSON.parse(feedConfig);
    }catch(e) {/*handle this later in the next check*/}

    //the user just hasn't configured any feeds so 
    if(feedConfig == undefined)
        feedConfig = Array();

    //upgrading from older versions may result in undefined folderId's
    //set them to null
	var feedChanges = false;
    for(var i in feedConfig) {
  
    if(feedConfig[i].folderId === undefined) {
        feedConfig[i].folderId = null;
    		feedChanges = true;
		  }

      if(feedConfig[i].id === undefined) {
        feedConfig[i].id = getUniqueFeedId(feedConfig[i]);
        feedChanges = true;
      }

      if(feedConfig[i].parentFolder !== undefined) {
        feedConfig[i].parentFolderId = feedConfig[i].parentFolder;
        feedChanges = true;
      }
	}
	
	//feed changes will be made when upgrading from version 2 - 3 so save 
	//them after they are made
	if(feedChanges)
		saveFeedConfig(feedConfig);
    
    return feedConfig;
}

//gets the currently configured poll interval
function getPollInterval() {
    var pollInterval;
    //load polling interval
    try{
        pollInterval = localStorage.getItem('poll_interval');
    }catch(e) 
    {/* handle this in the undef check later */}
    
	//I was getting some bad poll intervals, remove this later
	if(pollInterval === 'undefined') {
		console.log('poll interval was broken!');
		pollInterval = undefined;
	}
	
    //use default if not set
    if(pollInterval === null || pollInterval === undefined)
        pollInterval = 10;
		
    else if(!pollInterval >= 5)
      pollInterval = 5;

    return pollInterval;
}

//checks the config to see if a feed with this name is already defined
function feedNameUnique(name, config) {
	for(var i=0 ; i < config.length ; i++)
		if(config[i].name == name)
			return false;
	return true;
}

//saves the folderId of the feed to its settings based on name
function addFolderIdToFeedSettings(feed) {
	var config = getFeedConfig();
	
	for(i in config)
		if(config[i].name === feed.name)
			config[i].folderId = feed.folderId;
	
	localStorage['feed_config'] = JSON.stringify(config);
}

//saves the parentfolderId of the feed to its settings by folder id
function addParentIdToFeedSettings(feed) {
	var config = getFeedConfig();
	
	for(i in config)
		if(config[i].folderId === feed.folderId)
			config[i].parentFolderId = feed.parentFolderId;
	
	localStorage['feed_config'] = JSON.stringify(config);
}

//creates a unique feed id 
function getUniqueFeedId(feed) {
  console.log('getUniqueFeedId');
  return new Date().getTime() + '-' + Math.random(); 
}

//sets any missing folder ids based on the current config
function getExistingFolderIds(feeds) {
    var currentFeeds = getFeedConfig();
    for(var i in feeds) {
      var feed = feeds[i];
      if(feed.folderId === null)
        //check to see if the current config has the folder id
        for(var j in currentFeeds)
          if(feed.id === currentFeeds[j].id) {
            feed.folderId = currentFeeds[j].folderId;
            break;
           }
    }
}