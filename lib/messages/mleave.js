'use strict'

/**
 * Message that signals the departure of the sender.
 */
class MLeave {
  constructor () {
    this.type = 'MLeave'
  }
  static get type () {
    return 'MLeave'
  }
}

module.exports = MLeave
