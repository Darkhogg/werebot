'use strict';
var _            = require('lodash');
var EventEmitter = require('eventemitter3');
var util         = require('util');

var logger = require('>/common/logger');
var config = require('>/common/config');
var utils  = require('>/common/utils');

var BLANK = '-';

var Game = function Game () {
    /* Game Events */
    this.on('start-game', logger.debug.bind(logger, 'Game Starts'));
    this.on(  'end-game', logger.debug.bind(logger, 'Game Ends'));

    /* Phase Events */
    this.on('start-phase', logger.debug.bind(logger, 'Phase Starts:'));
    this.on(  'end-phase', logger.debug.bind(logger, 'Phase Ends:'));

    this.on('start-phase:' + Game.PHASE_PREPARATION, this.onStartPhasePreparation, this);
    this.on(  'end-phase:' + Game.PHASE_PREPARATION, this.onEndPhasePreparation, this);

    this.on('start-phase:' + Game.PHASE_NIGHTTIME, this.onStartPhaseNight, this);
    this.on(  'end-phase:' + Game.PHASE_NIGHTTIME, this.onEndPhaseNight, this);

    this.on('start-phase:' + Game.PHASE_DAYTIME, this.onStartPhaseDay, this);
    this.on(  'end-phase:' + Game.PHASE_DAYTIME, this.onEndPhaseDay, this);

    /* Turn Events */
    this.on('start-turn', logger.debug.bind(logger, 'Turn Starts:'));
    this.on(  'end-turn', logger.debug.bind(logger, 'Turn Ends:'));

    this.on('start-turn:' + Game.TURN_JOINING, this.onStartTurnJoining, this);
    this.on(  'end-turn:' + Game.TURN_JOINING, this.onEndTurnJoining, this);

    this.on('start-turn:' + Game.TURN_INFO, this.onStartTurnInfo, this);
    this.on(  'end-turn:' + Game.TURN_INFO, this.onEndTurnInfo, this);

    this.on('start-turn:' + Game.TURN_THIEF, this.onStartTurnThief, this);
    this.on(  'end-turn:' + Game.TURN_THIEF, this.onEndTurnThief, this);

    this.on('start-turn:' + Game.TURN_CUPID, this.onStartTurnCupid, this);
    this.on(  'end-turn:' + Game.TURN_CUPID, this.onEndTurnCupid, this);

    this.on('start-turn:' + Game.TURN_WOLVES, this.onStartTurnWolves, this);
    this.on(  'end-turn:' + Game.TURN_WOLVES, this.onEndTurnWolves, this);

    this.on('start-turn:' + Game.TURN_DISCUSSION, this.onStartTurnDiscussion, this);
    this.on(  'end-turn:' + Game.TURN_DISCUSSION, this.onEndTurnDiscussion, this);

    this.on('start-turn:' + Game.TURN_LYNCHING, this.onStartTurnLynching, this);
    this.on(  'end-turn:' + Game.TURN_LYNCHING, this.onEndTurnLynching, this);

    this.on('start-turn:' + Game.TURN_SEER, this.onStartTurnSeer, this);
    this.on(  'end-turn:' + Game.TURN_SEER, this.onEndTurnSeer, this);

    this.on('start-turn:' + Game.TURN_WITCH, this.onStartTurnWitch, this);
    this.on(  'end-turn:' + Game.TURN_WITCH, this.onEndTurnWitch, this);

    this.on('death', this.onDeath, this);

    this.on('attack', this.onAttack, this);
    this.on('peek-event', this.onPeekEvent, this);
};

var GameError = Game.Error = function GameError (message) {
    this.message = message;
}

util.inherits(GameError, Error);
util.inherits(Game, EventEmitter);

Game.prototype._emit = function emit () {
    var _this = this;
    var args = arguments;
    process.nextTick(function () {
        _this.emit.apply(_this, args);
    });
};

/* === PLAYER ROLES === */
Game.ROLE_VILLAGER  = 'villager';
Game.ROLE_SEER      = 'seer';
Game.ROLE_KID       = 'kid';
Game.ROLE_WITCH     = 'witch';
Game.ROLE_HUNTER    = 'hunter';
Game.ROLE_CUPID     = 'cupid';
Game.ROLE_THIEF     = 'thief';

Game.ROLE_WOLF       = 'werewolf';
Game.ROLE_WHITEWOLF  = 'whitewolf';
Game.ROLE_FIERCEWOLF = 'fiercewolf';
Game.ROLE_INFECTWOLF = 'infectwolf';

/* === MIN PLAYERS FOR ROLE === */
Game.PLAYERS_SEER = [
    { 'players': 5, 'probability': 0.80 },
    { 'players': 6, 'probability': 0.99 },
];
Game.PLAYERS_KID = [
    { 'players': 5, 'probability': 0.80 },
    { 'players': 6, 'probability': 0.90 },
    { 'players': 7, 'probability': 0.99 },
];
Game.PLAYERS_WITCH = [
    { 'players': 5, 'probability': 0.50 },
    { 'players': 6, 'probability': 0.75 },
    { 'players': 7, 'probability': 0.99 },
];
Game.PLAYERS_HUNTER = [
    { 'players': 5, 'probability': 0.40 },
    { 'players': 6, 'probability': 0.60 },
    { 'players': 7, 'probability': 0.80 },
    { 'players': 8, 'probability': 0.99 },
];
Game.PLAYERS_CUPID = [
    { 'players': 5, 'probability': 0.40 },
    { 'players': 6, 'probability': 0.70 },
    { 'players': 7, 'probability': 0.99 },
];
Game.PLAYERS_THIEF = [
    { 'players': 5, 'probability': 0.40 },
    { 'players': 6, 'probability': 0.60 },
    { 'players': 7, 'probability': 0.80 },
    { 'players': 8, 'probability': 0.99 },
];

