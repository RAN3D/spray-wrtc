'use strict'

/**
 * Message sent by a newcommer to its contact when it joins the network.
 */
class MJoin {
  constructor (jobId) {
    this.type = 'MJoin'
    this.jobId = jobId
  }
  static get type () {
    return 'MJoin'
  }
}

module.exports = MJoin
