import tmi from 'tmi.js'
import OBSWebSocket from 'obs-websocket-js'
import OBSView from './src/obs-view.js'
import PTZ from './src/ptz.js'

const obs = new OBSWebSocket();

// CHANGE ME: set OBS Pass
obs.connect({address:'localhost:4444', password:'Thegoatchick'})
.then(() => {
  console.log('OBS Connected')
})
.catch(err => {
  console.log('OBS Connection Failed')
  console.log(err)
})

// CHANGE ME: set PTZ cam IP/User/Pass
let kids = new PTZ({
  hostname: '192.168.1.63',
  username: 'ptz',
  password: 'Password$$',
  version:  2
})

let does = new PTZ({
  hostname: '192.168.1.62',
  username: 'ptz',
  password: 'Password$$',
  version:  2
})

// Set up OBS window changer
var obs_view = new OBSView(obs)
obs_view.addView('Yard',       ['yard'])
obs_view.addView('Bucks',      ['bucks'])
obs_view.addView('Does',       ['does'])
obs_view.addView('Ponds',      ['ponds','pond'])
obs_view.addView('Feeder',     ['feeder'])
obs_view.addView('Mobile',     ['mobile'])
obs_view.addView('Parlor',     ['parlor'])
obs_view.addView('KiddingA',   ['kiddinga','kida'])
obs_view.addView('KiddingB',   ['kiddingb','kidb'])
obs_view.addView('Kids',       ['kids','ptz'])

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

function sayForSubs () {
  chat.say(twitch_channel,"This command is reserved for Subscribers")
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

      // SUBSCRIBER COMMANDS
      case '!cam':
      case '!camera':
        if (!context.subscriber) {
          sayForSubs()
          return
        }
        obs_view.processChat(str);
        return;
      case '!ptz':
      case '!kids':
        if (!context.subscriber) {
          sayForSubs()
          return
        }
        kids.command(str);
        return;
      case '!does':
        if (!context.subscriber) {
          sayForSubs()
          return
        }
        does.command(str);
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
    }
  })
}
