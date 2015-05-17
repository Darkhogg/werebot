'use strict';
var _       = require('lodash');
var crashit = require('crashit');
var irc     = require('irc');

var logger = require('>/common/logger');
var config = require('>/common/config');

var MIN_PLAYERS = 5;

var TIME_JOIN    =  60;
var TIME_PREPARE =   1;
var TIME_NIGHT   =  90;
var TIME_DAY     = 180;

var ROLE_VILLAGER = 'villager';
var ROLE_WOLF     = 'werewolf';

var Bot = function Bot (opts) {
    this.options = opts;
};

Bot.prototype.start = function start (version) {
    var _this = this;

    _this.names = {};
    _this.game = {
        'joining': false,
        'playing': false
    };

    logger.debug('Starting Bot (v%s)', version);

    this.client = new irc.Client(
        _this.options.host,
        _this.options.nick,
        {
            channels: [_this.options.channel],
        }
    );

    _this.client.once('registered', function () {
        logger.info('Bot connected');

        _this.recoverNick();
    });

    _this.client.on('error', function (err) {
        logger.error(err);
    });

    _this.client.on('invite', _this.onInvite.bind(_this));
    _this.client.on('join', _this.onJoin.bind(_this));
    _this.client.on('part', _this.onPart.bind(_this));
    _this.client.on('names', _this.onNames.bind(_this));
    _this.client.on('notice', _this.onNotice.bind(_this));
    _this.client.on('message', _this.onMessage.bind(_this));
    _this.client.on('command', _this.onCommand.bind(_this));
    _this.client.on('+mode', _this.onAddMode.bind(_this));
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

Bot.prototype.resetTopic = function () {
    this.client.send('TOPIC', this.options.channel,
        '\x0fWelcome to \x02Werebot\x02, a Werewolf playing channel!  |  ' +
        'To start playing, write \x1f!play\x1f  |  ' +
        'Please report any problems to https://github.com/Darkhogg/werebot/issues');
};

Bot.prototype.resetChannel = function () {
    this.client.send('MODE', this.options.channel, '+t-m');
};

Bot.prototype.onInvite = function onInvite (channel, from, msg) {
    var _this = this;

    logger.silly('[ INVITE] %s %s', from, channel);

    if (channel == _this.options.channelWolves) {
        _this.client.join(_this.options.channelWolves);
    }
};

Bot.prototype.onJoin = function onJoin (channel, who, msg) {
    logger.silly('[   JOIN] %s %s', who, channel);

    if (!this.names[channel]) {
        this.names[channel] = [];
    }

    this.names[channel].push(who);
};

Bot.prototype.onPart = function onJoin (channel, who, msg) {
    logger.silly('[   PART] %s %s', who, channel);

    if (!this.names[channel]) {
        this.names[channel] = [];
    }

    var idx = this.names[channel].indexOf(who);
    if (idx >= 0) {
        this.names[channel].splice(idx, 1);
    }
};

Bot.prototype.onNick = function (oldNick, newNick, channels, msg) {
    logger.silly('[   NICK] %s -> %s', oldNick, newNick, channels);

    var idx = this.names[channel].indexOf(oldNick);
    this.names[channel][idx] = newNick;
};

Bot.prototype.onAddMode = function (channel, by, mode, argument, msg) {
    if (channel == this.options.channel && argument == this.client.nick) {
        if (!this.game.playing) {
            this.resetChannel();
        }

        this.resetTopic();
    }
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

    switch (command) {

        /* Start a new game */
        case 'p':
        case 'play': {
            logger.info('User %s wants to start a new game', who);

            /* If a game is already started, don't allow new ones */
            if (this.game.playing) {
                logger.warn('A game is already running');
                this.client.notice(who, 'Can\'t start a game: already playing');

            } else {
                this.client.notice(this.options.channel,
                    '\x02' + who + '\x02 wants to start a new game!'
                );
                this.beginGame(who);
            }
        } break;

        /* Join a game */
        case 'j':
        case 'join': {
            /* Check if the joining window is on */
            if (!this.game.joining) {
                this.client.notice(who, 'Can\'t join the game: not in joining phase');

            } else if (this.game.players.indexOf(who) >= 0) {
                this.client.notice(who, 'You are already in the game!');

            } else {
                logger.info('User %s joins the game', who);

                this.game.players.push(who);
                this.client.say(this.options.channel,
                    '\x02' + who + '\x02 joins the game!  ' +
                    '(\x02' + this.game.players.length + '\x02 players are already in)'
                );
            }
        } break;

        /* Kill a player */
        case 'k':
        case 'kill': {
            if (!this.game.playing) {
                this.client.notice(who, 'Can\'t kill: not playing');

            } else if (this.game.players.indexOf(who) < 0) {
                this.client.notice(who, 'Can\'t kill: you\'re not in town!');

            } else if (!this.game.roles || this.game.roles[who] != ROLE_WOLF) {
                this.client.notice(who, 'Can\'t kill: you\'re not a werewolf');

            } else if (!this.game.night) {
                this.client.notice(who, 'Can\'t kill: it\'s not nighttime');

            } else if (this.game.victim) {
                this.client.notice(who, 'Can\'t kill: already killed');

            } else if (args.length < 1) {
                this.client.notice(who, 'You need to specify who to kill!');

            } else {
                var victim = args[0];
                if (this.game.players.indexOf(victim) < 0) {
                    this.client.notice(who, '\x02' + victim + '\x02 is not in town!');

                } else {
                    this.game.victim = victim;

                    this.client.notice('You\'ve selected \x02' + victim + '\x02 as your next victim');
                }
            }
        } break;

        case 'v':
        case 'vote': {
            if (!this.game.playing) {
                this.client.notice(who, 'Can\'t vote: not playing');

            } else if (this.game.players.indexOf(who) < 0) {
                this.client.notice(who, 'Can\'t vote: you\'re not in town!');

            } else if (!this.game.day) {
                this.client.notice(who, 'Can\'t vote: it\'s not daytime');

            } else if (this.game.whoVoted.indexOf(who) >= 0) {
                this.client.notice(who, 'Can\'t vote: already voted');

            } else if (args.length < 1) {
                this.client.notice(who, 'You need to specify who to vote!');

            } else {
                var votedFor = args[0];
                if (this.game.players.indexOf(votedFor) < 0) {
                    this.client.notice(who, '\x02' + votedFor + '\x02 is not in town!');

                } else {
                    if (!this.game.votes[votedFor]) {
                        this.game.votes[votedFor] = 0;
                    }

                    this.game.votes[votedFor]++;
                    this.game.whoVoted.push(who);

                    if (this.game.votes[votedFor] == this.game.maxVotes) {
                        this.game.lynched = null;
                    }

                    if (this.game.votes[votedFor] > this.game.maxVotes) {
                        this.game.maxVotes = this.game.votes[votedFor];
                        this.game.lynched = votedFor;
                    }

                    this.client.say(this.options.channel, who + ' votes for \x02' + votedFor + '\x02 to be lynched');
                    _.forEach(this.game.votes, function (votes, name) {
                        _this.client.say(_this.options.channel,
                            ' - \x02' + name + '\x02 has \x02' + votes + '\x02 votes');
                    });
                }
            }
        } break;

        /* Command not found */
        default: {
            this.client.notice(who, 'Invalid command \x02' + command + '\x0f.');
        }
    }
};

Bot.prototype.onTick = function () {
    var now = Date.now();
    var passed = now - this.game.time;

    /* Finish joining */
    if (this.game.playing && this.game.joining && (
            this.game.players.length == this.names[this.options.channel].length - 1
            || passed > TIME_JOIN * 1000
    )) {
        this.endJoining();
        this.beginPreparing();
    }

    /* Finish preparing */
    if (this.game.playing && this.game.preparing && (passed > TIME_PREPARE * 1000)) {
        this.endPreparing();
        this.beginNight();
    }

    /* Finish night */
    if (this.game.playing && this.game.night && (
            this.game.victim
            || passed > TIME_NIGHT * 1000
    )) {
        this.endNight();
        this.beginDay();
    }

    /* Finish day */
    if (this.game.playing && this.game.day && (
            this.game.maxVotes >= Math.ceil(this.game.players.length / 2)
            || this.game.whoVoted.length >= this.game.players.length
            || passed > TIME_DAY * 1000
    )) {
        this.endDay();

        if (this.game.players.length <= this.game.wolves.length ||
            this.game.wolves.length == 0
        ) {
            this.finishGame();
        } else {
            this.beginNight();
        }
    }
};

Bot.prototype.beginGame = function (who) {
    logger.info('>> Game Begins >>');

    this.recoverNick();
    this.recoverWolvesChannel();

    this.game.players = [who];

    this.game.playing   = true;
    this.game.joining   = false;
    this.game.day       = false;
    this.game.night     = false;
    this.game.preparing = false;

    this.beginJoining();

    var _this = this;
    this.tickFn = function () {
        if (_this.tickFn && _this.game.playing) {
            _this.onTick();
            setTimeout(_this.tickFn, 1000);
        }
    }
    this.tickFn();
}

Bot.prototype.finishGame = function () {
    var win = this.game.wolves.length == 0;

    if (win) {
        this.client.say(this.options.channel, 'Every single werewolf has been killed! Now the town can rest');
        this.client.day(this.options.channel, '\x02\x0303The VILLAGERS win');
    } else {
        this.client.say(this.options.channel, 'Having too few numbers, the werewolves overcome the villagers and kill them all');
        this.client.day(this.options.channel, '\x02\x0304The WEREWOLVES win');
    }

    this.endGame();
};

Bot.prototype.endGame = function () {
    logger.info('<< Game Ends <<');
    this.game.playing = false;

    this.resetChannel();
};

Bot.prototype.beginJoining = function () {
    logger.info('The Joining begins');

    this.game.joining = true;
    this.game.time = Date.now();

    this.client.send('MODE', this.options.channel, '-m');

    this.client.say(this.options.channel, 'Join the current game by writing \x1f!join\x1f');
    this.client.say(this.options.channel, 'You have \x02' + TIME_JOIN + '\x02 seconds to join');
};

Bot.prototype.endJoining = function () {
    logger.info('The Joining ends');
    this.game.joining = false;
    this.client.say(this.options.channel, '\x02Time\'s up!');
};

Bot.prototype.beginPreparing = function () {
    logger.info('The Preparation begins');
    var _this = this;

    this.game.preparing = true;
    this.game.time = Date.now();

    this.game.players = _.sortBy(this.game.players);

    if (this.game.players.length < MIN_PLAYERS) {
        this.client.say(this.options.channel,
            'A game requires at least \x02' + MIN_PLAYERS + '\x02 players, ' +
            'but only \x02' + this.game.players.length + '\x02 joined');

        this.endGame();

        return;
    }

    this.client.say(this.options.channel, 'The town has \x02' + this.game.players.length
        + '\x02 inhabitants: \x02' + this.game.players.join('\x02, \x02') + '\x02');


    this.client.send('MODE', this.options.channelWolves, '+is');

    this.names[this.options.channelWolves].forEach(function (name) {
        if (name != _this.client.nick) {
            _this.client.send('KICK', _this.options.channelWolves, name);
        }
    });

    this.assignRoles();

    this.names[this.options.channel].forEach(function (name) {
        if (name != _this.client.nick) {
            _this.client.send('MODE', _this.options.channel, '-h', name);
            _this.client.send('MODE', _this.options.channel, '-v', name);
            _this.client.send('MODE', _this.options.channel, '-o', name);
        }
    });

    this.client.send('MODE', this.options.channel, '+m');
};

Bot.prototype.endPreparing = function () {
    logger.info('The Preparation ends');
    this.game.preparing = false;

};

Bot.prototype.assignRoles = function () {
    var _this = this;

    this.game.roles = {};
    this.game.wolves = [];
    this.game.villagers = [];

    var numWolves = 1;
    if (this.game.players.length >= 6) {
        numWolves = 2;
    }

    this.client.say(this.options.channel, ' - \x02' + numWolves + '\x02 of them are \x02werewolves\x02');
    this.client.say(this.options.channel, ' - The rest are \x02villagers\x02');

    var unassigned = _.shuffle(this.game.players);

    /* Select wolves */
    for (var i = 0; i < numWolves; i++) {
        var name = unassigned.shift();

        this.game.roles[name] = ROLE_WOLF;
        this.game.wolves.push(name);
    }

    /* The rest are villagers! */
    while (unassigned.length > 0) {
        var name = unassigned.shift();

        this.game.roles[name] = ROLE_VILLAGER;
        this.game.villagers.push(name);
    }

    /* Notice everyone */
    for (var name in this.game.roles) {
        var role = this.game.roles[name];

        logger.debug('"%s" is a "%s"', name, role);
        this.client.notice(name, '\x02' + name + '\x02: You are a \x02\x1f' + role + '\x1f\x02');
    }

    /* Invite wolves to their lair and tell them who their partners are */
    this.game.wolves.forEach(function (name) {
        _this.client.notice(name, 'The other werewolves are: \x02' + _this.game.wolves.join('\x02, \x02'));
        _this.client.send('INVITE', name, _this.options.channelWolves);
    });

    this.client.notice(this.options.channel, 'All werewolves have been invited to join ' + this.options.channelWolves + ' so they can speak at night.');
}

Bot.prototype.beginNight = function () {
    logger.info('The Night begins');
    var _this = this;

    this.game.night = true;
    this.game.victim = null;
    this.game.time = Date.now();

    this.client.say(this.options.channel, 'The \x02\x0302night\x0f falls, the town falls asleep...');
    this.client.say(this.options.channel, '...but the \x0304werewolves\x0f begin to hunt');

    this.names[this.options.channel].forEach(function (name) {
        _this.client.send('MODE', _this.options.channel, '-v', name);
    });

    this.game.wolves.forEach(function (name) {
        _this.client.notice(name, 'It\'s time to hunt, discuss who to kill with the other werewolves');
        _this.client.notice(name, 'Write \x1f!kill \x1dnick\x1d\x1f to choose who to kill when you\'re ready');
    });
};

Bot.prototype.endNight = function () {
    logger.info('The Night ends');
    this.game.night = false;

    if (!this.game.victim) {
        this.game.victim = _.shuffle(this.game.players)[0];
    }

    var victim = this.game.victim;

    this.game.players.splice(this.game.players.indexOf(victim), 1);
    if (this.game.roles[victim] == ROLE_WOLF) {
        this.game.wolves.splice(this.game.wolves.indexOf(victim), 1);
    }
};

Bot.prototype.beginDay = function () {
    var _this = this;
    logger.info('The Day begins');

    this.game.day = true;
    this.game.votes = {};
    this.game.whoVoted = [];
    this.game.maxVotes = 0;
    this.game.lynched = null;
    this.game.time = Date.now();

    var victim = this.game.victim;

    this.client.say(this.options.channel, 'A new \x02\x0310day\x0f begins, everyone wakes up...');
    this.client.say(this.options.channel, '...only to find that \x02' + victim + '\x02 has been killed');

    if (this.game.roles[victim] == ROLE_WOLF) {
        this.client.say(this.options.channel, 'The town is confused: \x1d' + victim + ' was a \x02' + this.game.roles[victim] + '\x02, killed by their own');
    } else {
        this.client.say(this.options.channel, 'Everyone is deeply sorry and sad for the death of \x02' + victim + '\x02, the \x02' + this.game.roles[victim] + '\x02!');
    }

    this.game.players.forEach(function (name) {
        _this.client.send('MODE', _this.options.channel, '+v', name);
    });

    this.client.say(this.options.channel, 'Discuss who you suspect of being a werewolf');
    this.client.say(this.options.channel, 'Vote who should be lynched by writing \x1f!vote \x1dnick\x1d\x1f');
};

Bot.prototype.endDay = function () {
    logger.info('The Day ends');
    this.game.day = false;

    if (this.game.lynched) {
        var lynched = this.game.lynched;

        this.client.say(this.options.channel, 'The town has decided to lynch \x02' + lynched + '\x02');

        this.game.players.splice(this.game.players.indexOf(lynched), 1);
        if (this.game.roles[lynched] == ROLE_WOLF) {
            this.game.wolves.splice(this.game.wolves.indexOf(lynched), 1);
        }

        if (this.game.roles[lynched] == ROLE_WOLF) {
            this.client.say(this.options.channel, 'Everyone cheers happily: \x1d' + lynched + ' was a \x02' + this.game.roles[lynched] + '\x02!');
        } else {
            this.client.say(this.options.channel, 'The town mourns in sadness and regret for killing \x1d' + lynched + ', the \x02' + this.game.roles[lynched] + '\x02!');
        }
    } else {
        this.client.say(this.options.channel, 'The town has not been able to decide who to lynch');
        this.client.say(this.options.channel, '\x1dNobody dies\x1d');
    }
};

module.exports = Bot;