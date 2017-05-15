const databaseWrapper = require('../utilities/databasewrapper');
const fs = require('fs');

function testTranslationKey(key, callback) {
	if(key === undefined) {
		callback({ status: 1, "error": "No key" });
	} else {
		databaseWrapper.getInstance(function(dbw) {
			if (dbw == null) {
				logger.error("Unable to get translationkey! Databasewrapper is unavailable.");
				return;
			}

			dbw.translationKeyExists(key, function(status, msg){
				if(status === 0) {
					// The key exists!
					callback({ status: status, language: msg });
				} else {
					// The key didn't exist or something else went wrong
					callback({ status: status, error: msg });
				}
			});
		});
	}
}

function submitTranslation(key, language, translationKey, translation, callback) {
	testTranslationKey(key, function(result) {
		if(result.status != 0) {
			// Key is invalid
			callback(result);
		} else {
			// Key is valid!

			// Check if the key is authorized for the requested language
			if(language === result.language) {
				// All good! Let's insert n stuff!

				const object = getInProgressObjectByLanguage(language);

				const translationKeyParts = translationKey.split(".");

				let currentObject = object;

				// Create sub-objects for each part of the translation key
				for(let i = 0; i < translationKeyParts.length-1; i++) {
					if(!currentObject.hasOwnProperty(translationKeyParts[i])) {
						currentObject[translationKeyParts[i]] = {};
					}
					currentObject = currentObject[translationKeyParts[i]];
				}

				// Add the translation to the subobject
				currentObject[translationKeyParts[translationKeyParts.length-1]] = translation;

				fs.writeFileSync(getInProgressPath(language), JSON.stringify(object, null, 4));

				callback({ status: 0 });
			} else {
				callback({ status: 1, error: "That key is not authorized for that language" });
			}
		}
	});
}

function requestNewTranslation(key, language, callback) {
	testTranslationKey(key, function(result) {
		if(result.status != 0) {
			// Key is invalid
			callback(result);
		} else {
			// Key is valid!

			// Check if the key is authorized for the requested language
			if(language === result.language) {
				// All good! Let's find the next translation..

			const all = JSON.parse(fs.readFileSync("./i18n/en.json", "utf-8"));
			const existing = getInProgressObjectByLanguage(language);

			let translationKey = findNextTranslationKeyPath(all, existing, "");

			callback({
				status: 0,
				translationKey: translationKey,
				translation: getTranslationFromTranslationKey(all, translationKey)
			});

			} else {
				callback({ status: 1, error: "That key is not authorized for that language" });
			}
		}
	});
}

/**
 * Finds the next key which exists in all but not in existing (and is not an object in all)
 * @param {object} all		The object which contains all the keys
 * @param {object} existing	The object which is (presumably) missing some keys
 * @param {string} keyPath	The keypath! Mostly used to utilize recursiveness, feel free to just pass an empty string
 * @returns {string} 		Returns a string equal to the keypath taken to find the empty value. And example could be: "about.security.title".
 **/
function findNextTranslationKeyPath(all, existing, keyPath) {

	const keysToCheck = Object.keys(all);

	// console.log("We're at the beginning.");
	// console.log(all);
	// console.log(existing);
	// console.log(keysToCheck);
	// console.log(keyPath);


	if(keysToCheck.length === 0) {
		return -1;
	}
	for(let i = 0; i < keysToCheck.length; i++) {
		const newKeyPath = keyPath + "." + keysToCheck[i];
		// console.log("Looping", newKeyPath);
		if(existing[keysToCheck[i]] === undefined) {
			// console.log("Find End node", newKeyPath);
			// We found it! Now find the end node
			// Then return it (while removing the prepended dot)
			return findEndNode(all[keysToCheck[i]], newKeyPath).replace(/^\./, "");
		} else if(typeof(existing[keysToCheck[i]]) === "object") {
			// console.log("It's an object!", newKeyPath);
			// It's an object, so we take a look at all the keys inside it.
			const end = findNextTranslationKeyPath(all[keysToCheck[i]], existing[keysToCheck[i]], newKeyPath);

			if(end === -1) {
				// console.log("Dead end", newKeyPath);
				// Must've found a dead end.. continue the loop
				continue;	
			} else {
				// console.log("Actual path", newKeyPath);
				// We've found an actual path!
				// Return it after removing the prepended dot.
				return end.replace(/^\./, "");
			}
		} else {
			// console.log("Dead end 2", newKeyPath);
			// We've found a dead end.. something that isn't an object.
			// Let's continue looping through the keys.
			continue;
		}
	}
	// console.log("Dead end 3", keyPath);
	// If we've looped through all the keys and haven't found anything, it must be a dead end
	return -1;
}

/**
 * Finds the first end node (a key containing something that isn't an object).
 * We assume we will never encounter empty objects!
 **/
function findEndNode(object, keyPath) {
	if(typeof(object) !== "object") {
		// This ain't no object! Return the keypath immediately!
		return keyPath;
	}

	keysToCheck = Object.keys(object);

	if(keysToCheck.length > 0) {
		const newKeyPath = keyPath + "." + keysToCheck[0];

		if(typeof(object[keysToCheck[0]]) !== "object") {
			// Not an object! Must be a string! (or something else, but we don't care! As long as it's not an object!)
			return newKeyPath;
		} else {
			// Aw, it's an object. This means we must go deeper!
			return findEndNode(object[keysToCheck[0]], newKeyPath);
		}
	}
}

function getTranslationFromTranslationKey(object, translationKey) {
	if(translationKey === -1) {
		return "";
	}

	const arr = translationKey.split(".");
		
	let current = object;

	for(let i = 0; i < arr.length; i++) {
		current = current[arr[i]];
	}

	return current;
}

function getInProgressPath(language) {
	return "./i18n/inprogress/" + language + ".json";
}

function getInProgressObjectByLanguage(language) {
	const path = getInProgressPath(language);

	// Create the file if it doesn't already exist
	fs.closeSync(fs.openSync(path, "a"));

	const content = fs.readFileSync(path, "utf-8");

	let object;

	// Check if the file contains valid JSON
	try {
		object = JSON.parse(content);
	} catch(err) {
		object = null;
	}

	if(object === null) {
		object = {};
	}

	return object;
}

module.exports = {
	testTranslationKey,
	submitTranslation,
	requestNewTranslation
};