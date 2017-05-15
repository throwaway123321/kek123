const mysql = require('mysql');
const fs = require('fs');

const uuidV4 = require('uuid/v4');

const logger = require('../utilities/logger');

// db_config.json should only contain host, user and password.
const config = JSON.parse(fs.readFileSync('./db_config.json'));
config.database = "smashorpass";
config.connectionLimit = 100;
config.multipleStatements = true;

const pool = mysql.createPool(config);

/**
 * A private function used for un-needed callbacks
 * @param {...} a	An unlimited amount of arguments of any type
 */
function emptyFunction(...a) {
}

/**
 * A function used to handle errors when getting a connection from the connection pool
 * PLEASE remember to release the connection after usage :)
 * @param {function} queryCallback	The function to execute if a connection is succesfully created. Takes a single argument, the connection.
 * @param {function} errorCallback	The function to execute if an error occurs. Takes a single argument, null. This will often (always?) be the callback provided to the databasing function.
 */
function getPoolConnection(queryCallback, errorCallback) {
	pool.getConnection(
		function(err, connection) {
			if(err) {
				logger.error(`Whilst trying to establish a connection\n${err}`);
				errorCallback(null);
			} else {
				queryCallback(connection);
			}
		}
	);
}

/**
 * Gets all the playlists from the database
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {function} callback	Takes a single argument, containing an array of playlist objects with all the playlist properties, or null if an error occured
 */
function getPlaylists(connection, callback) {
	connection.query("SELECT * FROM playlists",
		function(err, data){
			if(err) {
				logger.error(`Whilst getting all playlists\n${err}`);
				callback(null);
			} else {
				callback(data);
			}
		}
	);
}

/**
 * Asynchronously counts the number of profiles in a specific playlist.
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} playlist		The playlist to count profiles in
 * @param {function} callback	Takes a single argument, containing an integer corresponding to the number of profiles in the playlist, or null if an error occured.
 * @param {string} table 		The playlist table to count in
 *
 * NOTE: This is internal behavior and should only be called within this implementation.
 */
function countProfilesInPlaylist(connection, playlist, callback, table) {
	connection.query(`
		SELECT COUNT(id) as count
		FROM ${table}
		WHERE playlist_id = ?`,
		[playlist.id],
		function(err, data) {
			if(err) {
				logger.error(`Whilst counting profiles in playlist ${playlist.id}\n${err}`);
				callback(null);
			} else {
				callback(data[0].count);
			}
		}
	);
}

/**
 * Asynchronously counts the number of profiles in a specific playlist (predefined).
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} playlist		The playlist (predefined) to count profiles in
 * @param {function} callback	Takes a single argument, containing an integer corresponding to the number of profiles in the playlist, or null if an error occured.
 */
function countProfilesInStaticPlaylist(connection, playlist, callback) {
	countProfilesInPlaylist(connection, playlist, callback, "playlist_celebrities");
}

/**
 * Asynchronously counts the number of profiles in a specific playlist (not predefined).
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} playlist		The playlist (not predefined) to count profiles in
 * @param {function} callback	Takes a single argument, containing an integer corresponding to the number of profiles in the playlist, or null if an error occured.
 */
function countProfilesInDynamicPlaylist(connection, playlist, callback) {
	countProfilesInPlaylist(connection, playlist, callback, "playlist_users");
}

/**
 * Asynchronously gets a with the specified userId from the database.
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} playlist		The playlist to search
 * @param {int} userId 			The userId search for.
 * @param {function} callback 	Takes a single argument, containing the profile object, or null if an error occured.
 */
function getProfileByUserId(connection, playlist, userId, callback) {
	connection.query(`
		SELECT playlist_users.*,users.name,users.fb_id
		FROM playlist_users
		INNER JOIN users ON playlist_users.user_id = users.id
			WHERE playlist_users.playlist_id = ?
			AND users.id = ?
		LIMIT 1;`,
		[playlist.id, userId],
		function(err, data) {
			if(err) {
				logger.error(`Whilst getting a profile by userId '${userId}'\n${err}`);
				callback(null);
			} else {
				callback(data[0]);
			}
		}
	);
}

/**
 * Asynchronously gets a with the specified fbId from the database.
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} playlist		The playlist to search
 * @param {int or string} fbId 	The FB ID to search for.
 * @param {function} callback 	Takes a single argument, containing the profile object, or null if an error occured.
 */
