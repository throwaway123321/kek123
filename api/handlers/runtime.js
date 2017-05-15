// Handling all runtime / putting all the components together.

const schedule = require("node-schedule");

const logger = require("../utilities/logger");

const statistics = require("../stats/statistics");

const Playlist = require("./playlist");
const databaseWrapper = require("../utilities/databasewrapper");

const facebook = require("../utilities/facebook");

// Keys used to recognize females and males
const MALE_KEY = "m";
const FEMALE_KEY = "f";
// Replacement, when location doesn't exist in fb profile
const LOCATION_UNAVAILABLE = "unavailable";

// The decay time used for the playlist objects
const DECAY_TIME = 1000 * 60; // 1 minute

// Sorting and information about playlists
let playlistsByCategory = {};
let playlistsByCountry = {};
let playlistsArray = [];

let playlistCategories = [];
let playlistInformation = [];

let totalTasks = 0;

const ONCE_A_DAY_4PM = { hour: 4, minute: 0, second: 0 };
const ONCE_EVERY_10M = { minute: new schedule.Range(0, 59, 10), second: 0 };
const ONCE_EVERY_5M = { minute: new schedule.Range(0, 59, 5), second: 0 };

// The number of total profiles in the top list
const TOP_LIST_COUNT = 20;

// Used for linking predefined playlist assets
const IMAGES_DIRECTORY = "/assets/img/premade_playlists/";

// Number of opponents on each side of the selected rank
// Ex. If I am index 200, and this constant is 20, then
// I would be able to match against ranks from 180-220, 
// excluding myself.
const MINIMUM_POSSIBLE_OPPONENTS = 20;

/**
* This function should be in charge of setting up the api for runtime.
* This includes adding playlists, setting up leaderboards etc.
*
* NOTE: This is core functionality and should only be called from
* within this implementation.
*/
function setupRuntime() {
	logger.info("Setting up runtime...");
	
	setupPlaylists();
	setupTasks();

	logger.info("Done!");
}

/**
* Sets up the playlist. Each playlist will contain a prefix and
* a suffix. The prefix will be the category (Ex. "dk" or "uk"). 
* The suffix will be the gender ie. female("f") or male("m"). If
* the playlists do not exist on the database, it should be created
* before calling this function.
*
* NOTE: This is core functionality and should only be called from
* within this implementation.
*/
function setupPlaylists() {
	logger.info("Setting up playlists...");
	logger.alert(`Matches decay after approximately ${DECAY_TIME}ms!`);

	logger.info("Fetching playlists from database...");

	databaseWrapper.getInstance(function(dbw) {
		if (!dbw) {
			logger.fatal("Unable to get playlists whilst connecting to database, aborting launch for safety!");
			process.exit(1);
			return;
		}

		dbw.getPlaylists(function(data) {
			dbw.finish();
			if (data == null) {

				logger.fatal("Unable to get playlists, aborting launch for safety!");
				process.exit(1);
				return;
			} else {
				for (let playlist of data) {
					if (playlist.active) {
						addPlaylist(playlist.id, 
							playlist.country_short, 
							playlist.country, 
							playlist.gender,
							playlist.active != 0,
							playlist.predefined != 0);
					}
				}

				logger.info(`Added a total of ${playlistsArray.length} playlist(s)!`);

				logger.info("Syncing playlists with database...");
				logger.info("Cleaning up profiles...");
				profileCleanup();
			}
		});
	});
}

/**
* Sets up the tasks to be run on this server. If multiple different
* tasks are run at the same time, they should be divided into two
* tasks for convenience.
*
* NOTE: This is core functionality and should only be called from
* within this implementation.
*/
function setupTasks() {
	logger.info("Setting up tasks...");

	addTask("profileCleanup", ONCE_EVERY_5M, profileCleanup);

	logger.info(`Added a total of ${totalTasks} task(s)`);
}

