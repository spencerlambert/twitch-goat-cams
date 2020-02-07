export default class OBSView {
  constructor (obs) {

    this.obs = obs

    this.obsWindows = [
      {
        item: 'one',
        position: { alignment: 5, x: 0, y: 169 },
        scale: { x: 0.942187488079071, y: 0.9417344331741333 },
        visible: true,
      },{
        item: 'two',
        position: { alignment: 5, x: 1241, y: 46 },
        scale: { x: 0.528124988079071, y: 0.5284552574157715 },
        visible: true,
      },{
        item: 'three',
        position: { alignment: 5, x: 1241, y: 472 },
        scale: { x:  0.528124988079071, y: 0.5243902206420898 },
        visible: true,
      }]

    this.current = -1
    this.alias = []
  }

  processChat (msg) {
    const window_regex = /[1-2]+/gm
    const words_regex = /\b(\w+)\b/gm
    const letters_regex = /[a-z]+/gm

    // figure out what our window index is
    let window_index = 0
    let window_index_match = msg.match(window_regex)
    if (window_index_match != null) {
      window_index = Number(window_index_match[window_index_match.length - 1])
    }

    // check for matching alias
    let matches = msg.toLowerCase().match(words_regex)
    if (matches == null) return
    let hasChanges = false
    let obsName

    matches.forEach(match => {
      let keyword = match.match(letters_regex)
      if (keyword != null) {
        this.alias.forEach(alias => {
          if (alias.alias == keyword[0]) {
            obsName = alias.obsName
            hasChanges = true
          }
        })
      }
    })

    if (hasChanges) {
      this.setWindow(window_index, obsName)
      this.updateOBS()
    }

  }

  addView (obsName, aliases = []) {
    this.current++
    if (this.current > this.obsWindows.length - 1) {
      this.obsWindows[this.current] = {
        item: 'default',
        visible: false,
      }
    }
    this.obsWindows[this.current].item = obsName

    aliases.forEach(alias => {
      this.addAlias(alias, obsName)
    })
  }

  addAlias (alias, obsName) {
    alias = alias.toLowerCase();
    this.alias.push({
      alias,
      obsName,
    })
  }

  setWindow (index, name) {
    let current_index, old_name
    // get idex of where the view is currently
    for (var x=0; x<this.obsWindows.length; x++) {
      if (this.obsWindows[x].item == name) current_index = x
    }
    old_name = this.obsWindows[index].item
    // make swap
    this.obsWindows[index].item = name
    this.obsWindows[current_index].item = old_name
  }

  updateOBS () {
    this.obsWindows.forEach(camera => {
      this.obs.send('SetSceneItemProperties', camera)
    })
  }

  cameraTimeout(user) {
    switch (user.toLowerCase()) {
      // block users from using cams
      case 'matched-username':
        return true
    }
    return false
  }

}
