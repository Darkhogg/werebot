'use strict';
var _            = require('lodash');
var EventEmitter = require('eventemitter3');
var util         = require('util');

var logger = require('>/common/logger');
var config = require('>/common/config');
var utils  = require('>/common/utils');

var MIN_PLAYERS = 5;
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

    this.on('start-turn:' + Game.TURN_WOLVES, this.onStartTurnWolves, this);
    this.on(  'end-turn:' + Game.TURN_WOLVES, this.onEndTurnWolves, this);

    this.on('start-turn:' + Game.TURN_DISCUSSION, this.onStartTurnDiscussion, this);
    this.on(  'end-turn:' + Game.TURN_DISCUSSION, this.onEndTurnDiscussion, this);

    this.on('start-turn:' + Game.TURN_LYNCHING, this.onStartTurnLynching, this);
    this.on(  'end-turn:' + Game.TURN_LYNCHING, this.onEndTurnLynching, this);
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
Game.ROLE_VILLAGER = 'villager';
Game.ROLE_WOLF     = 'werewolf';
Game.ROLE_SEER     = 'seer';
Game.ROLE_WITCH    = 'witch';
Game.ROLE_HUNTER   = 'hunter';
Game.ROLE_CUPID    = 'concubine';
Game.ROLE_GUARDING = 'guarding angel';
Game.ROLE_SPY      = 'spy';

/* === GAME PHASES === */
Game.PHASE_PREPARATION = 'preparation';
Game.PHASE_DAYTIME     = 'day';
Game.PHASE_NIGHTTIME   = 'night';

/* === PLAYER TURNS === */
Game.TURN_JOINING    = 'joining';
Game.TURN_ELECTION   = 'election';
Game.TURN_CONCUBINE  = 'concubine';
Game.TURN_WOLVES     = 'wolves';
Game.TURN_SEER       = 'seer';
Game.TURN_WITCH      = 'witch';
Game.TURN_HUNTER     = 'hunter';
Game.TURN_DISCUSSION = 'discussion';
Game.TURN_LYNCHING   = 'lynching';
Game.TURN_SHERIFF    = 'sheriff';

/* === TURN DURATIONS === */
Game.TIME_JOINING    = 15//60;
Game.TIME_ELECTION   = 150;
Game.TIME_CONCUBINE  = 45;
Game.TIME_WOLVES     = 15//60;
Game.TIME_SEER       = 60;
Game.TIME_WITCH      = 30;
Game.TIME_HUNTER     = 30;
Game.TIME_DISCUSSION = 15//45;
Game.TIME_LYNCHING   = 30//90;
Game.TIME_SHERIFF    = 30;

/* === DEATH TYPES === */
Game.DEATH_WOLVES = 'wolves';
Game.DEATH_LYNCH  = 'lynch';

/* === GAME SIDES === */
Game.SIDE_TOWN   = 'town';
Game.SIDE_WOLVES = 'werewolves';

/* =========================== */
/* === INFORMATION GETTERS === */

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
}

Game.prototype.checkVictory = function checkVictory () {
    if (this.winningSide) {
        return true;
    }

    if (this.countRolePlayers(Game.ROLE_WOLF) == 0) {
        this.winningSide = Game.SIDE_TOWN;
        return true;

    } else if (this.countRolePlayers(Game.ROLE_WOLF) == this.players.length) {
        this.winningSide = Game.SIDE_WOLVES;
        return true;
    }

    return false;
}

/* ======================= */
/* === STATE MODIFIERS === */

Game.prototype.startGame = function startGame () {
    this._interval = setInterval(this.onTick.bind(this), 1000);
    this._interval.unref();

    this.townName = utils.generateTownName();
    this.winningSide = null;

    this.deaths = [];
    this.players = [];
    this.roles = {};
    this.rolePlayers = {};

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

    this._emit('end-game');
};

Game.prototype.startPhase = function startPhase (phase) {
    var now = Date.now();

    this.phase = phase;
    this.phaseEndTime = now + 5000;

    this._emit('start-phase', phase);
    this._emit('start-phase:' + phase);
};

