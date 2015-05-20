'use strict';
var _       = require('lodash');
var crashit = require('crashit');
var irc     = require('irc');
var sprintf = require('sprintf-js').sprintf;

var logger = require('>/common/logger');
var config = require('>/common/config');
var utils  = require('>/common/utils');

var Game = require('>/game');

var MIN_PLAYERS = 5;

var aliases = {
    'p': 'play',
    'j': 'join',
    'w': 'who',

    'k': 'kill',
    'v': 'vote',

    'rev': 'revenge',
}

var Bot = function Bot (opts) {
    this.options = opts;
};

Bot.prototype.start = function start (version) {
    var _this = this;
    this.names = {};

    logger.info('Starting Bot (v%s)', version);

    this.client = new irc.Client(
        this.options.host,
        this.options.nick,
        {
            channels: [this.options.channel],
            secure: true,
            selfSigned: true,
            port: this.options.port,
            userName: 'Werebot',
            realName: 'Werebot v' + version
        }
    );

    this.client.once('registered', function () {
        logger.info('Bot connected');

        _this.recoverNick();
    });

    this.client.on('error', function (err) {
        logger.error(err);
    });

    this.client.on('invite',  this.onInvite.bind(this));
    this.client.on('join',    this.onJoin.bind(this));
    this.client.on('quit',    this.onQuit.bind(this));
    this.client.on('part',    this.onPart.bind(this));
    this.client.on('nick',    this.onNick.bind(this));
    this.client.on('names',   this.onNames.bind(this));
    this.client.on('notice',  this.onNotice.bind(this));
    this.client.on('message', this.onMessage.bind(this));
    this.client.on('command', this.onCommand.bind(this));
    this.client.on('+mode',   this.onAddMode.bind(this));
    this.client.on('-mode',   this.onSubMode.bind(this));

    this.game = new Game();

    this.game.on('start-game', this.onGameStartGame, this);
    this.game.on(  'end-game', this.onGameEndGame, this);


    this.game.on('start-phase:' + Game.PHASE_PREPARATION, this.onGameStartPhasePreparation, this);
    this.game.on(  'end-phase:' + Game.PHASE_PREPARATION, this.onGameEndPhasePreparation, this);

    this.game.on('start-phase:' + Game.PHASE_NIGHTTIME, this.onGameStartPhaseNight, this);
    this.game.on(  'end-phase:' + Game.PHASE_NIGHTTIME, this.onGameEndPhaseNight, this);

    this.game.on('start-phase:' + Game.PHASE_DAYTIME, this.onGameStartPhaseDay, this);
    this.game.on(  'end-phase:' + Game.PHASE_DAYTIME, this.onGameEndPhaseDay, this);


    this.game.on('start-turn:' + Game.TURN_JOINING, this.onGameStartTurnJoining, this);
    this.game.on(  'end-turn:' + Game.TURN_JOINING, this.onGameEndTurnJoining, this);

    this.game.on('start-turn:' + Game.TURN_WOLVES, this.onGameStartTurnWolves, this);
    this.game.on(  'end-turn:' + Game.TURN_WOLVES, this.onGameEndTurnWolves, this);

    this.game.on('start-turn:' + Game.TURN_DISCUSSION, this.onGameStartTurnDiscussion, this);
    this.game.on(  'end-turn:' + Game.TURN_DISCUSSION, this.onGameEndTurnDiscussion, this);

    this.game.on('start-turn:' + Game.TURN_LYNCHING, this.onGameStartTurnLynching, this);
    this.game.on(  'end-turn:' + Game.TURN_LYNCHING, this.onGameEndTurnLynching, this);

    this.game.on('roles', this.onGameAssignedRoles, this);

    this.game.on('death', this.onGameDeath, this);

    this.game.on('join', this.onGameJoin, this);
    this.game.on('leave', this.onGameLeave, this);
    this.game.on('kill', this.onGameKill, this);
    this.game.on('vote', this.onGameVote, this);
};