/**
* Adds a playlist to the runtime. The playlist has to exist in
* the database. This is due to the playlist precounting the amount
* of entities in the database for faster calculations when picking
* random profiles. The playlist object can be retreived using the 
* function getPlaylist(playlistCategory, gender).
*
* NOTE: This is core functionality and should only be called from
* within this implementation. If this function will need to get called
* you should call it from setupPlaylists() called from setupRuntime().
*
* playlistCategory	-	A string prefix used for identifying the playlist.
* 						Ex. "da" or "en"
* playlistCountry	-	A country string used for identifying the playlist.
* 						Ex. "denmark" or "england". Should be lowercase!
*/
function addPlaylist(id, playlistCategory, playlistCountry, playlistGender, active, predefined) {
	if (playlistGender != FEMALE_KEY && playlistGender != MALE_KEY) {
		logger.alert(`Invalid playlist (${id}, ${playlistCategory}, ${playlistCountry}, ${playlistGender})`);
		return;
	}

	if (!(playlistCategory in playlistsByCategory) || !(playlistCountry in playlistsByCountry)) {
		playlistsByCategory[playlistCategory] = 
		playlistsByCountry[playlistCountry] = { };
	}

	if (!playlistCategories.includes(playlistCategory)) {
		playlistCategories.push(playlistCategory);
	}

	playlistInformation.push( {
		country: playlistCountry,
		category: playlistCategory,
		gender: playlistGender,
		isActive: active
	} );

	const playlist = new Playlist(playlistCategory, playlistGender, id, DECAY_TIME, active, predefined);
	playlistsByCategory[playlistCategory][playlistGender] = playlist;

	playlistsArray.push(playlist);

	logger.info(`Successfully added playlist '${playlistCategory}-${playlistGender}'`);
}

/**
* Adds a task to the node-schedule module. This will autmatically
* run a functionality on the server every time the recurrenceRule
* matches the current time.
*
* taskName			-	The name of this task, used for logging.
* recurrenceRule	-	The rule which will specify when to run
* 						this task.
* invokeFunction	-	The functionality to be run whenever the
* 						provided rule is matching the current time.
*
* NOTE: This is core functionality and should only be called from
* within this implementation.
*/
function addTask(taskName, recurrenceRule, invokeFunction) {
	schedule.scheduleJob(recurrenceRule, invokeFunction);

	totalTasks++;

	const recurrenceRuleString = JSON.stringify(recurrenceRule);
	logger.info(`Successfully added task ${taskName} with recurrence ${recurrenceRuleString}`);
}


/**
* Updates the ranks in all the defined playlists on the database,
* aswell as the number of profiles stored in memory under each
* playlist.
* 
* dbWrapper		-	The database wrapper object
* callback			-	Invoked when process is done. Null if it
* 						fails, true if it succeeds.
*
* NOTE: This is core functionality and should only be called from
* within this implementation.
*/
function syncPlaylists(dbWrapper, callback) {
	dbWrapper.updatePlaylistsRanks(playlistsArray, 
		function(status) {
			if (!status) {
				callback(null);
				return;
			}

			const updateProfileCount = function(playlistIndex) {
				if (playlistIndex >= playlistsArray.length) {
					callback(true);
					return;
				}

				const playlist = playlistsArray[playlistIndex];
				dbWrapper.countProfilesInPlaylist(playlist, 
					function(count) {
						if (count == null) {
							callback(null);
							return;
						}

						playlist.setProfileCount(count);
						updateProfileCount(playlistIndex + 1);
					}
				);
			}
			
			updateProfileCount(0);
		}
	);
}

