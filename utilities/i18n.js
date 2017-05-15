const locale = require("locale");
const path = require("path");
const fs = require("fs");
const handlebars = require("handlebars");
const mkdirp = require("mkdirp");

const logger = require('../api/utilities/logger');

let useCache = false;

// How long to keep cache before recreating it (seconds)
const ttl = 10;

// Object to keep when pages were cached
const cacheTime = {};

// Get all the files in our i18n-folder
// And remove all items that aren't JSON files
const supportedLanguageFileNames = fs.readdirSync("./i18n").filter(function(lang) {
	return (lang.indexOf(".json") != -1);
});

// Remove the file extensions (.json) from the languages
// Also fill out our cacheTime object with all the languages
const supportedLanguages = supportedLanguageFileNames.map(function(lang) {
	const langCode = lang.replace(".json", "");
	cacheTime[langCode] = {};

	return langCode
});

locale.Locale['default'] = 'en';

// Load all the language fíles into memory
// This might not be a good idea in the long run, but we don't want to do constant disk reads (on every request)
const languages = {};
supportedLanguageFileNames.forEach(function(filename, index) {
	languages[supportedLanguages[index]] = JSON.parse(fs.readFileSync("./i18n/" + filename));
});

function getSupportedLanguages() {
	return supportedLanguages;
};

function setUseCache(use_cache) {
	useCache = use_cache;
}

const use = function(req, res, next) {

	if(req.templatePath === undefined) {
		// Guess this isn't for us!
		return;
	}

	const cachePath = path.join("./", "cache", req.locale, req.templatePath);
	let page;

	if(
		useCache && // If the config is set to use cached versions
		fs.existsSync(cachePath) && // And a cached version exists
		new Date().getTime() < cacheTime[req.locale][req.templatePath] + (ttl * 1000) // And it hasn't been too long since the cached version was created
	) {
		
		// Simply serve it from the cache file
		page = fs.readFileSync(cachePath, "utf-8");

	} else {
		// Create it

		const template = fs.readFileSync(path.join("./", req.templatePath), "utf-8");

		const data = languages[req.locale];

		if(req.data !== undefined) {
			// Merge the data with the language
			Object.assign(data, { request: req.data });
		}

		page = handlebars.compile(template)(data);

		// Create the cache directory and file if they don't exist, and write the compiled template to the file
		mkdirp(path.dirname(cachePath), function(err){
			if(err) {
				logger.error("Cannot make cache folder at " + path.dirname(cachePath) + " \nRecieved error:\n" + err);
			} else {
				fs.writeFile(cachePath, page, function(err) {
					if(err) {
						logger.error("Cannot write cache file at " + cachePath + " \nRecieved error:\n" + err);
					} else {
						// Set the cache time
						cacheTime[req.locale][req.templatePath] = new Date().getTime();
					}
				});
			}
		})
		
	}

	res.send(page);

	next();
};

module.exports = {
	getSupportedLanguages: getSupportedLanguages,
	setUseCache: setUseCache,
	use: use,
}