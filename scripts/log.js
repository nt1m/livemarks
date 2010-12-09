/* author: david hamp-gonsalves */

var storageLogKey = 'log';

//adds a error message to the log
function logError(msg)
{
	var msgs = getMessages();
	//bring this message to the top if it exists already
	for(var i=0 ; i < msgs.length ; i++)
		if(msgs[i] == msg)
		{
			msgs = msgs.splice(i, 0);
			break;
		}
	
	//create the message if this is the first time
	msgs.unshift(msg);
	storeMessages(msgs);
}

//returns the messages from local storage or a new array if nothing was found
function getMessages()
{
	var msgs = undefined;
	try
	{
		msgs = JSON.parse(localStorage[storageLogKey]);
	}catch(e)
	{
		//no messages yet
		console.log("error getting log messages: " + e);
	}
	
	if(msgs == undefined)
		msgs = Array();
	
	return msgs;
}

//saves the messages to local storage
function storeMessages(msgs)
{
	localStorage[storageLogKey] = JSON.stringify(msgs);
}

//deletes the pending messages
function deleteMessages()
{
	localStorage[storageLogKey] = JSON.stringify(Array());
}