/**
* Performs the tasks in pending on the database. These tasks can
* remove profiles and/or add profiles. When the profiles have been
* added or removed, the database will perform a ranking of every
* profile, which will in turn update the leaderboard etc.
*
* NOTE: This is core functionality and should only be called from
* within this implementation.
*/
function profileCleanup() {
	databaseWrapper.getInstance(function(dbw) {
		if (!dbw) {
			logger.error("Unable to fetch tasks, unable to connect!");
			logger.alert("Profile cleanup terminating...");
			return;
		}

		dbw.getTasks(function(tasks) {
			if (tasks == null) {
				logger.error("Unable to fetch tasks!");
				logger.alert("Profile cleanup terminating...");
				
				dbw.finish();
				return;
			}

			const performTask = function(index) {
				if (index >= tasks.length) {
					syncPlaylists(dbw, function(status) {
						dbw.finish();

						if (!status) {
							logger.alert("Unable to sync playlists, might want to halt the server!");
						}
					});
					return;
				}

				const task = tasks[index];
				dbw.performTask(task, 
					function(status) {
						if (status) {
							performTask(index + 1); 
						} else {
							logger.alert("Unable to finish tasks! Continuing...");
							// Simulate finishing tasks..
							performTask(Number.MAX_VALUE);
						}
					}
				);
			};

			performTask(0);
		});
	});
}

/**
* Checks if the provided playlistCategory exists within the current
* runtime.
*
* NOTE: This function should only be called if absolutly needed. If
* you're calling this function to retreive a playlist you should instead
* call getPlaylist(playlistCategory, gender) which will automatically
* check if the playlist exists and return null if it doesn't.
*
* playlistCategory	-	The category representing the playlist of which
*						may exist in this runtime.
*
* Returns			-	true, if the playlistCategory exists, false otherwise.
*/
function hasPlaylistCategory(playlistCategory) {
	return (playlistCategory in playlistsByCategory);
}

/**
* Checks if the provided playlistcategory and -gender exists within the 
* current runtime.
*
* NOTE: This function should only be called if absolutly needed. If
* you're calling this function to retreive a playlist you should instead
* call getPlaylist(playlistCategory, gender) which will automatically
* check if the playlist exists and return null if it doesn't.
*
* playlistCategory	-	The category representing the playlist of which
*						may exist in this runtime.
* gender			-	The gender representing the playlist of which
*						may exist in this runtime.
*
* Returns			-	true, if the playlist with the specified category 
* 						and gender exists, false otherwise.
*/
function hasPlaylist(playlistCategory, gender) {
	if (!hasPlaylistCategory(playlistCategory)) {
		return false;
	}
	return (gender in playlistsByCategory[playlistCategory]);
}

/**
* Returns 		-	an array of loaded playlist objects. The objects 
* 					contain the information granted in playlist.js.
*/
function getPlaylists() {
	return playlistsArray;
}

/**
* Returns 		-	an array of categories representing the gateway to
* 					different playlists. If you want to grant more info
* 					about a specific playlist/category, you can call
* 					getPlaylist(category, gender) to grand an object
* 					containing more info (specified in playlist.js).
*/
function getPlaylistCategories() {
	return playlistCategories;
}

/**
* Returns		-	an array of objects containing information about
* 					every single playlist defined in this runtime.
* 					the information will describe the country, category,
* 					gender & 'isActive' describing rather the playlist
* 					is active or not.
*/
function getPlaylistInformation() {
	return playlistInformation;
}

/**
* Checks if the provided playlistcategory and -gender exists within the
* current runtime. If a playlist matching the given data exists, it will
* be returned.
*
* NOTE: This function calls hasPlaylist(playlistCategory, gender) as a
* helperfunction to check if the playlist exists or not. If it doesn't
* null(undefined) will be returned.
*
* playlistCategory	-	The category used to identify the playlist which
*						should be returned.
* gender			-	The gender used to identify the playlist which
*						should be returned.
* 
* Returns			-	null, if the playlist does not exist in this
*						runtime, the granted playlist, if it does.
*/
function getPlaylist(playlistCategory, gender) {
	if (!hasPlaylist(playlistCategory, gender)) {
		return null;
	}
	return playlistsByCategory[playlistCategory][gender];
}

