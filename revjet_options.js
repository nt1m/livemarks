(function() {
	var save_option = function() {
		chrome.storage.local.set({'revjet': !!this.checked});
	};

	chrome.storage.local.get('revjet', function(results) {
		if (results['revjet']) {
			document.querySelector('#revjet­-optout').checked = true;
		}
		document.querySelector('#revjet­-optout').addEventListener('change', save_option);
	});
})();