const request = require("request");

const graphUrl = "https://graph.facebook.com/"

// Original request url
let reqUrl = graphUrl + "me?";
// Add fields
reqUrl += "fields=id,name,location{location}, gender";

pictureRequest = "/picture?width=250&height=250"

/**
* Makes an ajax call to the facebook graph api, which
* will return the id, name and location. The callback
* will be invoked with 2 arguments, the data and error,
* if the operation failed.
*
* accessToken	-	Used for gaining access to profile
*					information
* callback		-	Invoked to retreive the returned
* 					data from graph.facebook
*/
function getFacebookProfile(accessToken, callback) {
	const url = reqUrl + `&access_token=${accessToken}`;
	request.get(url, function(err, res, body) {
		if (err == null && res.statusCode == 200) {
			callback(null, JSON.parse(body));
		} else {
			callback(err, null);
		}
	});
}

/**
* Converts the given fbId into an image request url.
* 
* fbId		-	The fbId of the wanted profile picture
* Returns 	-	The profile picture request url
*/
function getPictureURL(fbId) {
	return graphUrl + fbId + pictureRequest;
}

module.exports = {
	getFacebookProfile,
	getPictureURL
};
