/**
 * Message that signals the departure of the sender.
 * @private
 */
class MLeave {
  /**
   * @private
   */
  constructor () {
    this.type = 'MLeave'
  }
  /**
   * get type of the message
   * @type {String}
   * @private
   */
  static get type () {
    return 'MLeave'
  }
}

module.exports = MLeave
