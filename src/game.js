'use strict';
var _            = require('lodash');
var EventEmitter = require('eventemitter3');
var util         = require('util');

var logger = require('>/common/logger');
var config = require('>/common/config');

var MIN_PLAYERS = 5;

var Game = function Game () {
};

util.inherits(Game, EventEmitter);

/* === PLAYER ROLES === */
Game.ROLE_VILLAGER = 'villager';
Game.ROLE_WOLF     = 'werewolf';

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
Game.TIME_JOINING = 60;


/* =========================== */
/* === INFORMATION GETTERS === */

Game.prototype.findPlayer = function (player) {
    if (!this.player) {
        return null;
    }

    var idx = this.players.indexOf(player);

    if (idx < 0) {
        return null;
    }

    return this.players[idx];
};


/* ======================= */
/* === STATE MODIFIERS === */

Game.prototype.startGame = function startGame () {
    this._interval = setInterval(this.tick.bind(this), 1000);
    this._interval.unref();

    this.activeTurns = [];

    this.emit('start-game');

    this.startPhase(Game.PHASE_PREPARATION);
    this.startTurn(Game.TURN_JOINING, Game.TIME_JOINING);
};

Game.prototype.endGame = function endGame () {
    clearInterval(this._interval);
    this._interval = null;

    this.emit('end-game');
};

Game.prototype.startPhase = function startPhase (phase) {
    var now = new Date();

    this.phase = phase;
    this.phaseEndTime = now + 5000;

    this.emit('start-phase', phase);
    this.emit('start-phase:' + phase);
};

Game.prototype.endPhase = function endPhase () {
    this.phase = null;

    this.emit('end-phase', this.phase);
    this.emit('end-phase:' + this.phase);
};

Game.prototype.startTurn = function startTurn (turn, time) {
    var now = Date.now();

    this.activeTurns.push(turn);
    this.turnEndTimes[turn] = now + time * 1000;

    this.emit('start-turn', turn);
    this.emit('start-turn:' + turn);
};

Game.prototype.endTurn = function endTurn (turn) {
    this.activeTurns.splice(this.activeTurns.indexOf(phase), 1);

    this.emit('end-turn', this.turn);
    this.emit('end-turn:' + this.turn);
};


/* ======================= */
/* === GAME MANAGEMENT === */

Game.prototype.tick = function tick () {
    var now = Date.now();

    /* End phase at its time if no turn is active */
    if (now >= this.phaseEndTime && this.activeTurns.length == 0) {
        this.endPhase();
    }
};


/* ================== */
/* === PLAYER ACTIONS */

Game.prototype.join = function join (name) {
    var player = this.findPlayer(name);

    if (player) {
        throw new Exception('join_already_in');
    }

    this.emit('join', player);
};


/* ====================== */
/* === MODULE EXPORTS === */

module.exports = Game;