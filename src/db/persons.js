'use strict';

const Person = require('./person');

var PersonArray = function(data) {
  if(!data) {
    return [];
  }

  var json = data;
  if(typeof(data) === 'string') {
    json = JSON.parse(data);
  }

  var result = [];
  if(Array.isArray(json)) {
    for(var i = 0; i < json.length; i++) {
      result.push(new Person(json[i]));
    }
  } else {
    result.push(new Person(json));
  }
  return result;
}

module.exports = PersonArray;