/* === ROLE PRIORITY & PLAYERS === */
Game.ROLEPLAYERS = [
    { 'role': Game.ROLE_SEER,   'chances': Game.PLAYERS_SEER },
    { 'role': Game.ROLE_KID,   'chances': Game.PLAYERS_KID },
    { 'role': Game.ROLE_WITCH,  'chances': Game.PLAYERS_WITCH },
    { 'role': Game.ROLE_HUNTER, 'chances': Game.PLAYERS_HUNTER },
    //{ 'role': Game.ROLE_CUPID,  'chances': Game.PLAYERS_CUPID },
    { 'role': Game.ROLE_THIEF,  'chances': Game.PLAYERS_THIEF },
];

/* === GAME PHASES === */
Game.PHASE_PREPARATION = 'preparation';
Game.PHASE_DAYTIME     = 'day';
Game.PHASE_NIGHTTIME   = 'night';

/* === PLAYER TURNS === */
Game.TURN_JOINING    = 'joining';
Game.TURN_INFO       = 'info';

Game.TURN_ELECTION   = 'election';
Game.TURN_CUPID      = 'cupid';
Game.TURN_THIEF      = 'thief';

Game.TURN_WOLVES     = 'wolves';
Game.TURN_SEER       = 'seer';
Game.TURN_KIDPEEK    = 'kid-peek';
Game.TURN_WITCH      = 'witch';
Game.TURN_HUNTER     = 'hunter';

Game.TURN_DISCUSSION = 'discussion';
Game.TURN_LYNCHING   = 'lynching';
Game.TURN_SUCCESSOR  = 'successor';


/* === TURN DURATIONS === */
Game.TIME_JOINING    = (config.testing) ? 30 : 60;
Game.TIME_INFO       = 1.5; // Per player
Game.TIME_THIEF      = (config.testing) ? 45 : 60;
Game.TIME_ELECTION   = (config.testing) ? 30 : 150;
Game.TIME_CUPID      = (config.testing) ? 30 : 45;
Game.TIME_WOLVES     = (config.testing) ? 30 : 60;
Game.TIME_SEER       = (config.testing) ? 20 : 45;
Game.TIME_KIDPEEK    = (config.testing) ? 15 : 10;
Game.TIME_WITCH      = (config.testing) ? 20 : 45;
Game.TIME_HUNTER     = (config.testing) ? 20 : 30;
Game.TIME_DISCUSSION = (config.testing) ? 15 : 60;
Game.TIME_LYNCHING   = (config.testing) ? 60 : 150;
Game.TIME_POSTLYNCH  = (config.testing) ? 20 : 45;

/* === DEATH TYPES === */
Game.DEATH_WOLVES     = 'wolves';
Game.DEATH_LYNCH      = 'lynch';
Game.DEATH_DISAPPEAR  = 'disappear';
Game.DEATH_WITCH      = 'witch';
Game.DEATH_HUNTER     = 'hunter';
Game.DEATH_SUICIDE    = 'suicide';

/* === GAME SIDES === */
Game.SIDE_NOBODY    = 'nobody';
Game.SIDE_TOWN      = 'town';
Game.SIDE_LOVERS    = 'lovers';
Game.SIDE_WOLVES    = 'werewolves';
Game.SIDE_WHITEWOLF = 'whitewolf';
Game.SIDE_FLUTIST   = 'flutist';

/* === DEFAULT ROLE SIDES === */
Game.DEFAULT_SIDES = {};

Game.DEFAULT_SIDES[Game.ROLE_VILLAGER] = Game.SIDE_TOWN;
Game.DEFAULT_SIDES[Game.ROLE_SEER]     = Game.SIDE_TOWN;
Game.DEFAULT_SIDES[Game.ROLE_KID]      = Game.SIDE_TOWN;
Game.DEFAULT_SIDES[Game.ROLE_WITCH]    = Game.SIDE_TOWN;
Game.DEFAULT_SIDES[Game.ROLE_HUNTER]   = Game.SIDE_TOWN;
Game.DEFAULT_SIDES[Game.ROLE_CUPID]    = Game.SIDE_TOWN;

Game.DEFAULT_SIDES[Game.ROLE_THIEF]    = null; // Don't assign to anything by default

Game.DEFAULT_SIDES[Game.ROLE_WOLF]       = Game.SIDE_WOLVES;
Game.DEFAULT_SIDES[Game.ROLE_FIERCEWOLF] = Game.SIDE_WOLVES;
Game.DEFAULT_SIDES[Game.ROLE_INFECTWOLF] = Game.SIDE_WOLVES;

Game.DEFAULT_SIDES[Game.ROLE_WHITEWOLF] = Game.SIDE_WHITEWOLF;

/* === ROLES IDENTIFIED AS "WOLVES" === */
Game.WOLF_ROLES = [
    Game.ROLE_WOLF,
    Game.ROLE_WHITEWOLF,
    Game.ROLE_FIERCEWOLF,
    Game.ROLE_INFECTWOLF
];

/* === OTHER === */
Game.LIMIT_KIDEVENTS = 3;
Game.MIN_PLAYERS = config.minPlayers || 5;

/* =========================== */
/* === INFORMATION GETTERS === */

Game.prototype.findAlivePlayer = function findAlivePlayer (player) {
    if (!this.alivePlayers) {
        return null;
    }

    var idx = this.alivePlayers.indexOf(player);
    if (idx < 0) {
        return null;
    }

    return this.alivePlayers[idx];
};

Game.prototype.findPlayer = function findPlayer (player) {
    if (!this.players) {
        return null;
    }

    var idx = this.players.indexOf(player);
    if (idx < 0) {
        return null;
    }

    return this.players[idx];
};

