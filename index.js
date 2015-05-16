#!/usr/bin/env node
var crashit = require('crashit');

var config = require('./config');
var logger = require('./logger');

var Bot = require('./bot');

crashit.addHook(function (cause) {
    logger.warn('Crashing:', cause);
});

crashit.handleSignals(['SIGINT', 'SIGTERM'], true);
crashit.handleUncaught(true);

var bot = new Bot({
    'host': config.host,
    'nick': config.nick,
    'channel': config.channel,
    'channelWolves': config.channelWolves,
    'nickservPassword': config.nickservPassword
});

crashit.addHook(function () {
    bot.stop();
});

bot.start();