/**
* Generates a match in the specified playlist. If the playlist does
* not exist in this runtime or if there is less than 2 profiles in
* the database, this function will simply return false. If the process
* succeeds, this function returns true. If the database successfully
* returns the granted profiles, the provided callback will be called
* with an arg containing an object: { matchUUID, profile0, profile1 }.
* The matchUUID should later be used for finishing the pending match.
*
* NOTE: this function will not be pending for the database to retreive
* the profiles granted. This means that the callback function will
* be called asynchronously and will therefore have some latency.
*
* playlistCategory	-	The category used to identify the playlist
* 						where the match should be played.
* gender			-	The gender used to identify the playlist
*						where the match should be played
* callback			-	The callback used to retreive data about the
* 						generated match in the first argument. This 
*						data will contain the matchUUID and the two 
*						profiles. The structure is as following 
*						{ matchUUID, profile0, profile1 }. If an error 
*						occurs null is the first argument.
*
* Returns			-	false, if the playlist does not exist or if
* 						there are not enough profiles within the 
* 						granted playlist, true otherwise.
*/
function generateMatch(playlistCategory, gender, voterFbId, callback) {
	
	const playlist = getPlaylist(playlistCategory, gender);
	if (playlist == null) {
		statistics.matchFailed(playlistCategory, gender, 
			-1, -1, statistics.ILLEGAL_PLAYLIST);
		
		callback(null);
		return false;
	}

	const profileNum = playlist.getProfileCount();
	if (profileNum < 2) {
		const playlistKey = playlist.key;
		
		logger.alert(`Not enough users in playlist ${playlistKey} (${profileNum})`);

		statistics.matchFailed(playlistCategory, gender, 
			-1, -1, statistics.TOO_FEW_PROFILES);
		
		callback(null);
		return false;
	}

	// Note: Database is one-based
	let index0;
	let index1;

	// Select two random participants
	if (profileNum < MINIMUM_POSSIBLE_OPPONENTS * 2) {
		index0 = Math.floor(Math.random() * (profileNum - 0)) + 1;
		index1 = Math.floor(Math.random() * (profileNum - 1)) + 1;

		// If index1 is above or equal to index0, it should exclude index0
		// by adding 1.
		if (index1 >= index0) {
			++index1;
		}
	} 
	// Select two, biased (close to each other), participants
	else {
		index0 = Math.floor(Math.random() * (profileNum - 0)) + 1;

		let offset = 
		((index0 + MINIMUM_POSSIBLE_OPPONENTS > profileNum) ?	// Overflow
			profileNum - MINIMUM_POSSIBLE_OPPONENTS * 2 + 1 : 
			((index0 - MINIMUM_POSSIBLE_OPPONENTS < 1) ?		// Underflow
				1 : 
				index0 - MINIMUM_POSSIBLE_OPPONENTS));			// Default

		// Offset is one-based, we don't + 1 here:
		index1 = offset + Math.floor(Math.random() * (MINIMUM_POSSIBLE_OPPONENTS * 2 - 1));

		if (index1 >= index0) {
			// We hit index0 in our random selecting. We need to increment
			// index1 to exclude index0.
			// NOTE: This is taken into count when declearing index1.
			index1++;
		}
	}

	databaseWrapper.getInstance(function(dbw) {
		if (!dbw) {
			callback(null);
			return;
		}

		dbw.getParticipants(playlist, 
			function(data) {
				dbw.finish();

				if (data == null) {
					statistics.matchFailed(playlistCategory, gender, 
						index0, index1, statistics.DATABASE_ERROR);
					
					callback(null); // Callback with null argument (failed)
					return;
				}

				if (data.length < 2) {
					logger.error(`${data.length} profile(s) were fetched, but 2 were needed. Indexes (${index0}, ${index1})`);
					
					statistics.matchFailed(playlistCategory, gender, 
						index0, index1, statistics.DATABASE_ERROR);
					
					callback(null); // Callback with null argument (failed)
					return;
				}
				
				statistics.matchStarted(playlist, index0, index1);

				let profile0 = data[0];
				let profile1 = data[1];
				
				// Generate new match. The match will automatically decayed
				const matchUUID = playlist.genMatch(profile0, profile1, voterFbId);
				
				profile0 = simplifyProfile(profile0, playlist);
				profile1 = simplifyProfile(profile1, playlist);
				callback({ matchUUID, profile0, profile1 });
			}
		, index0, index1);
	});

	return true;
}

