var argv = require('yargs').argv;
var fs   = require('fs');

var filenames = ['./default.json', '/etc/werebot/config.json'];

var config = {};

filenames.forEach(function (filename) {
    if (fs.existsSync(filename)) {
        Object.assign(config, fs.readFileSync(filename));
    }
});

module.exports = config;