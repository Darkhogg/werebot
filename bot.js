#!/usr/bin/env node
var irc  = require('irc');
var argv = require('yargs').argv;

var logger = require('./logger');

var config = {
    'nick': argv.nick || 'Werebot',
    'server': argv.server || 'irc.afternet.org',
    'channel': argv.channel || '#werebot'
};

var game = {
    'playing': false,
    'joining': false
};

var client = new irc.Client(config.server, config.nick, {
    channels: [config.channel],
});

client.on('message', function (from, to, text, msg) {
    logger.verbose('%s [%s]: %s', from, to, text);

    if (text.indexOf('!') == 0) {
        var parts = text.substring(1).split();
        var cmd = parts[0];
        var args = parts.slice(1);

        client.emit('command', from, (to == config.channel) ? config.channel : from, cmd, args);
    }
});

client.on('command', function (who, where, command, args) {
    logger.debug('%s [%s]: !%s', who, where, command, args);

    switch (command) {
        /* Show the help */
        case 'h':
        case 'help': {

        } break;

        /* Start a new game */
        case 's':
        case 'start': {
            logger.info('User %s wants to start a new game', who);

            /* If a game is already started, don't allow new ones */
            if (game.playing || game.joining) {
                logger.warn('A game is already running');
                client.notice(where, 'Can\'t start a game: already playing');
                break;
            }

            game.joining = true;
            game.players = [];

            logger.info('Opening joining window for 30 seconds');
            client.notice(config.channel, '\x02' + who + '\x0f wants to start a new game, you have \x0230\x0f seconds to join!');

            /* Timeout for the joining ending */
            setTimeout(function () {
                game.joining = false;

                logger.info('Closing joining window');

                client.notice(config.channel, '\x02Time\'s up!');
                client.notice(config.channel, 'The game starts with \x02' + game.players.length
                    + '\x0f players: \x02' + game.players.join('\x0f, \x02') + '\x0f');

            }, 30000);
        } break;

        /* Join a game */
        case 'j':
        case 'join': {
            /* Check if the joining window is on */
            if (!game.joining) {
                client.notice(where, 'Can\'t join the game: not in joining');
                break;
            }

            /* Check if the user is already there */
            if (game.players.indexOf(who) < 0) {
                logger.info('User %s joins the game', who);
                game.players.push(who);
            }
        } break;

        /* Command not found */
        default: {
            client.notice(where, 'Invalid command \x02' + command + '\x0f.');
        }
    }
});