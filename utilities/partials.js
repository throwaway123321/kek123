const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const logger = require(path.join(__dirname, '../api/utilities/logger'));

const partialsPath = path.join(__dirname, '../public/partials');
const partials = fs.readdirSync(partialsPath);

/** TODO 
 * AUTOMATICALLY REGISTER ALL PARTIALS IN FOLDER 
 **/


function initPartials() {
	for(let i = 0; i < partials.length; i++) {
		handlebars.registerPartial(partials[i].replace('.html', ''), handlebars.compile(fs.readFileSync(path.join(partialsPath, partials[i]), 'utf-8')));
	}
	logger.info('Registered partials');
}

module.exports = initPartials;