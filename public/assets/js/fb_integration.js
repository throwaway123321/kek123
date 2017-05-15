// INIT FB
window.fbAsyncInit = function() {
  FB.init({
    appId      : '374320782927089',
    xfbml      : true,
    version    : 'v2.8'
  });
  FB.AppEvents.logPageView();
};
(function(d, s, id){
  var js, fjs = d.getElementsByTagName(s)[0];
  if (d.getElementById(id)) {return;}
  js = d.createElement(s); js.id = id;
  js.src = "//connect.facebook.net/en_US/sdk.js";
  fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));


function logout() {
  console.log("logout triggered");
  Cookies.set('token', undefined);
  Cookies.set('fbId', undefined);
  Cookies.set('name', undefined);
  window.location.reload();
}
// Get access token with FB Login
function startLogin() {
    FB.login(function(response) {
      console.log(JSON.stringify(response, null, 2));
      if (response.status === 'connected') {
        var accessToken = response.authResponse.accessToken;
        addUser(accessToken);
      } else if (response.status === 'not_authorized') {
        alert("something went wrong");
      } else {
        alert("something went wrong");
      }
    }, {scope: 'public_profile,user_location'});
}
// Try to add user using access token
function addUser(token) {
  $.post( "/api/profile/add", {access_token: token})
  .done(function( data ) {
    console.log(JSON.stringify(data, null, 2));
    console.log((data.status === 0));

    login(token);

    /*if(data.status === 0) {
      console.log("Cookie: " + Cookies.get('token'));
      $('#success-modal').modal();
    } else {
      alert("Something went wrong, please try again later!");
    }*/
  });
}

function login(token) {
	console.log("XD");
	$.post("/api/profile/login", {access_token: token}).done(function(data) {
		console.log(JSON.stringify(data, null, 2));
		if(data.status == 0) {
			Cookies.set('token', data.data.token);
			Cookies.set('fbId', data.data.fbId);
			Cookies.set('name', data.data.name);

			location.reload();
		} else {
			alert("An error has occured! Please try again later");
		}
	});

}
