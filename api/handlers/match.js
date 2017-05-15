const MatchResult = require("./matchresult");

class Match {
	
	/**
	* Constructs a Match with the specified profiles. This match
	* will automatically generate a MatchResult, which will tell
	* the new deltas in elo depending on the result. This constructor
	* should be called for every new match. 
	* To get the delta elo, you would call getEloDelta(result). If 
	* the result is unknown, but you know the winning profile, you
	* should use 1 - getProfileIndex(profileId) to get the result 
	* specified by the given winner's profileId.
	*
	* profile0	-	The complete profile with index 0, ie. the
	* 				first contestant
	* profile1	-	The complete profile with index 1, ie. the
	* 				second contestant
	* voterFbId	-	The userId of the user, the match is created for (-1 if none specified)
	*/
	constructor(profile0, profile1, voterFbId) {
		this.id0 = profile0["id"];
		this.id1 = profile1["id"];
		this.voterFbId = voterFbId;
		this.matchResult = new MatchResult(profile0["elo"], profile1["elo"]);
	}

	/**
	* Returns the profile index of the profile in this match 
	* with the specified profileId. If the profileId is not 
	* contained within this match, it will return -1.
	*
	* profileId	-	The id of the wanted profile index
	*
	* Reurns	-	0 or 1 if the profile exists, -1 otherwise.
	*/
	getProfileIndex(profileId) {
		if (this.id0 == profileId) {
			return 0;
		}
		return this.id1 == profileId ? 1 : -1;
	}

	/**
	* Returns elo delta provided by the MatchResult depending on
	* the given result. If the first player won, the result should
	* be 1, if the second player won the result should be 0. If the
	* result is neither of those, this function returns [[0], [0]].
	*/
	getEloDelta(result) {
		return this.matchResult.getEloDelta(result);
	}
}

module.exports = Match;