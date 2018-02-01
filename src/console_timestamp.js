'use strict';

console.log = (function() {
  var console_log = console.log;

  var pad = function(digits, value) {
    var v = String(value);
    while(v.length < digits) {
      v = '0' + v;
    }
    return v;
  }

  return function() {
    var now = new Date();
    var hours = pad(2, now.getHours());
    var minutes = pad(2, now.getMinutes());
    var seconds = pad(2, now.getSeconds());
    var month = pad(2, now.getMonth() + 1);
    var day = pad(2, now.getDate());
    var ms = pad(3, now.getMilliseconds());
    var timeStr = now.getFullYear() + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds + '.' + ms;

    var args = [];
    args.push(timeStr);
    for(var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    console_log.apply(console, args);
  };
})();