/**
* Returns - a simplified version of the profile provided. The 
* profile should contain fb_id, name, elo, wins, losses & rank.
* 
* rawProfile	-	The profile to be simplified. 
*
* NOTE: This is core functionality and should only be called from
* within this implementation.
*/
function simplifyProfile(rawProfile, playlist) {
	if (!playlist.isPredefined()) {
		return {
			picture: facebook.getPictureURL(rawProfile.fb_id),
			name: rawProfile.name,
			elo: rawProfile.elo,
			wins: rawProfile.wins,
			losses: rawProfile.losses,
			rank: rawProfile.rank
		};
	} else {
		return {
			picture: getImagePath(rawProfile.picture),
			picture_author: rawProfile.picture_author,
			picture_license: rawProfile.picture_license,
			name: rawProfile.name,
			elo: rawProfile.elo,
			wins: rawProfile.wins,
			losses: rawProfile.losses,
			rank: rawProfile.rank,
			known_for: rawProfile.known_for,
			desc_url: rawProfile.desc_url
		};
	}
}

/**
* Converts the given path into a usable url format
* depending on the file structure on the server.
*
* Returns	-	The converted path.
*
* NOTE: This is core functionality and should only be called from
* within this implementation.
*/
function getImagePath(path) {
	return IMAGES_DIRECTORY + path;
}

/**
* Finishes the match with the provided playlistCategory, gender and 
* matchUUID and adds or removes elo from the profiles in the database.
* If the operation fails nothing will happpen to the database entries.
*
* playlistCategory	-	The category used to identify the playlist
* 						where the match was played.
* gender			-	The gender used to identify the playlist
*						where the match was played
* matchUUID			-	The uuid used to identify the played match
* result			-	The result of the match, see playlist#finishMatch
*
* Returns	-	false, If the operation fails or the playlist or
* 				match does not exist. If the operation succeeds 
* 				and the match hasn't decayed, true is returned.
*/
function finishMatch(playlistCategory, gender, matchUUID, result) {
	const playlist = getPlaylist(playlistCategory, gender);
	if (playlist == null) {
		statistics.matchEndFailed(playlistCategory, gender, 
			statistics.ILLEGAL_PLAYLIST);
		
		return false;
	}

	const match = playlist.finishMatch(matchUUID, result);
	if (match == null) {
		statistics.matchEndFailed(playlistCategory, gender, 
			statistics.NONEXISTENT_MATCH);
		
		return false;
	}

	if (result == 0 || result == 1) {
		const eloDelta = match.getEloDelta(result);

		if (eloDelta[0] != 0 || eloDelta[1] != 0) {
			databaseWrapper.getInstance(function(dbw) {
				if (!dbw) {
					return;
				}

				let changedElo = false;
				const shiftCallback = function(status) {
					if (!changedElo) {
						changedElo = true;
					} else {
						dbw.finish();
					}
				}
				
				if (eloDelta[0] != 0) {
					dbw.shiftProfileStats(playlist, match.id0, eloDelta[0], result, shiftCallback);
				}
				if (eloDelta[1] != 0) {
					dbw.shiftProfileStats(playlist, match.id1, eloDelta[1], 1 - result, shiftCallback);
				}
			});
		}
	}

	statistics.matchEnded(playlist, match.id0, match.id1, result, match.voterFbId);

	return true;
}

