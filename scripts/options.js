/* author: david hamp-gonsalves */

var fieldNames = ['name', 'parentFolderId', 'maxItems', 'feedUrl', 'siteUrl', 'folderId', 'id'];
	
//loads the feed configuration in the options page
function loadFeedConfig() {
    var feedConfig = getFeedConfig()
    for(var i=0 ; i < feedConfig.length ; i++) {
        var feed = feedConfig[i];
        addFeed(feed);
    }
    
    $('#poll_interval').val(getPollInterval());
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
    if(feed === undefined) {
      console.log('adding');
      $(newFeed.find('.id')[0]).val(getUniqueFeedId());
	  }

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

    //get any folder ids that have been set since page load
    getExistingFolderIds(config);
        
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
			
			//before we update the background process we may need to preform some 
			//actions like requesting the initital pull of feeds or moving folders
			performSettingChangeActions(config);
			
      //save the settings back to local storage
      saveFeedConfig(config);
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

				//add the current settings to save
				config[config.length] = feedInput;		
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
    
    if(file.type !== 'text/xml')
        importError('incorrect file format');
        
    // Closure to capture the file information.
    reader.onload = function(e) { readImportFile(e.target.result); };
    reader.onerror = importErrorHandler;

    // Read the xml
    reader.readAsText(file.slice(0, file.size));
  }
  
//read the import file and add any feeds it contains
function readImportFile(importFile) {
    var importFeeds = $(importFile).find('outline');
    if(importFeeds.length === 0)
    {
        importError('no feeds were found');
        return;
    }
    
    //add each feed item to the page
    for(var i=0; i < importFeeds.length ; i++)
        addFeed(parseFeedInfoFromXml(importFeeds[i]));
    
    importSuccess();
}

//parses a feed object from a feed defined by an xml outline 
function parseFeedInfoFromXml(xmlOutline) {
    return {'name': xmlOutline.title,
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
function importSuccess() {
    $('#import_status')[0].setAttribute('class', 'success');
    $('#import_status').html('feeds loaded, make any changes and click save');
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
