$(document).ready(function() {
	// TODO: Verify token, logout if authorization fails

	const name = Cookies.get('name');
	const fbId = Cookies.get('fbId');

	if(name !== undefined) {
		$('.user-name').text(name);
		$('.playButton.facebook').hide();
	}
	if(fbId !== undefined) {
		$('.user-profile-picture').css("background-image","url(https://graph.facebook.com/"+fbId+"/picture?type=small)");
		$('.playButton.facebook').hide();
	}

	// If we have a popover on this page
	if($('[data-toggle="popover"]').length) {
		$('body').click(function(e){
			// If anything but the popover-toggler and the popover itself was clicked..
			if (!$(e.target).hasClass('popover') && $(e.target).closest('[data-toggle="popover"]').length === 0) {
				// Hide the opover and set its state to false.
				// If we don't do the last part, we will have to click the toggle twice before it enables.
				$('.popover.in').popover('hide').data('bs.popover').inState.click = false;
			}
		});
	}

	// Same as above, but with the sidebar-menu (playlist selecter)
	if($('#cbp-playlist-picker').length) {
		$('body').click(function(e){
			if($(e.target).closest('#showLeft, #cbp-playlist-picker').length === 0) {
				$('#cbp-playlist-picker').removeClass('cbp-spmenu-open');
			}
		});
	}

	if($('#guide-modal').length && Cookies.get('guide') === undefined) {
		$('#guide-modal').modal('show');
		Cookies.set('guide', 'true', {expires: 60*60*24*365}); // Expires in a year
	}
});
