/**
 * Message sent by a newcommer to its contact when it joins the network.
 * @private
 */
class MJoin {
  /**
   * Notify our neighbor to begin the connect its neighbor to us
   * @param {String} jobId identifier of the job, we will wait for its response
   * @private
   */
  constructor (jobId) {
    this.jobId = jobId
    this.type = 'MJoin'
  }
  /**
   * get type of the message
   * @type {String}
   * @private
   */
  static get type () {
    return 'MJoin'
  }
}

module.exports = MJoin
