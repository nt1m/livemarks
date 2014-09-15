showDialogue = function showDialogueInit() {

	var firstRun = true;
	return function showDialogue(message, options) {
		if(!options)
			options = {};

		$('body').append('<div id=dialogue>' +
    			'<div id=dialogue-container>' +
    				'<a href=# id=dialogue-close>-</a>' +
    				'<div id=dialogue-content>' +
	    				message +
    				'</div>' +
    				(options.callback ? '<input type=text/>' : '') +
    				'<a id=dialogue-button class=button href=#>ok</a>' +
    			'</div>' +
    		'</div>');

		$('#dialogue-close').click(function() {
			$('#dialogue').remove();
			return false;
		});

		$('#dialogue-button').click(function() {
			if(options.callback) {
				options.callback($('#dialogue input').val());
			}

			$('#dialogue').remove();

			return false;
		});

		var $dialogue = $('#dialogue');

		if(options.status === 'error') {
			$dialogue.addClass('error');
		} else
			$dialogue.removeClass('error');

		$dialogue.find('#dialogue-content').text(message);

		$dialogue.show();
	}
}();