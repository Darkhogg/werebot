'use strict';
var _       = require('lodash');
var crashit = require('crashit');
var irc     = require('irc');
var sprintf = require('sprintf-js').sprintf;

var nickserv = require('>/modules/nickserv');

var logger = require('>/common/logger');
var config = require('>/common/config');
var utils  = require('>/common/utils');

var Game = require('>/game');

var MIN_PLAYERS = 5;

var aliases = {
    'p': 'play',
    'j': 'join',
    'w': 'who',

    'a': 'attack',
    'v': 'vote',

    'life': 'lifepot',
    'death': 'deathpot',

    'rev': 'revenge',
}

var Bot = function Bot (opts) {
    this.options = opts;
};

Bot.prototype.start = function start (version) {
    var _this = this;
    this.lastMessage = Date.now();

    this.names = {};
    this.isRegistered = {};

    logger.info('Starting Bot (v%s)', version);

    this.client = new irc.Client(
        this.options.host,
        this.options.nick,
        {
            //debug: true,
            autoConnect: false,
            floodProtection: true,
            floodProtectionDelay: 100,
            channels: [],
            secure: true,
            selfSigned: true,
            port: this.options.port,
            userName: 'Werebot',
            realName: 'Werebot v' + version
        }
    );

    setInterval(function () {
        var now = Date.now();
        var diff = now - _this.lastMessage;

        if (diff > 250 * 1000) {
            logger.debug('Last message %s seconds ago!', diff/1000);
            _this.client.send('ping', _this.options.host);
        }

        if (diff > 300 * 1000) {
            crashit.crash(2);
        }
    }, 10 * 1000);

    this.client.on('raw', function () {
        _this.lastMessage = Date.now();
    });

    this.client.on('ping', function (data) {
        logger.silly('[   PING] %s', data);
    });

    this.client.on('pong', function (data) {
        logger.silly('[   PONG] %s', data);
    });

    this.client.once('abort', function () {
        crashit.crash(1);
    });

    this.client.once('netError', function (err) {
        crashit.crash(err);
    });

    this.client.once('motd', function (motd) {
        _this.recoverGameChannel();
        _this.recoverWolvesChannel();
    });

    this.client.on('error', function (err) {
        logger.warn(' /!\\ /!\\  %s (%s):', err.command, err.rawCommand, err.args.join(', '));
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

    this.game.on('player-victory', this.onGamePlayerVictory, this);
    this.game.on('side-victory', this.onGameSideVictory, this);


    this.game.on('start-phase:' + Game.PHASE_PREPARATION, this.onGameStartPhasePreparation, this);
    this.game.on(  'end-phase:' + Game.PHASE_PREPARATION, this.onGameEndPhasePreparation, this);

    this.game.on('start-phase:' + Game.PHASE_NIGHTTIME, this.onGameStartPhaseNight, this);
    this.game.on(  'end-phase:' + Game.PHASE_NIGHTTIME, this.onGameEndPhaseNight, this);

    this.game.on('start-phase:' + Game.PHASE_DAYTIME, this.onGameStartPhaseDay, this);
    this.game.on(  'end-phase:' + Game.PHASE_DAYTIME, this.onGameEndPhaseDay, this);


    this.game.on('start-turn:' + Game.TURN_JOINING, this.onGameStartTurnJoining, this);
    this.game.on(  'end-turn:' + Game.TURN_JOINING, this.onGameEndTurnJoining, this);

    this.game.on('start-turn:' + Game.TURN_THIEF, this.onGameStartTurnThief, this);
    this.game.on(  'end-turn:' + Game.TURN_THIEF, this.onGameEndTurnThief, this);

    this.game.on('start-turn:' + Game.TURN_CUPID, this.onGameStartTurnCupid, this);
    this.game.on(  'end-turn:' + Game.TURN_CUPID, this.onGameEndTurnCupid, this);

    this.game.on('start-turn:' + Game.TURN_WOLVES, this.onGameStartTurnWolves, this);
    this.game.on(  'end-turn:' + Game.TURN_WOLVES, this.onGameEndTurnWolves, this);
    this.game.on('wolves-victim', this.onGameSelectWolvesVictim, this);

    this.game.on('start-turn:' + Game.TURN_DISCUSSION, this.onGameStartTurnDiscussion, this);
    this.game.on(  'end-turn:' + Game.TURN_DISCUSSION, this.onGameEndTurnDiscussion, this);

    this.game.on('start-turn:' + Game.TURN_LYNCHING, this.onGameStartTurnLynching, this);
    this.game.on(  'end-turn:' + Game.TURN_LYNCHING, this.onGameEndTurnLynching, this);

    this.game.on('start-turn:' + Game.TURN_SEER, this.onGameStartTurnSeer, this);
    this.game.on(  'end-turn:' + Game.TURN_SEER, this.onGameEndTurnSeer, this);

    this.game.on('start-turn:' + Game.TURN_KIDPEEK, this.onGameStartTurnKid, this);
    this.game.on(  'end-turn:' + Game.TURN_KIDPEEK, this.onGameEndTurnKid, this);

    this.game.on('start-turn:' + Game.TURN_WITCH, this.onGameStartTurnWitch, this);
    this.game.on(  'end-turn:' + Game.TURN_WITCH, this.onGameEndTurnWitch, this);

    this.game.on('start-turn:' + Game.TURN_HUNTER, this.onGameStartTurnHunter, this);
    this.game.on(  'end-turn:' + Game.TURN_HUNTER, this.onGameEndTurnHunter, this);

    this.game.on('assigned', this.onGameAssignedRoles, this);
    this.game.on('role', this.onGameRole, this);
    this.game.on('side', this.onGameSide, this);

    this.game.on('death', this.onGameDeath, this);

    this.game.on('join', this.onGameJoin, this);
    this.game.on('leave', this.onGameLeave, this);
    this.game.on('attack', this.onGameAttack, this);
    this.game.on('vote', this.onGameVote, this);
    this.game.on('see', this.onGameSee, this);
    this.game.on('lifepot', this.onGameLifePot, this);
    this.game.on('deathpot', this.onGameDeathPot, this);

    this.game.on('peek-event', this.onGamePeekEvent, this);

    this.nickserv = nickserv(this.client, this.options.nick, this.options.nickservPassword);

    this.client.connect(1, function (msg) {
        _this._connected = true;
    });
};

Bot.prototype.stop = function stop (message) {
    logger.debug('Stopping Bot');

    this.resetChannel();

    this.client.disconnect(message);
};

Bot.prototype.recoverGameChannel = function recoverGameChannel () {
    this.client.join(this.options.channel);
    this.client.say('ChanServ', sprintf('INVITE %s', this.options.channel));
}

Bot.prototype.recoverWolvesChannel = function () {
    this.client.join(this.options.channelWolves);
    this.client.say('ChanServ', sprintf('INVITE %s', this.options.channelWolves));
};

Bot.prototype.resetChannel = function () {
    if (this._connected) {
        this.client.send('MODE', this.options.channel, '+t-m');
        this.client.say('ChanServ', sprintf('SYNC %s', this.options.channel));
    }
};

Bot.prototype.onInvite = function onInvite (channel, from, msg) {
    var _this = this;

    logger.silly('[ INVITE] %s %s', from, channel);

    if ([_this.options.channel, _this.options.channelWolves, _this.options.channelTalk].indexOf(channel) >= 0) {
        _this.client.join(channel);
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

            case 'leave': {
                this.game.playerLeft(who);
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

            /* Attack a player */
            case 'attack': {
                this.game.attack(who, args[0]);
            } break;

            /* Vote for lynching */
            case 'vote': {
                this.game.lynch(who, args[0]);
            } break;

            /* Steal a character (thief) */
            case 'steal': {
                this.game.steal(who, args[0]);
            } break;

            /* Make two people fall in love */
            case 'love': {
                this.game.love(who, args[0], args[1]);
            } break;

            /* Use the seer ability */
            case 'see': {
                this.game.see(who, args[0]);
            } break;

            /* Use the kid ability */
            case 'peek': {
                this.game.peek(who);
            } break;

            /* Use the witch ability */
            case 'lifepot': {
                this.game.useLife(who, args[0]);
            } break;
            case 'deathpot': {
                this.game.useDeath(who, args[0]);
            } break;

            /* Revenge kill */
            case 'revenge': {
                this.game.revenge(who, args[0]);
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
    var _this = this;

    this.nickserv.recover().then(function () {
        _this.recoverWolvesChannel();
    });

    var potentialPlayers = this.names[this.options.channel].filter(function (name) {
        return name != _this.client.nick;
    });

    utils.joinWithMax(potentialPlayers, ' ', 80).forEach(function (line) {
        _this.client.say(_this.options.channel, line);
    })

    this.client.say(this.options.channel, '\x02A new game is about to start!');
};

Bot.prototype.onGameEndGame = function onGameEndGame () {
    if (!this.game.assignedRoles) {
        this.client.say(this.options.channel,
            sprintf('A minimum of \x02%s\x02 players are required to start a game', Game.MIN_PLAYERS)
        );
    }

    this.resetChannel();
};


Bot.prototype.onGameSideVictory = function onGameSideVictory (side, result) {
    switch (side) {
        case Game.SIDE_TOWN: {
            this.client.say(this.options.channel,
                sprintf('\x0303The \x02town of %1$s\x02 has won!', this.game.townName));
        } break;

        case Game.SIDE_WOLVES: {
            this.client.say(this.options.channel,
                '\x0305The \x02werewolves\x02 have won!');
        } break;

        case Game.SIDE_NOBODY: {
            this.client.say(this.options.channel,
                '\x0314\x02Nobody\x02 has won the game');
        }
    }
};

Bot.prototype.onGamePlayerVictory = function onGamePlayerVictory (player, result) {
    if (result) {
        this.client.notice(player, sprintf('%1$s:\x0f\x0303 You have \x02won\x0f!', player));

    } else {
        this.client.notice(player, sprintf('%1$s:\x0f\x0304 You have \x02lost\x0f!', player));
    }
};


Bot.prototype.onGameStartPhasePreparation = function onGameStartPhasePreparation () {
    this.client.say(this.options.channel, '\x02\x0307/!\\\x0f \x0315Remember that the game is in \x02beta\x02 stage ');
    this.client.say(this.options.channel, '\x0308/!\\\x0f \x0315Please report any problems, suggestions to\x0302 https://github.com/Darkhogg/werebot/issues');
};

Bot.prototype.onGameEndPhasePreparation = function onGameEndPhasePreparation () {

};



Bot.prototype.onGameStartPhaseNight = function onGameStartPhaseNight () {
    var _this = this;

    this.client.say(this.options.channel, 'The \x02\x0312night\x0f falls over ' + this.game.townName + ' and everyone goes to sleep.');

    this.names[this.options.channel].forEach(function (user) {
        if (user != _this.client.nick) {
            _this.client.send('MODE', _this.options.channel, '-v', user);
        }
    });

    this.game.getRolePlayers(Game.ROLE_KID).forEach(function (kid) {
        _this.client.notice(kid, sprintf('%1$s: At any point during the night, say \x1f/msg %2$s !peek\x1f to see what\'s happening in the town', kid, _this.client.nick));
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
    var _this = this;

    this.client.say(this.options.channel, '\x02Time\'s up!');

    /* Add moderated flag to channel */
    this.client.send('MODE', this.options.channel, '+m');

    /* Remove @ % and + from everyone */
    this.names[this.options.channel].forEach(function (user) {
        if (user != _this.client.nick) {
            _this.client.send('MODE', _this.options.channel, '-ohv', user, user, user);
        }
    });
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
        sprintf('The town of \x02%1$s\x02 has \x02%2$s\x02 inhabitants', this.game.townName, this.game.alivePlayers.length));

    this.client.say(this.options.channel,
        sprintf('There are \x0305\x02%1$s\x02 werewolves\x0f in the town', this.game.wolves.length));
};

Bot.prototype.onGameRole = function onGameRole (player, role) {
    this.client.notice(player, player + ': You are a \x1f\x02' + role + '\x02\x1f');
};

Bot.prototype.onGameSide = function onGameSide (player, side) {
    switch (side) {
        /* Town Side */
        case Game.SIDE_TOWN: {
            this.client.notice(player, sprintf('%1$s:\x0f\x0303 You side with \x02the town\x02', player));
            this.client.notice(player, sprintf('%1$s:\x0f\x0303 In order to win, you have to kill all the werewolves', player));
        } break;

        /* Wolves Side */
        case Game.SIDE_WOLVES: {
            this.client.notice(player, sprintf('%1$s:\x0f\x0305 You side with \x02the werewolves\x02', player));
            this.client.notice(player, sprintf('%1$s:\x0f\x0305 The werewolves are: \x02%2$s\x02', player, this.game.getRolePlayers(Game.ROLE_WOLF).join('\x02, \x02')));
            this.client.notice(player, sprintf('%1$s:\x0f\x0305 In order to win, you have to kill anyone that\'s not a werewolf', player));
        } break;

        /* Wolves Side */
        case Game.SIDE_LOVERS: {
            var otherLovers = this.game.getSidePlayers(Game.SIDE_LOVERS).filter(function (lover) {
                return lover != player;
            });

            this.client.notice(player, sprintf('%1$s:\x0f\x0306 You are \x02in love\x02 with \x02%2$s\x02', player, utils.join(otherLovers, '\x02, \x02', '\x02 and \x02')));
            this.client.notice(player, sprintf('%1$s:\x0f\x0306 If any of you two die, the other will immediately commit suicide', player));
            this.client.notice(player, sprintf('%1$s:\x0f\x0306 In order to win, you need to be alive at the end of the game', player));
        } break;
    }
};


Bot.prototype.onGameStartTurnThief = function onGameStartTurnThief () {
    var _this = this;

    this.game.getRolePlayers(Game.ROLE_THIEF).forEach(function (thief) {
        _this.client.notice(thief, sprintf('%1$s:\x0f You can choose to become one of the unassigned roles:', thief));
        _this.game.thiefRoles.forEach(function (role) {
            _this.client.notice(thief, sprintf('%1$s: - \x0f Write \x1f/msg %4$s !steal %2$s\x1f to become a \x02%3$s\x02', thief, role, role, _this.client.nick));
        });
        _this.client.notice(thief, sprintf('%1$s:\x0f You have \x02%2$s\x02 seconds to steal a role', thief, Game.TIME_THIEF));
    });
};

Bot.prototype.onGameEndTurnThief = function onGameEndTurnThief () {

};


Bot.prototype.onGameStartTurnCupid = function onGameStartTurnCupid () {
    var _this = this;

    this.game.getRolePlayers(Game.ROLE_CUPID).forEach(function (cupid) {
        _this.client.notice(cupid, sprintf('%1$s:\x0f Write \x1f/msg %2$s !love \x1dnick1\x1d \x1dnick2\x1d\x1f to make \x1dnick1\x1d and \x1dnick2\x1d fall in love', cupid, _this.client.nick));
        _this.client.notice(cupid, sprintf('%1$s:\x0f You have \x02%2$s\x02 seconds to make two people fall in love', cupid, Game.TIME_CUPID));
    });
};

Bot.prototype.onGameEndTurnCupid = function onGameEndTurnCupid () {
    var _this = this;

    this.game.getRolePlayers(Game.ROLE_CUPID).forEach(function (cupid) {
        _this.client.notice(cupid, sprintf('%1$s:\x0f The lovers for the rest of the game are \x02%2$s\x02', cupid, utils.join(_this.game.getSidePlayers(Game.SIDE_LOVERS), '\x02, \x02', '\x02 and \x02')));
    });
};



Bot.prototype.onGameStartTurnWolves = function onGameStartTurnWolves () {
    var _this = this;

    this.game.getRolePlayers(Game.ROLE_WOLF).forEach(function (wolf) {
        _this.client.send('INVITE', wolf, _this.options.channelWolves);
        _this.client.notice(wolf, 'It\'s time to hunt! Join \x1f' + _this.options.channelWolves + '\x1f to discuss who to attack with the other werewolves');
        _this.client.notice(wolf, 'When you\'re ready, vote for attacking by saying \x1f!attack nick\x1f, or \x1f!attack -\x1f to skip vote');
        _this.client.notice(wolf, 'If a tie is reached, a random player from the tie will die!');
    });
};

Bot.prototype.onGameEndTurnWolves = function onGameEndTurnWolves () {

};

Bot.prototype.onGameSelectWolvesVictim = function onGameSelectWolfVictim (victim) {
    var _this = this;

    this.game.getRolePlayers(Game.ROLE_WOLF).forEach(function (wolf) {
        _this.client.notice(wolf, sprintf('The wolves have decided to attack \x02%s\x02!', victim));
    });
};


Bot.prototype.onGameStartTurnDiscussion = function onGameStartTurnDiscussion () {
    var _this = this;

    /* Give voice to anyone still alive */
    this.game.alivePlayers.forEach(function (user) {
        if (user != _this.client.nick) {
            _this.client.send('MODE', _this.options.channel, '+v', user);
        }
    });

    this.client.say(this.options.channel, 'Everyone on ' + this.game.townName + ' gathers at the plaza');
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


Bot.prototype.onGameStartTurnSeer = function onGameStartTurnSeer () {
    var _this = this;

    this.game.getRolePlayers(Game.ROLE_SEER).forEach(function (seer) {
        _this.client.notice(seer, sprintf('%s: Your crystal ball lights up, giving you the chance of knowing the true identity of a villager', seer));
        _this.client.notice(seer, sprintf('To reveal the role of a player, write \x1f/msg %1$s !see \x1dnick\x1d\x1f, or \x1f/msg %1$s !see \x1d-\x1d\x1f to skip the turn', _this.client.nick));
        _this.client.notice(seer, sprintf('You have \x02%s\x02 seconds until your crystal ball loses power', Game.TIME_SEER));
    });
};

Bot.prototype.onGameEndTurnSeer = function onGameEndTurnSeer () {
    var _this = this;

    this.game.getRolePlayers(Game.ROLE_SEER).forEach(function (seer) {
        _this.client.notice(seer, 'Your crystal ball goes black, you\'ll need to wait a day to use it again');
    });
};


Bot.prototype.onGameStartTurnKid = function onGameStartTurnKid () {
    var _this = this;

    this.game.getRolePlayers(Game.ROLE_KID).forEach(function (kid) {
        _this.client.notice(kid, sprintf('You wake up and go outside; if anything happens, you\'ll see it'));
    });
};

Bot.prototype.onGameEndTurnKid = function onGameEndTurnKid () {
    var _this = this;

    this.game.getRolePlayers(Game.ROLE_KID).forEach(function (kid) {
        _this.client.notice(kid, 'You go back to sleep');
    });
};


/* === WITCH === */

Bot.prototype.onGameStartTurnWitch = function onGameStartTurnWitch () {
    var _this = this;

    this.game.getRolePlayers(Game.ROLE_WITCH).forEach(function (witch) {
        var victim = _this.game.wolvesVictim;

        _this.client.notice(witch, sprintf('This night, the werewolves attacked \x02%1$s\x02 and killed them', victim));

        _this.client.notice(witch, sprintf('You have \x02\x0303%d\x02 life potion(s)\x0300', _this.game.lifePotions));
        if (_this.game.lifePotions) {
            _this.client.notice(witch, sprintf('Use a life potion to revive \x02%1$s\x02 by saying \x1f/msg %2$s !lifepot %1$s\x1f, or skip it with \x1f/msg %2$s !lifepot -\x1f', victim, _this.client.nick));
        }

        _this.client.notice(witch, sprintf('You have \x02\x0305%d\x02 death potion(s)\x0300', _this.game.deathPotions));
        if (_this.game.lifePotions) {
            _this.client.notice(witch, sprintf('Use a death potion to kill anyone by saying \x1f/msg %1$s !deathpot nick\x1f, or skip it with \x1f/msg %1$s !deathpot -\x1f', _this.client.nick));
        }

        if (_this.game.lifePotions || _this.game.deathPotions) {
            _this.client.notice(witch, sprintf('You have \x02%1$d\x02 seconds to use your potions', Game.TIME_WITCH));
        }
    });
};

Bot.prototype.onGameEndTurnWitch = function onGameEndTurnWitch () {
    var _this = this;

    this.game.getRolePlayers(Game.ROLE_WITCH).forEach(function (witch) {
        _this.client.notice(witch, sprintf('Fearing the werewolves might discover you, you go back to sleep'));
    });
};


/* === HUNTER === */

Bot.prototype.onGameStartTurnHunter = function onGameStartTurnHunter () {
    this.client.notice(this.game.activeHunter, sprintf('%1$s: As the hunter, you can avenge your own death by killing someone with your last breath', this.game.activeHunter));
    this.client.notice(this.game.activeHunter, sprintf('Select who to kill using \x1f/msg %1$s !revenge nick\x1f', this.client.nick));
};

Bot.prototype.onGameEndTurnHunter = function onGameEndTurnHunter () {

};


Bot.prototype.onGameDeath = function (player, role, reason) {
    this.client.send('MODE', this.options.channel, '-v', player);

    switch (reason) {
        case Game.DEATH_DISAPPEAR: {
            this.client.say(this.options.channel, sprintf('\x02%1$s\x02, the \x02%2$s\x02, has gone missing', player, role));
        } break;

        case Game.DEATH_WOLVES:
        case Game.DEATH_WITCH: {
            this.client.say(this.options.channel, sprintf('\x02%1$s\x02, the \x02%2$s\x02, has been found dead', player, role));
        } break;

        default: {
            this.client.say(this.options.channel, sprintf('\x02%1$s\x02, the \x02%2$s\x02, has died', player, role));
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

Bot.prototype.onGameAttack = function onGameAttack (player, victim, oldVictim) {
    var _this = this;

    var msg = [
        '\x02%1$s\x02 doesn\'t want to attack anyone', // null, null
        '\x02%1$s\x02 wants to attack \x02\x1f%2$s\x1f\x02', // "str", null
        '\x02%1$s\x02 doesn\'t want to attack \x1f%3$s\x1f anymore', // null, "str"
        '\x02%1$s\x02 wants to attack \x02\x1f%2$s\x1f\x02 instead of \x1f%3$s\x1f', // "str", "str"
    ][(+!!victim) + (+!!oldVictim)*2];


    var pieces = [];

    _.forEach(this.game.attackVictims, function (votes, votedPlayer) {
        pieces.push(sprintf('\x0305\x1f%s\x1f: \x02%d\x02\x0f', votedPlayer, votes));
    });

    var joinedPieces = utils.joinWithMax(pieces, '   ', 80, 'Votes:  ');

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

Bot.prototype.onGameSee = function onGameSee (player, target, role) {
    var _this = this;

    this.client.notice(player, sprintf('%s: The player \x02%s\x02 is a \x02\x1f%s\x1f\x02', player, target, role));
};


Bot.prototype.onGamePeekEvent = function onGamePeekEvent (event, args) {
    var _this = this;

    this.game.getRolePlayers(Game.ROLE_KID).forEach(function (kid) {
        switch (event) {
            case 'attack': {
                _this.client.notice(kid, sprintf('%1$s: \x0fYou see \x02%2$s\x02, the \x0305\x02werewolf\x0f, planning to attack \x02%3$s\x02 tonight', kid, args[0], args[1]));
            } break;

            case 'see': {
                _this.client.notice(kid, sprintf('%1$s: \x0fYou see \x02%2$s\x02, the \x0301\x02seer\x0f, revealing the true identity of \x02%3$s\x02', kid, args[0], args[1]));
            } break;

            case 'lifepot': {
                _this.client.notice(kid, sprintf('%1$s: \x0fYou see \x02%2$s\x02, the \x0306\x02witch\x0f, using a \x0303life potion\x0f on \x02%3$s\x02', kid, args[0], args[1]));
            } break;

            case 'deathpot': {
                _this.client.notice(kid, sprintf('%1$s: \x0fYou see \x02%2$s\x02, the \x0306\x02witch\x0f, using a \x0305death potion\x0f on \x02%3$s\x02', kid, args[0], args[1]));
            } break;

            default: {
                _this.client.notice(kid, sprintf('Unknown event: \x02%s\x02 [%s]', event, args.join(', ')));
            }
        }
    });
}


Bot.prototype.onGameLifePot = function (witch, target) {
    if (target) {
        this.client.say(witch, sprintf('You\'ve used a \x0303life potion\x0300 on \x02%1$s\x02', target));
    }
};

Bot.prototype.onGameDeathPot = function (witch, target) {
    if (target) {
        this.client.say(witch, sprintf('You\'ve used a \x0305death potion\x0300 on \x02%1$s\x02', target));
    }
};

module.exports = Bot;