/**
* Adds a profiles using the provided Facebook access_token. This
* process will fetch data from the graph api by Facebook using the
* utilities/facebook module. If the process fails, the callback
* will be provided with information about the error. If the process
* succeeds the callback will not be called with a second argument null.
* The profile fetched via the access_token will be added to the
* profiles table and any matching playlist tables in the database.
*
* fbAccessToken		-	The access_token provided by facebook.
* callback			-	This is a function callback used for handling
*						errors with two arguments (errorCode, error).
*						The following errors are possible.
*						errorCode - error
*							 0 - "No access" (Facebook api ajax error)
*							 1 - "Internal error"
*							 2 - "Already exists"
*							 3 - "Illegal gender" (Gender = 'other')
*							-1 - null (success)
*/
function addProfile(fbAccessToken, callback) {
	facebook.getFacebookProfile(fbAccessToken, 
		function(err1, data) {
			if (err1 != null) {
				statistics.profileAddFailed(null, null, statistics.UNKNOWN_ERROR);

				callback(0, "No access");
				return;
			}

			const fbId = data.id;
			const name = data.name;

			databaseWrapper.getInstance(function(dbw) {
				if (!dbw) {
					statistics.profileAddFailed(null, null, statistics.UNKNOWN_ERROR);

					callback(1, "Internal error");
					return;
				}

				dbw.profileExists(fbId, 
					function(existData) {
						if (existData != false) {
							dbw.finish();
							
							if (existData) {
								statistics.profileAddFailed(fbId, name, statistics.ALREADY_EXISTS);
								
								callback(2, "Already exists");
								return;
							}

							statistics.profileAddFailed(fbId, name, statistics.UNKNOWN_ERROR);

							callback(1, "Internal error");
							return;
						}

						const profileData = { 
							fbId: fbId,
							name: name,
							gender: data.gender
						};

						if (("location" in data) && ("location" in data.location)) {
							if ("city" in data.location.location) {
								profileData.city = data.location.location.city;
							} else {
								profileData.city = LOCATION_UNAVAILABLE;
							}
							if ("country" in data.location.location) {	
								profileData.country = data.location.location.country;
							} else {
								profileData.country = LOCATION_UNAVAILABLE;
							}
						} else {
							profileData.city = LOCATION_UNAVAILABLE;
							profileData.country = LOCATION_UNAVAILABLE;
						}

						const playlists = getPlaylistsByProfile(profileData);
						if (playlists == null) {
							dbw.finish();

							statistics.profileAddFailed(fbId, name, statistics.ILLEGAL_GENDER);
							
							callback(3, "Illegal gender");
							return;
						}

						dbw.addProfile(profileData, playlists, 
							function(status, token) {
								dbw.finish();

								if (status) {
									statistics.profileAdded(playlists, fbId, name);

									callback(-1, token);
								} else { // Null or false
									statistics.profileAddFailed(fbId, name, statistics.UNKNOWN_ERROR);

									callback(1, "Internal error");
								}
							}
						);
					}
				);
			});
		}
	);
}

/**
* Retreives the matching playlists according to the data fetched
* from the profileData. The data needed to perform this operation
* is { gender, country }. The country will be converted to lowercase
* and tested against the playlistsByCountry object.
*
* NOTE: This is core functionality and should only be called from
* within this implementation.
*
* profileData	-	Data about the specified profile: gender & country
*
* Returns		-	The matching playlists for the provided data. If
* 					the gender isn't supported, null will be returned.
*/
function getPlaylistsByProfile(profileData) {
	let gender;
	if ("male" == profileData.gender) {
		gender = MALE_KEY;
	} else if ("female" == profileData.gender) {
		gender = FEMALE_KEY;
	} else {
		return null; // Error
	}

	let result = [];

	let country = profileData.country;
	if (country != null) {
		country = country.toLowerCase();

		if (country in playlistsByCountry) {
			result.push(playlistsByCountry[country][gender]);
		}
	}

	result.push(playlistsByCountry["international"][gender]);

	return result;
}

