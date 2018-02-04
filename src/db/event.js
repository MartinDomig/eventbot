'use strict';

const moment = require('moment');
const Person = require('./person');
const PersonArray = require('./persons');

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
    var args = [JSON.stringify(event.creator), event.name, event.date, event.deadline, event.chatId];

    if(event._id) {
      sql = 'UPDATE Event SET creator = ?, name = ?, date = ?, deadline = ?, chatId = ? WHERE _id = ?';
      args.push(event._id);
    }
    this.db.run(sql, args, function(err, result) {
      if(err) {
        console.log('error saving event', err);
        reject(err);
        return;
      }
      if(!event._id) {
        event.participants = [];
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
      if(!row) {
        reject('Event does not exist');
        return;
      }
      row.creator = new Person(row.creator);
      row.participants = PersonArray(row.participants);
      row.isClosed = row.flags && row.flags.includes('C');
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
        console.log(participant.handle(), 'tried to register for', row.name, 'after deadline');
        resolve({ reply: true, event: row, text: 'Registration for ' + row.name + ' is closed, ' + participant.handle()});
        return;
      }

      var p = row.participants;
      for(var i = 0; i < p.length; i++) {
        if(p[i].equals(participant)) {
          console.log(participant.handle(), 'registered for', row.name, 'AGAIN');
          resolve({ reply: false, event: row, text: 'You are already registered for ' + row.name + ', ' + participant.handle() });
          return;
        }
      }
      p.push(participant);

      var sql = 'UPDATE Event SET participants = ? WHERE _id = ?';
      this.db.run(sql, [JSON.stringify(p), id], (err) => {
        if(err) {
          console.log(err);
          reject(err);
          return;
        }
        console.log(participant.handle(), 'registered for', row.name);
        resolve({ reply: true, event: row, text: participant.handle() + ' registered for ' + row.name });
      });
    });
  });
}

Event.prototype.removeParticipant = function(id, participant) {
  return new Promise((resolve, reject) => {
    this.get(id).then((row) => {
      if(row.deadline < moment()) {
        console.log(participant.handle(), 'tried to deregister from', row.name, 'after deadline');
        resolve({ reply: true, event: row, text: 'Registration for ' + row.name + ' is closed, ' + participant.handle() });
        return;
      }

      var p = row.participants;
      var index = -1;
      for(var i = 0; i < p.length; i++) {
        if(p[i].equals(participant)) {
          index = i;
          break;
        }
      }
      if(index < 0) {
        console.log(participant.handle(), 'deregistered from', row.name, 'but was not on');
        resolve({ reply: true, event: row, text: 'You were not registered for ' + row.name + ', ' + participant.handle() });
        return;
      }

      p.splice(index, 1);
      var sql = 'UPDATE Event SET participants = ? WHERE _id = ?';
      this.db.run(sql, [JSON.stringify(p), id], (err) => {
        if(err) {
          console.log(err);
          reject(err);
          return;
        }
        console.log(participant.handle(), 'deregistered from', row.name);
        resolve({ reply: true, event: row, text: participant.handle() + ' is no longer registered for ' + row.name });
      });
    });
  });
}

Event.prototype.delete = function(id, sender) {
  return new Promise((resolve, reject) => {
    this.get(id).then((row) => {
      if(!sender.equals(row.creator) && sender.id != process.env.OWNER_ID) {
        console.log(sender.fullname, 'tried to delete', row.name);
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
        console.log(sender.fullname, 'deleted', row.name);

        var msg = row.name + ' was canceled by ' + sender.handle();
        if(row.participants.length) {
          msg += '\nParticipants were: ' + row.participants.map((p) => { return p.handle(); }).join(', ');
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

Event.prototype.getAll = function(chatId, person) {
  return new Promise((resolve, reject) => {
    var sql = 'SELECT * FROM Event WHERE ';
    var args = [];
    if(person && chatId === 0) {
      if(person.id != process.env.OWNER_ID) {
        sql += 'creator LIKE ?';
        args.push('%"id":' + person.id + '%');
      } else {
        sql += '1';
      }
    } else {
      sql += 'chatId = ?';
      args.push(chatId);
    }
    this.db.all(sql, args, (err, rows) => {
      if(err) {
        reject(err);
        return;
      }
      for(var i = 0; i < rows.length; i++) {
        rows[i].creator = new Person(rows[i].creator);
        rows[i].participants = PersonArray(rows[i].participants);
        rows[i].isClosed = rows[i].flags && rows[i].flags.includes('C');
      }
      resolve(rows);
    });
  });
}

Event.prototype.getAll2 = function(chatId, creator) {
  return new Promise((resolve, reject) => {
    var sql = 'SELECT * FROM Event WHERE creator LIKE ? ';
    var args = ['%"id":' + creator.id + '%'];
    if(chatId !== 0) {
        sql += 'AND chatId = ?';
        args.push(chatId);
    }
    this.db.all(sql, args, (err, rows) => {
      if(err) {
        reject(err);
        return;
      }
      var result = [];
      for(var i = 0; i < rows.length; i++) {
        rows[i].creator = new Person(rows[i].creator);
        rows[i].participants = PersonArray(rows[i].participants);
        rows[i].isClosed = rows[i].flags && rows[i].flags.includes('C');
      }
      resolve(rows);
    });
  });
}

module.exports = Event;