function getProfileByFbId(connection, playlist, fbId, callback) {
	connection.query(`
		SELECT playlist_users.*,users.name,users.fb_id
		FROM playlist_users
		INNER JOIN users ON playlist_users.user_id = users.id
			WHERE playlist_users.playlist_id = ?
			AND users.fb_id = ?
		LIMIT 1;`,
		[playlist.id, fbId],
		function(err, data) {
			if(err) {
				logger.error(`Whilst getting a profile by fbId '${fbId}'\n${err}`);
				callback(null);
			} else {
				callback(data[0]);
			}
		}
	);
}

/**
 * Asynchronously gets the profiles with the specified ranks in the given playlist (predefined)
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} playlist		The playlist (predefined) to search
 * @param {function} callback 	Takes a single argument, containing the profile objects, or null if an error occured.
 * @param {int[]} ranks 		The ranks to search for.
 */
function getStaticParticipants(connection, playlist, callback, ...ranks) {
	const conditions = ranks.join();
	connection.query(`
		SELECT playlist_celebrities.*,celebrities.name,celebrities.picture,celebrities.picture_author,celebrities.picture_license,celebrities.known_for,celebrities.desc_url
		FROM playlist_celebrities
		INNER JOIN celebrities ON playlist_celebrities.celeb_id = celebrities.id
			WHERE playlist_celebrities.playlist_id = ?
			AND playlist_celebrities.rank IN (${conditions})
		LIMIT ?;`,
		[playlist.id, ranks.length],
		function(err, data) {
			if (err) {
				logger.error(`Whilst getting participants (${conditions}), playlist ${playlist.key}\n${err}`);
				callback(null);
			} else {
				callback(data);
			}
		}
	);
}

/**
 * Asynchronously gets the profiles with the specified ranks in the given playlist (not predefined)
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} playlist		The playlist (not predefined) to search
 * @param {function} callback 	Takes a single argument, containing the profile objects, or null if an error occured.
 * @param {int[]} ranks 		The ranks to search for.
 */
function getDynamicParticipants(connection, playlist, callback, ...ranks) {
	const conditions = ranks.join();
	connection.query(`
		SELECT playlist_users.*,users.name,users.fb_id
		FROM playlist_users
		INNER JOIN users ON playlist_users.user_id = users.id
			WHERE playlist_users.playlist_id = ?
			AND playlist_users.rank IN (${conditions})
		LIMIT ?;`,
		[playlist.id, ranks.length],
		function(err, data) {
			if (err) {
				logger.error(`Whilst getting participants (${conditions}), playlist ${playlist.key}\n${err}`);
				callback(null);
			} else {
				callback(data);
			}
		}
	);
}

/**
 * Asynchronously updates the profile statistics by the arguments given in the given table.
 * @param {object} connection 		The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} playlist			The playlist object where the profile is contained
 * @param {integer} id				The id owned by the profile.
 * @param {integer} deltaElo		The amount of elo which should be added or removed from the profile
 * @param {integer} statIdentifier	Wether the profile won or lost, 1 will add +1 to wins, 0 will add +1 to losses, anything else does nothing other than elo
 * @param {function} callback		A function taking a single argument, null if an error occured, true if it succeeded. Invoked after query finished.
 * @param {string} table 			The table to update the profile stats in.
 *
 * NOTE: This is internal behavior and should only be called within this implementation.
 */
function shiftProfileStats(connection, playlist, id, deltaElo, statIdentifier, callback, table) {
	let updateQuery;

	// Add the statistic updates
	if (statIdentifier == 0) {
		updateQuery = "SET elo = elo + ?, losses = losses + 1";
	} else if (statIdentifier == 1) {
		updateQuery = "SET elo = elo + ?, wins = wins + 1";
	} else {
		updateQuery = "SET elo = elo + ?";
	}

	connection.query(
		`UPDATE ${table} ${updateQuery}
			WHERE id = ? LIMIT 1;`,
		[deltaElo, id],
		function(err, data) {
			if (err) {
				logger.error(`Whilst updating profile statistics in playlist ${playlist.key}, id ${id}\n${err}`);
				callback(null);
			} else {
				callback(true);
			}
		}
	);
}

/**
 * Asynchronously updates the profile statistics by the arguments given.
 * @param {object} connection 		The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} playlist			The playlist (predefined) object where the profile is contained
 * @param {integer} id				The id owned by the profile.
 * @param {integer} deltaElo		The amount of elo which should be added or removed from the profile
 * @param {integer} statIdentifier	Wether the profile won or lost, 1 will add +1 to wins, 0 will add +1 to losses, anything else does nothing other than elo
 * @param {function} callback		A function taking a single argument, null if an error occured, true if it succeeded. Invoked after query finished.
 */
