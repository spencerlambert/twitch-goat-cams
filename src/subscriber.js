export default class Subscriber {
  constructor (redis, username, stream) {
    this.redis = redis
    this.username = username.toLowerCase()
    this.stream = stream

    this.ready = false

    // get object
    this.redis.send_command("json.get", [this.username], (err, res) => {
      if (err) console.log(err)
      if (!res) {
        // new object
        this.data = {
          "goat": {
            "shortcuts": {},
          }
        }
        this.redis.send_command("json.set", [this.username, ".", JSON.stringify(this.data)], (err, res) => {
          if (err) console.log(err)
          this.ready = true
        })
      } else {
        this.data = JSON.parse(res)
        this.ready = true          
      }
    })

  }

  saveShortcut (shortcut, settings) {

    let _shortcut = shortcut
    let _settings = settings

    if (!this.ready) {
      setTimeout(() => {
        this.saveShortcut(_shortcut, _settings)
      }, 1)
      return
    }

    let str = _shortcut.toLowerCase().trim()
    if (str.indexOf(' ') >= 0) return
    this.redis.send_command("json.set", [this.username, `.${this.stream}.shortcuts.${str}`, JSON.stringify(_settings)], (err, res) => {
      if (err) console.log(err)
    })
    // make copy
    let json = JSON.stringify(_settings)
    this.data[this.stream].shortcuts[str] = JSON.parse(json)
  }

  getShortcut (shortcut, callback) {

    let _shortcut = shortcut
    let _callback = callback

    if (!this.ready) {
      setTimeout(() => {
        this.getShortcut(_shortcut, _callback)
      }, 1)
      return
    }
    let str = _shortcut.toLowerCase().trim()
    if (str.indexOf(' ') >= 0) return
    _callback(this.data[this.stream].shortcuts[str])
  }

}