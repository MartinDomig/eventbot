const Scene = require('telegraf/scenes/base');
const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');
const Stage = require('telegraf/stage');
const { enter, leave } = Stage;
const Chrono = require('chrono-node');
const moment = require('moment');
const printEvent = require('./printevent');

var NewEvent = function(db) {
  this.eventMap = {};

  var dateStr = function(d) {
    return moment(d).format("dddd MMM Do, h:mm a");
  }

  var cancelKeyboard = Markup.inlineKeyboard([Markup.callbackButton('Cancel', 'cancel')]).extra();

  var cancelEvent = function(ctx) {
    if(this.eventMap[ctx.message.chat.id + '_' + ctx.message.from.username]) {
      delete this.eventMap[ctx.message.chat.id + '_' + ctx.message.from.username];
      ctx.reply('OK, never mind.');
      ctx.scene.leave();
    }
  };

  const newEvent = new Scene('new-event');
  newEvent.enter((ctx) => {
    ctx.reply('Ahoy @' + ctx.message.from.username + ', a new event! What should we call it?');
  });
  newEvent.on('text', (ctx) => {
    if(ctx.message.text.trim() == '') {
      cancelEvent(ctx);
      return;
    }
    var event = {
      creator: ctx.message.from.username,
      name: ctx.message.text.trim(),
      chatId: ctx.message.chat.id
    }
    this.eventMap[ctx.message.chat.id + '_' + ctx.message.from.username] = event;
    ctx.scene.enter('new-event-2');
  });

  const newEvent2 = new Scene('new-event-2');
  newEvent2.enter((ctx) => {
    var event = this.eventMap[ctx.message.chat.id + '_' + ctx.message.from.username];
    if(!event) return;
    ctx.reply("What's the date for " + event.name + ", @" + ctx.message.from.username + "?");
  });
  newEvent2.on('text', (ctx) => {
    var event = this.eventMap[ctx.message.chat.id + '_' + ctx.message.from.username];
    if(!event) return;

    if(ctx.message.text.trim() == '') {
      cancelEvent(ctx);
      return;
    }

    if(!event.date) {
      event.date = Chrono.parseDate(ctx.message.text);
      if(event.date == null) {
        ctx.reply("I don't understand, try something like 'Saturday 8pm', @" + ctx.message.from.username + ".");
        return;
      } else if(event.date < moment()) {
        delete event.date;
        ctx.reply("The date must be in the future, @" + ctx.message.from.username + ".");
        return;
      }
      ctx.scene.enter('new-event-3');
    }
  });

  const newEvent3 = new Scene('new-event-3');
  newEvent3.enter((ctx) => {
    var event = this.eventMap[ctx.message.chat.id + '_' + ctx.message.from.username];
    if(!event) return;
    ctx.reply("What's the registration deadline for " + event.name + ", @" + ctx.message.from.username + "?");
  });
  newEvent3.on('text', (ctx) => {
    var event = this.eventMap[ctx.message.chat.id + '_' + ctx.message.from.username];
    if(!event) return;

    if(ctx.message.text.trim() == '') {
      cancelEvent(ctx);
      return;
    }

    if(!event.deadline) {
      event.deadline = Chrono.parseDate(ctx.message.text);
      if(event.deadline == null) {
        ctx.reply("I don't understand, try something like 'Tomorrow 1pm', @" + ctx.message.from.username + ".");
        return;
      } else if(event.deadline < moment()) {
        delete event.deadline;
        ctx.reply("The deadline must be in the future, @" + ctx.message.from.username + ".");
        return;
      } else if(event.deadline > event.date) {
        delete event.deadline;
        ctx.reply("The deadline cannot be after the event date, @" + ctx.message.from.username + ".");
        return;
      }
      db.createEvent(event).then((id) => {
        event._id = id;
        printEvent(event, ctx);
        delete this.eventMap[ctx.message.chat.id + '_' + ctx.message.from.username];
        ctx.scene.leave();
      }).catch((err) => {
        ctx.reply('Event creation failed! This should not happen.\n' + err);
        ctx.scene.leave();
      });
    }
  });

  return [newEvent, newEvent2, newEvent3];
}

module.exports = NewEvent;
