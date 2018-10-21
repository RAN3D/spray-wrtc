'use strict'

/**
 * Message requesting an exchange of neighborhood.
 */
class MExchange {
  /**
     * @param {string} id The identifier of the peer.
     */
  constructor (id) {
    this.id = id
    this.type = 'MExchange'
  }
  static get type () {
    return 'MExchange'
  }
}

module.exports = MExchange
