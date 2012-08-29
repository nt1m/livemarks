//init method of the options page
document.addEventListener('DOMContentLoaded', function () {
	$('#add').click(function() { addFeed();});
	$('#save').click(validateAndSaveFeeds);
    $('#files').bind('change', handleFileSelect);
    chrome.bookmarks.getTree(function(topNode) {
		var feeds = getFeedConfig();
        var folders = getAllBookmarkFolders(topNode[0].children, feeds);
        //add folders to the options drop down
        populateParentFolders(folders);
        loadFeedConfig();
    });                
});
