/**
 * Message sent by a newcommer to its contact when it joins the network.
 * @private
 */
class MJoinBack {
  /**
   * Construct a MJoinBack message to notify the joining peer that we finish to add all arcs from our neighbor to him
   * @param {String}  jobId            identifier of the job
   * @param {Boolean} [topology=false] if it is a 2-peer network or not
   * @param {Number} [arcs=0] Number of arcs created
   * @private
   */
  constructor (jobId, topology = false, arcs = 0) {
    this.type = 'MJoinBack'
    this.jobId = jobId
    this.topology = topology
    this.arcs = 0
  }
  /**
   * get type of the message
   * @type {String}
   * @private
   */
  static get type () {
    return 'MJoinBack'
  }
}

module.exports = MJoinBack