/**
* Verifies the given usertoken through the database. 
* If the token exists, the callback will be invoked 
* with:
* 	{ result: true, data: data } 
* and otherwhise:
* 	{ result: false, error: error }
*
* token		-	The token to be tested.
* callback	-	The callback function to be invoked 
* 				when the result is present.
*/
function verifyUserToken(token, callback) {
	databaseWrapper.getInstance(function(dbw) {
		if (!dbw) {
			callback({ result: false, error: "Internal error" });
			return;
		}

		dbw.verifyUserToken(token, function(result, data) {
			dbw.finish();

			if (data) {	
				callback({ result: true, data: data });
			} else {
				callback({ result: false, error: "Invalid token" });
			}
		});
	});
}

/**
* Queues a profile for removal. The profile will be removed once
* the cleanupProfiles task is called. 
* If the queuing will fail if the fbAccessToken is invalid,
* the profile doesn't exist or if the database calls fail.
*
* fbAccessToken		-	The access_token provided by facebook.
* callback			-	This is a function callback used for handling
*						errors with two arguments (errorCode, error).
*						The following errors are possible:
*						errorCode - error
*							 0 - "No access" (Facebook api ajax error)
*							 1 - "Internal error"
*							 2 - "Doesn't exist"
*							-1 - null (success)
*/
function queueProfileRemoval(fbAccessToken, callback) {
	facebook.getFacebookProfile(fbAccessToken, 
		function(err1, data) {
			if (err1 != null) {
				statistics.profileRemovalPendingFailed(null, null, statistics.UNKNOWN_ERROR);

				callback(0, "No access");
				return;
			}

			const fbId = data.id;
			// Used for stats
			const name = data.name;

			databaseWrapper.getInstance(function(dbw) {
				if (!dbw) {
					statistics.profileRemovalPendingFailed(null, null, statistics.UNKNOWN_ERROR);

					callback(1, "Internal error");
					return;
				}

				dbw.profileExists(fbId, 
					function(existData) {
						if (!existData) {
							dbw.finish();

							if (existData == false) {
								statistics.profileRemovalPendingFailed(fbId, name, statistics.DOESNT_EXISTS);
							
								callback(2, "Doesn't exist");
								return;
							}

							statistics.profileRemovalPendingFailed(fbId, name, statistics.UNKNOWN_ERROR);

							callback(1, "Internal error");
							return;
						}

						dbw.queueProfileRemovalByFbId(fbId, 
							function(status) {
								dbw.finish();

								if (status) {	
									statistics.profileRemovalPending(fbId, name);

									callback(-1, null);
								} else {
									statistics.profileRemovalPendingFailed(fbId, name, statistics.UNKNOWN_ERROR);
								
									callback(1, "Internal error");
								}
							}
						);
					}
				);
			});
		}
	);
}

/**
* Checks if the user exists by querying the facebook
* api to get a valid fbId. If the profile exists, a
* new user token will be added to the database for
* the user to use.
*
* fbAccessToken		-	The access_token provided by facebook.
* callback			-	This is a function callback used for handling
*						errors with two arguments (errorCode, error/data).
*						The following errors are possible:
*						errorCode - error
*							 0 - "No access" (Facebook api ajax error)
*							 1 - "Internal error"
*							 2 - "Doesn't exist"
*							-1 - { token, fbId, name } (success)
*/
function profileLogin(fbAccessToken, callback) {
	facebook.getFacebookProfile(fbAccessToken, 
		function(err1, data) {
			if (err1 != null) {
				statistics.profileLoginFailed(null, null, statistics.UNKNOWN_ERROR);

				callback(0, "No access");
				return;
			}

			const fbId = data.id;
			const name = data.name;

			databaseWrapper.getInstance(function(dbw) {
				if (!dbw) {
					statistics.profileLoginFailed(fbId, name, statistics.UNKNOWN_ERROR);

					callback(1, "Internal error");
					return;
				}

				dbw.profileExists(fbId, 
					function(existData) {
						if (!existData) {
							dbw.finish();

							if (existData == false) {
								statistics.profileLoginFailed(fbId, name, statistics.DOESNT_EXISTS);
							
								callback(2, "Doesn't exist");
								return;
							}

							statistics.profileLoginFailed(fbId, name, statistics.UNKNOWN_ERROR);

							callback(1, "Internal error");
							return;
						}

						dbw.addUserToken(fbId, existData, 
							function(token) {
								dbw.finish();

								if (!token) {
									statistics.profileLoginFailed(fbId, name, statistics.UNKNOWN_ERROR);
									
									callback(1, "Internal error");
								} else {
									statistics.profileLoggedIn(fbId, name);

									callback(-1, {token: token, fbId: fbId, name: name });
								}
							}
						);
					}
				);
			}
		);
	});
}

