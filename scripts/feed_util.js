/* author: david hamp-gonsalves */

//add the feed item to the logical folders children item list and the create the bookmark
function addFeedItem(feedFolder, feed, jFeed, item, iter, callBack)
{
	//update the feedFolder children to reflect adding the bookmark
	addFeedItemToFeedFolder(feedFolder, item, iter);
	chrome.bookmarks.create({'parentId': feedFolder.id,
		'title': $.trim(item.title),
		'url': item.url,
		'index': iter},
		function(item){
			if(isError(item))
				return;
			callBack(feedFolder, feed, jFeed, ++iter);
		});
}

//insert the item into the logical folder children item list
function addFeedItemToFeedFolder(feedFolder, item, index)
{
	feedFolder.children.splice(index, 0, item);
}

//moves the feed item in both the bookmark folder and the logical feed children item list
function moveFeedItem(feedFolder, feed, jFeed, iter, oldIndex, callBack)
{
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
function moveFolderItem(feedFolder, jFeed, newIndex, oldIndex)
{
	var itemToMove = feedFolder.children[oldIndex];
	addFeedItemToFeedFolder(feedFolder, itemToMove, newIndex);
	//if the item has moved earlier in the list then we need to account for then when we
	//remove the duplicate
	if(newIndex < oldIndex)
		oldIndex++;
	removeFeedItemFromFeedFolder(feedFolder, oldIndex);
}

//removes the feed item in both the bookmark folder and the logical feed children item list
function removeFeedItem(feedFolder, feed, jFeed, iter, callBack)
{
	var bookmarkId = feedFolder.children[iter].id;
	removeFeedItemFromFeedFolder(feedFolder, iter);
	
	chrome.bookmarks.remove(bookmarkId, function(){
		//call this method again once this action has completed
		//don't increment iter since by deleting the item we have achieved that
		callBack(feedFolder, feed, jFeed, iter);
	});
}

//removes the child in the feedFolder, does not alter the related bookmark
function removeFeedItemFromFeedFolder(feedFolder, index)
{
	feedFolder.children.splice(index, 1);
}

function feedItemsMatch(item, item2)
{
	if(item.url ==- item2.url && item.title === item2.title)
		return true;
	return false;
}

//iterates over the passed in feed and checks if the item exists 
//based on title
function itemExistsInFeed(item, jFeed, feed)
{
	for(var i=0 ; i < jFeed.items.length && i < feed.maxItems ; i++)
		if(feedItemsMatch(item, jFeed.items[i]))
			return true;
	
	return false;
}

//iterates over the bookmarks in the folder and returns if the item exists
function bookmarkExistsByTitle(item, feedFolder)
{
	for(var i = feedFolder.children.length-1 ; i >= 0 ; i--)
		if(feedFolder.children[i].title == item.title)
			return true;
	
	return false;
}

//finds the folder node that matches the passed in id
function getBookmarkFolder(tree, id)
{
    for(var i in tree)
        if(tree[i].children != undefined)
            if(tree[i].id === id)
                return tree[i];
            else
            {
                var folder = getBookmarkFolder(tree[i].children, id);
                if(folder !== undefined)
                    return folder;
            }
}

function getBookmarkBarFolder(topNode)
{
    var nodes = topNode[0].children
    for(var i in nodes)
        if(nodes[i].title.toLowerCase() == 'bookmarks bar')
            return nodes[i];
    //couldn't find the bookmark bar by name, could be different locale(thanks Joost)
    //try defaulting to 1 b/c of the chrome bug 21330
    return topNode[0].children[1];
}