'use strict';

function GrumpyDB() {
  this.sqlite3 = require('sqlite3').verbose();

  this.start();
}

GrumpyDB.prototype.start = function() {
  console.log('Database starting up');

  this.db = new this.sqlite3.Database('grumpbot.db', (err) => {
    if(err) {
      console.log('Database connection error', err);
      return;
    }
    console.log('Database connection established');

    var E = require('./event');
    this.Event = new E(this);
  });
}

GrumpyDB.prototype.stop = function() {
  console.log('Database shutting down');
  this.db.close();
}

GrumpyDB.prototype.createEvent = function(e) {
  return this.Event.create(e);
}

GrumpyDB.prototype.getEvents = function(chatId) {
  return this.Event.getAll(chatId);
}

GrumpyDB.prototype.getEvents2 = function(chatId, creator) {
  return this.Event.getAll2(chatId, creator);
}

GrumpyDB.prototype.deleteOldEvents = function() {
  return this.Event.deleteOld();
}

module.exports = new GrumpyDB();
