/* author: david hamp-gonsalves */

var fieldNames = ['name', 'parentFolderId', 'maxItems', 'feedUrl', 'siteUrl', 'folderId', 'id'];
	
//loads the feed configuration in the options page
function loadFeedConfig() {
    var feedConfig = getFeedConfig()
	
	setupExportLink(feedConfig);
	
    for(var i=0, len = feedConfig.length; i < len ; i++)
        addFeed(feedConfig[i]);
    
    $('#poll_interval').val(getPollInterval());
}

function setupExportLink(feedConfig) {
	var exportData = 'data:text/xml;charset=utf-8,<?xml version="1.0" encoding="UTF-8"?><opml version="1.0"><head><title>Foxish RSS Subscriptions</title></head><body><outline title="RSS Feeds" text="RSS Feeds">';
	
	for(var i=0, len = feedConfig.length; i < len ; i++) {
		var feed = feedConfig[i];
		exportData += '<outline text="' + escapeXML(feed.name) + '" title="' + escapeXML(feed.name) + '" type="rss" xmlUrl="' + escapeXML(feed.feedUrl) + '" htmlUrl="' + escapeXML(feed.siteUrl) + '"/>';
	}
	exportData += '</outline></body></opml>';
	$('#export_area a').attr('href', exportData);
}

