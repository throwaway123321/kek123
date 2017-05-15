const uuidV4 = require('uuid/v4');
const Match = require("./match")

class Playlist {

	/**
	* Constructs a new playlist with the given playlist id and
	* gender. The decay time is specified in milliseconds and
	* will be used for deleting the current session, for overflow
	* reasons.
	* This constructor should be called at the start of a new serversession
	* ie. when the server starts.
	*
	* category		-	The category of the playlist. Ex. 'DK' or 'dk'
	* gender		-	The gender of this playlist. Ex. 'f' (female) 
	*					or 'm'(male)
	* decayTime		-	Each session will decay after a specified amount of time.
	*					The decayTime will specify how long a session will stay as
	*					the activeSessionIndex.
	*/
	constructor(category, gender, id, decayTime, active, predefined) {
		this.category = category;
		this.gender = gender;
		this.id = id;
		this.decayTime = decayTime;
		this.active = active;
		this.predefined = predefined;
		
		this.key = category + "-" + gender;

		this.lastSessionChange = Date.now();
		this.sessions = [{}, {}];
		this.activeSessionIndex = 0;

		this.profileCount = 0;
	}

	/**
	* Generates a match between the two profiles. The match will
	* automatically be added to the current session and remain in
	* the current session for a minimum of this.decayTime milliseconds
	*
	* profile0	-	The first profile in the wanted match
	* profile1	-	The second profile in the wanted match
	* voterFbId	-	The userId of the user, the match is created for (-1 if none specified)
	*
	* Returns	-	the matchUUID key for the new match
	*/
	genMatch(profile0, profile1, voterFbId) {
		const now = Date.now();
		if (now - this.lastSessionChange >= this.decayTime) {
			// Flip first bit (0 -> 1; 1 -> 0)
			this.activeSessionIndex ^= 1;
			this.lastSessionChange = now;

			// Clear last session
			this.sessions[this.activeSessionIndex] = {};
		}

		// Generate match
		const match = new Match(profile0, profile1, voterFbId);

		const matchUUID = uuidV4();
		this.sessions[this.activeSessionIndex][matchUUID] = match;
		
		return matchUUID;
	}

	/**
	* Will check if a match with the given matchUUID exists in
	* this playlist. If it does, this function returns true.
	* This might be CPU intensive and should not be used regularly,
	* if it's not needed.
	*
	* matchUUID	-	The unique user identifier for a match
	*
	* Returns	-	true, if the matchUUID exists, false otherwise
	*/
	hasMatch(matchUUID) {
		// Async-safe constant
		const currentSessionIndex = this.activeSessionIndex;
		
		// If key exists in current session return true
		if (matchUUID in this.sessions[currentSessionIndex]) {
			return true;
		}
		// Else return true if it exists in previous session
		return matchUUID in this.sessions[currentSessionIndex ^ 1];
	}

	/**
	* Finishes the match with the specified UUID. If the match does
	* not exist this function returns null. If it does and it
	* succeed this function returns that match.
	*
	* matchUUID	-	The UUID of the specified match
	*
	* Returns	-	match object, if it exists and the operation succeeds, 
	*				null otherwise
	*/
	finishMatch(matchUUID) {
		let specifiedSession = this.activeSessionIndex;
		
		// Find out what session the match is within
		if (!(matchUUID in this.sessions[specifiedSession])) {
			specifiedSession ^= 1;
			if (!(matchUUID in this.sessions[specifiedSession])) {
				return null;
			}
		}

		// Find the match in the session
		const match = this.sessions[specifiedSession][matchUUID];
		if (match == null) { // Might be null (async reasons)
			return null;
		}

		// Delete it, if it exists
		delete this.sessions[specifiedSession][matchUUID];

		return match;
	}

	/**
	* Returns	-	The number of profiles on the database 
	*				associated with this playlist.
	*/
	getProfileCount() {
		return this.profileCount;
	}

	/**
	* Sets the number of profiles on the database associated
	* with this playlist. This function should only be called
	* at startup and should not be called with 'fake' args.
	*
	* profileCount	-	The new number of profiles associated
	* 					with this playlist.
	*/
	setProfileCount(profileCount) {
		this.profileCount = profileCount;
	}

	/**
	* Shifts the number of profiles on the database associated
	* with this playlist. This function should only be called
	* when the amount of profiles changes on the database.
	*
	* shiftBy		-	The number telling how much this function
	*					should shift the amount of profiles.
	*/
	shiftProfileCount(shiftBy) {
		this.profileCount += shiftBy;
	}

	/**
	* Returns		-	true, if this playlist is active, false
	*					otherwise. This is a getter function, the
	* 					same information can be retreived using the 
	* 					property 'active'.
	*/
	isActive() {
		return this.active;
	}

	/**
	* Returns 		-	true if this playlist is predefined, false
	* 					otherwise. This is a getter function, the
	* 					same information can be tetreived using the
	* 					property 'predefined'.
	*/
	isPredefined() {
		return this.predefined;
	}
}

module.exports = Playlist;