Bot.prototype.stop = function stop (message) {
    logger.debug('Stopping Bot');

    this.resetChannel();

    this.client.disconnect(message);
};

Bot.prototype.recoverNick = function () {
    this.client.send('NICK', this.options.nick);

    if (this.options.nickservPassword) {
        logger.verbose('Registering with NickServ...');
        this.client.say('NickServ', 'IDENTIFY ' + this.options.nickservPassword);
    }
};

Bot.prototype.recoverWolvesChannel = function () {
    logger.verbose('Requesting ChanServ an invite to %s', this.options.channelWolves);
    this.client.say('ChanServ', 'INVITE ' + this.options.channelWolves);
};

Bot.prototype.resetChannel = function () {
    this.client.send('MODE', this.options.channel, '+t-m');
    this.client.say('ChanServ', 'SYNC ' + this.options.channel);
};

Bot.prototype.onInvite = function onInvite (channel, from, msg) {
    var _this = this;

    logger.silly('[ INVITE] %s %s', from, channel);

    if (channel == _this.options.channelWolves) {
        _this.client.join(_this.options.channelWolves);
    }
};

Bot.prototype.onJoin = function onJoin (channel, who, msg) {
    logger.silly('[   JOIN] %s @ %s', who, channel);

    if (!this.names[channel]) {
        this.names[channel] = [];
    }

    this.names[channel].push(who);
};

Bot.prototype.onPart = function onJoin (channel, who, msg) {
    logger.silly('[   PART] %s @ %s', who, channel);

    if (!this.names[channel]) {
        this.names[channel] = [];
    }

    var idx = this.names[channel].indexOf(who);
    if (idx >= 0) {
        this.names[channel].splice(idx, 1);
    }

    if (channel == this.options.channel) {
        this.game.playerLeft(who);
    }
};

Bot.prototype.onQuit = function onJoin (who, reason, channels, msg) {
    var _this = this;

    logger.silly('[   QUIT] %s "%s" [%s]', who, reason, channels.join(','));

    channels.forEach(function (channel) {
        if (!_this.names[channel]) {
            _this.names[channel] = [];
        }

        var idx = _this.names[channel].indexOf(who);
        if (idx >= 0) {
            _this.names[channel].splice(idx, 1);
        }
    });

    this.game.playerLeft(who);
};

Bot.prototype.onNick = function (oldNick, newNick, channels, msg) {
    var _this = this;

    logger.silly('[   NICK] %s -> %s ["%s"]', oldNick, newNick, channels.join('","'));

    channels.forEach(function (channel) {
        if (_this.names[channel]) {
            var idx = _this.names[channel].indexOf(oldNick);
            _this.names[channel][idx] = newNick;
        }
    });

    this.game.nickChanged(oldNick, newNick);
};

Bot.prototype.onAddMode = function (channel, by, mode, argument, msg) {
    logger.silly('[  +MODE] %s sets %s +%s', by, channel, mode, argument || '');

    if (
        argument &&
        this.game.running &&
        argument != this.client.nick &&
        (
            'ho'.indexOf(mode) >= 0 ||
            (mode == 'v' && !this.game.isPhase(Game.PHASE_DAYTIME)) ||
            channel == this.options.channelWolves
        )
    ) {
        this.client.send('MODE', channel, '-' + mode, argument);
    }

    if (argument && channel == this.options.channel && argument == this.client.nick) {
        if (!this.game.running) {
            this.resetChannel();
        }
    }
}

Bot.prototype.onSubMode = function (channel, by, mode, argument, msg) {
    logger.silly('[  -MODE] %s sets %s -%s', by, channel, mode, argument);
}

Bot.prototype.onNotice = function onNotice (from, to, text, msg) {
    logger.silly('[ NOTICE] %s %s: ', from, to, text);
};

Bot.prototype.onNames = function onNames (channel, nicks) {
    var _this = this;

    logger.silly('[  NAMES] %s: ', channel, Object.keys(nicks).join(', '));
    _this.names[channel] = Object.keys(nicks);
};

