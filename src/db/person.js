'use strict';

var Person = function(data) {
  var json = data;
  if(typeof(data) === 'string') {
    if(data.startsWith('{')) {
      json = JSON.parse(data);
    } else {
      // backward compatibility: old databases stored users as username only
      json = {
        username: data,
        fullname: data
      }
    }
  }

  this.username = json.username;
  this.id = json.id;
  if(json.fullname) {
    this.fullname = json.fullname;
  } else if(json.first_name || json.last_name) {
    var a = [];
    if(json.first_name) {
      a.push(json.first_name);
    }
    if(json.last_name) {
      a.push(json.last_name);
    }
    this.fullname = a.join(' ');
  } else if(json.username) {
    this.fullname = json.username;
  }
  this._type = 'Person';
}

Person.prototype.equals = function(other) {
  if(other._type !== 'Person') {
    return false;
  }
  if(this.id && other.id) {
    return this.id === other.id;
  }
  if(this.username && other.username) {
    return this.username === other.username;
  }
  return false;
}

Person.prototype.handle = function() {
  if(this.username) {
    return '@' + this.username;
  }
  return this.fullname;
}

module.exports = Person;
