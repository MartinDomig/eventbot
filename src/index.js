const Telegraf = require('telegraf');
const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Scene = require('telegraf/scenes/base');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const { enter, leave } = Stage;
const Chrono = require('chrono-node');
const moment = require('moment');
const printEvent = require('./printevent');
const Person = require('./db/person');

process.env.TZ = 'Europe/London';

require('./console_timestamp');

var eventMap = {};

var db = require('./db/db');
var shutdown = function() {
  db.stop();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('unhandledRejection', error => {
  console.log(error);
});

listEvents = function(ctx) {
  var isGroup = ctx.message.chat.type === 'group';
  db.deleteOldEvents().then(() => {
    db.getEvents(isGroup ? ctx.message.chat.id : 0, new Person(ctx.message.from)).then((events) => {
      if(events.length == 0) {
        ctx.reply('Nothing going on at the moment. Add a new event with /new.');
        return;
      }
      for(var i = 0; i < events.length; i++) {
        printEvent(events[i], ctx, ctx.telegram, isGroup);
      }
    })
  });
}

deleteEvents = function(ctx) {
  db.deleteOldEvents().then(() => {
    var isGroup = ctx.message.chat.type === 'group';
    db.getEvents2(isGroup ? ctx.message.chat.id : 0, new Person(ctx.message.from)).then((events) => {
      if(events.length == 0) {
        ctx.reply('You do not have any open events.');
        return;
      }
      for(var i = 0; i < events.length; i++) {
        var event = events[i];

        var now = moment();

        var msg = event.name + ', organized by ' + event.creator.fullname + '\n'
          + 'Starts ' + now.to(event.date) + ' (' + moment(event.date).format("dddd MMM Do, h:mm a") + ')\n';
        var keys = undefined;

        if(now < event.deadline) {
          msg += 'Registration is open until ' + moment(event.deadline).format("dddd MMM Do, h:mm a");
        } else {
          msg += 'Registration is CLOSED.';
        }

        if(event.participants.length == 0) {
          msg += '\nNoone registered.';
        } else {
          msg += '\n' + event.participants.length + ' Registered: ' + event.participants.map((p) => { return p.fullname; }).join(', ');
        }

        keys = Markup.inlineKeyboard([
          Markup.callbackButton("Cancel " + event.name, 'event-cancel#' + event._id),
        ]).extra();

        ctx.reply(msg, keys);
      }
    })
  });
}

cancelEvent = function(ctx) {
  var id = ctx.match[0];
  id = id.substring(id.indexOf('#') + 1);
  var sender = new Person(ctx.update.callback_query.from);
  db.Event.delete(id, sender).then((r) => {
    var isGroup = ctx.update.callback_query.message.chat.type === 'group';
    if(r.reply) {
      ctx.reply(r.text);
      if(!isGroup) {
        ctx.telegram.sendMessage(r.event.chatId, r.text);
      }
    }
  });
}

openEvent = function(ctx) {
  var id = ctx.match[0];
  id = id.substring(id.indexOf('#') + 1);
  var sender = new Person(ctx.update.callback_query.from);
  db.Event.get(id).then((event) => {
    if(!event.creator.equals(sender) && sender.id != process.env.OWNER_ID) {
      return;
    }
    var flags = event.flags.replace('C', '');
    db.Event.setFlags(event._id, flags).then(() => {
      var msg = event.name + ' registration re-opened by ' + sender.handle();
      ctx.telegram.sendMessage(event.chatId, msg);
      ctx.reply(msg);
    });
  });
}

closeEvent = function(ctx) {
  var id = ctx.match[0];
  id = id.substring(id.indexOf('#') + 1);
  var sender = new Person(ctx.update.callback_query.from);
  db.Event.get(id).then((event) => {
    if(!event.creator.equals(sender) && sender.id != process.env.OWNER_ID) {
      return;
    }
    var flags = event.flags + 'C';
    db.Event.setFlags(event._id, flags).then(() => {
      var msg = event.name + ' registration closed by ' + sender.handle();
      ctx.telegram.sendMessage(event.chatId, msg);
      ctx.reply(msg);
    });
  });
}

changeDate = function(ctx) {
  var id = ctx.match[0];
  id = id.substring(id.indexOf('#') + 1);
  var sender = new Person(ctx.update.callback_query.from);
  db.Event.get(id).then((event) => {
    if(!event.creator.equals(sender) && sender.id != process.env.OWNER_ID) {
      return;
    }
    eventMap[sender._id] = event;
    ctx.scene.enter('change-date');
  });
}

changeDeadline = function(ctx) {
  var id = ctx.match[0];
  id = id.substring(id.indexOf('#') + 1);
  var sender = new Person(ctx.update.callback_query.from);
  db.Event.get(id).then((event) => {
    if(!event.creator.equals(sender) && sender.id != process.env.OWNER_ID) {
      return;
    }
    eventMap[sender._id] = event;
    ctx.scene.enter('change-deadline');
  });
}

joinEvent = function(ctx) {
  var id = ctx.match[0];
  id = id.substring(id.indexOf('#') + 1);
  var sender = new Person(ctx.update.callback_query.from);
  db.Event.addParticipant(id, sender).then((r) => {
    if(r.reply) ctx.reply(r.text);
  });
}

leaveEvent = function(ctx) {
  var id = ctx.match[0];
  id = id.substring(id.indexOf('#') + 1);
  var sender = new Person(ctx.update.callback_query.from);
  db.Event.removeParticipant(id, sender).then((r) => {
    if(r.reply) ctx.reply(r.text);
  });
}

getHelpText = function(ctx) {
  var msg = [];
  var isGroup = ctx.message.chat.type === 'group';
  if(isGroup) {
    msg.push('/new create a *new event*');
    msg.push('/delete to cancel events that you created');
  }
  msg.push('/list show *upcoming events*');
  msg.push('/help displays this message');
  msg.push('/start gives you a description of what I can do');
  if(isGroup) {
    msg.push('You can change your events in a private chat with me.');
  }
  return msg.join('\n');
}

getStartText = function(ctx) {
  var msg = [];
  msg.push("Ahoy! I'm an *event bot*. Nice to meet you.");
  msg.push('I can help you organize *events in a group chat*. If you want my help, just add me to your group and start adding events.');
  msg.push('Once I am in your group, you can use the /new or /add command to create a new event. Once the event is created, people can easily register and deregister by just clicking on a button.');
  msg.push('/list will show all upcoming events, including the registration buttons.');
  msg.push('Each event has a date and a registration deadline. Just before the deadline is reached (~3 hours), the bot will send out a reminder about this event to the group. Once the deadline passed, the bot will no longer accept registrations, so you can make reservations, buy tickets or do whatever preparation needs to be done for your event.');
  msg.push('To cancel an event, the *creator of that event* can use /cancel or /delete. Registered users will be mentioned in the cancel notification.');
  msg.push('/help gets you a list of available commands');
  msg.push("Now, `add me to your group` and let's go!");
  return msg.join('\n\n');
}

startNewEvent = function(ctx) {
  if(ctx.message.chat.type !== 'group') {
    ctx.reply('/new can only be used in a group chat.');
    return;
  }
  ctx.scene.enter('new-event');
}

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.telegram.getMe().then((botInfo) => { bot.options.username = botInfo.username });
bot.use(session());

var NewEvent = require('./newevent');
var newEventStages = NewEvent(db, eventMap);
const newEventStage = new Stage(newEventStages, { ttl: 30 });
bot.use(newEventStage.middleware());

bot.command('new', (ctx) => startNewEvent(ctx));
bot.command('add', (ctx) => startNewEvent(ctx));
bot.command('list', (ctx) => listEvents(ctx));
bot.command('delete', (ctx) => deleteEvents(ctx));
bot.command('cancel', (ctx) => deleteEvents(ctx));
bot.command('help', (ctx) => ctx.replyWithMarkdown(getHelpText(ctx)));
bot.command('start', (ctx) => ctx.replyWithMarkdown(getStartText(ctx)));

bot.action(/event-in#.+/, (ctx) => joinEvent(ctx));
bot.action(/event-out#.+/, (ctx) => leaveEvent(ctx));
bot.action(/event-cancel#.+/, (ctx) => cancelEvent(ctx));

bot.action(/open-event#.+/, (ctx) => openEvent(ctx));
bot.action(/close-event#.+/, (ctx) => closeEvent(ctx));
bot.action(/change-date#.+/, (ctx) => changeDate(ctx));
bot.action(/change-deadline#.+/, (ctx) => changeDeadline(ctx));

var eventNotifier = function() {
  const ONE_MINUTE = 1000 * 60;
  const ONE_HOUR = ONE_MINUTE * 60;

  db.deleteOldEvents().then(() => {
    db.getEvents().then((events) => {
      var now = moment();
      for(var i = 0; i < events.length; i++) {
        var event = events[i];
        var flags = event.flags ? event.flags : '';

        if(!flags.includes(1) && !event.isClosed && now > event.deadline - ONE_HOUR * 3) {
          flags += '1';
          console.log('Sending registration reminder for', event.name);
          printEvent(event, null, bot, true);
          bot.telegram.sendMessage(event.chatId, "Registration will CLOSE " + now.to(event.deadline));
        }

        if(!flags.includes(2) && !event.isClosed && now > event.deadline) {
          flags += '2C';

          var msg = event.creator.handle() + " registration for " + event.name + " is now CLOSED.";
          if(event.participants.length == 0) {
            msg += " Nobody registered.";
          } else {
            msg += "\n" + event.participants.length + " registered: " + event.participants.map((e) => { return e.handle(); }).join(', ');
          }
          console.log('Sending registration info for', event.name);
          bot.telegram.sendMessage(event.chatId, msg);
        }

        if(!flags.includes(3) && now > event.date - ONE_MINUTE * 30) {
          flags += '3';

          if(event.participants.length > 0) {
            var msg = event.name + " will start " + now.to(event.date) + "!";
            msg += "\n" + event.participants.length + " registered: " + event.participants.map((e) => { return e.handle(); }).join(', ');
            console.log('Sending event reminder for', event.name);
            bot.telegram.sendMessage(event.chatId, msg);
          }
        }
        db.Event.setFlags(event._id, flags);
      }
    })
  });
}

setInterval(eventNotifier, 60000);

bot.startPolling();
