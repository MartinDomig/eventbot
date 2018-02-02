const Markup = require('telegraf/markup');
const moment = require('moment');

printEvent = function(event, ctx, bot) {
  var now = moment();

  var msg = event.name + ', organized by ' + event.creator.fullname + '\n'
    + 'Starts ' + now.to(event.date) + ' (' + moment(event.date).format("dddd MMM Do, h:mm a") + ' GMT)\n';
  var keys = undefined;

  if(now < event.deadline) {
    msg += 'Registration closes ' + now.to(event.deadline) + ' (' + moment(event.deadline).format("dddd MMM Do, h:mm a") + ' GMT)';
    keys = Markup.inlineKeyboard([
      Markup.callbackButton("I'm in", 'event-in#' + event._id),
      Markup.callbackButton("I'm out", 'event-out#' + event._id)
    ]).extra();
  } else {
    msg += 'Registration is CLOSED.';
  }

  if(event.participants.length == 0) {
    msg += '\nNoone registered.';
  } else {
    msg += '\n' + event.participants.length + ' Registered: ' + event.participants.map((p) => { return p.fullname }).join(', ');
  }

  if(ctx) {
    ctx.reply(msg, keys);
  } else if(bot) {
    bot.telegram.sendMessage(event.chatId, msg, keys);
  }
}

module.exports = printEvent
