const Scene = require('telegraf/scenes/base');
const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');
const Stage = require('telegraf/stage');
const { enter, leave } = Stage;
const Chrono = require('chrono-node');
const moment = require('moment');
const printEvent = require('./printevent');
const Person = require('./db/person');

var NewEvent = function(db, eventMap) {
  this.eventMap = eventMap;

  var key = function(ctx) {
    return '#' + ctx.message.chat.id + '_' + ctx.message.from.id;
  }

  const newEvent = new Scene('new-event');
  newEvent.enter((ctx) => {
    var p = new Person(ctx.message.from);
    ctx.reply('Ahoy ' + p.handle() + ', a new event! What should we call it?');
  });
  newEvent.on('text', (ctx) => {
    var event = {
      creator: new Person(ctx.message.from),
      name: ctx.message.text.trim(),
      chatId: ctx.message.chat.id
    }
    this.eventMap[key(ctx)] = event;
    ctx.scene.enter('new-event-2');
  });

  const newEvent2 = new Scene('new-event-2');
  newEvent2.enter((ctx) => {
    var event = this.eventMap[key(ctx)];
    if(!event) return;
    var p = new Person(ctx.message.from);
    ctx.reply("What's the date for " + event.name + ", " + p.handle() + "?");
  });
  newEvent2.on('text', (ctx) => {
    var event = this.eventMap[key(ctx)];
    if(!event) return;

    var p = new Person(ctx.message.from);
    if(!event.date) {
      event.date = Chrono.parseDate(ctx.message.text);
      if(event.date == null) {
        ctx.reply("I don't understand, try something like 'Saturday 8pm', " + p.handle() + ".");
        return;
      } else if(event.date < moment()) {
        delete event.date;
        ctx.reply("The date must be in the future, " + p.handle() + ".");
        return;
      }
      ctx.scene.enter('new-event-3');
    }
  });

  const newEvent3 = new Scene('new-event-3');
  newEvent3.enter((ctx) => {
    var event = this.eventMap[key(ctx)];
    if(!event) return;

    var p = new Person(ctx.message.from);
    ctx.reply("What's the registration deadline for " + event.name + ", " + p.handle() + "?");
  });
  newEvent3.on('text', (ctx) => {
    var event = this.eventMap[key(ctx)];
    if(!event) return;

    var p = new Person(ctx.message.from);
    if(!event.deadline) {
      event.deadline = Chrono.parseDate(ctx.message.text);
      if(event.deadline == null) {
        ctx.reply("I don't understand, try something like 'Tomorrow 1pm', " + p.handle() + ".");
        return;
      } else if(event.deadline < moment()) {
        delete event.deadline;
        ctx.reply("The deadline must be in the future, " + p.handle() + ".");
        return;
      } else if(event.deadline > event.date) {
        delete event.deadline;
        ctx.reply("The deadline cannot be after the event date, " + p.handle() + ".");
        return;
      }
      db.createEvent(event).then((id) => {
        event._id = id;
        printEvent(event, ctx, ctx.telegram, true);
        delete this.eventMap[key(ctx)];
        ctx.scene.leave();
      }).catch((err) => {
        ctx.reply('Event creation failed! This should not happen.\n' + err);
        ctx.scene.leave();
      });
    }
  });

  const chDate = new Scene('change-date');
  chDate.enter((ctx) => {
    var p = new Person(ctx.update.callback_query.from);
    var event = this.eventMap[p._id];
    ctx.reply("What's the new date for " + event.name + '?');
  });
  chDate.on('text', (ctx) => {
    var p = new Person(ctx.message.from);
    var event = this.eventMap[p._id];
    event.date = Chrono.parseDate(ctx.message.text);
    if(event.date == null) {
      ctx.reply("I don't understand, try something like 'Saturday 8pm'");
      return;
    } else if(event.date < moment()) {
      delete event.date;
      ctx.reply("The date must be in the future.");
      return;
    } else if(event.date < event.deadline) {
      delete event.date;
      ctx.reply("The date must not be before the registration deadline.");
      return;
    }

    db.createEvent(event).then(() => {
      var p = new Person(ctx.message.from);
      var dateStr = moment(event.date).format("dddd MMM Do, h:mm a");
      var msg = 'The date for ' + event.name + ' was changed to ' + dateStr + ' by ' + p.handle();
      ctx.reply(msg);
      ctx.telegram.sendMessage(event.chatId, msg);
      ctx.scene.leave();
    });
  });

  const chDeadline = new Scene('change-deadline');
  chDeadline.enter((ctx) => {
    var p = new Person(ctx.update.callback_query.from);
    var event = this.eventMap[p._id];
    ctx.reply("What's the new registration deadline for " + event.name + '?');
  });
  chDeadline.on('text', (ctx) => {
    var p = new Person(ctx.message.from);
    var event = this.eventMap[p._id];
    event.deadline = Chrono.parseDate(ctx.message.text);
    if(event.deadline == null) {
      ctx.reply("I don't understand, try something like 'Tomorrow 5pm'");
      return;
    } else if(event.deadline < moment()) {
      delete event.deadline;
      ctx.reply("The deadline must be in the future.");
      return;
    } else if(event.date < event.deadline) {
      delete event.deadline;
      ctx.reply("The deadline must not be after the date.");
      return;
    }

    db.createEvent(event).then(() => {
      var p = new Person(ctx.message.from);
      var dateStr = moment(event.deadline).format("dddd MMM Do, h:mm a");
      var msg = 'The registration deadline for ' + event.name + ' was changed to ' + dateStr + ' by ' + p.handle();
      ctx.reply(msg);
      ctx.telegram.sendMessage(event.chatId, msg);
      ctx.scene.leave();
    });
  });

  return [newEvent, newEvent2, newEvent3, chDate, chDeadline];
}

module.exports = NewEvent;
