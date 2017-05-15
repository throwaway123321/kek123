const databaseWrapper = require("../utilities/databasewrapper");
const logger = require('../utilities/logger');

const UNKNOWN_ERROR = -1;

const TOO_FEW_PROFILES = 0;
const DATABASE_ERROR = 1;
const ILLEGAL_PLAYLIST = 2;
const NONEXISTENT_MATCH = 3;

const ALREADY_EXISTS = 4;
const ILLEGAL_GENDER = 5;

const DOESNT_EXISTS = 6;

// Match statistics

function matchFailed(playlistCategory, gender, index0, index1, failReason) {

}

function matchStarted(playlist, index0, index1) {

}

function matchEndFailed(playlistCategory, gender, failReason) {

}

/**
 * See documentation for databasemysql.logVote :)
 * result is either:
 	1 = profile1 won
 	0 = profile2 won (don't ask)
   -1 = skip
 **/
function matchEnded(playlist, profile1Id, profile2Id, result, voterFbId) {
	databaseWrapper.getInstance(function(dbw) {
		if(!dbw) {
			logger.error('Can\'t get DB instance while trying to log match (matchEnded');
			return;
		}

		let winnerId;
		if(result === 1) {
			winnerId = profile1Id;
		} else if(result === 0) {
			winnerId = profile2Id;
		} else {
			winnerId = -1;
		}

		dbw.logVote(playlist.id, profile1Id, profile2Id, winnerId, voterFbId, function(){
			dbw.finish();
		});
	});
}

// Profile statistics

function profileAdded(playlists, fbId, name) {

}

function profileAddFailed(fbId, name, failReason) {

}

function profileRemovalPending(fbId, name) {

}

function profileRemovalPendingFailed(fbId, name, failReason) {

}

function profileLoggedIn(fbId, name) {

}

function profileLoginFailed(fbId, name, failReason) {

}

module.exports = {
	// Constants
	UNKNOWN_ERROR,
	TOO_FEW_PROFILES,
	DATABASE_ERROR,
	ILLEGAL_PLAYLIST,
	NONEXISTENT_MATCH,
	ALREADY_EXISTS,
	ILLEGAL_GENDER,
	DOESNT_EXISTS,

	// Functions
	matchFailed,
	matchStarted,
	matchEndFailed,
	matchEnded,
	profileAdded,
	profileAddFailed,
	profileRemovalPending,
	profileRemovalPendingFailed,
	profileLoggedIn,
	profileLoginFailed
};