Bot.prototype.onMessage = function onMessage (from, to, text, msg) {
    var _this = this;

    logger.silly('[PRIVMSG] %s %s: ', from, to, text);

    if (text.indexOf('!') == 0) {
        var parts = text.substring(1).split(/\s+/);
        var cmd = parts[0];
        var args = parts.slice(1);

        if (aliases[cmd]) {
            cmd = aliases[cmd];
        }

        _this.client.emit('command',
            from,
            to.indexOf('#') == 0 ? to : from,
            cmd.toLowerCase(),
            args);
    }
};

Bot.prototype.onCommand = function onCommand (who, where, command, args) {
    var _this = this;
    logger.debug('  > %s %s: [%s]', who, where, command.toUpperCase(), args);

    try {
        switch (command) {
            /* Start a new game */
            case 'play': {
                this.game.play(who);
            } break;

            /* Join a game */
            case 'join': {
                this.game.join(who);
            } break;

            /* Show who am I */
            case 'who': {
                var role = this.game.getPlayerRole(who);
                if (role) {
                    this.client.notice(who, sprintf('%s: You are a \x1f\x02%s\x02\x1f', who, role));
                } else {
                    this.client.notice(who, sprintf('%s: You are not currently playing', who));
                }
            } break;

            /* Kill a player */
            case 'kill': {
                this.game.kill(who, args[0]);
            } break;

            case 'vote': {
                this.game.lynch(who, args[0]);
            } break;

            /* Command not found */
            default: {
                this.client.notice(who, 'Invalid command \x02' + command + '\x0f.');
            }
        }

    } catch (err) {
        if (!(err instanceof Game.Error)) throw err;

        this.client.notice(who, 'Unknown Error: \x02\x0304' + err.message + '\x0f');
    }
};

/* =========================== */
/* === GAME EVENT HANDLERS === */

Bot.prototype.onGameStartGame = function onGameStartGame () {
    this.recoverNick();
    this.recoverWolvesChannel();

    this.client.notice(this.options.channel,
        'A new game is about to start!');
};

Bot.prototype.onGameEndGame = function onGameEndGame () {
    this.client.say(this.options.channel,
        'The game has ended');

    if (this.game.winningSide) {
        switch (this.game.winningSide) {
            case Game.SIDE_TOWN: {
                this.client.say(this.options.channel,
                    '\x0303The \x02town of ' + this.game.townName + '\x02 has won by killing all werewolves!');
            } break;

            case Game.SIDE_WOLVES: {
                this.client.say(this.options.channel,
                    '\x0304The \x02werewolves\x02 have won by killing all humans!');
            } break;
        }
    }

    this.resetChannel();
};


Bot.prototype.onGameStartPhasePreparation = function onGameStartPhasePreparation () {

};

Bot.prototype.onGameEndPhasePreparation = function onGameEndPhasePreparation () {
    var _this = this;

    /* Add moderated flag to channel */
    this.client.send('MODE', this.options.channel, '+m');

    /* Remove @ % and + from everyone */
    this.names[this.options.channel].forEach(function (user) {
        if (user != _this.client.nick) {
            _this.client.send('MODE', _this.options.channel, '-ohv', user, user, user);
        }
    });
};



Bot.prototype.onGameStartPhaseNight = function onGameStartPhaseNight () {
    var _this = this;

    this.client.say(this.options.channel, 'The \x02\x0312night\x0f falls over ' + this.game.townName + ' and everyone goes to sleep.');

    this.names[this.options.channel].forEach(function (user) {
        if (user != _this.client.nick) {
            _this.client.send('MODE', _this.options.channel, '-v', user);
        }
    });
};

Bot.prototype.onGameEndPhaseNight = function onGameEndPhaseNight () {

};



Bot.prototype.onGameStartPhaseDay = function onGameStartPhaseDay () {
    this.client.say(this.options.channel,
        'A new \x02\x0307day\x0f begins in ' + this.game.townName + ' and everyone wakes up.');
};