function escapeXML(str) {
	return str.replace(/"/g, '&quot;');
}
//appends a feed to the options page
function addFeed(feed) {
    var lastSpacer = $('.spacer:last');
    var newFeed = $('.feed:hidden:last').clone();
    lastSpacer.after("<div class='spacer'> </div>");
    
    //set the new fields values if they were passed in
    for(var field in feed)
        if(feed[field] !== undefined)
            $(newFeed.find('.' + field)[0]).val(feed[field]);

    //if we are adding a new empty feed then assign a feed id
    if(feed === undefined)
      $(newFeed.find('.id')[0]).val(getUniqueFeedId());

    newFeed.toggle();
    lastSpacer.after(newFeed);
    
    $('.delete').click(function() {
        $(this).parent().next().remove(); //delete the spacer
        $(this).parent().remove(); //delete the feed item
    });
}

//populates the parent folder drop down on the options page
function populateParentFolders(folders) {
    var parentFolderIdSelect = $('.feed:last').find('select.parentFolderId');
    
    for(var id in folders)
        parentFolderIdSelect.append($("<option></option>").
            attr("value", id).
            text(folders[id]));
}

//saves or appends to the current settings with the feeds on the page
function validateAndSaveFeeds(appendFeeds) {
    //if we are only appending a feed then use the current config as the base
    var config;
    if(appendFeeds == true)
        config = getFeedConfig();
	else
		config = Array();
		                
  	//validate the feed input
    var hasErrors = validateAndAddFeeds(config);
       
    //check if we are on the options page
    var pollInterval = null;
    if($('#poll_interval').length > 0)
		  //if so then validate the poll interval as well
		  pollInterval = getValidatedPollInterval();
	
    var saveStatus = $('#save_status');
    if(!hasErrors && pollInterval !== undefined) {
			//save the poll interval if set or get the existing if not
			if(pollInterval !== null)
				localStorage['poll_interval'] = pollInterval;
			else
				pollInterval = getPollInterval();

			//reset the interval to use the new setting or if no change then just 
			//to restart the interval so it doesn't start before our change actions can complete
			chrome.extension.getBackgroundPage().setPollInterval(pollInterval);

      //get any folder ids that have been set since page load
      getExistingFolderIds(config);
			
			//before we update the background process we may need to preform some 
			//actions like requesting the initital pull of feeds or moving folders
			performSettingChangeActions(config);
			
      //save the settings back to local storage
      saveFeedConfig(config);
	  setupExportLink(config)
      saveStatus.removeClass('error').addClass('success');
      saveStatus.html('settings were saved');
      $('#save_message').show();

      //update the background.html process
      chrome.extension.getBackgroundPage().setFeeds(config);
    } else {
      saveStatus.removeClass('success').addClass('error');
      saveStatus.html('settings have errors and weren\'t saved.');
    }
    
    window.setTimeout(function(){
        $('#save_status').removeClass('error success');
        $('#save_status').html('');
    }, 1500);
}

//preforms validation and adds the feeds to the config argument
function validateAndAddFeeds(config) {
	var hasErrors = false;
	var feeds = $('.feed:visible');
	for(var i=0 ; i < feeds.length ; i++) {
		var feed = $(feeds[i]);
		if(feed.length > 0) {
				//get the clean input
				var feedInput = getCleanedFeedInput(feed);
				
				var errors = validateFeedInput(feedInput, config);
				var feedErrors = feed.find('.feed_errors');
				feedErrors.html('');
				if(errors.length > 0) {
						hasErrors = true;
						//display errors
						for(var j=0 ; j < errors.length ; j++)
								$(feedErrors[j%2]).append('<li>' + errors[j]);
				}        

        //set a unique feed id if not set
        if(feedInput.id === null) 
          feedInput.id = getUniqueFeedId();

				//add the current settings to save
				config.push(feedInput);
		}
	}
	return hasErrors;
}

function getValidatedPollInterval() {
	// validate the poll interval if changed
	var pollInterval = $('#poll_interval').val();
	if(! /^[0-9]+$/.test(pollInterval) || pollInterval < 5) {
		$('#poll_interval_status').addClass('error');
		$('#poll_interval_status').html('must be a whole number and at least 5 minutes');
	}else {   
		//remove error messages
		$('#poll_interval_status').removeClass('error');
		$('#poll_interval_status').html('');

    //the poll interval is only valid if its 5 or greater
    if(pollInterval >= 5)
	    return pollInterval;
	}
}

//validates the configuration of a single feed based on its values and the current config
function validateFeedInput(input, config) {
    var errors = Array();
    
    if(!feedNameUnique(input.name, config))
            errors.push('duplicate feed name, needs to be unique');
    if(input.name == '')
            errors.push('every feed needs a name.');
            
    var error;
    if(error = validateUrlField(input.siteUrl, 'site url'))
      errors.push(error);
    if(error = validateUrlField(input.feedUrl, 'feed url'))
      errors.push(error);
    if(! /^[0-9]+$/.test(input.maxItems))
        errors.push('the max feed items should be a whole number');
    else
        if(input.maxItems == 0)
            errors.push('you must display at least one feed item');
                    
    return errors;
}

//validates that the url is valid and returns the error message if not
function validateUrlField(url, fieldName) {
  var error;
  if(url.feedUrl == '')
		error = 'every ' + fieldName + ' needs a url to pull from';
	else if(!/^http[s]{0,1}:\/\//.test(url))
		error = 'the ' + fieldName + ' needs to have a protocol defined(ie: <b>http://</b>your_url.com)';
  else if(!/^http[s]{0,1}:\/\/\S/.test(url))
    error = 'the ' + fieldName + ' needs a valid url(ie: <b>http://</b>your_url.com)';

  return error;
}

//cleans the users input and retuns it as a dict
function getCleanedFeedInput(feedNode) {
	var feedInput = {};
	
	for(var i=0 ; i <  fieldNames.length ; i++) {
		var fieldName = fieldNames[i];
		var field = feedNode.find('.' + fieldName)[0];
		
		if((fieldName == 'folderId' || fieldName == 'id') && (field === undefined  || field.value == '')) {
			field = new Object();
			field.value = null;
		}else if(field.tagName !== 'select')
			field.value = $.trim(field.value);
	
		//set the max length to 25 if left blank
		if(fieldName == 'max_items' && field.value == '')
			field.value = 25;
			
		feedInput[fieldName] = field.value;
	}
	return feedInput;
}

/* feed import code */
//load the input file when selected
function handleFileSelect(evt) {
    var file = evt.target.files[0]; // FileList object
    var reader = new FileReader();
    
    // call back to capture the file information.
    reader.onload = readImportFile;
    reader.onerror = importErrorHandler;

    // Read the xml
    reader.readAsText(file);
  }
  
//read the import file and add any feeds it contains
function readImportFile(e) {
    var importFeeds = $(e.target.result).find('outline[type="rss"]');
    if(importFeeds.length === 0)
    {
        importError('no feeds were found');
        return;
    }
    
    //add each feed item to the page
    for(var i=0, len = importFeeds.length; i < len ; i++)
        addFeed(parseFeedInfoFromXml(importFeeds[i]));
    
    importSuccess(importFeeds.length);
}

//parses a feed object from a feed defined by an xml outline 
function parseFeedInfoFromXml(xmlOutline) {
    return {'name': xmlOutline.getAttribute('text'),
        'feedUrl': xmlOutline.getAttribute('xmlUrl'),
        'siteUrl': xmlOutline.getAttribute('htmlUrl')};
}

//display any errors that occurred durring reading
function importErrorHandler(evt) {
    switch(evt.target.error.code) 
    {
      case evt.target.error.NOT_FOUND_ERR:
        importError('File Not Found!');
        break;
      case evt.target.error.NOT_READABLE_ERR:
        importError('File is not readable');
        break;
      default:
        importError('An error occurred reading this file.');
    }
}

//display a import error
function importError(error) {
    $('#import_status')[0].setAttribute('class', 'error');
    $('#import_status').html(error);
    hideImportStatus();
}

//clear the error area
function importSuccess(feedsAdded) {
    
	var msg, status;
	if(feedsAdded > 5) {
		status = 'error';
		if(feedsAdded > 30) 
			msg = 'Hold your horses!! Your adding WAY too many feeds!';
		else if(feedsAdded > 10)
			msg = 'Wow you\'ve got a lot of feeds there!';
		else
			msg = 'No need to panic but you might have too many feeds there.\n\n';
			
		msg += '<br><br>Chrome enforces bookmark creation limits that prevent Foxish from keeping so many feeds up to date at once.  In most cases Foxish can usually handle updating about 7 feeds and can handle importing three or four an hour before it hits those limits. <br><br>Sorry but for now this is the best we can do.<br><br>You can try to import all your feeds but keep in mind that it will take some time before Chrome lets Foxish catch up and things may get a bit dated or buggy.';
	}else {
		status = 'success';
		msg = 'feeds loaded, make any changes and click save';
	}
	
	$('#import_status')[0].setAttribute('class', status);
    $('#import_status').html(msg);
    if(status == 'success')
		hideImportStatus();
}

//hide the feed bookmark status area
function hideImportStatus() {
    window.setTimeout(function(){
            var status = $('#import_status');
            status[0].setAttribute('class', '');
            status.html('');
    }, 2500);
}

//gets all the bookmark folders
function getAllBookmarkFolders(node, feeds) {
    var folders = [];
    for(var i in node)
        if(node[i].children !== undefined) {
            //this is a folder
			
			//if the folder belongs to a feed then skip it and its children
			if(doesFolderBelongToFeed(node[i].id, feeds))
				continue;
				
            folders[node[i].id] = node[i].title;
            var temFolders = getAllBookmarkFolders(node[i].children, feeds);
            for(var id in temFolders)
				if(!doesFolderBelongToFeed(id, feeds))
					folders[id] = temFolders[id];
        }
    return folders;
}


//returns if the folder id belongs to a configured feed
function doesFolderBelongToFeed(folderId, feeds) {
	for(var i in feeds) 
		if(folderId === feeds[i].folderId)
			return true;
	
	return false;
}
