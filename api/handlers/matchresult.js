const eloUtils = require("../utilities/elo");

class MatchResult {

	/**
	* Constructs a new MatchResult.
	*
	* elo0	-	The elo of the first profile
	* elo1	-	The elo of the second profile
	*/
	constructor(elo0, elo1) {
		this.elo0 = elo0;
		this.elo1 = elo1;
	}

	/**
	* Returns elo delta depending on the given result. 
	*
	* result	-	If the first player won, the result should
	* 				be 1, if the second player won the result 
	* 				should be 0. 
	*
	* Returns	-	[delta0, delta1], if the result is 1 
	* 				or 0, [0, 0] otherwise.
	*/
	getEloDelta(result) {
		if (result != 0 && result != 1) {
			return [0, 0];
		}

		const ed0 = eloUtils.getEloDelta(this.elo0, this.elo1, result);
		const ed1 = eloUtils.getEloDelta(this.elo1, this.elo0, 1 - result);
	
		return [ed0, ed1];
	}
}

module.exports = MatchResult;