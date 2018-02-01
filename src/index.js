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

process.env.TZ = 'Europe/London';

require('./console_timestamp');

var db = require('./db/db');
var shutdown = function() {
  db.stop();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

listEvents = function(ctx) {
  if(ctx.message.chat.type !== 'group') {
    ctx.reply('/list can only be used in a group chat.');
    return;
  }

  db.deleteOldEvents().then(() => {
    db.getEvents(ctx.message.chat.id).then((events) => {
      if(events.length == 0) {
        ctx.reply('Nothing going on at the moment. Add a new event with /new.');
        return;
      }
      for(var i = 0; i < events.length; i++) {
        printEvent(events[i], ctx);
      }
    })
  })
  .catch((err) => console.log(err));
}

deleteEvents = function(ctx) {
  if(ctx.message.chat.type !== 'group') {
    ctx.reply('/delete can only be used in a group chat.');
    return;
  }

  if(!ctx.message.from.username) {
    ctx.reply('You need to set a telegram username, mate.');
    return;
  }

  db.deleteOldEvents().then(() => {
    db.getEvents2(ctx.message.chat.id, ctx.message.from.username).then((events) => {
      if(events.length == 0) {
        ctx.reply('You do not have any open events.');
        return;
      }
      for(var i = 0; i < events.length; i++) {
        var event = events[i];

        var now = moment();

        var msg = event.name + ', organized by ' + event.creator + '\n'
          + 'Starts ' + now.to(event.date) + ' (' + moment(event.date).format("dddd MMM Do, h:mm a") + ')\n';
        var keys = undefined;

        if(now < event.deadline) {
          msg += 'Registration is open until ' + moment(event.deadline).format("dddd MMM Do, h:mm a");
        } else {
          msg += 'Registration is CLOSED.';
        }

        var p = event.participants ? event.participants.split('/') : [];
        if(p.length == 0) {
          msg += '\nNoone registered.';
        } else {
          msg += '\n' + p.length + ' Registered: ' + p.join(', ');
        }

        keys = Markup.inlineKeyboard([
          Markup.callbackButton("Cancel " + event.name, 'event-cancel#' + event._id),
        ]).extra();

        ctx.reply(msg, keys);
      }
    })
  })
  .catch((err) => console.log(err));
}

cancelEvent = function(ctx) {
  var id = ctx.match[0];
  id = id.substring(id.indexOf('#') + 1);
  var sender = ctx.update.callback_query.from.username;
  if(!sender) {
    return;
  }
  db.Event.delete(id, sender).then((r) => {
    if(r.reply) ctx.reply(r.text);
  }).catch((err) => console.log(err));
}

joinEvent = function(ctx) {
  var id = ctx.match[0];
  id = id.substring(id.indexOf('#') + 1);
  var sender = ctx.update.callback_query.from.username;
  if(!sender) {
    ctx.reply('You need to set a telegram username, mate.');
    return;
  }
  db.Event.addParticipant(id, sender).then((r) => {
    if(r.reply) ctx.reply(r.text);
  }).catch((err) => console.log(err));
}

leaveEvent = function(ctx) {
  var id = ctx.match[0];
  id = id.substring(id.indexOf('#') + 1);
  var sender = ctx.update.callback_query.from.username;
  if(!sender) {
    return;
  }
  db.Event.removeParticipant(id, sender).then((r) => {
    if(r.reply) ctx.reply(r.text);
  }).catch((err) => console.log(err));
}

getHelpText = function() {
  var msg = [];
  msg.push('/new create a *new event*');
  msg.push('/list show *upcoming events*');
  msg.push('/delete to cancel events that you created');
  msg.push('/help displays this message');
  return msg.join('\n');
}

getStartText = function(ctx) {
  var msg = [];
  msg.push("Ahoy! I'm a *event bot*. Nice to meet you.");
  msg.push('I can help you organize *events in a group chat*. If you want my help, just add me to your group and start adding events.');
  msg.push('Once I am in your group, you can use the /new or /add command to create a new event for that group. Once the event is created, people can register and deregister by just clicking on a button.');
  msg.push('/list will show all upcoming events, including the registration buttons if the registration deadline did not pass.');
  msg.push('Each event has a date and a registration deadline. Just before the deadline is reached (~30 minutes), the bot will send out a reminder about this event to the grouop. Once the deadline passed, the bot will mention all registered participants so that everyone can see who registered.');
  msg.push('To cancel an event, the *creator of that event* can use /cancel or /delete. Registered users will be mentioned in the cancel notification.');
  msg.push('/help gets you a list of available commands');
  msg.push("Now, add me to your group and let's go!");

  if(!ctx.message.from.username) {
    msg.push("Oh, one more thing: you have to set a telegram user name, otherwise I can't work wit you.");
  }

  return msg.join('\n\n');
}

startNewEvent = function(ctx) {
  if(ctx.message.chat.type !== 'group') {
    ctx.reply('/new can only be used in a group chat.');
    return;
  }
  if(!ctx.message.from.username) {
    ctx.reply('You need to set a telegram username, mate.');
    return;
  }

  ctx.scene.enter('new-event');
}

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.telegram.getMe().then((botInfo) => { bot.options.username = botInfo.username });
bot.use(session());

var NewEvent = require('./newevent');
var stages = NewEvent(db);

const stage = new Stage(stages, { ttl: 30 });
bot.use(stage.middleware());
bot.command('new', (ctx) => startNewEvent(ctx));
bot.command('add', (ctx) => startNewEvent(ctx));
bot.command('list', (ctx) => listEvents(ctx));
bot.command('delete', (ctx) => deleteEvents(ctx));
bot.command('cancel', (ctx) => deleteEvents(ctx));
bot.command('help', (ctx) => ctx.replyWithMarkdown(getHelpText()));
bot.command('start', (ctx) => ctx.replyWithMarkdown(getStartText(ctx)));

bot.action(/event-in#.+/, (ctx) => joinEvent(ctx));
bot.action(/event-out#.+/, (ctx) => leaveEvent(ctx));
bot.action(/event-cancel#.+/, (ctx) => cancelEvent(ctx));

var eventNotifier = function() {
  const ONE_MINUTE = 1000 * 60;
  const ONE_HOUR = ONE_MINUTE * 60;

  db.deleteOldEvents().then(() => {
    db.getEvents().then((events) => {
      var now = moment();
      for(var i = 0; i < events.length; i++) {
        var event = events[i];
        var flags = event.flags ? event.flags : '';

        if(!flags.includes(1) && now > event.deadline - ONE_HOUR) {
          flags += '1';
          console.log('Sending registration reminder for', event.name);
          printEvent(event, null, bot);
          bot.telegram.sendMessage(event.chatId, "Registration will CLOSE IN 1 HOUR");
        }

        if(!flags.includes(2) && now > event.deadline) {
          flags += '2';

          var msg = "@" + event.creator + " registration for " + event.name + " is now CLOSED.";
          var p = event.participants ? event.participants.split('/') : [];
          if(p.length == 0) {
            msg += " Nobody registered.";
          } else {
            msg += "\n" + p.length + " registered: " + p.map((e) => { return '@' + e; }).join(', ');
          }
          console.log('Sending registration info for', event.name);
          bot.telegram.sendMessage(event.chatId, msg);
        }

        if(!flags.includes(3) && now > event.date - ONE_MINUTE * 30) {
          flags += '3';

          var p = event.participants ? event.participants.split('/') : [];
          if(p.length > 0) {
            var msg = event.name + " will start in 30 minutes, get ready!";
            msg += "\n" + p.length + " registered: " + p.map((e) => { return '@' + e; }).join(', ');
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