function shiftStaticProfileStats(connection, playlist, id, deltaElo, statIdentifier, callback) {
	shiftProfileStats(connection, playlist, id, deltaElo, statIdentifier, callback, "playlist_celebrities");
}

/**
 * Asynchronously updates the profile statistics by the arguments given.
 * @param {object} connection 		The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} playlist			The playlist (not predefined) object where the profile is contained
 * @param {integer} id				The id owned by the profile.
 * @param {integer} deltaElo		The amount of elo which should be added or removed from the profile
 * @param {integer} statIdentifier	Wether the profile won or lost, 1 will add +1 to wins, 0 will add +1 to losses, anything else does nothing other than elo
 * @param {function} callback		A function taking a single argument, null if an error occured, true if it succeeded. Invoked after query finished.
 */
function shiftDynamicProfileStats(connection, playlist, id, deltaElo, statIdentifier, callback) {
	shiftProfileStats(connection, playlist, id, deltaElo, statIdentifier, callback, "playlist_users");
}

/**
 * Asynchronously logs a vote.
 * @param {object} connection 		The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} playlistId		The id of the playlist where the match was played.
 * @param {integer} profile1Id		The profile id of the first profile.
 * @param {integer} profile2Id		The profile id of the second profile.
 * @param {integer} winnerId			The profile id of the profile which won (-1 if the user skipped)
 * @param {integer} voterFbId		The Facebook ID of the person who cast the vote (-1 if not logged in)
 * @param {function} callback		A function taking no parameters. Probably used for releasing the connection.
 */
function logVote(connection, playlistId, profile1Id, profile2Id, winnerId, voterFbId, callback) {
	connection.query(`
		INSERT INTO votes
		(playlist_id, profile1_id, profile2_id, winner_id, voter_fb_id)
		VALUES (${playlistId}, ${profile1Id}, ${profile2Id}, ${winnerId},  ?)`,
		[voterFbId],
		function(err, data) {
			callback();
			if(err) {
				logger.error(`Whilst logging a vote:\n\tprofile1Id = ${profile1Id}\n\tprofile2Id = ${profile2Id}\n\twinner = ${winnerId}\n\tvoterFbId = ${voterFbId}\n${err}`);
			}
		}
	);
}

/**
 * Asynchronously checks if a profile with the specified fbId already exists
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {int} fbId 			The fbId to check for
 * @param {function} callback	Takes a single parameter which returns true, if the profile exists,
 * 								false if it doesn't and null if there was an error
 */
function profileExists(connection, fbId, callback) {
	connection.query(
		`SELECT id FROM users WHERE fb_id = ?`,
		[fbId],
		function(err, data) {
			if (err) {
				logger.error(`Whilst checking if profile exists, fb_id ${fbId}\n${err}`);
				callback(null);
			} else if(data.length > 0) {
				callback(data[0].id);
			} else {
				callback(false);
			}
		}
	);
}

function addUserToken(connection, fbId, userId, callback) {
	const token = uuidV4();

	connection.query(`
		INSERT INTO user_tokens
		(user_id, fb_id, token, last_used)
		VALUES (?, ?, ?, DATE(NOW()))`,
		[userId, fbId, token],
		function(err, data) {
			if(err) {
				logger.error(`Whilst adding a user token, token = ${token}\n${err}`);
				callback(null);
			} else {
				callback(token);
			}
		}
	);
}

function verifyUserToken(connection, token, callback) {
	connection.query(`
		SELECT
			user_id,
			fb_id
		FROM user_tokens
		WHERE
			token = ? AND
			last_used >= DATE_SUB(DATE(NOW()), INTERVAL 7 DAY)`,
			[token],
		function(err, data) {
			if(err) {
				logger.error(`Whilst verifying a user token, token = ${token}\n${err}`);
				callback({ result: false, data: null });
			} else if (data.length == 0) {
				callback({ result: false, data: null });
			} else {
				// Set last_used to the current day :D
				connection.query(`UPDATE user_tokens SET last_used = DATE(NOW()) WHERE token = ${token}`, emptyFunction);

				callback(true, data[0]);
			}
		}
	);
}

/**
 * Asynchronously adds the profile to the users table and adds a task to add the profile to the different playlists
 * @param {object} connection 		The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} profileData		The profileData of the profile to add (fbId, name, gender, city and country)
 * @param {array} playlists			The playlists to add the profile to
 * @param {function} callback		The callback to be called for status. False if this operation failed, true otherwise.
 */
