/**
 * Message requesting an exchange of neighborhood.
 * @private
 */
class MExchange {
  /**
     * @param {string} id The identifier of the peer.
     * @private
     */
  constructor (id) {
    this.id = id
    this.type = 'MExchange'
  }
  /**
   * get type of the message
   * @type {String}
   * @private
   */
  static get type () {
    return 'MExchange'
  }
}

module.exports = MExchange
