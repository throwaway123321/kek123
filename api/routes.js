const express = require("express");
const bodyParser = require("body-parser");

const runtime = require("./handlers/runtime");
const admin = require("./handlers/admin");
const logger = require('./utilities/logger');

const router = express.Router();

const databaseWrapper = require("./utilities/databasewrapper");

router.use(bodyParser.urlencoded( {
	extended: false
} ));
router.use(bodyParser.json());

router.get("/", function(req, res) {
	res.send("This is the api");
});

router.post("/translate/checkkey", function(req, res) {

	admin.testTranslationKey(req.body.key, function(result) {
		res.json(result);
	});
});

router.post("/translate/submit", function(req, res) {
	admin.submitTranslation(req.body.key, req.body.language, req.body.translationKey, req.body.translation, function(result) {
		res.json(result);
	});
});

router.post("/translate/requesttranslation", function(req, res) {
	admin.requestNewTranslation(req.body.key, req.body.language, function(result) {
		res.json(result);
	})
});

router.get("/playlists", function(req, res) {
	res.json(runtime.getPlaylistInformation());
});

router.get("/match/:playlist/:gender", function(req, res) {
	let voterFbId;
	if('query' in req && 'voterFbId' in req.query) {
		voterFbId = req.query.voterFbId;
		if (!(/^[0-9]+$/.test(voterFbId))) {
			voterFbId = -1;
		}
	} else {
		voterFbId = -1;
	}
	runtime.generateMatch(req.params.playlist, req.params.gender, voterFbId,
		function(matchData) {
			if (matchData != null) {
				res.json(matchData);
			} else {
				res.json({ error: "Failed to start match" });
			}
		}
	);
});

router.post("/vote", function(req, res) {
	const postData = req.body;

	if (("playlistCategory" in postData) &&
		("gender" in postData) &&
		("matchUUID" in postData) &&
		("result" in postData)) {

		const result = Number.parseInt(postData.result);
		if (!isNaN(result)) {
			if (runtime.finishMatch(postData.playlistCategory, postData.gender,
				postData.matchUUID, result)) {

				res.json({ status: "Success!" });

				return;
			}
		}
	}

	res.json({ error: "Failed to end match" });
});

router.post("/profile/add", function(req, res){
	const postData = req.body;

	if (("access_token" in postData)) {
		runtime.addProfile(postData.access_token,
			function(errorCode, error) {
				if (errorCode != -1) {
					res.json({ status: 1, errorCode, error });
				} else {
					res.json({ status: 0 });
				}
			}
		);
	} else {
		res.json({ status: 1, errorCode: 1, error: "No access"});
	}
});

router.get('/verifytoken', function(req, res) {
	if('token' in req.query) {
		runtime.verifyUserToken(req.query.token, function(data) {
			res.json(data);
		});
	} else {
		res.json({ result: false, error: "Invalid token" });
	}
});

router.post("/profile/login", function(req, res){
	const postData = req.body;

	if (("access_token" in postData)) {
		runtime.profileLogin(postData.access_token,
			function(errorCode, data) {
				if (errorCode != -1) {
					res.json({ status: 1, errorCode, error: data });
				} else {
					res.json({ status: 0, data: data });
				}
			}
		);
	} else {
		res.json({ status: 1, errorCode: 1, error: "No access"});
	}
});

router.delete("/profile/remove", function(req, res) {
	const postData = req.body;

	if (("access_token" in postData)) {
		runtime.queueProfileRemoval(postData.access_token,
			function(errorCode, error) {
				if (error != null) {
					res.json({ status: 1, errorCode, error });
				} else {
					res.json({ status: 0 });
				}
			}
		);
	} else {
		res.json({ status: 1, errorCode: 1, error: "No access"});
	}
});

router.get("/profile/:playlist/:gender/:fbId", function (req, res) {
	const fbId = req.params.fbId;

	// Check if fbId is a numberic value in stringform
	// for preventing database code injection...
	if (/^[0-9]+$/.test(fbId)) {
		runtime.getProfile(req.params.playlist, req.params.gender, fbId,
			function(data) {
				if (data == null) {
					res.json({ status: "Doesn't exist" });
				} else {
					res.json(data);
				}
			}
		);
	} else {
		res.json({ status: "Invalid id"});
	}
});

router.get("/leaderboard/:playlist/:gender", function(req, res) {
	runtime.getLeaderboard(req.params.playlist, req.params.gender,
		function(data) {
			if (data == null) {
				res.json({ status: "Internal error" });
			} else {
				res.json(data);
			}
		}
	);
});

module.exports = router;