Game.prototype.endPhase = function endPhase () {
    var phase = this.phase
    this.phase = null;

    this._emit('end-phase', phase);
    this._emit('end-phase:' + phase);
};

Game.prototype.startTurn = function startTurn (turn, time) {
    var now = Date.now();

    this.activeTurns.push(turn);
    this.turnEndTimes[turn] = now + time * 1000;

    this._emit('start-turn', turn);
    this._emit('start-turn:' + turn);
};

Game.prototype.endTurn = function endTurn (turn) {
    this.activeTurns.splice(this.activeTurns.indexOf(turn), 1);

    this._emit('end-turn', turn);
    this._emit('end-turn:' + turn);
};

Game.prototype.assignRoles = function assignRoles () {
    this.rolePlayers = {};
    this.roles = {};

    /* Define all wanted roles */
    var roles = []; // TODO

    /* Find out how many wolves */
    var numWolves = Math.max(1, (this.players.length - 1) / 5);

    /* Fill the remaining with villagers, with a minimum (numWolves+1) willagers */
    var numVillagers = 1 + Math.max(numWolves, this.players.length - roles.length - numWolves);
    for (var i = 0; i < numVillagers; i++) {
        roles.push(Game.ROLE_VILLAGER);
    }

    /* Shuffle the players and the roles */
    var randPlayers = _.shuffle(this.players);
    var randRoles   = _.shuffle(roles);

    /* Add as many werewolves as necessary at the start */
    for (var i = 0; i < numWolves; i++) {
        randRoles.unshift(Game.ROLE_WOLF);
    }

    /* Assign a role to each player, in "order" */
    for (var i in randPlayers) {
        var player = randPlayers[i];
        var role =randRoles[i];

        logger.verbose('Assign: "%s" is a "%s"', player, role);

        /* Add the player to the role list */
        if (!this.rolePlayers[role]) {
            this.rolePlayers[role] = [];
        }
        this.rolePlayers[role].push(player);

        /* Set the player role */
        this.roles[player] = role;
    }

    /* Emit the apprpriate event */
    this._emit('roles');
};

Game.prototype.addDeath = function addDeath (who, why, direct) {
    logger.verbose('Player "%s" added to death queue:', who, why);

    var death = {
        'player': who,
        'reason': why
    };

    if (direct) {
        this.performDeath(death);
    } else {
        this.deaths.push(death);
    }

    logger.verbose('Death queue:', this.deaths);
};

Game.prototype.applyDeaths = function applyDeaths () {
    if (this.deaths.length == 0) {
        this._emit('nodeaths');
    }

    while (this.deaths.length > 0) {
        var death = this.deaths.shift();

        this.performDeath(death);
    }
}

Game.prototype.performDeath = function performDeath (death) {
    var player = death.player;
    var role = this.getPlayerRole(player);

    logger.verbose('%s (%s) is going to die', player, role);

    /* Remove the player from the role and player lists */
    this.players.splice(this.players.indexOf(player), 1);
    this.rolePlayers[role].splice(this.rolePlayers[role].indexOf(player), 1);
    this.roles[player] = null;

    /* Emit the appropriate event */
    this._emit('death', player, role, death.reason);
}

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
            _this.endTurn(turn);
        }
    });
};


Game.prototype.onStartPhasePreparation = function onStartPhasePreparation () {
    this.startTurn(Game.TURN_JOINING, Game.TIME_JOINING);
};

Game.prototype.onEndPhasePreparation = function onEndPhasePreparation () {
    this.startPhase(Game.PHASE_NIGHTTIME);
};


Game.prototype.onStartPhaseNight = function onStartPhaseNight () {
    this.startTurn(Game.TURN_WOLVES, Game.TIME_WOLVES);

    if (this.countRolePlayers(Game.ROLE_SEER) > 0) {
        this.startTurn(Game.TURN_SEER, Game.TIME_SEER);
    }
};

