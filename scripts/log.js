document.addEventListener('DOMContentLoaded', function () {
	$('#clear').click(function() 
	{ 
		//clear the stored logs
		deleteMessages();
		//display the current messages(none)
		displayMessages();
	});
	
	displayMessages();
});
