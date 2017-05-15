const dbmysql = require('../handlers/databasemysql');

/**
 * A function to get an instance of the DatabaseWrapper
 *
 * @param {function} connectedCallback 	A callback which is called when a connection is successfully obtained. All queries should be made inside this callback.
 *										The first and only argument of this function is a wrapper used for querying or null if no connection was obtained.
 * 										The last function called inside the callback should be finish() to release the connection.
 */
function getInstance(connectedCallback){
	dbmysql.getPoolConnection(function(connection) {
		connectedCallback(new DatabaseWrapper(connection));
	}, connectedCallback);
};

/**
 * A class for calling the database.
 *
 * @param {function} connection 	The connection granted from the database.
 */
function DatabaseWrapper(connection) {
	this.connection = connection;
}

/**
 * Finishes this instanceo of the DBWrapper and releases the connection.
 */
DatabaseWrapper.prototype.finish = function() {
	this.connection.release();
}

/**
 * A dummy function that does nothing. Can be used to throw away the callbacks you don't want to handle.
 * @param [...] args 	All the arguments you want nothing to do with
 */
DatabaseWrapper.prototype.dummy = function(...args) {
	// Doees nothing
};

/**
 * Call all the functions you want, all with a single call! Might be a silly idea performance wise, but it hasn't been benchmarked yet!
 * @param {array} calls 		An array of strings containing the names of the functions you want to call.
 * @param {object} parameters	An object containing all the parameters you need to call the functions contained in "calls".
 * 								If you, for example, wanted to call getParticipants and shiftProfileStats,
 *								you would need to provide "playlist", "id", "deltaElo" and "statIdentifier".
 * @param {function} callback 	The function to call back to after all the calls have been done. Takes a single argument,
 *								an array "return values" from the functions that have been called, ordered in the same order they were inputted in "calls".
 */
DatabaseWrapper.prototype.multi = function(calls, parameters, callback) {
	// TO BE IMPLEMENTED
}

/*
* Here starts the helper functions. Used for simplifying database calls
* with different playlist types
*/

DatabaseWrapper.prototype.countProfilesInPlaylist = function(playlist, callback) {
	if (playlist.isPredefined()) {
		this.countProfilesInStaticPlaylist(playlist, callback);
	} else {
		this.countProfilesInDynamicPlaylist(playlist, callback);
	}
};

DatabaseWrapper.prototype.getParticipants = function(playlist, callback, ...ranks) {
	if (playlist.isPredefined()) {
		this.getStaticParticipants(playlist, callback, ...ranks);
	} else {
		this.getDynamicParticipants(playlist, callback, ...ranks);
	}
};

DatabaseWrapper.prototype.shiftProfileStats = function(playlist, id, deltaElo, statIdentifier, callback) {
	if (playlist.isPredefined()) {
		this.shiftStaticProfileStats(playlist, id, deltaElo, statIdentifier, callback);
	} else {
		this.shiftDynamicProfileStats(playlist, id, deltaElo, statIdentifier, callback);
	}
};

DatabaseWrapper.prototype.logVote = function(playlistId, profile1Id, profile2Id, winnerId, voterFbId, callback) {
	dbmysql.logVote(this.connection, playlistId, profile1Id, profile2Id, winnerId, voterFbId, callback);
};

DatabaseWrapper.prototype.updatePlaylistsRanks = function(playlists, callback) {
	let staticPlaylists = [];
	let dynamicPlaylists = [];

	for (let playlist of playlists) {
		if (playlist.isPredefined()) {
			staticPlaylists.push(playlist);
		} else {
			dynamicPlaylists.push(playlist);
		}
	}

	const dbw = this;

	if (staticPlaylists.length > 0) {
		this.updateStaticPlaylistsRanks(staticPlaylists, function(status1) {
			if (dynamicPlaylists.length > 0) {
				dbw.updateDynamicPlaylistsRanks(dynamicPlaylists, function(status2) {
					callback(status1 ? status2 : status1);
				});
			} else {
				callback(status1);
			}
		});
	} else if (dynamicPlaylists.length > 0) {
		this.updateDynamicPlaylistsRanks(dynamicPlaylists, callback);
	}
};

DatabaseWrapper.prototype.getPlaylistLeaderboard = function(playlist, count, callback) {
	if (playlist.isPredefined()) {
		this.getStaticPlaylistLeaderboard(playlist, count, callback);
	} else {
		this.getDynamicPlaylistLeaderboard(playlist, count, callback);
	}
};

/*
* The helper functions end here.
*/

/*
 * Here starts the duplicated functions. All of these simply act as a way to use the connection aqcuired in the constructor.
 * Documentation for the functions can be found inside the database file (as of writing this, databasemysql.js)
 */