function addProfile(connection, profileData, playlists, callback) {

	connection.query(`
		INSERT INTO users (name, fb_id, country, city, gender)
		VALUES (?, ?, ?, ?, ?);
		SELECT LAST_INSERT_ID() AS id;`,
		[profileData.name, profileData.fbId, profileData.country, profileData.city, profileData.gender],
		function(err, data) {
			if (err) {
				logger.error(`Whilst inserting profile into users table, fb_id ${profileData.fbId}\n${err}`);
				callback(null);
				return;
			}

			const userId = data[1][0].id;

			let playlistJSON = [];
			for (let playlist of playlists) {
				let playlistData = {};
				playlistData.id = playlist.id;
				playlistJSON.push(playlistData);
			}

			const playlistDataString = JSON.stringify(playlistJSON);

			// DUAL table is simply a dummy table used for when you're not interested in the actual data.
			connection.query(`
				INSERT INTO tasks (user_id, task, data)
				SELECT ?,'add', ?
				FROM DUAL
				WHERE NOT EXISTS (
					SELECT id FROM tasks
							WHERE user_id = ?
							AND task = 'add'
							AND data = ?
				);`,
				[userId, playlistDataString, userId, playlistDataString],
				function(err2, data2) {
					if (err2) {
						logger.error(`Whilst queuing profile with userid ${userId} to an 'add' task\n${err2}`);
						queueProfileRemovalByUserId(userId, emptyFunction);
						callback(null);
					} else {
						addUserToken(connection, profileData.fbId, data[1][0].id, function(token) {
							callback(true, token);
						});
					}
				}
			);
		}
	);
}
/**
 * Asynchronously adds the profile to the specified playlists
 * @param {object} connection 		The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {array} playlists			The playlists to add the profile to
 * @param {int} userId 				The user to insert into the specified playlists
 * @param {function} callback		Takes a single argument, null if the operation fails, or true if it succeeds
 */
function addProfileToPlaylists(connection, playlists, userId, callback) {
	if (playlists.length <= 0) {
		callback(true);
		return;
	}

	let playlistId = playlists[0].id;
	let query = `INSERT INTO playlist_users (playlist_id, user_id) VALUES (${playlistId},${userId})`;

	for (let i = 1; i < playlists.length; i++) {
		playlistId = playlists[i].id;
		query += `,(${playlistId},${userId})`;
	}

	connection.query(query, 
		function(err, data) {
			if (err) {
				logger.error(`Whilst adding profile to playlists, user_id ${userId}\n${err}`);
				callback(null);
			} else {
				callback(true);
			}
		}
	);
}

/**
 * Asynchronously adds a task to the removal queue using userId
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {integer} userId 		The userId of the profile which should be removed
 * @param {function} callback	Takes a single argument, null if the operation fails, or true if it succeeds
 */
function queueProfileRemovalByUserId(connection, userId, callback) {
	connection.query(`
		INSERT INTO tasks (user_id, task)
		SELECT ?,'remove'
		FROM DUAL
		WHERE NOT EXISTS (
			SELECT id FROM tasks
					WHERE user_id = ?
					AND task = 'remove'
		);`,
		[userId, userId],
		function(err, data) {
			if (err) {
				logger.error(`Whilst queuing profile with userid ${userId} to a 'remove' task\n${err}`);
				callback(null);
			} else {
				callback(true);
			}
		}
	);
}

/**
 * Asynchronously adds a task to the removal queue using fbId
 * @param {object} connection 		The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {integer or string} fbId 	The fbId of the profile which should be removed
 * @param {function} callback		Takes a single argument, null if the operation fails, or true if it succeeds
 */
function queueProfileRemovalByFbId(connection, fbId, callback) {
	connection.query(`
		INSERT INTO tasks (user_id, task)
		SELECT id,'remove' FROM users
		WHERE users.fb_id = ?
		AND NOT EXISTS (
			SELECT id FROM tasks
			WHERE user_id IN (
				SELECT id FROM users
				WHERE fb_id = ?
			)
			AND task = 'remove'
		);`,
		[fbId, fbId],
		function(err, data) {
			if (err) {
				logger.error(`Whilst queuing profile with fb_id ${fbId} to a 'remove' task\n${err}`);
				callback(null);
			} else {
				callback(true);
			}
		}
	);
}

