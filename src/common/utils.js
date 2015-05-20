var _    = require('lodash');
var fs   = require('fs');
var path = require('path');

var logger = require('>/common/logger');

var townsFirst  = fs.readFileSync(path.join(path.dirname(require.main.filename), 'data', 'towns.1.txt'), 'utf8').trim().split('\n');
var townsSecond = fs.readFileSync(path.join(path.dirname(require.main.filename), 'data', 'towns.2.txt'), 'utf8').trim().split('\n');

module.exports.generateTownName = function generateTownName () {
    return townsFirst[Math.floor(Math.random() * townsFirst.length)]
         + townsSecond[Math.floor(Math.random() * townsSecond.length)];
}

module.exports.mostVoted = function mostVoted (votes) {
    var maxVotes = 0;
    var winner = null;

    _.forEach(votes, function (votes, player) {
        if (votes > maxVotes) {
            maxVotes = votes;
            winner = player;

        } else if (votes == maxVotes) {
            winner = null;
        }
    });

    return winner;
}

module.exports.joinWithMax = function joinWithMax (array, glue, linesize) {
    var pieces = [];
    var line = '';

    for (var i = 0; i < array.length; i++) {
        if (line) {
            line += glue;
        }

        line += array[i];

        if (line.length >= linesize) {
            pieces.push(line);
            line = '';
        }
    }

    if (line) {
        pieces.push(line);
    }

    return pieces;
}
