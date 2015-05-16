var argv   = require('yargs').argv;
var fs     = require('fs');
var objAss = require('object-assign');

var filenames = ['./default.json', 'local.json', '/etc/werebot/config.json'];

var config = {};

filenames.forEach(function (filename) {
    if (fs.existsSync(filename)) {
        objAss(config, JSON.parse(fs.readFileSync(filename)));
    }
});

module.exports = config;