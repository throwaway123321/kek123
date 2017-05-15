var moment = require('moment');

/**
* Logs the message given in the console. the message will be
* stamped with the current weekday, day, month and year for
* debugging reasons. This should be used for information giving
* events, like when the service starts, ends or when something
* gets changed.
*
* msgs	-	The messages which should be informed in the console
*/
function info(...msgs) {
	const msg = msgs.toString();
	console.log(getTimestamp() + ` [INFO]: ${msg}`);
}

/**
* Logs the message given in the console. the message will be
* stamped with the current weekday, day, month and year for
* debugging reasons. This should be used for alerting about
* curtain events or configurations, like when the service is
* in a bad state or when the user should be aware of something
* important.
*
* msgs	-	The messages which should be alerted in the console
*/
function alert(...msgs) {
	const msg = msgs.toString();
	console.log(getTimestamp() + ` [ALERT]: ${msg}`);
}

/**
* Logs the message given in the console. the message will be
* stamped with the current weekday, day, month and year for
* debugging reasons. This should be used for showing errors
* when something did not go as expected, like when a database
* returns an error instead of data and the user has to know.
*
* msgs	-	The error which should be shown in the console
*/
function error(...msgs) {
	const msg = msgs.toString();
	console.log(getTimestamp() + ` [ERROR]: ${msg}`);
}

/**
* Logs the message given in the console. the message will be
* stamped with the current weekday, day, month and year for
* debugging reasons. This should be used for showing fatal errors.
* A fatal error occurs, when the server is unable to continue it's
* runtime due to an error.
*
* msgs	-	The fatal error which should be shown in the console
*/
function fatal(...msgs) {
	const msg = msgs.toString();
	console.log(getTimestamp() + ` [FATAL]: ${msg}`);
}

/**
* Creates a timestamp string with the current weekday, date, 
* month and year used for logging.
*
* Returns	-	the current timestamp. This timestamp will be
* 				formatted with the weekday, the day of month,
* 				the month and the year: [ddd-DD-MMM-YYYY].
*/
function getTimestamp() {
	return moment().format("[[]ddd-DD-MMM-YYYY HH:mm:ss[]]");
}

module.exports = {
	error,
	info,
	alert,
	fatal
};