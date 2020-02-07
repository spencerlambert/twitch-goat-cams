import { Cam } from 'onvif'

export default class PTZ {
  constructor (options) {

    this.redis = options.redis
    this.name = options.name
    this.version = options.version || 1

    this.cam = new Cam({
      hostname: options.hostname,
      username: options.username,
      password: options.password
    }, err => {
      if (err) {
        console.log(err)
        console.log("Failed to conntect to camera: " + this.name)
      } else {
        console.log("Conntected to camera: " + this.name)
        //this.move(this.data.coords)
      }
    })

    this.redis.send_command("json.get", [this.name], (err, res) => {
      if (err) {
        console.log(err)
        return
      }
      if (!res) {
        // initialize object
        this.data = {
          coords: {
            pan: 240,
            tilt: 20,
            zoom: 50
          },
          shortcuts: {}
        }
        this.redis.send_command("json.set", [this.name, ".", JSON.stringify(this.data)], (err, res) => {
          if (err) console.log(err)
        })
      } else {
        this.data = JSON.parse(res)
        //console.log(JSON.stringify(this.data, null, 2))
      }
    })

    this.pan_regex = /\b(p|pan|right|left|r|l) ?(\+|-)? ?([0-9]{1,3})/gm
    this.tilt_regex = /\b(t|tilt|down|up|d|u) ?(\+|-)? ?([0-9]{1,3})/gm
    this.zoom_regex = /\b(z|zoom|in|out|i|o) ?(\+|-)? ?([0-9]{1,3})/gm

    this.shortcuts_regex = /\b(\w+)\b/gm

  }

  getShortcutList () {
    let shortcuts = ""
    Object.keys(this.data.shortcuts).forEach(item => {
      shortcuts = shortcuts + item + " "
    })
    return shortcuts
  }


  saveShortcut (shortcut) {
    let str = shortcut.toLowerCase().trim()
    if (str.indexOf(' ') >= 0) return
    this.redis.send_command("json.set", [this.name, ".shortcuts." + str, JSON.stringify(this.data.coords)], (err, res) => {
      if (err) console.log(err)
    })
    // make copy
    let json = JSON.stringify(this.data.coords)
    this.data.shortcuts[str] = JSON.parse(json)
  }

  calcPan (pan) {
    let v = Number(pan)

    if (v < 0) v = 0
    if (v > 360) v = 360

    // process user set limits

    this.data.coords.pan = v
    if (this.version == 2) {
      if (v <= 180) {
        return Number((v * 0.0055555).toFixed(2)) 
      } else {
        v = v - 180
        return Number(((v * 0.0055555) - 1).toFixed(2))      
      }
    } else {
      return Number(((v * 0.0055555) - 1).toFixed(2))      
    }
  }

  calcTilt (tilt) {
    let v = Number(tilt)

    if (v < 0) v = 0
    if (v > 90) v = 90

    // process user set limits

    this.data.coords.tilt = v
    if (this.version == 2) {
      return Number((((v * 0.0222222) - 1) * - 1).toFixed(2))
    } else {
      return Number(((v * 0.0222222) - 1).toFixed(2))
    }
  }

  calcZoom (zoom) {
    let v = Number(zoom)

    if (v < 0) v = 0
    if (v > 100) v = 100

    // process user set limits

    this.data.coords.zoom = v
    return Number((v * 0.01).toFixed(2))
  }

  status() {
    this.cam.getStatus({}, (err, res) => {
      console.log(JSON.stringify(res, null, 2))
    })
  }

  move (coords) {
    this.cam.absoluteMove({
      x: this.calcPan(coords.pan),
      y: this.calcTilt(coords.tilt),
      zoom: this.calcZoom(coords.zoom)
    })
    this.redis.send_command("json.set", [this.name, ".coords", JSON.stringify(this.data.coords)], (err, res) => {
      if (err) console.log(err)
    })
  }

  command(txt) {

    let str_lower = txt.toLowerCase();

    // shortcuts
    let matches = str_lower.match(this.shortcuts_regex)
    if (matches == null) matches = []

    let first = true
    matches.forEach(match => {
      if (!first && this.data.shortcuts[match]) {
        this.move(this.data.shortcuts[match])
        return
      }
      first = false
    })

    // manual control
    let coords = this.data.coords
    let have_move = false;

    let p = [];
    let t = [];
    let z = [];
    if (str_lower.match(this.pan_regex) != null)
      p = [...this.pan_regex.exec(str_lower)];
    if (str_lower.match(this.tilt_regex) != null)
      t = [...this.tilt_regex.exec(str_lower)];
    if (str_lower.match(this.zoom_regex) != null)
      z = [...this.zoom_regex.exec(str_lower)];


    if (p.length != 0) {
      coords.pan = this.getVal(p, coords.pan);
      have_move = true;
    }

    if (t.length != 0) {
      coords.tilt = this.getVal(t, coords.tilt);
      have_move = true;
    }

    if (z.length != 0) {
      coords.zoom = this.getVal(z, coords.zoom);
      have_move = true;
    }

    if (have_move)
      this.move(coords);

  }

  getVal(matches, current) {
    let abs = true
    let is_pos = true
    let val = 0
    let pos = Number(current)
    matches.forEach(match => {
      if (!isNaN(match)) val = match
      switch (match) {
        case '-':
        case 'l':
        case 'left':
        case 'u':
        case 'up':
        case 'o':
        case 'out':
          abs = false
          is_pos = false
          break
        case '+':
        case 'r':
        case 'right':
        case 'd':
        case 'down':
        case 'i':
        case 'in':
          abs = false
          is_pos = true
          break
      }
    })

    if (abs) {
      pos = val
    } else {
      if (is_pos) {
        pos += Number(val)
      } else {
        pos -= Number(val)
      }
    }
    return pos
  }

}