/**
 * Asynchronously updates the rank column of a playlist.
 * @param {object} connection 		The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {array} playlists			An array of playlists (not predefined) to update ranks for
 * @param {function} callback		Takes a single argument, null if the operation fails, or true if it succeeds
 * @param {string} table 			The table to update ranks in
 *
 * NOTE: This is internal behavior and should only be called within this implementation.
 */
function updatePlaylistsRanks(connection, playlists, callback, table) {
	function updateRanksInPlaylist(index) {
		if (index >= playlists.length) {
			callback(true);
			return;
		}

		const playlist = playlists[index];

		connection.query(`
			SET @newRank = 0;
			UPDATE ${table}
			SET rank = IF (playlist_id = ?, (@newRank:=@newRank+1), rank)
				WHERE playlist_id = ?
			ORDER BY elo DESC;`,
			[playlist.id, playlist.id],
		function(err, data) {
			if (err) {
				logger.error(`Whilst updating playlist ranks in playlist ${playlist.id}\n${err}`);
				callback(null);
			} else {
				updateRanksInPlaylist(index + 1);
			}
		});
	}

	updateRanksInPlaylist(0);
}

/**
 * Asynchronously updates the rank column of a playlist (predefined).
 * @param {object} connection 		The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {array} playlists			An array of playlists (predefined) to update ranks for
 * @param {function} callback		Takes a single argument, null if the operation fails, or true if it succeeds
 */
function updateStaticPlaylistsRanks(connection, playlists, callback) {
	updatePlaylistsRanks(connection, playlists, callback, "playlist_celebrities");
}

/**
 * Asynchronously updates the rank column of a playlist (not predefined).
 * @param {object} connection 		The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {array} playlists			An array of playlists (not predefined) to update ranks for
 * @param {function} callback		Takes a single argument, null if the operation fails, or true if it succeeds
 */
function updateDynamicPlaylistsRanks(connection, playlists, callback) {
	updatePlaylistsRanks(connection, playlists, callback, "playlist_users");
}

/**
 * Asynchronously removes a profile from all appropriate playlists and thereafter the users table
 * @param {object} connection 		The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {int} userId 				The user ID of the profile to remove
 * @param {function} callback		The callback to be called for status. Null if this operation failed, true otherwise.
 */
function removeProfileByUserId(connection, userId, callback) {
	connection.query(`
		DELETE playlist_users.*
		FROM playlist_users
			WHERE user_id = ?`,
		[userId],
		function(err, data) {
			if(err) {
				logger.error(`Whilst removing a profile from the appropriate playlists\n${err}`);
				callback(null);
				return;
			}

			connection.query(`
				DELETE users.*
				FROM users
					WHERE id = ?`,
				[userId],
				function(err, data) {
					if(err) {
						logger.error(`Whilst removing a profile from the users table\n${err}`);
						callback(null);
					} else {
						callback(true);
					}
				}
			);
		}
	);
}

/**
 * Asynchronously removes a profile from all appropriate playlists and thereafter the users table
 * @param {object} connection 		The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {int} fbId 				The Facebook ID of the profile to remove
 * @param {function} callback		The callback to be called for status. Null if this operation failed, true otherwise.
 */
function removeProfileByFbId(connection, fbId, callback) {
	connection.query(`
		DELETE playlist_users.* FROM playlist_users
		JOIN users ON playlist_users.user_id = users.id
			WHERE users.fb_id = ?`,
		[fbId],
		function(err, data) {
			if(err) {
				logger.error(`Whilst removing a profile from the appropriate playlists\n${err}`);
				callback(null);
				return;
			}

			connection.query(`
				DELETE users.* FROM users
					WHERE fb_id = ?`,
				[fbId],
				function(err, data) {
					if(err) {
						logger.error(`Whilst removing a profile from the users table\n${err}`);
						callback(null);
					} else {
						callback(true);
					}
				}
			);
		}
	);
}

/**
 * Asynchronously gets a leaderboard with a maximum length of {@code count}.
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} playlist 	The playlist (predefined) where the leaderboard should be found
 * @param {int} count 			The maximum length of the leaderboard
 * @param {function} callback	The callback used to retreive the data or null if it an error occured.
 */
function getStaticPlaylistLeaderboard(connection, playlist, count, callback) {
	connection.query(`
		SELECT playlist_celebrities.*,celebrities.name,celebrities.picture,celebrities.known_for,celebrities.desc_url
		FROM playlist_celebrities
		INNER JOIN celebrities ON playlist_celebrities.celeb_id = celebrities.id
			WHERE playlist_celebrities.rank <= ?
			AND playlist_celebrities.playlist_id = ?
		LIMIT ?;`,
		[count, playlist.id, count],
		function(err, data) {
			if(err) {
				logger.error(`Whilst getting leaderboard with count ${count}\n${err}`);
				callback(null);
			} else {
				callback(data);
			}
		}
	);
}