Game.prototype.isTurn = function isTurn (turn) {
    return this.activeTurns && this.activeTurns.indexOf(turn) >= 0;
};

Game.prototype.isPhase = function isPhase (phase) {
    return this.phase && this.phase == phase;
};

Game.prototype.getPlayerRole = function getPlayerRole (name) {
    var player = this.findPlayer(name);

    if (!player) {
        return null;
    }

    if (!this.roles || !this.roles[player]) {
        return null;
    }

    return this.roles[player];
};

Game.prototype.getRolePlayers = function getRolePlayers (role) {
    if (!this.rolePlayers || !this.rolePlayers[role]) {
        return [];
    }

    return this.rolePlayers[role];
};

Game.prototype.countRolePlayers = function countRolePlayers (role) {
    return this.getRolePlayers(role).length;
};

Game.prototype.getPlayerSides = function getPlayerSides (name) {
    var player = this.findPlayer(name);

    if (!player) {
        return [];
    }

    if (!this.sides || !this.sides[player]) {
        return [];
    }

    return this.sides[player];
};

Game.prototype.getSidePlayers = function getSidePlayers (role) {
    if (!this.sidePlayers || !this.sidePlayers[role]) {
        return [];
    }

    return this.sidePlayers[role];
};

Game.prototype.countSidePlayers = function countSidePlayers (role) {
    return this.getSidePlayers(role).length;
};


Game.prototype.checkVictory = function checkVictory () {
    /* Victory already set */
    if (this.winningSide) {
        return true;
    }

    var _this = this;

    /* Make the lovers lose if they're dead */
    var loversDead = this.getSidePlayers(Game.SIDE_LOVERS).some(function (lover) {
        return _this.alivePlayers.indexOf(lover) < 0;
    });
    if (loversDead && this.losingSides.indexOf(Game.SIDE_LOVERS) < 0) {
        this.losingSides.push(Game.SIDE_LOVERS);
    }

    /* If nobody is alive, "nobody" wins (literally) */
    if (this.players.length == 0) {
        this.winningSide = Game.SIDE_NOBODY;
        return true;
    }

    /* The town wins if they're the only ones alive */
    if (this.countSidePlayers(Game.SIDE_TOWN) == this.players.length) {
        this.winningSide = Game.SIDE_TOWN;
        return true;
    }

    /* The werewolves win if they're the only ones alive */
    if (this.countSidePlayers(Game.SIDE_WOLVES) == this.players.length) {
        this.winningSide = Game.SIDE_WOLVES;
        return true;
    }

    /* The lovers win if they're the only ones alive */
    if (this.countSidePlayers(Game.SIDE_LOVERS) == this.players.length) {
        this.winningSide = Game.SIDE_LOVERS;
        return true;
    }

    /* No victory */
    return false;
};

Game.prototype.performVictory = function performVictory () {
    var _this = this;

    if (!this.performedVictory && this.checkVictory()) {
        logger.debug('Winning side: ' + this.winningSide);

        var winners = {};

        /* Anyone on the winning side wins */
        _this.allSidePlayers[this.winningSide].forEach(function (winner) {
            winners[winner] = true;
        });

        /* Anyone on a loding side loses */
        this.losingSides.forEach(function (losingSide) {
            _this.allSidePlayers[losingSide].forEach(function (loser) {
                winners[loser] = false;
            });
        });

        /* Emit everything! */
        _this._emit('side-victory', this.winningSide, true);
        this.initialPlayers.forEach(function (player) {
            _this._emit('player-victory', player, winners[player]);
        });

        this.performedVictory = true;
        return this.endGame();
    }

    logger.silly('No wins yet...');
}

Game.prototype.nickChanged = function nickChanged (oldNick, newNick) {
    /* When a nick changes, we need to:
       - Change it on the list of players and alivePlayers
       - Change it on its role list
       - Modify the entry on the roles map
       - Change it on its side list
       - Modify the entry on the sides map
    */

    if (this.running && this.players.indexOf(oldNick) >= 0) {
        this.players[this.players.indexOf(oldNick)] = newNick;
        this.alivePlayers[this.alivePlayers.indexOf(oldNick)] = newNick;

        if (this.roles[oldNick]) {
            var rolePlayersNick = this.rolePlayers[this.roles[oldNick]];
            rolePlayersNick[rolePlayersNick.indexOf(oldNick)] = newNick;

            this.roles[newNick] = this.roles[oldNick];
            this.roles[oldNick] = null;
        }
    }
};

Game.prototype.playerLeft = function playerLeft (player) {
    if (this.running && this.alivePlayers.indexOf(player) >= 0) {
        if (this.isTurn(Game.TURN_JOINING)) {
            this.alivePlayers.splice(this.alivePlayers.indexOf(player));

            this._emit('leave', player, this.alivePlayers.length);
        } else {
            this.addDeath(player, Game.DEATH_DISAPPEAR, this.isPhase(Game.PHASE_DAYTIME));
        }
    }
}

/* ======================= */
/* === STATE MODIFIERS === */

Game.prototype.startGame = function startGame () {
    this._interval = setInterval(this.onTick.bind(this), 1000);
    this._interval.unref();

    this.townName = utils.generateTownName();
    this.winningSide = null;
    this.losingSides = [];
    this.assignedRoles = false;
    this.performedVictory = false;

    this.deaths = [];
    this.players = [];
    this.alivePlayers = [];
    this.initialPlayers = [];

    this.wolves = [];

    this.roles = {};
    this.rolePlayers = {};
    this.existingRoles = [];

    this.sides = {};
    this.sidePlayers = {};
    this.allSidePlayers = {};
    this.existingSides = [];

    this.thiefRoles = [];

    this.lifePotions = 1;
    this.deathPotions = 1;

    this.running = true;

    this.activeTurns = [];
    this.turnEndTimes = {};

    this._emit('start-game');

    this.startPhase(Game.PHASE_PREPARATION);
};

