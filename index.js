#!/usr/bin/env node
var crashit = require('crashit');

var config = require('./config');
var logger = require('./logger');

var Bot = require('./bot');

crashit.handleSignals(['SIGINT', 'SIGTERM'], true);
crashit.handleUncaught(true);

var bot = new Bot({
    'host': config.irc.server,
    'nick': config.irc.nick,
    'channel': config.irc.channel,
    'channelWolves': config.irc.channelWolves,
    'nickserv': config.nickserv
});

crashit.addHook(function (cause) {
    logger.warn('Crashing:', cause);
})

crashit.addHook(function () {
    bot.stop();
});

bot.start();
