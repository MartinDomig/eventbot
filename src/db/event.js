'use strict';

const moment = require('moment');

var Event = function(db) {
    this.db = db.db;
    this.createTable();
};

Event.prototype.createTable = function() {
  var columns = [];
  columns.push('_id INTEGER PRIMARY KEY');
  columns.push('name TEXT');
  columns.push('creator TEXT');
  columns.push('date INTEGER');
  columns.push('deadline INTEGER');
  columns.push('chatId INTEGER');
  columns.push('flags TEXT');
  columns.push('participants TEXT');
  this.db.run('CREATE TABLE IF NOT EXISTS Event (' + columns.join(', ') + ')');
}

Event.prototype.create = function(event) {
  return new Promise((resolve, reject) => {
    var sql = 'INSERT INTO Event (creator, name, date, deadline, chatId) VALUES(?, ?, ?, ?, ?)';
    this.db.run(sql, [event.creator, event.name, event.date, event.deadline, event.chatId], function(err, result) {
      if(err) {
        console.log('error saving event', err);
        reject(err);
        return;
      }
      resolve(this.lastID);
    });
  });
}

Event.prototype.get = function(id) {
  return new Promise((resolve, reject) => {
    var sql = 'SELECT * FROM Event WHERE _id = ?';
    this.db.get(sql, [id], (err, row) => {
      if(err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

Event.prototype.setFlags = function(id, flags) {
  return new Promise((resolve, reject) => {
    var sql = 'UPDATE Event SET flags = ? WHERE _id = ?';
    this.db.get(sql, [flags, id], (err, row) => {
      if(err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

Event.prototype.addParticipant = function(id, participant) {
  return new Promise((resolve, reject) => {
    this.get(id).then((row) => {
      if(row.deadline < moment()) {
        console.log(participant, 'tried to register for', row.name, 'after deadline');
        resolve({ reply: true, event: row, text: 'Registration for ' + row.name + ' is closed, @' + participant});
        return;
      }
      var p = row.participants ? row.participants.split('/') : [];
      for(var i = 0; i < p.length; i++) {
        if(p[i] == participant) {
          console.log(participant, 'registered for', row.name, 'AGAIN');
          resolve({ reply: false, event: row, text: 'You are already registered for ' + row.name });
          return;
        }
      }
      p.push(participant);

      var sql = 'UPDATE Event SET participants = ? WHERE _id = ?';
      this.db.run(sql, [p.join('/'), id], (err) => {
        if(err) {
          console.log(err);
          reject(err);
          return;
        }
        console.log(participant, 'registered for', row.name);
        resolve({ reply: true, event: row, text: '@' + participant + ' registered for ' + row.name });
      });
    });
  });
}

Event.prototype.removeParticipant = function(id, participant) {
  return new Promise((resolve, reject) => {
    this.get(id).then((row) => {
      if(row.deadline < moment()) {
        console.log(participant, 'tried to deregister from', row.name, 'after deadline');
        resolve({ reply: true, event: row, text: 'Registration for ' + row.name + ' is closed, @' + participant});
        return;
      }

      var p = row.participants ? row.participants.split('/') : [];
      var i = p.indexOf(participant);
      if(i < 0) {
        console.log(participant, 'deregistered from', row.name, 'AGAIN');
        resolve({ reply: false, event: row, text: 'You were not registered for ' + row.name });
        return;
      }

      p.splice(i, 1);
      var sql = 'UPDATE Event SET participants = ? WHERE _id = ?';
      this.db.run(sql, [p.join('/'), id], (err) => {
        if(err) {
          console.log(err);
          reject(err);
          return;
        }
        console.log(participant, 'deregistered from', row.name);
        resolve({ reply: true, event: row, text: '@' + participant + ' is no longer registered for ' + row.name });
      });
    });
  });
}

Event.prototype.delete = function(id, sender) {
  return new Promise((resolve, reject) => {
    this.get(id).then((row) => {
      if(sender !== row.creator) {
        console.log(sender, 'tried to delete', row.name);
        reject('permission denied');
        return;
      }

      var sql = 'DELETE FROM Event WHERE _id = ?';
      this.db.run(sql, [id], (err) => {
        if(err) {
          console.log(err);
          reject(err);
          return;
        }
        console.log(sender, 'deleted', row.name);

        var msg = row.name + ' was canceled by @' + sender;
        var p = row.participants ? row.participants.split('/') : [];
        if(p.length) {
          msg += '\nParticipants were: ' + p.map((e) => { return '@' + e; }).join(', ');
        }

        resolve({ reply: true, event: row, text: msg });
      });
    });
  });
}

Event.prototype.deleteOld = function() {
  return new Promise((resolve, reject) => {
    var sql = 'DELETE FROM Event WHERE date < ?';
    this.db.all(sql, [Date.now()], (err, rows) => {
      if(err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

Event.prototype.getAll = function(chatId) {
  return new Promise((resolve, reject) => {
    var sql = 'SELECT * FROM Event';
    var args = [];
    if(chatId) {
      sql = 'SELECT * FROM Event WHERE chatId = ?';
      args.push(chatId);
    }
    this.db.all(sql, args, (err, rows) => {
      if(err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

Event.prototype.getAll2 = function(chatId, creator) {
  return new Promise((resolve, reject) => {
    var sql = 'SELECT * FROM Event WHERE chatId = ? AND creator = ? ORDER BY date';
    this.db.all(sql, [chatId, creator], (err, rows) => {
      if(err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

module.exports = Event;