Game.prototype.endGame = function endGame () {
    clearInterval(this._interval);
    this._interval = null;

    this.running = false;
    this.players = [];
    this.alivePlayers = []

    this._emit('end-game');
};

Game.prototype.startPhase = function startPhase (phase) {
    var now = Date.now();

    if (this.running) {
        this.phase = phase;
        this.phaseEndTime = now + 5000;

        this._emit('start-phase', phase);
        this._emit('start-phase:' + phase);
    }
};

Game.prototype.endPhase = function endPhase () {
    var phase = this.phase
    this.phase = null;

    this._emit('end-phase', phase);
    this._emit('end-phase:' + phase);
};

Game.prototype.startTurn = function startTurn (turn, time) {
    var now = Date.now();

    if (this.running) {
        this.activeTurns.push(turn);
        this.turnEndTimes[turn] = now + time * 1000;

        this._emit('start-turn', turn);
        this._emit('start-turn:' + turn);
    }
};

Game.prototype.endTurn = function endTurn (turn, when) {
    var now = Date.now();

    this.turnEndTimes[turn] = now + (when || 0) * 1000;
};

Game.prototype.assignRoles = function assignRoles () {
    var _this = this;

    this.initialPlayers = this.players.slice(0);
    this.assignedRoles = true;

    this.existingRoles = [];
    this.rolePlayers = {};
    this.roles = {};

    this.existingSides = [];
    this.sidePlayers = {};
    this.allSidePlayers = {};
    this.sides = {};

    /* Start defining the number of roles */
    var roles = [];

    var numWolves = Math.floor(Math.max(1, (this.players.length + 4) / 5));

    /* Add the wolves */
    for (var i = 0; i < numWolves; i++) {
        roles.push(Game.ROLE_WOLF);
    }

    var extraRoles = (numWolves > 1) ? 1 : 0;
    var numRoles = this.players.length + extraRoles;

    /* Add the regular roles based on priority/players */
    for (var i = 0; i < Game.ROLEPLAYERS.length && roles.length < numRoles; i++) {
        var rolespec = Game.ROLEPLAYERS[i];

        var probability = (Game.__FORCED_ROLE == rolespec.role) ? 1.00 : 0.00;

        /* Find out the probabilidy */
        rolespec.chances.forEach(function (chance) {
            if (_this.players.length >= chance.players) {
                probability = Math.max(probability, chance.probability);
            }
        });

        logger.silly('Probability of %s: %d', rolespec.role, probability);

        /* If the role gets randomly selected */
        if (Math.random() < probability) {
            roles.push(rolespec.role);

            /* If this was a thief, ensure we add 2 extra roles */
            if (rolespec.role == Game.ROLE_THIEF) {
                numRoles = this.players.length + 2;
            }
        }
    }

    /* Add the villagers */
    while (roles.length < numRoles) {
        roles.push(Game.ROLE_VILLAGER);
    }

    /* Shuffle the players and the roles */
    var randPlayers = _.shuffle(this.players);
    var randRoles   = _.shuffle(roles);

    if (Game.__FORCED_ROLE) {
        if (this.players.indexOf(this.gameStarter) >= 0) {
            randPlayers.splice(randPlayers.indexOf(this.gameStarter), 1);
            randPlayers.unshift(this.gameStarter);
        }

        randRoles.splice(randRoles.indexOf(Game.__FORCED_ROLE), 1);
        randRoles.unshift(Game.__FORCED_ROLE);
    }

    logger.silly('Players: ', randPlayers.join(', '));
    logger.silly('Roles: ', randRoles.join(', '));

    /* Assign a role to each player, in "order" */
    for (var i in randPlayers) {
        this.assignRoleToPlayer(randPlayers[i], randRoles[i]);
    }

    /* All roles after the last one assigned should be left for the thief */
    if (roles.indexOf(Game.ROLE_THIEF) >= 0) {
        this.thiefRoles = randRoles.slice(this.players.length);
        logger.silly('Thief Roles: ', this.thiefRoles.join(', '));
    }

    /* Emit the apprpriate event */
    this._emit('assigned');
};

Game.prototype.assignRoleToPlayer = function assignRoleToPlayer (player, role) {

    /* --- 1. Role --- */

    var oldRole = null;

    /* If the player had a role, remove it from its list */
    if (this.roles && this.roles[player]) {
        oldRole = this.roles[player];
        this.rolePlayers[oldRole].splice(this.rolePlayers[oldRole].indexOf(player), 1);
    }

    /* Add the player to the role list */
    if (!this.rolePlayers[role]) {
        this.rolePlayers[role] = [];
    }
    this.rolePlayers[role].push(player);

    /* Set the player role */
    this.roles[player] = role;

    /* Add the role to the existing roles */
    if (this.existingRoles.indexOf(role) < 0) {
        this.existingRoles.push(role);
    }

    /* Emit events! */
    if (oldRole) {
        logger.verbose('Unassign: "%s" is NOT a "%s"', player, oldRole);
        this._emit('unrole', player, oldRole);
    }

    logger.verbose('Assign: "%s" is a "%s"', player, role);
    this._emit('role', player, role);

    /* --- 2. Sides --- */

    var side = Game.DEFAULT_SIDES[role];

    if (side != null) {
        this.addPlayerToSide(player, side);

        /* If it's a wolf, add it as a wolf */
        if (Game.WOLF_ROLES.indexOf(role) >= 0) {
            this.wolves.push(player);
        }
    }
};