Bot.prototype.onGameEndPhaseDay = function onGameEndPhaseDay () {

};




Bot.prototype.onGameStartTurnJoining = function onGameStartTurnJoining () {
    this.client.say(this.options.channel,
        'Join the game by saying \x1f!join\x1f; you have \x02' + Game.TIME_JOINING + '\x02 seconds to join');
};

Bot.prototype.onGameEndTurnJoining = function onGameEndTurnJoining () {
    this.client.say(this.options.channel, '\x02Time\'s up!');
};

Bot.prototype.onGameAssignedRoles = function onGameAssignedRoles () {
    var _this = this;

    /* Add invite-only and secret flags to wolves channel */
    this.client.send('MODE', this.options.channelWolves, '+is');

    /* Then kick everyone out! */
    this.names[this.options.channelWolves].forEach(function (user) {
        if (user != _this.client.nick) {
            _this.client.send('KICK', _this.options.channelWolves, user);
        }
    });


    /* Inform everyone of the roles of the town */
    this.client.say(this.options.channel,
        'The town of \x02' + this.game.townName + '\x02 has \x02' + this.game.players.length + '\x02 inhabitants:');

    /* Inform of every player */
    utils.joinWithMax(this.game.players, '\x02, \x02', 80).forEach(function (line) {
        _this.client.say(_this.options.channel, '\x02' + line + '\x02');
    });

    /* Announce the role of the players */
    _.forEach(this.game.rolePlayers, function (players, role) {
        _this.client.say(_this.options.channel,
            '- \x1f' + role + '\x1f: \x02' + players.length + '\x02 ' + (players.length > 1 ? 'people' : 'person'));
    });

    _.forEach(this.game.roles, function (role, player) {
        _this.client.notice(player, player + ': You are a \x1f\x02' + role + '\x02\x1f');

        if (role == Game.ROLE_WOLF) {
            _this.client.notice(player, 'The werewolves are: \x02' + _this.game.getRolePlayers(Game.ROLE_WOLF).join('\x02, \x02'));
        }
    });
};


Bot.prototype.onGameStartTurnWolves = function onGameStartTurnWolves () {
    var _this = this;

    this.game.getRolePlayers(Game.ROLE_WOLF).forEach(function (wolf) {
        _this.client.send('INVITE', wolf, _this.options.channelWolves);
        _this.client.notice(wolf, 'It\'s time to hunt! Join \x1f' + _this.options.channelWolves + '\x1f to discuss who to kill with the other werewolves');

        _this.client.notice(wolf, 'When you\'re ready, vote for killing by saying \x1f!kill nick\x1f, or \x1f!kill -\x1f to skip vote');
        _this.client.notice(wolf, 'If a tie is reached, a random player from the tie will die!');
    });
};

Bot.prototype.onGameEndTurnWolves = function onGameEndTurnWolves () {

};


Bot.prototype.onGameStartTurnDiscussion = function onGameStartTurnDiscussion () {
    var _this = this;

    /* Give voice to anyone still alive */
    this.game.players.forEach(function (user) {
        if (user != _this.client.nick) {
            _this.client.send('MODE', _this.options.channel, '+v', user);
        }
    });

    var numWolves =  this.game.getRolePlayers(Game.ROLE_WOLF).length;

    this.client.say(this.options.channel, 'Everyone on ' + this.game.townName + ' gathers at the plaza');
    this.client.say(this.options.channel,
        '\x0305\x02' + numWolves + ' werewolve' + (numWolves > 1 ? 's\x02 are ' : '\x02 is ') + 'still alive\x0f');
    this.client.say(this.options.channel, 'It\'s time to find out who is a werewolf: discuss!');
}

Bot.prototype.onGameEndTurnDiscussion = function onGameEndTurnDiscussion () {

};


