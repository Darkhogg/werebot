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

Game.MIN_PLAYERS = 5;

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
Game.TIME_JOINING    = 60;
Game.TIME_ELECTION   = 150;
Game.TIME_CONCUBINE  = 45;
Game.TIME_WOLVES     = 60;
Game.TIME_SEER       = 30;
Game.TIME_WITCH      = 30;
Game.TIME_HUNTER     = 30;
Game.TIME_DISCUSSION = 60;
Game.TIME_LYNCHING   = 150;
Game.TIME_SHERIFF    = 30;

/* === DEATH TYPES === */
Game.DEATH_WOLVES     = 'wolves';
Game.DEATH_LYNCH      = 'lynch';
Game.DEATH_DISAPPEAR  = 'disappear';

/* === GAME SIDES === */
Game.SIDE_NOBODY = 'nobody';
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

Game.prototype.checkVictory = function checkVictory () {
    /* Victory already set */
    if (this.winningSide) {
        return true;
    }

    if (this.players.players.length) {
        this.winningSide = Game.SIDE_NOBODY;
        return true;

    } else if (this.countRolePlayers(Game.ROLE_WOLF) == 0) {
        this.winningSide = Game.SIDE_TOWN;
        return true;

    } else if (this.countRolePlayers(Game.ROLE_WOLF) == this.players.length) {
        this.winningSide = Game.SIDE_WOLVES;
        return true;
    }

    return false;
};

Game.prototype.nickChanged = function nickChanged (oldNick, newNick) {
    /* When a nick changes, we need to:
       - Change it on the list of players
       - Change it on its role list
       - Modify the entry on the roles map
    */

    if (this.running && this.players.indexOf(oldNick) >= 0) {
        this.players[this.players.indexOf(oldNick)] = newNick;

        if (this.roles[oldNick]) {
            var rolePlayersNick = this.rolePlayers[this.roles[oldNick]];
            rolePlayersNick[rolePlayersNick.indexOf(oldNick)] = newNick;

            this.roles[newNick] = this.roles[oldNick];
            this.roles[oldNick] = null;
        }
    }
};

Game.prototype.playerLeft = function playerLeft (player) {
    if (this.running && this.players.indexOf(player) >= 0) {
        if (this.isTurn(Game.TURN_JOINING)) {
            this.players.splice(this.players.indexOf(player));

            this._emit('leave', player, this.players.length);
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
    this.assignedRoles = false;

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
    this.assignedRoles = true;

    this.existingRoles = [];
    this.rolePlayers = {};
    this.roles = {};

    /* Define all wanted roles */
    var roles = []; // TODO

    /* Find out how many wolves */
    var numWolves = Math.floor(Math.max(1, (this.players.length + 4) / 5));

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

        /* Add the role to the existing roles */
        if (this.existingRoles.indexOf(role) < 0) {
            this.existingRoles.push(role);
        }
    }

    /* Emit the apprpriate event */
    this._emit('roles');
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

    if (this.players.indexOf(player) < 0) {
        return;
    }

    var role = this.getPlayerRole(player);

    logger.verbose('%s [%s] dies (%s)', player, role, death.reason);

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
    if (this.players >= Game.MIN_PLAYERS) {
        this.startPhase(Game.PHASE_NIGHTTIME);
    }
};


Game.prototype.onStartPhaseNight = function onStartPhaseNight () {
    this.applyDeaths();

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
    if (this.lynchVictim) {
        this.addDeath(this.lynchVictim, Game.DEATH_LYNCH, true);
    }

    if (this.checkVictory()) {
        this.endGame();

    } else {
        this.startPhase(Game.PHASE_NIGHTTIME);
    }
};


Game.prototype.onStartTurnJoining = function onStartTurnJoining () {
};

Game.prototype.onEndTurnJoining = function onEndTurnJoining () {
    if (this.players.length >= Game.MIN_PLAYERS) {
        this.assignRoles();
    }
};


Game.prototype.onStartTurnWolves = function onStartTurnWolves () {
    this.wolvesVictim = null;
    this.killVictims = {};
    this.killVoted = {};
    this.totalKillVoted = [];
};

Game.prototype.onEndTurnWolves = function onEndTurnWolves () {
    var _this = this;

    var victims = utils.mostVotedMulti(this.killVictims);
    if (victims.length == 0) {
        victims = this.players.filter(function (player) {
            return _this.getRolePlayers(Game.ROLE_WOLF).indexOf(player) < 0;
        });
    }

    if (victims.length > 0) {
        this.wolvesVictim = _.shuffle(victims)[0];
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
    this.lynchTotalVotes = 0;
};

Game.prototype.onEndTurnLynching = function onEndTurnLynching () {
    /* Select the victim from the lynch votes */
    this.lynchVictim = utils.mostVoted(this.lynchVictims);
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

    if (!victim && victimName != BLANK) {
        throw new GameError('kill_victim_not_playing');
    }

    if (this.getPlayerRole(victim) == Game.ROLE_WOLF) {
        throw new GameError('kill_victim_wolf');
    }

    /* --- Everything OK --- */

    logger.verbose('KILL("%s")', name, victim);

    /* Add the player to the list of who voted */
    if (this.totalKillVoted.indexOf(player) < 0) {
        this.totalKillVoted.push(player);
    }

    /* Create a vote entry if not present (and not blank) */
    if (victimName != BLANK && !this.killVictims[victim]) {
        this.killVictims[victim] = 0;
    }

    var oldVictim = null;

    /* If there was already a vote from this wolf, remove it */
    if (this.killVoted[player]) {
        oldVictim = this.killVoted[player];

        this.killVictims[oldVictim]--;
        this.killVoted[player] = undefined;
    }

    /* If the current vote was not blank, add it */
    if (victimName != BLANK) {
        this.killVictims[victim]++;
        this.killVoted[player] = victim;
    }

    console.log(this.totalKillVoted);
    console.log(this.killVictims);

    this._emit('kill', player, victim, oldVictim);

    /* If everyone has voted and there is majority, end the turn */
    if (
        this.totalKillVoted.length >= this.getRolePlayers(Game.ROLE_WOLF).length &&
        utils.mostVoted(this.killVictims)
    ) {
        this.endTurn(Game.TURN_WOLVES);
    }
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
    if (target && !this.killVictims[target]) {
        this.lynchVictims[target] = 0;
    }

    /* If the current vote was not blank, add it */
    if (target) {
        this.lynchVictims[target]++;
        this.lynchVoted[player] = target;
    }

    this._emit('vote', player, target);

    /* If everyone has voted, end the turn */
    if (this.lynchTotalVotes >= this.players.length) {
        this.endTurn(Game.TURN_LYNCHING);
    }
};

/* ====================== */
/* === MODULE EXPORTS === */

module.exports = Game;