Game.prototype.addPlayerToSide = function addPlayerToSide (player, side) {
    /* Add the player to the side list */
    if (!this.sidePlayers[side]) {
        this.sidePlayers[side] = [];
        this.allSidePlayers[side] = [];
    }
    this.sidePlayers[side].push(player);
    this.allSidePlayers[side].push(player);

    /* Set the player side (as a list -- there can be multiple sides!) */
    if (!this.sides[player]) {
        this.sides[player] = [];
    }
    this.sides[player].push(side);

    /* Add the side to the existing sides if it didn't exist */
    if (this.existingSides.indexOf(side) < 0) {
        this.existingSides.push(side);
    }

    logger.verbose('Side: "%s" is with "%s"', player, side);
    this._emit('side', player, side);
};

Game.prototype.addDeath = function addDeath (who, why, direct) {
    logger.verbose('Death: %s %s', who, why);

    var death = {
        'player': who,
        'reason': why
    };

    if (direct) {
        this.performDeath(death);
    } else {
        this.deaths.push(death);
    }

    logger.verbose('Death queue: [%s]', this.deaths.join(', '));
};

Game.prototype.removeDeath = function removeDeath (who, why) {
    logger.verbose('Revive: %s %s', who, why);

    this.deaths = this.deaths.filter(function (death) {
        return !(who == death.player && (!why || why == death.reason));
    });
};

Game.prototype.applyDeaths = function applyDeaths () {
    if (this.deaths.length == 0) {
        this._emit('nodeaths');
    }

    while (this.deaths.length > 0) {
        var death = this.deaths.shift();
        this.performDeath(death);
    }

};

Game.prototype.performDeath = function performDeath (death) {
    var player = death.player;

    if (this.alivePlayers.indexOf(player) < 0) {
        return;
    }

    var role = this.getPlayerRole(player);

    logger.verbose('%s [%s] dies (%s)', player, role, death.reason);

    /* Remove the player from the role and player lists */
    this.alivePlayers.splice(this.alivePlayers.indexOf(player), 1);

    /* Emit the appropriate event */
    this._emit('death', player, role, death.reason);
};

Game.prototype.finishDeath = function finishDeath (player) {
    var _this = this;

    var role = this.getPlayerRole(player);
    var sides = this.getPlayerSides(player);

    /* Empty the roles... */
    this.roles[player] = null;
    this.rolePlayers[role].splice(this.rolePlayers[role].indexOf(player));

    /* Empty the sides... */
    this.sides[player] = [];
    sides.forEach(function (side) {
        _this.sidePlayers[side].splice(_this.sidePlayers[side].indexOf(player));
    });

    /* Remove from players... */
    this.players.splice(this.players.indexOf(player), 1);
};

/* ======================= */
/* === GAME MANAGEMENT === */

Game.prototype.onTick = function onTick () {
    var _this = this;
    var now = Date.now();

    /* If there's no current phase, finish the game */
    if (!this.phase) {
        this.endGame();
    }

    /* End phase at its time if no turn is active */
    if (this.phase && now >= this.phaseEndTime && this.activeTurns.length == 0) {
        this.endPhase();
    }

    /* End turns when their time passes */
    this.activeTurns.forEach(function (turn) {
        if (now >= _this.turnEndTimes[turn]) {
            _this.phaseEndTime = now + 1500;
            _this.activeTurns.splice(_this.activeTurns.indexOf(turn), 1);

            _this._emit('end-turn', turn);
            _this._emit('end-turn:' + turn);
        }
    });
};


Game.prototype.onStartPhasePreparation = function onStartPhasePreparation () {
    this.startTurn(Game.TURN_JOINING, Game.TIME_JOINING);
};

Game.prototype.onEndPhasePreparation = function onEndPhasePreparation () {
    if (this.alivePlayers.length >= Game.MIN_PLAYERS) {
        this.startPhase(Game.PHASE_NIGHTTIME);
    }
};


Game.prototype.onStartPhaseNight = function onStartPhaseNight () {
    this.kidPeeked = false;

    this.applyDeaths();
    this.performVictory();

    this.startTurn(Game.TURN_WOLVES, Game.TIME_WOLVES);

    if (this.existingRoles.indexOf(Game.ROLE_SEER) >= 0) {
        this.startTurn(Game.TURN_SEER, Game.TIME_SEER);
    }
};

Game.prototype.onEndPhaseNight = function onStartPhaseNight () {
    this.startPhase(Game.PHASE_DAYTIME);
};



Game.prototype.onStartPhaseDay = function onStartPhaseDay () {
    this.applyDeaths();

    this.performVictory();

    this.startTurn(Game.TURN_DISCUSSION, Game.TIME_DISCUSSION);
};

Game.prototype.onEndPhaseDay = function onStartPhaseDay () {
    if (this.lynchVictim) {
        this.addDeath(this.lynchVictim, Game.DEATH_LYNCH, true);
    }

    this.performVictory();

    this.startPhase(Game.PHASE_NIGHTTIME);
};


Game.prototype.onStartTurnJoining = function onStartTurnJoining () {
};

Game.prototype.onEndTurnJoining = function onEndTurnJoining () {
    if (this.players.length >= Game.MIN_PLAYERS) {
        this.assignRoles();

        this.startTurn(Game.TURN_INFO, Game.TIME_INFO * this.players.length);
    }
};


Game.prototype.onStartTurnInfo = function onStartTurnInfo () {
};

Game.prototype.onEndTurnInfo = function onEndTurnInfo () {
    var thiefTime = (this.getRolePlayers(Game.ROLE_THIEF) > 0)
        ? Game.TIME_THIEF
        : utils.randomRange(Game.TIME_THIEF / 5, Game.TIME_THIEF * 3 / 5);

    this.startTurn(Game.TURN_THIEF, thiefTime);
};