/**
 * Asynchronously gets a leaderboard with a maximum length of {@code count}.
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} playlist 	The playlist (not predefined) where the leaderboard should be found
 * @param {int} count 			The maximum length of the leaderboard
 * @param {function} callback	The callback used to retreive the data or null if it an error occured.
 */
function getDynamicPlaylistLeaderboard(connection, playlist, count, callback) {
	connection.query(`
		SELECT playlist_users.*,users.name,users.fb_id
		FROM playlist_users
		INNER JOIN users ON playlist_users.user_id = users.id
			WHERE playlist_users.rank <= ?
			AND playlist_users.playlist_id = ?
		LIMIT ?;`,
		[count, playlist.id, count],
		function(err, data) {
			if(err) {
				logger.error(`Whilst getting leaderboard with count ${count}\n${err}`);
				callback(null);
			} else {
				callback(data);
			}
		}
	);
}

/**
 * Asynchronously checks if a translation key exists in the database
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {string} key			The key to check
 * @param {function} callback	Callback taking 2 arguments, the first being a status (0 if fine, 1 if error)
 *								and the second being either an error message or the language which they key is valid for
 */
function translationKeyExists(connection, key, callback) {
	connection.query(`
		SELECT language
		FROM translation_keys
		WHERE \`key\` = "${key}"`,
		[key],
		function(err, data) {
			if(err) {
				logger.error(`Whilst checking if a translation key exists\n${err}`);
				callback(1, "Something went wrong");
			} else {
				if(data.length && data[0].language) {
					callback(0, data[0].language);
				} else {
					callback(1, "Invalid key");
				}
			}
		}
	);
}

/**
 * Gets all the playlists from the database
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {function} callback	Takes a single argument, containing an array of task objects, or null if an error occured
 */
function getTasks(connection, callback) {
	connection.query("SELECT * FROM tasks",
		function(err, data) {
			if(err) {
				logger.error(`Whilst getting tasks\n${err}`);
				callback(null);
			} else {
				callback(data);
			}
		}
	);
}

/**
 * Removes the given task from the tasks database table if it exists.
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} task			The task returned by the database.
 * @param {function} callback	Takes a single argument, true if the operation succeeds, null if an error occured.
 */
function removeTask(connection, task, callback) {
	connection.query(`
		DELETE tasks.* FROM tasks
			WHERE id = ?`,
		[task.id],
		function(err, data) {
			if(err) {
				logger.error(`Whilst removing task '${task.id}'\n${err}`);
				callback(null);
			} else {
				callback(true);
			}
		}
	);
}


/**
 * Performs the task provided, if it's valid. The task should be in the format directly from the database.
 * @param {object} connection 	The connection to query through. Should be obtained through the DatabaseWrapper module
 * @param {object} task			The task returned by the database.
 * @param {function} callback	Takes a single argument, true if the operation succeeded, or null otherwise
 */
function performTask(connection, task, callback) {
	removeTask(connection, task,
		function(status) {
			if (status) {
				switch (task.task) {
					case "add":
						addProfileToPlaylists(connection, JSON.parse(task.data), task.user_id, callback);
						return;
					case "remove":
						removeProfileByUserId(connection, task.user_id, callback);
						return;
				}

				logger.alert(`Found invalid task ${task.task}`);
				callback(null);
			}
		}
	);
}

module.exports = {
	getPoolConnection,
	getPlaylists,
	countProfilesInStaticPlaylist,
	countProfilesInDynamicPlaylist,
	getProfileByUserId,
	getProfileByFbId,
	getStaticParticipants,
	getDynamicParticipants,
	shiftStaticProfileStats,
	shiftDynamicProfileStats,
	logVote,
	profileExists,
	addUserToken,
	verifyUserToken,
	addProfile,
	addProfileToPlaylists,
	updateStaticPlaylistsRanks,
	updateDynamicPlaylistsRanks,
	queueProfileRemovalByUserId,
	queueProfileRemovalByFbId,
	removeProfileByUserId,
	removeProfileByFbId,
	getStaticPlaylistLeaderboard,
	getDynamicPlaylistLeaderboard,
	translationKeyExists,
	getTasks,
	performTask
};
