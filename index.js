#!/usr/bin/env node
var crashit = require('crashit');

var config = require('>/common/config');
var logger = require('>/common/logger');

var Bot = require('>/bot');

crashit.addHook(function (cause) {
    logger.warn('Crashing:', cause);
});

crashit.handleSignals(['SIGINT', 'SIGTERM'], true);
crashit.handleUncaught(true);

var bot = new Bot({
    'host': config.host,
    'port': config.port || 6667,
    'nick': config.nick,
    'channel': config.channelGame,
    'channelWolves': config.channelWolves,
    'channelTalk': config.channelTalk,
    'nickservPassword': config.nickservPassword
});

crashit.addHook(function () {
    bot.stop('I\'ll be back...');
});

bot.start(require('./package.json').version);
