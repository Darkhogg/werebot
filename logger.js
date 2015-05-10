var winston = require('winston')

/* Create and configure the logger */
var logger = new winston.Logger();

/* Configure Everything */
logger.cli();
logger.add(winston.transports.Console, {
  'level':       'silly',
  'colorize':    true,
  'prettyPrint': true
});

/* Export it */
module.exports = logger;
