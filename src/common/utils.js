var _    = require('lodash');
var fs   = require('fs');
var path = require('path');

var logger = require('>/common/logger');

var townsFirst;
var townsSecond;

module.exports.generateTownName = function generateTownName () {
    if (!townsFirst || !townsSecond) {
        townsFirst  = fs.readFileSync(path.join(path.dirname(require.main.filename), 'data', 'towns.1.txt'), 'utf8').trim().split('\n');
        townsSecond = fs.readFileSync(path.join(path.dirname(require.main.filename), 'data', 'towns.2.txt'), 'utf8').trim().split('\n');
    }
    return townsFirst[Math.floor(Math.random() * townsFirst.length)]
         + townsSecond[Math.floor(Math.random() * townsSecond.length)];
};

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
};

module.exports.mostVotedMulti = function mostVotedMulti (votes) {
    var maxVotes = 0;
    var winners = [];

    _.forEach(votes, function (votes, player) {
        if (votes > maxVotes) {
            maxVotes = votes;
            winners = [player];

        } else if (votes == maxVotes) {
            winners.push(player);
        }
    });

    return winners;
};

module.exports.joinWithMax = function joinWithMax (array, glue, linesize, prefix_) {
    var prefix = prefix_ || '';

    var pieces = [];
    var line = prefix;

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
};

module.exports.randomRange = function randomRange (min_, max_, step_) {
    var min = max_ === undefined ? 0 : min_;
    var max = max_ === undefined ? min_ : max_;
    var step = step_ || 1;

    return step * Math.floor((min + Math.random() * (max - min)) / step);
}

module.exports.format = function format (string) {
    return string
        .replace(/\^R/g, '\x0f')
        .replace(/\^B/g, '\x02')
        .replace(/\^K/g, '\x03')
        .replace(/\^U/g, '\x1f')
        .replace(/\^I/g, '\x1d');
}

module.exports.join = function (array, glue_, lastGlue_) {
    var glue = glue_ || '';
    var lastGlue = lastGlue_ || glue;

    var str = '';
    array.forEach(function (v, i) {
        if (i > 0 && i < array.length - 1) {
            str += glue;
        }
        if (i > 0 && i == array.length - 1) {
            str += lastGlue;
        }
        str += v;
    });
    return str;
}