Bot.prototype.onGameStartTurnLynching = function onGameStartTurnLynching () {
    this.client.say(this.options.channel, 'Choose who should be lynched: say \x1f!vote \x1dnick\x1d\x1f, say \x1f!vote -\x1f to skip vote');
    this.client.say(this.options.channel, 'You have \x02' + Game.TIME_LYNCHING + '\x02 seconds to vote');
};

Bot.prototype.onGameEndTurnLynching = function onGameEndTurnLynching () {
    this.client.say(this.options.channel, 'A decision has been made');
};

Bot.prototype.onGameDeath = function (player, role, reason) {
    var prefix = ((role == Game.ROLE_WOLF) ? '\x0303' : '\x0304')
        + '\x02' + player + '\x02, the \x02' + role + '\x02, ';

    switch (reason) {
        case Game.DEATH_DISAPPEAR: {
            this.client.say(this.options.channel,
                prefix + 'has gone missing');
        } break;

        case Game.DEATH_WOLVES: {
            this.client.say(this.options.channel,
                prefix + 'has been found dead, killed by the werewolves!');
        } break;

        case Game.DEATH_LYNCH: {
            this.client.say(this.options.channel,
                prefix + 'has been lynched by the town');
        } break;

        default: {
            this.client.say(this.options.channel,
                prefix + 'has been found dead');
        }
    }
};

Bot.prototype.onGameJoin = function onGameJoin (player, numPlayers) {
    this.client.say(this.options.channel,
        '\x02' + player + '\x02 joins the game!  (\x02' + numPlayers + '\x02 player' + (numPlayers != 1 ? 's are ' : ' is ') + 'already in)');
};

Bot.prototype.onGameLeave = function onGameLeave (player, numPlayers) {
    this.client.say(this.options.channel,
        '\x02' + player + '\x02 left the game.  (\x02' + numPlayers + '\x02 player' + (numPlayers != 1 ? 's are ' : ' is ') + 'still in)');
};

Bot.prototype.onGameKill = function onGameKill (player, victim, oldVictim) {
    var _this = this;

    var msg = [
        '\x02%1$s\x02 doesn\'t want to kill anyone', // null, null
        '\x02%1$s\x02 wants to kill \x02\x1f%2$s\x1f\x02', // "str", null
        '\x02%1$s\x02 doesn\'t want to kill \x1f%3$s\x1f anymore', // null, "str"
        '\x02%1$s\x02 wants to kill \x02\x1f%2$s\x1f\x02 instead of \x1f%3$s\x1f', // "str", "str"
    ][(+!!victim) + (+!!oldVictim)*2];


    var pieces = ['Votes:'];

    _.forEach(this.game.killVictims, function (votes, votedPlayer) {
        pieces.push(sprintf('\x0305\x1f%s\x1f: \x02%d\x02\x0f', votedPlayer, votes));
    });

    var joinedPieces = utils.joinWithMax(pieces, '   ', 80);

    this.game.getRolePlayers(Game.ROLE_WOLF).forEach(function (wolf) {
        _this.client.notice(wolf, sprintf(msg, player, victim, oldVictim));

        joinedPieces.forEach(function (line) {
            _this.client.notice(wolf, line);
        });
    });

};

Bot.prototype.onGameVote = function onGameVote (player, target) {
    var _this = this;

    if (target) {
        this.client.say(this.options.channel,
            '\x02' + player + '\x02 wants to lynch \x02\x1f' + target + '\x1f\x02');
    } else {
        this.client.say(this.options.channel,
            '\x02' + player + '\x02 doesn\'t want to lynch anyone');
    }

    var pieces = ['Votes:'];

    _.forEach(this.game.lynchVictims, function (votes, votedPlayer) {
        pieces.push(sprintf('\x0302\x1f%s\x1f: \x02%d\x02\x0f', votedPlayer, votes));
    });

    utils.joinWithMax(pieces, '   ', 80).forEach(function (line) {
        _this.client.say(_this.options.channel, line);
    });
};


module.exports = Bot;