var Promise = require('bluebird');
var sprintf = require('sprintf-js').sprintf;

var NickServ = function (client, nick, password) {
    this.client = client;
    this.nick = nick;
    this.password = password;

    this._pendingNickChanges = [];
    this._pendingStatuses = [];

    client.on('registered', this._onRegister.bind(this));
    client.on(      'nick', this._onNick.bind(this));
    client.on(    'notice', this._onNotice.bind(this));
};


NickServ.prototype._onRegister = function _onRegister (msg) {
    this.recover();
};

NickServ.prototype._onNotice = function _onNotice (from, to, text, msg) {
    var _this = this;

    if (from == 'NickServ' && text.indexOf('STATUS') == 0) {
        var pieces = text.split(/\s+/g);
        var processed = false;

        /* Process pending statuses */
        this._pendingStatuses.forEach(function (stpend) {
            if (!processed && stpend.nick == pieces[1]) {
                processed = true;

                stpend.processed = true;
                stpend.deferred.resolve(parseInt(pieces[2]));
            }
        });

        /* Remove processed statuses */
        this._pendingStatuses = this._pendingStatuses.filter(function (stpend) {
            return !stpend.processed;
        });
    }
};

NickServ.prototype._onNick = function _onNick (oldNick, newNick, channels, msg) {
    var _this = this;

    /* Process pending nick changes */
    this._pendingNickChanges.forEach(function (change) {
        if (change.oldNick == oldNick) {
            change.processed = true;
            change.deferred.resolve(newNick == change.newNick)
        }
    });

    /* Remove processed nick changes */
    this._pendingNickChanges = this._pendingNickChanges.filter(function (change) {
        return !change.processed;
    });

    /* Recover the nick if it changed */
    if (this.client.nick != this.nick) {
        this.recover();
    }
};


NickServ.prototype._changeNick = function (nick) {
    if (this.client.nick == nick) {
        return Promise.resolve(true);
    }

    var dfr = Promise.defer();

    this._pendingNickChanges.push({
        'oldNick': this.client.nick,
        'newNick': nick,
        'deferred': dfr
    });

    this.client.send('NICK', nick);

    return dfr.promise;
};


NickServ.prototype._identify = function () {
    var _this = this;

    return _this.status(_this.client.nick).then(function (status) {
        if (status == 3) {
            return 3;
        }

        _this.client.say('NickServ', sprintf('IDENTIFY %s', _this.password));

        return _this.status(_this.client.nick).then(function (status) {
            return status == 3;
        });
    });
};

NickServ.prototype._recover = function () {
    var _this = this;

    if (this.client.nick == this.nick) {
        return Promise.resolve(true);
    }

    return _this._changeNick(_this.nick).then(function (changed) {
        if (changed) {
            return true;
        }

        _this.client.say('NickServ', sprintf('RECOVER %s %s', _this.nick, _this.password));

        return Promise.delay(2500).then(function () {
            _this.client.say('NickServ', sprintf('RELEASE %s %s', _this.nick, _this.password));

            return Promise.delay(2500).then(function () {
                return _this._changeNick(_this.nick);
            });
        })
    });
}


NickServ.prototype.recover = function recover () {
    var _this = this;

    if (this._recoverPromise) {
        return this._recoverPromise;
    }

    var promise = this._recoverPromise = this._changeNick(this.nick).then(function (changed) {
        if (changed) {
            return true;
        }

        return _this._recover().then(function (recovered) {
            return _this._changeNick(this.nick);

        });

    }).then(function (recovered) {
        return _this._identify();

    }).finally(function () {
        this._recoverPromise = null;
    });

    return promise;
}


NickServ.prototype.status = function status (nick) {
    var dfr = Promise.defer();

    this._pendingStatuses.push({
        'nick': nick,
        'deferred': dfr
    });

    this.client.say('NickServ', sprintf('STATUS %s', nick));

    return dfr.promise;
}

/* Export a function that creates a new NickServ and associates it with the client */
module.exports = function nickserv (client, nick, password) {
    return new NickServ(client, nick, password);
};