Game.prototype.onEndPhaseNight = function onStartPhaseNight () {
    this.startPhase(Game.PHASE_DAYTIME);
};



Game.prototype.onStartPhaseDay = function onStartPhaseDay () {
    this.applyDeaths();

    if (this.checkVictory()) {
        this.endGame();

    } else {
        this.startTurn(Game.TURN_DISCUSSION, Game.TIME_DISCUSSION);
    }
};

Game.prototype.onEndPhaseDay = function onStartPhaseDay () {
    if (this.checkVictory()) {
        this.endGame();

    } else {
        this.startPhase(Game.PHASE_NIGHTTIME);
    }
};


Game.prototype.onStartTurnJoining = function onStartTurnJoining () {
};

Game.prototype.onEndTurnJoining = function onEndTurnJoining () {
    this.assignRoles();
};


Game.prototype.onStartTurnWolves = function onStartTurnWolves () {
    this.wolvesVictim = null;
    this.killVictims = {};
    this.killVoted = {};
};

Game.prototype.onEndTurnWolves = function onEndTurnWolves () {
    /* Select the victim from the wolf votes */
    this.wolvesVictim = utils.mostVoted(this.killVictims);

    if (this.wolvesVictim) {
        this.addDeath(this.wolvesVictim, Game.DEATH_WOLVES);
    }

    /* Start the turn of the witch */
    if (this.countRolePlayers(Game.ROLE_WITCH) > 0) {
        this.startTurn(Game.TURN_WITCH, Game.TIME_WITCH);
    }
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
};

Game.prototype.onEndTurnLynching = function onEndTurnLynching () {
    /* Select the victim from the wolf votes */
    this.lynchVictim = utils.mostVoted(this.lynchVictims);

    if (this.lynchVictim) {
        this.addDeath(this.lynchVictim, Game.DEATH_LYNCH, true);
    }
};



/* ================== */
/* === PLAYER ACTIONS */

Game.prototype.play = function play (name) {
    if (this.running) {
        throw new GameError('play_already_playing');
    }

    /* --- Everything OK --- */

    logger.verbose('PLAY("%s")', name);

    this.startGame();

    this.players.push(name);
    this._emit('join', name, this.players.length);
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
    this._emit('join', name, this.players.length);
};

Game.prototype.kill = function kill (name, victimName) {
    var player = this.findPlayer(name);

    if (!player) {
        throw new GameError('player_not_playing');
    }

    if (this.getPlayerRole(player) != Game.ROLE_WOLF) {
        throw new GameError('kill_not_a_wolf');
    }

    if (!this.isTurn(Game.TURN_WOLVES)) {
        throw new GameError('kill_not_in_turn');
    }

    var victim = this.findPlayer(victimName);

    if (!victim) {
        throw new GameError('kill_victim_not_playing');
    }

    /* --- Everything OK --- */

    logger.verbose('KILL("%s")', name, victim);

    /* Create a vote entry if not present (and not blank) */
    if (victim != BLANK && !this.killVictims[victim]) {
        this.killVictims[victim] = 0;
    }

    /* If there was already a vote from this wolf, remove it */
    if (this.killVoted[player]) {
        this.killVictims[victim]--;
        this.killVoted[player] = undefined;
    }

    /* If the current vote was not blank, add it */
    if (victim != BLANK) {
        this.killVictims[victim]++;
        this.killVoted[player] = victim;
    }

    this._emit('kill', player, victim);
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

    if (!target) {
        throw new GameError('lynch_target_not_playing');
    }

    /* --- Everything OK --- */

    logger.verbose('LYNCH("%s")', name, target);

    /* Create a vote entry if not present (and not blank) */
    if (target != BLANK && !this.killVictims[target]) {
        this.lynchVictims[target] = 0;
    }

    /* If the current vote was not blank, add it */
    if (target != BLANK) {
        this.lynchVictims[target]++;
        this.lynchVoted[player] = target;
    }

    this._emit('vote', player, target);
};

/* ====================== */
/* === MODULE EXPORTS === */

module.exports = Game;