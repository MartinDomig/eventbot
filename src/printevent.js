const Markup = require('telegraf/markup');
const moment = require('moment');

printEvent = function(event, ctx, bot, isPublic) {
  var now = moment();

  var msg = event.name + ', organized by ' + event.creator.fullname + '\n'
    + 'Starts ' + now.to(event.date) + ' (' + moment(event.date).format("dddd MMM Do, h:mm a") + ' GMT)\n';
  var keys = undefined;

  if(!event.isClosed) {
    msg += 'Registration closes ' + now.to(event.deadline) + ' (' + moment(event.deadline).format("dddd MMM Do, h:mm a") + ' GMT)';
    if(isPublic) {
      keys = Markup.inlineKeyboard([
        Markup.callbackButton("I'm in", 'event-in#' + event._id),
        Markup.callbackButton("I'm out", 'event-out#' + event._id)
      ]).extra();
    }
  } else {
    msg += 'Registration is CLOSED.';
  }

  if(!isPublic) {
    keys = Markup.inlineKeyboard([
      Markup.callbackButton("Cancel", 'event-cancel#' + event._id),
      event.isClosed ?
        Markup.callbackButton("Open", 'open-event#' + event._id)
        : Markup.callbackButton("Close", 'close-event#' + event._id),
      Markup.callbackButton("Date", 'change-date#' + event._id),
      Markup.callbackButton("Deadline", 'change-deadline#' + event._id)
    ]).extra();
  }

  if(event.participants.length == 0) {
    msg += '\nNoone registered.';
  } else {
    msg += '\n' + event.participants.length + ' Registered:\n' + event.participants.map((p) => { return ' - ' + p.fullname }).join('\n');
  }

  if(ctx) {
    ctx.reply(msg, keys);
  } else if(bot) {
    bot.telegram.sendMessage(event.chatId, msg, keys);
  }
}

module.exports = printEvent