Game.prototype.onStartTurnThief = function onStartTurnThief () {
    this.thiefSelect = null;
};

Game.prototype.onEndTurnThief = function onEndTurnThief () {
    if (this.countRolePlayers(Game.ROLE_THIEF) > 0) {

        var allWolves = this.thiefRoles.every(function (role) {
            return Game.WOLF_ROLES.indexOf(role) >= 0;
        });

        if (this.thiefRoles.length > 0 && allWolves && !this.thiefSelect) {
            this.thiefSelect = _.sample(this.thiefRoles);
        }

        if (this.thiefSelect) {
            this.assignRoleToPlayer(this.getRolePlayers(Game.ROLE_THIEF)[0], this.thiefSelect);

        } else {
            this.addPlayerToSide(this.getRolePlayers(Game.ROLE_THIEF)[0], Game.SIDE_TOWN);
        }
    }

    /* Start the cupid turn */
    var cupidTime = (this.getRolePlayers(Game.ROLE_CUPID) > 0)
        ? Game.TIME_CUPID
        : utils.randomRange(Game.TIME_CUPID / 5, Game.TIME_CUPID * 3 / 5);

    this.startTurn(Game.TURN_CUPID, cupidTime);
};



Game.prototype.onStartTurnCupid = function onStartTurnCupid () {
    this.selectedLovers = [];
};

Game.prototype.onEndTurnCupid = function onEndTurnCupid () {
    var _this = this;

    if (this.countRolePlayers(Game.ROLE_CUPID) > 0) {
        while (this.selectedLovers.length < 2) {
            var candidates = this.players.filter(function (player) {
                return _this.selectedLovers.indexOf(player) < 0;
            });

            this.selectedLovers.push(_.sample(candidates));
        }

        this.selectedLovers.forEach(function (lover) {
            _this.addPlayerToSide(lover, Game.SIDE_LOVERS);
        });
    }
};



Game.prototype.onStartTurnWolves = function onStartTurnWolves () {
    this.wolvesVictim = null;
    this.attackVictims = {};
    this.attackVoted = {};
    this.totalAttackVoted = [];
};

Game.prototype.onEndTurnWolves = function onEndTurnWolves () {
    var _this = this;

    var victims = utils.mostVotedMulti(this.attackVictims);
    if (victims.length == 0) {
        victims = this.alivePlayers.filter(function (player) {
            return _this.getRolePlayers(Game.ROLE_WOLF).indexOf(player) < 0;
        });
    }

    if (victims.length > 0) {
        this.wolvesVictim = _.sample(victims);

        this._emit('wolves-victim', this.wolvesVictim);
        this.addDeath(this.wolvesVictim, Game.DEATH_WOLVES);
    }

    /* Start the turn of the witch */
    if (this.existingRoles.indexOf(Game.ROLE_WITCH)) {
        this.startTurn(Game.TURN_WITCH, Game.TIME_WITCH);
    }
};

Game.prototype.onStartTurnSeer = function onStartTurnSeer () {
    this.usedSeer = false;
};

Game.prototype.onEndTurnSeer = function onEndTurnSeer () {
};


Game.prototype.onStartTurnWitch = function onStartTurnWitch () {
    this.usedWitchLife = (this.lifePotions == 0);
    this.usedWitchDeath = (this.deathPotions == 0);

    if (this.usedWitchLife && this.usedWitchDeath) {
        this.endTurn(Game.TURN_WITCH, utils.randomRange(10, Game.TIME_WITCH));
    }
};

Game.prototype.onEndTurnWitch = function onEndTurnWitch () {
};


Game.prototype.onStartTurnDiscussion = function onStartTurnDiscussion () {
};

Game.prototype.onEndTurnDiscussion = function onEndTurnDiscussion () {
    this.startTurn(Game.TURN_LYNCHING, Game.TIME_LYNCHING);
};


Game.prototype.onStartTurnLynching = function onStartTurnLynching () {
    this.lynchVictim = null;
    this.lynchVictims = {};
    this.lynchVoted = {};
    this.lynchTotalVotes = 0;
};

Game.prototype.onEndTurnLynching = function onEndTurnLynching () {
    /* Select the victim from the lynch votes */
    this.lynchVictim = utils.mostVoted(this.lynchVictims);
};

Game.prototype.onStartTurnHunter = function onStartTurnHunter () {

};

Game.prototype.onEndTurnHunter = function onEndTurnHunter () {
    this.finishDeath(this.activeHunter);
};




Game.prototype.onDeath = function onDeath (player) {
    var _this = this;

    var role = this.getPlayerRole(player);
    var sides = this.getPlayerSides(player);

    if (sides.indexOf(Game.SIDE_LOVERS)) {
        this.getSidePlayers(Game.SIDE_LOVERS).forEach(function (lover) {
            _this.addDeath(lover, Game.DEATH_SUICIDE, true);
        });
    }

    if (role == Game.ROLE_HUNTER) {
        /* The hunter is not finished yet: A hunter turn starts, the hunter
         * uses !revenge, and he dies AFTER the turn ends
         */

        this.activeHunter = player;
        return this.startTurn(Game.TURN_HUNTER, Game.TIME_HUNTER);
    }

    this.finishDeath(player);

    this.performVictory();
};


Game.prototype.onAttack = function onAttack (player, victim, oldVictim) {
    /* If everyone has voted and there is majority, end the turn */
    if (
        this.totalAttackVoted.length >= this.getRolePlayers(Game.ROLE_WOLF).length &&
        utils.mostVoted(this.attackVictims)
    ) {
        this.endTurn(Game.TURN_WOLVES);
    }

    /* If the kid is awake and the vote isn't blank... */
    if (this.isTurn(Game.TURN_KIDPEEK) && victim != Game.BLANK) {
        this._emit('peek-event', 'attack', [player, victim]);
    }
};