DatabaseWrapper.prototype.getPlaylists = function(callback) {
	dbmysql.getPlaylists(this.connection, callback);
};

DatabaseWrapper.prototype.countProfilesInStaticPlaylist = function(playlist, callback) {
	dbmysql.countProfilesInStaticPlaylist(this.connection, playlist, callback);
}

DatabaseWrapper.prototype.countProfilesInDynamicPlaylist = function(playlist, callback) {
	dbmysql.countProfilesInDynamicPlaylist(this.connection, playlist, callback);
}

DatabaseWrapper.prototype.getProfileByUserId = function(playlist, userId, callback) {
	dbmysql.getProfileByUserId(this.connection, playlist, userId, callback);
};

DatabaseWrapper.prototype.getProfileByFbId = function(playlist, fbId, callback) {
	dbmysql.getProfileByFbId(this.connection, playlist, fbId, callback);
};

DatabaseWrapper.prototype.getStaticParticipants = function(playlist, callback, ...ranks) {
	dbmysql.getStaticParticipants(this.connection, playlist, callback, ...ranks);
}

DatabaseWrapper.prototype.getDynamicParticipants = function(playlist, callback, ...ranks) {
	dbmysql.getDynamicParticipants(this.connection, playlist, callback, ...ranks);
}

DatabaseWrapper.prototype.shiftStaticProfileStats = function(playlist, id, deltaElo, statIdentifier, callback) {
	dbmysql.shiftStaticProfileStats(this.connection, playlist, id, deltaElo, statIdentifier, callback);
}

DatabaseWrapper.prototype.shiftDynamicProfileStats = function(playlist, id, deltaElo, statIdentifier, callback) {
	dbmysql.shiftDynamicProfileStats(this.connection, playlist, id, deltaElo, statIdentifier, callback);
}

DatabaseWrapper.prototype.profileExists = function(fbId, callback) {
	dbmysql.profileExists(this.connection, fbId, callback);
};
DatabaseWrapper.prototype.addUserToken = function(fbId, userId, callback) {
	dbmysql.addUserToken(this.connection, fbId, userId, callback);
}

DatabaseWrapper.prototype.verifyUserToken = function(token, callback) {
	dbmysql.verifyUserToken(this.connection, token, callback);
}

DatabaseWrapper.prototype.addProfile = function(profileData, playlists, callback) {
	dbmysql.addProfile(this.connection, profileData, playlists, callback);
};

DatabaseWrapper.prototype.addProfileToPlaylists = function(playlists, userId, callback) {
	dbmysql.addProfileToPlaylists(this.connection, playlists, userId, callback);
};

DatabaseWrapper.prototype.queueProfileRemovalByUserId = function(userId, callback) {
	dbmysql.queueProfileRemovalByUserId(this.connection, userId, callback);
};

DatabaseWrapper.prototype.queueProfileRemovalByFbId = function(fbId, callback) {
	dbmysql.queueProfileRemovalByFbId(this.connection, fbId, callback);
};

DatabaseWrapper.prototype.updateStaticPlaylistsRanks = function(playlists, callback) {
	dbmysql.updateStaticPlaylistsRanks(this.connection, playlists, callback);
};

DatabaseWrapper.prototype.updateDynamicPlaylistsRanks = function(playlists, callback) {
	dbmysql.updateDynamicPlaylistsRanks(this.connection, playlists, callback);
};

DatabaseWrapper.prototype.removeProfileByUserId = function(userId, callback) {
	dbmysql.removeProfileByUserId(this.connection, userId, callback);
};

DatabaseWrapper.prototype.removeProfileByFbId = function(fbId, callback) {
	dbmysql.removeProfileByFbId(this.connection, fbId, callback);
};

DatabaseWrapper.prototype.getStaticPlaylistLeaderboard = function(playlist, count, callback) {
	dbmysql.getStaticPlaylistLeaderboard(this.connection, playlist, count, callback);
};

DatabaseWrapper.prototype.getDynamicPlaylistLeaderboard = function(playlist, count, callback) {
	dbmysql.getDynamicPlaylistLeaderboard(this.connection, playlist, count, callback);
};

DatabaseWrapper.prototype.translationKeyExists = function(key, callback) {
	dbmysql.translationKeyExists(this.connection, key, callback);
};

DatabaseWrapper.prototype.getTasks = function(callback) {
	dbmysql.getTasks(this.connection, callback);
};

DatabaseWrapper.prototype.performTask = function(task, callback) {
	dbmysql.performTask(this.connection, task, callback);
};

/*
 * The duplicated functions end here.
 */


module.exports = {
	getInstance
};