/**
* Gets a profile from the database with the specified fbId.
* If a profile with that fbId does not exist or if the database
* returned with an error, the first argument in the callback
* function will be null. If the profile exists it will be
* returned in a simplified manner. For more information about
* the simplified profile see doc on runtime#simplifyProfile.
* 
* playlistCategory	-	The category used to identify the playlist
* 						where the profile exists.
* gender	-	The gender used to identify the playlist
*				where the profile exists. This should match
* 				the gender of the profile itself.
* fbId		-	The facebook id owned by the wanted profile. 
*				Note that this argument is not checked for 
* 				database code injection and might cause problems, 
* 				if it is not handled properly beforehand.
* callback	-	A function with a single argument. The argument
* 				will be a simplified version of the granted
* 				profile or null if that profile doesn't exist
* 				or if an error occured.
*/
function getProfile(playlistCategory, gender, fbId, callback) {
	const playlist = getPlaylist(playlistCategory, gender);
	if (playlist == null) {
		callback(null);
		return;
	}

	databaseWrapper.getInstance(function(dbw) {
		if (!dbw) {
			callback(null);
			return;
		}

		dbw.getProfileByFbId(playlist, fbId,
			function(data) {
				dbw.finish();

				if (data) {
					callback(simplifyProfile(data, playlist));
				} else {
					callback(null);
				}
			}
		);
	});
}

/**
* Gets a leaderboard with a maximum amount of runtime#TOP_LIST_COUNT
* profiles. If an error occurs during this operation, if the playlist
* doesn't exist or if there was a database error, the callback will
* be called with a first argument of null.
*
* playlistCategory	-	The category used to identify the playlist
* 						where the leaderboard is granted.
* gender			-	The gender used to identify the playlist
*						where the leaderboard is granted.
* callback			-	A function with a single argument. The argument
* 						will be an object with a 'count' property
* 						telling how many profiles are in the leader-
* 						board and an array with the key 'profiles' 
* 						listing all the profiles on the leaderboard in
* 						undefined order. The leaderboard placement can
* 						be defined by the rank property of each profile.
*/
function getLeaderboard(playlistCategory, gender, callback) {
	const playlist = getPlaylist(playlistCategory, gender);
	if (playlist == null) {
		callback(null);
		return;
	}

	databaseWrapper.getInstance(function(dbw) {
		if (!dbw) {
			callback(null);
			return;
		}

		dbw.getPlaylistLeaderboard(playlist, TOP_LIST_COUNT, 
			function(data) {
				dbw.finish();

				if (data) {
					const leaderboard = {};
					leaderboard.count = data.length;
					leaderboard.profiles = [];
					for (let profile of data) {
						leaderboard.profiles.push(simplifyProfile(profile, playlist));
					}

					callback(leaderboard);
				} else {
					callback(null);
				}
			}
		);
	});
}

// Call setup once
setupRuntime();

module.exports = {
	hasPlaylistCategory,
	hasPlaylist,
	getPlaylists,
	getPlaylistCategories,
	getPlaylistInformation,
	getPlaylist,
	generateMatch,
	finishMatch,
	addProfile,
	verifyUserToken,
	profileLogin,
	queueProfileRemoval,
	getProfile,
	getLeaderboard
};