/* jFeed : jQuery feed parser plugin
 * Copyright (C) 2007 Jean-François Hovinne - http://www.hovinne.com/
 * Dual licensed under the MIT (MIT-license.txt)
 * and GPL (GPL-license.txt) licenses.
 */
 
 /* david hamp-gonsalves
  * this is a modified version that can handle jquery 1.4 and is used
  * by the chrome extension Foxish Live RSS. 
  */

jQuery.getFeed = function(options) {

    options = jQuery.extend({
    
        url: null,
        data: null,
        success: null,
		error: null
        
    }, options);

    if(options.url) {

		//david hamp-gonsalves 
		//made a change here to remove the dataType 
		//setting since it was breaking in some cases (incorrect mime type)
		//also set up the error call back from the ajax call
        $.ajax({
            type: 'GET',
            url: options.url,
			timeout: 20000, //this is to account for 1.4.2(if not error wont be called in some cases)
            data: options.data,
            success: function(xml) {
				//if the mime was incorrectly set then it might return as a string
				//if so we need to parse it to a document so JQuery can use it correctly
				//hacker news is a feed that currently has an mime type of html(should be xml)
				
				if(typeof(xml) == 'string')
					//JQuery isn't calling error in for non existant domains and is returning a blank string
					if(xml.length == 0)
					{
						if(jQuery.isFunction(options.error)) options.error("feed could not be pulled");
						return;
					}else
						xml = new DOMParser().parseFromString(xml, "text/xml");
						
				var feed = new JFeed(xml);
                if(jQuery.isFunction(options.success)) options.success(feed);},
			error: function(xml, errorText)
			{
				if(jQuery.isFunction(options.error)) options.error(errorText);
			}
        });
		//end of change
    }
};

function JFeed(xml) {
    if(xml) this.parse(xml);
};

JFeed.prototype = {

    type: '',
    version: '',
    title: '',
    url: '',
    description: '',
    parse: function(xml) {			
        if($('channel', xml).length == 1) {
            this.type = 'rss';
            var feedClass = new JRss(xml);
			

        } else if($('feed', xml).length == 1) {
        
            this.type = 'atom';
            var feedClass = new JAtom(xml);
        }
        
        if(feedClass) jQuery.extend(this, feedClass);
    }
};

function JFeedItem() {};

JFeedItem.prototype = {

    title: '',
    url: '',
    description: '',
    updated: '',
    id: ''
};

function JAtom(xml) {
    this._parse(xml);
};

JAtom.prototype = {
    
    _parse: function(xml) {
    
        var channel = $('feed', xml).eq(0);

        this.version = '1.0';
		    //atom supports a html type field which we need to handle
		    this.title = $(channel).find('title:first').text();
        this.url = this._getAtomUrl(channel);
        this.description = $(channel).find('subtitle:first').text();
        this.language = $(channel).attr('xml:lang');
        this.updated = $(channel).find('updated:first').text();
        
        this.items = new Array();
        
        var feed = this;
        
        $('entry', xml).each( function() { 
          var item = new JFeedItem();
          var title = $(this).find('title:first')[0];
			    if(title.getAttribute('type') === 'html') {
            //crazy atom feeds can have html based titles
				    item.title = title.childNodes[0].nodeValue.replace(/<.*?>/g, '');
			    } else 
				    item.title = title.childNodes[0].nodeValue;
			    //try get the link with rel=alternate, if not found then use the first link
          item.url = feed._getAtomUrl(this);
	
          item.description = $(this).find('content').eq(0).text();
          item.updated = $(this).find('updated').eq(0).text();
          item.id = $(this).find('id').eq(0).text();
          
          if(isItemValid(item))
		        feed.items.push(item);
        });
    },
	
    _getAtomUrl: function(parent)
    {
	    var url;
	    if((url = $(parent).find('link[rel=alternate]:first')).length > 0);
	    else if((url = $(parent).find('link:first')).length > 0);
	    
	    if(url.attr('href') !== undefined)
		url = url.attr('href');
	    else
		url = url.text();;
		
	    return url;
    }
};


function JRss(xml) {
    this._parse(xml);
};

JRss.prototype  = {
    
    _parse: function(xml) {	
        if($('rss', xml).length == 0) this.version = '1.0';
        else this.version = $('rss', xml).eq(0).attr('version');

        var channel = $('channel:first', xml);
        this.title = $(channel).find('title:first').text();
        this.url = $(channel).find('link:first').text();
        this.description = $(channel).find('description:first').text();
        this.language = $(channel).find('language:first').text();
        this.updated = $(channel).find('lastBuildDate:first').text();
		
        this.items = new Array();
        
        var feed = this;
        
        $('item', xml).each(function() {
            var item = new JFeedItem();
            
            item.title = $(this).find('title:first').text();
            item.url = $(this).find('link:first').text();
            item.description = $(this).find('description:first').text();
            item.updated = $(this).find('pubDate:first').text();
            item.id = $(this).find('guid:first').text();

	    if(isItemValid(item))
			feed.items.push(item);
        });
    }
};

function isItemValid(item) {
    if(item.title == '' || item.url == '')
	return false;
    else
	return true;
}

var escapedLessThan = '&lt;'
var escapeGreaterThan = '&gt;'
//cleans out any escaped html from the passed in text
function cleanEscapedHtml(text) {
	if(text === undefined)
		return '';
		
	var cleanedText = '';
	for(var i = 0 ; i < text.length ; i++) {
		console.log(text[i]);
		if(text[i] === '&')
			console.log(text.substr(i, escapedLessThan.length) );
		if(text[i] === '&' && text.substr(i, escapedLessThan.length) === escapedLessThan) {
			i += 4;
			for( ; i < text.length ; i++)
				if(text[i] === '&' && text.substr(i, escapedGreaterThan.length) === escapedGreaterThan) {
					i += 4;
					break;
				}
		}else
			cleanedText += text[i];
	}
	console.log('-> ' + cleanedText);
	return cleanedText;
}
