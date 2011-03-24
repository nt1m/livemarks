/* author: david hamp-gonsalves */

//add the feed item to the logical folders children item list and the create the bookmark
//After the item is added the call back will be called, with the passed in paramters, except 
//the iter if it was passed in as undefined
function addFeedItem(feedFolder, feed, jFeed, item, iter, callBack) {
	//update the feedFolder children to reflect adding the bookmark
	addFeedItemToFeedFolder(feedFolder, item, iter);

	chrome.bookmarks.create({'parentId': feedFolder.id,
		'title': item.title,
		'url': item.url,
		'index': iter},
		function(item){
			if(isError(item))
				return;
			if(iter !== undefined)
				callBack(feedFolder, feed, jFeed, ++iter);
			else
				callBack(feedFolder, feed, jFeed);
		});
}

function addFeedItemToEnd(feedFolder, feed, jFeed, item, callBack) {
	//update the feedFolder children to reflect adding the bookmark
	feedFolder.children.push(item);

	chrome.bookmarks.create({'parentId': feedFolder.id,
		'title': item.title,
		'url': item.url,
		'index': feedFolder.children.length - 1},
		function(item){
			if(isError(item))
				return;
				callBack(feedFolder, feed, jFeed);
		});
}

//insert the item into the logical folder children item list
function addFeedItemToFeedFolder(feedFolder, item, index) {
	feedFolder.children.splice(index, 0, item);
}

//moves the feed item in both the bookmark folder and the logical feed children item list
function moveFeedItem(feedFolder, feed, jFeed, iter, oldIndex, callBack) {
	//the new index can't be longer then the current list
	var index = iter > feedFolder.children.length - feedOptionCount ? feedFolder.children.length - feedOptionCount : iter;
	var bookmarkItemId = feedFolder.children[oldIndex].id;
	//update the feedFolder children
	moveFolderItem(feedFolder, jFeed, index, oldIndex);
	chrome.bookmarks.move(bookmarkItemId, 
		{'parentId': feedFolder.id, 
		'index': index},
		function(result){
			if(isError(result))
				return;
			callBack(feedFolder, feed, jFeed, ++iter);
		});
}
							
//moves the child in the feedFolder, does not alter the related bookmark
function moveFolderItem(feedFolder, jFeed, newIndex, oldIndex) {
	var itemToMove = feedFolder.children[oldIndex];
	addFeedItemToFeedFolder(feedFolder, itemToMove, newIndex);
	//if the item has moved earlier in the list then we need to account for then when we
	//remove the duplicate
	if(newIndex < oldIndex)
		oldIndex++;
	removeFeedItemFromFeedFolder(feedFolder, oldIndex);
}

//removes the feed item in both the bookmark folder and the logical feed children item list
function removeFeedItem(feedFolder, feed, jFeed, iter, callBack) {
	var bookmarkId = feedFolder.children[iter].id;
	removeFeedItemFromFeedFolder(feedFolder, iter);
	
	chrome.bookmarks.remove(bookmarkId, function(){
		//call the supplied call back method 
		callBack(feedFolder, feed, jFeed, iter);
	});
}

//removes the child in the feedFolder, does not alter the related bookmark
function removeFeedItemFromFeedFolder(feedFolder, index) {
	feedFolder.children.splice(index, 1);
}

function feedItemsMatch(item, item2) {

	//I was seeing an issue where urls would have a slash added for some feeds	
	if(item.title === item2.title && (item.url === item2.url || (item.url + '/' === item2.url))) {
		if(item.url !== item2.url )
			console.log(item.url + ' === ' + item2.url + ' ' + (item.title === item2.title) + ' &&  ' + (item.url === item2.url) + ' || ' + (item.url + '/' === (item2.url)));
		return true;
	}
	
	return false;
}

//iterates over the passed in feed and checks if the item exists 
//based on title
function doesItemExistsInFeed(item, jFeed, feed) {
	for(var i=0 ; i < jFeed.items.length && i < feed.maxItems ; i++)
		if(feedItemsMatch(item, jFeed.items[i]))
			return true;
	
	return false;
}

//iterates over the bookmarks in the folder and returns if the seperator exists
function doesSeperatorBookmarkExists(feedFolder) {
	var index = feedFolder.children.length - 2;
	
	if(index >= 0 && feedFolder.children[index].title === seperator)
		return true;
	
	return false;
}

//returns if the site bookmark exists in the current folder
function doesSiteUrlBookmarkExist(feed, feedFolder) {
	var index = feedFolder.children.length-1;
	if(index < 0)
		return;
		
	var title = feedFolder.children[index].title;

	//check if the item is the site url bookmark
	if(title.charAt(title.length -1) !== siteBookmarkPostfix || 
			title.substring(0, siteBookmarkPrefix.length) !== siteBookmarkPrefix)
		return false;
	
	return true;
}

//updates the bookmark title and url to reflect any changes
function updateSiteUrlBookmark(feedFolder, feed) {
	var siteBookmark = feedFolder.children[feedFolder.children.length-1];
	
	//check if the bookmark was just created
	if(siteBookmark.id === undefined)
		return;
	
	//get the feed name from the bookmark title
	var feedName = siteBookmark.title.substring(siteBookmarkPostfix.length, siteBookmark.title.length - 1);
	//update the feed name if its changed
	if(feedName !== feed.name)
		chrome.bookmarks.update(siteBookmark.id, {'title': siteBookmarkPrefix + feed.name + siteBookmarkPostfix});
	
	//update the bookmark if its changed
	if(siteBookmark.url !== feed.siteUrl)
		chrome.bookmarks.update(siteBookmark.id, {'url': feed.siteUrl});
}

function doesParentFolderExist(tree, feed) {
	var parentFolder = getBookmarkFolderById(tree, feed.parentFolderId);
	return parentFolder !== null;
}

//Finds a feeds folder if it exists based on its id or its name and parent folder
function getBookmarkFolder(tree, feed) {
	var folder = null;
	if(feed.folderId != null)
		folder = getBookmarkFolderById(tree, feed.folderId);

	if(folder == null)
		folder = getFeedBasedOnParentFolderId(tree, feed);
			
	return folder;
}

//finds the folder node that matches the passed in id
function getBookmarkFolderById(tree, id) {
    for(var i in tree)
        if(tree[i].children !== undefined)
			      if(tree[i].id === id)
                return tree[i];
            else
            {
                var folder = getBookmarkFolderById(tree[i].children, id);
                if(folder !== null)
                    return folder;
            }
	
	return null;
}

//returns the feeds folder based on its parent and name
function getFeedBasedOnParentFolderId(tree, feed) {
	var folder = getBookmarkFolderById(tree, feed.parentFolderId);
	
	//parent folder wasn't found
	if(folder === null)
		return null;
	
	var child;
	for(var i in folder.children) {
		child = folder.children[i];
		if(child.children != undefined)
			if(child.title === feed.name && 
				doesSeperatorBookmarkExists(child))
        //we have a possiable match, to verify check for the seperator
        return child;
	}

	//feed folder wasn't found in its parent
	return null;
}