Game.prototype.onPeekEvent = function onPeekEvent (event, args) {
    this.kidEvents++;

    if (this.kidEvents >= Game.LIMIT_KIDEVENTS) {
        this.endTurn(Game.TURN_KIDPEEK);
    }
};

/* ====================== */
/* === PLAYER ACTIONS === */

Game.prototype.play = function play (name) {
    if (this.running) {
        throw new GameError('play_already_playing');
    }

    /* --- Everything OK --- */

    logger.verbose('PLAY("%s")', name);

    this.startGame();

    this.gameStarter = name;

    this.players.push(name);
    this.alivePlayers.push(name);
    this._emit('join', name, this.alivePlayers.length);
};

Game.prototype.join = function join (name) {
    if (!this.isTurn(Game.TURN_JOINING)) {
        throw new GameError('join_not_in_turn');
    }

    var player = this.findPlayer(name);

    if (player) {
        throw new GameError('join_already_joined');
    }

    /* --- Everything OK --- */

    logger.verbose('JOIN("%s")', name);

    this.players.push(name);
    this.alivePlayers.push(name);

    this._emit('join', name, this.alivePlayers.length);
};

Game.prototype.steal = function steal (name, role) {
    var player = this.findPlayer(name);

    if (!player) {
        throw new GameError('player_not_playing');
    }

    if (this.getPlayerRole(player) != Game.ROLE_THIEF) {
        throw new GameError('steal_not_a_thief');
    }

    if (!this.isTurn(Game.TURN_THIEF)) {
        throw new GameError('steal_not_in_turn');
    }

    if (role != Game.BLANK && this.thiefRoles.indexOf(role) < 0) {
        throw new GameError('steal_role_not_available');
    }

    /* --- Everything OK --- */

    logger.verbose('STEAL("%s")', name, role);

    if (role != Game.BLANK) {
        this.thiefSelect = role;
    }

    this.endTurn(Game.TURN_THIEF);
};

Game.prototype.love = function love (name, target1Name, target2Name) {
    var player = this.findPlayer(name);

    if (!player) {
        throw new GameError('player_not_playing');
    }

    if (this.getPlayerRole(player) != Game.ROLE_CUPID) {
        throw new GameError('love_not_cupid');
    }

    if (!this.isTurn(Game.TURN_CUPID)) {
        throw new GameError('love_not_in_turn');
    }

    var target1 = target1Name;
    var target2 = target2Name;

    if (!target1 && target1Name != BLANK) {
        throw new GameError('love_target1_not_playing');
    }

    if (!target2 && target2Name != BLANK) {
        throw new GameError('love_target2_not_playing');
    }

    /* --- Everything OK --- */

    logger.verbose('LOVE("%s")', name, target1, target2);

    this.selectedLovers = [target1, target2].filter(function (target) {
        return target != Game.BLANK;
    });

    this.endTurn(Game.TURN_CUPID);
};

Game.prototype.attack = function attack (name, victimName) {
    var player = this.findPlayer(name);

    if (!player) {
        throw new GameError('player_not_playing');
    }

    if (this.wolves.indexOf(player) < 0) {
        throw new GameError('attack_not_a_wolf');
    }

    if (!this.isTurn(Game.TURN_WOLVES)) {
        throw new GameError('attack_not_in_turn');
    }

    var victim = this.findPlayer(victimName);

    if (!victim && victimName != BLANK) {
        throw new GameError('attack_victim_not_playing');
    }

    if (this.wolves.indexOf(victim) >= 0) {
        throw new GameError('attack_victim_wolf');
    }

    /* --- Everything OK --- */

    logger.verbose('ATTACK("%s")', name, victim);

    /* Add the player to the list of who voted */
    if (this.totalAttackVoted.indexOf(player) < 0) {
        this.totalAttackVoted.push(player);
    }

    /* Create a vote entry if not present (and not blank) */
    if (victimName != BLANK && !this.attackVictims[victim]) {
        this.attackVictims[victim] = 0;
    }

    var oldVictim = null;

    /* If there was already a vote from this wolf, remove it */
    if (this.attackVoted[player]) {
        oldVictim = this.attackVoted[player];

        this.attackVictims[oldVictim]--;
        this.attackVoted[player] = undefined;
    }

    /* If the current vote was not blank, add it */
    if (victimName != BLANK) {
        this.attackVictims[victim]++;
        this.attackVoted[player] = victim;
    }

    this._emit('attack', player, victim, oldVictim);
};

Game.prototype.lynch = function (name, targetName) {
    var player = this.findPlayer(name);

    if (!player) {
        throw new GameError('player_not_playing');
    }

    if (!this.isTurn(Game.TURN_LYNCHING)) {
        throw new GameError('lynch_not_in_turn');
    }

    if (this.lynchVoted[player]) {
        throw new GameError('lynch_already_voted');
    }

    var target = this.findPlayer(targetName);

    if (!target && targetName != BLANK) {
        throw new GameError('lynch_target_not_playing');
    }

    /* --- Everything OK --- */

    logger.verbose('LYNCH("%s")', name, target);

    this.lynchTotalVotes ++;

    /* Create a vote entry if not present (and not blank) */
    if (target && !this.attackVictims[target]) {
        this.lynchVictims[target] = 0;
    }

    /* If the current vote was not blank, add it */
    if (target) {
        this.lynchVictims[target]++;
        this.lynchVoted[player] = target;
    }

    this._emit('vote', player, target);

    /* If everyone has voted, end the turn */
    if (this.lynchTotalVotes >= this.alivePlayers.length) {
        this.endTurn(Game.TURN_LYNCHING);
    }
};

