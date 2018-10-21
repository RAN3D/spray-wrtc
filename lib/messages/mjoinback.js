'use strict'

/**
 * Message sent by a newcommer to its contact when it joins the network.
 */
class MJoinBack {
  constructor () {
    this.type = 'MJoinBack'
  };
  static get type () {
    return 'MJoinBack'
  }
};

module.exports = MJoinBack
