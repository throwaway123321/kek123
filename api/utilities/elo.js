// General ELO calculation utility functions

/**
* Calculates the elo which should be added or removed
* from elo0 depending on the result.
*
* elo0		-	elo owned by the player whose elo should change
* elo1		-	elo owned by the player to be compared
* result	-	1.0 if elo0 won, 0.0 if elo0 lost.
*
* Returns	-	the elo to be added/removed from elo0
* 				with the given result.
*/
function getEloDelta(elo0, elo1, result) {
	// Difference between target and opponent
	const eloDelta = elo1 - elo0;

	// The usual way of doing elo calculation..
	const winVariable = 1 / (1 + Math.pow(10, eloDelta / 400));
	
	return Math.round(32 * (result - winVariable));
}

/**
* Calculates the new rating for elo0 and elo1
*
* elo0		-	elo owned by the player whose elo should change
* elo1		-	elo owned by the player to be compared
* result	-	1.0 if elo0 won, 0.0 if elo0 lost.
*
* Returns	-	the new elo for elo0 and elo1 in an array
*				[0: newElo0, 1: newElo1]
*/
function getNewElos(elo0, elo1, result) {
	const newElo0 = elo0 + getEloDelta(elo0, elo1, result);
	const newElo1 = elo1 + getEloDelta(elo1, elo0, 1.0 - result);
	return [newElo0, newElo1];
}

module.exports = {
	getEloDelta,
	getNewElos
};