Game.prototype.see = function see (name, targetName) {
    var player = this.findPlayer(name);

    if (!player) {
        throw new GameError('player_not_playing');
    }

    if (this.getPlayerRole(player) != Game.ROLE_SEER) {
        throw new GameError('see_not_seer');
    }

    if (!this.isTurn(Game.TURN_SEER)) {
        throw new GameError('see_not_in_turn');
    }

    if (this.usedSeer) {
        throw new GameError('see_already_seen');
    }

    var target = this.findPlayer(targetName);

    if (!target && targetName != BLANK) {
        throw new GameError('see_target_not_playing');
    }

    if (target == player) {
        throw new GameError('see_target_is_you');
    }

    /* --- Everything OK --- */

    logger.verbose('SEE("%s")', name, target);

    this.usedSeer = true;

    this._emit('see', player, target, this.getPlayerRole(target));

    this.endTurn(Game.TURN_SEER);
    if (this.isTurn(Game.TURN_KIDPEEK)) {
        this._emit('peek-event', 'see', player, target);
    }
};

Game.prototype.peek = function peek (name) {
    var player = this.findPlayer(name);

    if (!player) {
        throw new GameError('player_not_playing');
    }

    if (this.getPlayerRole(player) != Game.ROLE_KID) {
        throw new GameError('peek_not_kid');
    }

    if (!this.isPhase(Game.PHASE_NIGHTTIME)) {
        throw new GameError('peek_not_night');
    }

    if (this.kidPeeked) {
        throw new GameError('peek_already_peeked');
    }

    /* --- Everything OK --- */

    logger.verbose('PEEK("%s")', name);

    this.kidPeeked = true;
    this.kidEvents = 0;

    this.startTurn(Game.TURN_KIDPEEK, Game.TIME_KIDPEEK);
}

Game.prototype.useLife = function useLife (name, targetName) {
    var player = this.findPlayer(name);

    if (!player) {
        throw new GameError('player_not_playing');
    }

    if (this.getPlayerRole(player) != Game.ROLE_WITCH) {
        throw new GameError('lifepot_not_witch');
    }

    if (!this.isTurn(Game.TURN_WITCH)) {
        throw new GameError('lifepot_not_in_turn');
    }

    if (this.lifePotions <= 0) {
        throw new GameError('lifepot_no_potions');
    }

    if (this.usedWitchLife) {
        throw new GameError('lifepot_already_used');
    }

    var target = this.findPlayer(targetName);

    if (!target && targetName != BLANK) {
        throw new GameError('lifepot_target_not_playing');
    }

    if (target != this.wolvesVictim) {
        throw new GameError('lifepot_not_attacked');
    }

    /* --- Everything OK --- */

    logger.verbose('LIFEPOT("%s")', name, target);

    if (target) {
        this.removeDeath(target, Game.DEATH_WOLVES);
        this.lifePotions--;
    }

    this.usedWitchLife = true;

    if (this.usedWitchLife && this.usedWitchDeath) {
        this.endTurn(Game.TURN_WITCH);
    }

    this._emit('lifepot', player, target);
    if (this.isTurn(Game.TURN_KIDPEEK)) {
        this._emit('peek-event', 'lifepot', player, target);
    }
};

Game.prototype.useDeath = function useDeath (name, targetName) {
    var player = this.findPlayer(name);

    if (!player) {
        throw new GameError('player_not_playing');
    }

    if (this.getPlayerRole(player) != Game.ROLE_WITCH) {
        throw new GameError('deathpot_not_witch');
    }

    if (!this.isTurn(Game.TURN_WITCH)) {
        throw new GameError('deathpot_not_in_turn');
    }

    if (this.deathPotions <= 0) {
        throw new GameError('deathpot_no_potions');
    }

    if (this.usedWitchDeath) {
        throw new GameError('deathpot_already_used');
    }

    var target = this.findPlayer(targetName);

    if (!target && targetName != BLANK) {
        throw new GameError('deathpot_target_not_playing');
    }

    if (target == player) {
        throw new GameError('deathpot_target_is_you');
    }

    /* --- Everything OK --- */

    logger.verbose('DEATHPOT("%s")', name, target);

    if (target) {
        this.addDeath(target, Game.DEATH_WITCH);
        this.deathPotions--;
    }

    this.usedWitchDeath = true;

    if (this.usedWitchLife && this.usedWitchDeath) {
        this.endTurn(Game.TURN_WITCH);
    }

    this._emit('deathpot', player, target);
    if (this.isTurn(Game.TURN_KIDPEEK)) {
        this._emit('peek-event', 'deathpot', player, target);
    }
};

Game.prototype.revenge = function revenge (name, targetName) {
    var player = this.findPlayer(name);

    if (!player) {
        throw new GameError('player_not_playing');
    }

    if (this.getPlayerRole(player) != Game.ROLE_HUNTER) {
        throw new GameError('revenge_not_hunter');
    }

    if (player != this.activeHunter) {
        throw new GameError('revenge_not_recently_dead');
    }

    if (!this.isTurn(Game.TURN_HUNTER)) {
        throw new GameError('deathpot_not_in_turn');
    }

    var target = this.findPlayer(targetName);

    if (!target && targetName != BLANK) {
        throw new GameError('deathpot_target_not_playing');
    }

    if (target == player) {
        throw new GameError('deathpot_target_is_you');
    }

    /* --- Everything OK --- */

    logger.verbose('REVENGE("%s")', name, target);

    if (target) {
        this.addDeath(target, Game.DEATH_HUNTER, true);
    }

    this.endTurn(Game.TURN_HUNTER);
}

/* ====================== */
/* === MODULE EXPORTS === */

module.exports = Game;
