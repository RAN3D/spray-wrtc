'use strict'

/**
 * Message sent by a newcommer to its contact when it joins the network.
 */
class MJoinBack {
  constructor (jobId, topology = false) {
    this.type = 'MJoinBack'
    this.jobId = jobId
    this.topology = topology
  };
  static get type () {
    return 'MJoinBack'
  }
};

module.exports = MJoinBack
