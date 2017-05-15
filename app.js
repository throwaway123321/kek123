const express = require("express");
const path = require("path");
const fs = require("fs");

const locale = require("locale");
const i18n = require("./utilities/i18n");

const api = require("./api/routes");
const logger = require("./api/utilities/logger");

// Initialize template partials
const partials = require('./utilities/partials')();

const port = 80;

const server = express();

const config = JSON.parse(fs.readFileSync('./app_config.json'));

i18n.setUseCache(config.use_cache);

server.get("/admin/translate", function(req, res, next) {
	req.templatePath = '/admin/translate.html';
	next();
});

server.use("/api", api);

server.use("/assets", express.static(path.join(__dirname, "public/assets")));

server.get('/', function(req, res, next) {
	req.templatePath = '/public/index.html';
//	logger.info(JSON.stringify(api.getPlaylistCategories(), null, 2));
	next();
});

server.get('/about', function (req, res, next) {
  req.templatePath = '/public/about/index.html';
  next();
});
server.get('/credits', function (req, res, next) {
  req.templatePath = '/public/credits/index.html';
  next();
});
server.get('/leaderboard/:playlist/:gender', function (req, res, next) {
  req.templatePath = '/public/leaderboard/index.html';
  next();
});
server.get('/profile/:playlist/:gender/:fbid', function (req, res, next) {
  req.templatePath = '/public/profile/index.html';
  next();
});
server.get('/play/:playlist/:gender', function (req, res, next) {
  req.templatePath = '/public/playlist/index.html';
  req.data = {
  	playlist: req.params.playlist,
  	gender: req.params.gender	
  };
  next();
});
server.get('/play/:gender', function (req, res, next) {
  req.templatePath = '/public/playlist/index.html';
  next();
});
server.get('/play/friends', function (req, res, next) {
	req.templatePath = '/public/friends/landing.html';
	next();
});
server.get('/play/friends/:ID', function (req, res, next) {
	req.templatePath = '/public/friends/index.html';
	next();
});
server.use(locale(i18n.getSupportedLanguages()));
server.use(i18n.use);
if(config.production) {
	// We're in production! Use some real certificates n shit!

	/* SSL */

	// returns an instance of node-greenlock with additional helper methods
	var lex = require('greenlock-express').create({
	  // set to https://acme-v01.api.letsencrypt.org/directory in production
	  server: 'staging'
	  //server: 'https://acme-v01.api.letsencrypt.org/directory'

	// If you wish to replace the default plugins, you may do so here
	//
	, challenges: { 'http-01': require('le-challenge-fs').create({}) }
	, store: require('le-store-certbot').create({})

	// You probably wouldn't need to replace the default sni handler
	// See https://git.daplie.com/Daplie/le-sni-auto if you think you do
	//, sni: require('le-sni-auto').create({})

	, approveDomains: approveDomains
	});
	function approveDomains(opts, certs, cb) {
	  // This is where you check your database and associated
	  // email addresses with domains and agreements and such

	  // Only verify our own domains
	  const verifiedDomains = 'smashorpass.io;www.smashorpass.io';

	  for(let i = 0; i < opts.domains.length; i++) {
	  	if(verifiedDomains.indexOf(opts.domains[i]) < 0) {
	  		logger.error('Domain \'' + opts.domains[i] + '\' is not a verified domain!');
	  		return;
	  	}
	  }


	  // The domains being approved for the first time are listed in opts.domains
	  // Certs being renewed are listed in certs.altnames
	  if (certs) {
	    opts.domains = certs.altnames;
	  }
	  else {
	    opts.email = 'duckandersduck@gmail.com';
	    opts.agreeTos = true;
	  }

	  // NOTE: you can also change other options such as `challengeType` and `challenge`
	  // opts.challengeType = 'http-01';
	  // opts.challenge = require('le-challenge-fs').create({});

	  cb(null, { options: opts, certs: certs });
	}
	// handles acme-challenge and redirects to https
	require('http').createServer(lex.middleware(require('redirect-https')())).listen(port, function () {
	  logger.info("Listening for ACME http-01 challenges on", this.address());
	});

	// handles your app
	require('https').createServer(lex.httpsOptions, lex.middleware(server)).listen(443, function () {
	  logger.info("Listening for ACME tls-sni-01 challenges and serve app on", JSON.stringify(this.address(), null, 2));
	});
} else {
	// Not in production! Use local certificates.

	const SNICallback = function(servername, cb) {
		cb(
			null,
			require("tls").createSecureContext({
				key: fs.readFileSync("./local-certs/server.key"),
				cert: fs.readFileSync("./local-certs/server.crt")
			})
		);
	}

	require('https').createServer({SNICallback: SNICallback}, server).listen(443, function () {

	});
}
