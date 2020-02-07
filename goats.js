import redis from 'redis'
import tmi from 'tmi.js'
import OBSWebSocket from 'obs-websocket-js'
import OBSView from './src/obs-view.js'
import PTZ from './src/ptz.js'

let redclient = redis.createClient({
    host: "127.0.0.1"
  })

const obs = new OBSWebSocket();

// CHANGE ME: set OBS Pass
obs.connect({address:'localhost:4444', password:'pass'})
.then(() => {
  console.log('OBS Connected')
})
.catch(err => {
  console.log('OBS Connection Failed')
  console.log(err)
})

// CHANGE ME: set PTZ cam IP/User/Pass
let ptz = new PTZ({
  redis:    redclient,
  name:     'goat-ptz',
  hostname: '192.168.11.97',
  username: 'user',
  password: 'password',
  version:  2
})

var obs_view = new OBSView(obs)

obs_view.addView('Yard',       ['yard'])
obs_view.addView('Bucks',      ['bucks'])
obs_view.addView('Does',       ['does'])
obs_view.addView('Ponds',      ['ponds','pond'])
obs_view.addView('Feeder',     ['feeder'])
obs_view.addView('Mobile',     ['mobile'])
obs_view.addView('Parlor',     ['parlor'])
obs_view.addView('Kidding',    ['kidding','kids'])
obs_view.addView('PTZ',        ['ptz'])

// twitch IRC options
// CHANGE ME: set OAUTH key
var twitch_channel = 'thegoatchick'
var opts = {
  identity: {
    username: twitch_channel,
    password: 'oauth:#####'
  },
  connection: {
    reconnect: true
  },
  channels: [
    twitch_channel
  ]
}

// Create a client with our options:
let chat = new tmi.client(opts);

chat.on('cheer', onCheerHandler);
chat.on('chat', onChatHandler);
chat.on('connected', onConnectedHandler);
chat.on('disconnected', onDisconnectedHandler);

// Connect to Twitch:
chat.connect();

function onCheerHandler (target, context, msg) {
  obs_view.processChat(msg);
}

function onChatHandler (target, context, msg) {
  if (context['display-name'] == "HerdBoss") return; // ignore the bot
  chatBot(msg, context)
  feedBot(msg, context)
}

// Called every time the bot connects to Twitch chat:
function onConnectedHandler (addr, port) {
  console.log(`* Connected to ${addr}:${port}`)
}

// Called every time the bot disconnects from Twitch:
function onDisconnectedHandler (reason) {
  console.log(`Disconnected: ${reason}`)
  process.exit(1)
}

function sayCoords (name, coords) {
  chat.say(twitch_channel, name + " Coordinates - PAN:" + coords.pan + " TILT:" + coords.tilt + " ZOOM:" + coords.zoom)
}

function sayForSubs () {
  chat.say(twitch_channel,"This command is reserved for Subscribers")
}

function moveToSettings(settings) {
    if (!settings) {
      chat.say(twitch_channel,"Personal shortcut not found.")
      return
    }
    for (let x = 0; x < 4; x++) {
      if (settings.obs[x]) obs_view.setWindow(x, settings.obs[x])
    }
    obs_view.updateOBS()
    if (settings.ptz) ptz.move(settings.ptz)
}

function saveShortcut(username, shortcut) {
  let _user = new Subscriber(redclient, username, 'goat')
  let _obs = [
      obs_view.obsWindows[0].item,
      obs_view.obsWindows[1].item,
      obs_view.obsWindows[2].item
    ]

  let _ptz = JSON.stringify(ptz.data.coords)
  let settings = {
    obs: _obs,
    ptz: JSON.parse(_ptz),
  }
  _user.saveShortcut(shortcut, settings)
}

function chatBot (str, context) {
  const words_regex = /!(\w+)\b/gm;
  const nums_regex = /[0-9]+/gm;
  let matches = str.toLowerCase().match(words_regex)
  let shortcut
  let user
  if (matches == null) return
  if (obs_view.cameraTimeout(context.username)) return
  matches.forEach(match => {
    switch (match) {
      case '!ptzcoords':
        sayCoords("PTZ", ptz.data.coords)
        return
      case '!ptzshortcuts':
        chat.say(twitch_channel,"PTZ: " + ptz.getShortcutList())
        return

      // SUBSCRIBER COMMANDS
      case '!cam':
      case '!camera':
        if (!context.subscriber) {
          sayForSubs()
          return
        }
        saveShortcut('undo', 'undo')
        obs_view.processChat(str);
        return;
      case '!undo':
        if (!context.subscriber) {
          sayForSubs()
          return
        }
        user = new Subscriber(redclient, 'undo', 'rooster')
        user.getShortcut('undo', settings => {
          moveToSettings(settings)
        })
        chat.say(twitch_channel,"but I liked it...")
        return
      case '!fav':
        if (!context.subscriber) {
          sayForSubs()
          return
        }
        saveShortcut('undo', 'undo')
        shortcut = str.substring(5)
        user = new Subscriber(redclient, context.username, twitch_channel)
        user.getShortcut(shortcut, settings => {
          moveToSettings(settings)
        })
        return
      case '!favsave':
        if (!context.subscriber) {
          sayForSubs()
          return
        }
        shortcut = str.substring(8)
        saveShortcut(context.username, shortcut)
        chat.say(twitch_channel,"Personal Shortcut Updated: " + shortcut)
        return
      case '!ptz':
        if (!context.subscriber) {
          sayForSubs()
          return
        }
        saveShortcut('undo', 'undo')
        ptz.command(str);
        return;


      // MOD COMMANDS
      case '!mute':
        if (context.mod) {
          obs.send('SetMute', {'source':'Audio', 'mute':true})
        }
        return;
      case '!unmute':
        if (context.mod) {
          obs.send('SetMute', {'source':'Audio', 'mute':false})
        }
        return;
      case '!stop':
        if (context.mod) {
          chat.say(twitch_channel,"Stopping")
          obs.send('StopStreaming')
        }
        return;
      case '!start':
        if (context.mod) {
          chat.say(twitch_channel,"Starting")
          obs.send('StartStreaming')
        }
        return;
      case '!restart':
        if (context.mod) {
          chat.say(twitch_channel,"Stopping")
          obs.send('StopStreaming')
          setTimeout(function(){chat.say(twitch_channel,":Z Five")},  5000)
          setTimeout(function(){chat.say(twitch_channel,":\\ Four")}, 6000)
          setTimeout(function(){chat.say(twitch_channel,";p Three")}, 7000)
          setTimeout(function(){chat.say(twitch_channel,":) Two")},   8000)
          setTimeout(function(){chat.say(twitch_channel,":D One")},   9000)
          setTimeout(function(){
            chat.say(twitch_channel,"Starting")
            obs.send('StartStreaming')
          }, 10000)
        }
        return;

      case '!ptzsave':
        if (context.mod) {
          shortcut = str.substring(7)
          ptzca.saveShortcut(shortcut)
          chat.say(twitch_channel,"PTZ Shortcut Updated: " + shortcut)
        }
        return;
    }
  })
}
