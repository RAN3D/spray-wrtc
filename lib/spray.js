'use strict'

const debug = (require('debug'))('spray-wrtc')
const N2N = require('n2n-wrtc').N2N
const lmerge = require('lodash.merge')

const PartialView = require('./partialview.js')

const MExchange = require('./messages/mexchange.js')
const MJoin = require('./messages/mjoin.js')
const MJoinBack = require('./messages/mjoinback.js')
const MLeave = require('./messages/mleave.js')

// const ExMessage = require('./exceptions/exmessage.js')
// const ExJoin = require('./exceptions/exjoin.js')

/**
 * Implementation of the random peer-sampling Spray.
 */
class Spray extends N2N {
  /**
     * You can pass other parameters such as webrtc options
     * @param {object} [options.spray = {}] Object with all options
     * @param {string} [options.spray.pid = 'spray-wrtc'] The identifier of this
     * protocol.
     * @param {number} [options.spray.delta] Every delta milliseconds, Spray shuffles
     * its partial view with its oldest neighbor.
     * @param {number} [options.spray.a = 1] The number of arcs at each peer converges
     * to a*log(N) + b, where N is the number of peers in the network.
     * @param {nubmer} [options.spray.b = 0] See above.
     */
  constructor (options = {}) {
    super(lmerge({
      spray: {
        protocol: 'spray-wrtc',
        delta: 1000 * 60 * 2,
        a: 1,
        b: 0
      }
    }, options))
    this.PID = this.options.spray.protocol
    this.PEER = this.id
    // #2 initialize the partial view containing ages
    this.partialView = new PartialView()
    // #3 periodic shuffling
    this.periodic = null
    this.on(this.options.spray.protocol, (id, message) => {
      this.___receive(id, message)
    })
    // #4 events
    this.on('out', (peerId) => {
      this._open(peerId)
    })
    this.on('close_out', (peerId) => {
      this._close(peerId)
    })
  }

  async connect (...Args) {
    return super.connect(...Args).then((id) => {
      if (id) {
        return this.send(this.options.spray.protocol, id, new MJoin()).then(() => {
          this._start() // start shuffling process
          this._inject(this.options.spray.a - 1, 0, id)
        }).catch(e => {
          throw new Error('Cannot contact the first peer: ', e)
        })
      } else {
        this._start() // start shuffling process
        return Promise.resolve()
      }
    })
  }

  /**
     * @private Start periodic shuffling.
     */
  _start (delay = this.options.spray.delta) {
    this.periodic = setInterval(() => {
      // this._exchange()
    }, delay)
  }

  /**
     * @private Stop periodic shuffling.
     */
  _stop () {
    clearInterval(this.periodic)
  }

  /**
     * @private Called each time this protocol receives a message.
     * @param {string} peerId The identifier of the peer that sent the message.
     * @param {object|MExchange|MJoin} message The message received.
     */
  ___receive (id, message) {
    if (message && message.type && message.type === MExchange.type) {
      this._onExchange(id, message)
    } else if (message && message.type && message.type === MJoin.type) {
      this._onJoin(id)
    } else if (message && message.type && message.type === MJoinBack.type) {
      this._injectReverse(2 * this.options.spray.a, 2 * this.options.spray.b, id)
    } else if (message && message.type && message.type === MLeave.type) {
      this._onLeave(id)
    }
  }

  /**
     * @private Behavior when a connection is ready to be added in the partial
     * view.
     * @param {string} peerId The identifier of the new neighbor.
     */
  _open (peerId) {
    debug('[%s] Open %s ===> %s', this.options.spray.protocol, this.PEER, peerId)
    this.partialView.add(peerId)
  }

  /**
     * @private Behavior when a connection is closed.
     * @param {string} peerId The identifier of the removed arc.
     */
  _close (peerId) {
    // if (this.partialView.has(peerId)) this.partialView.removeOldest(peerId)
    debug('[%s] Close %s =†=> %s', this.options.spray.protocol, this.PEER, peerId)
    // if (!this.view.livingOutview.exist(peerId) && this.partialView.has(peerId)) {
    //   this._onPeerDown(peerId)
    // }
  }

  /**
     * @private Behavior of the contact peer when a newcomer arrives.
     * @param {string} peerId The identifier of the newcomer.
     */
  _onJoin (peerId) {
    // cause of crash and rapid refresh
    // some connection can stay in the partialView after a crash
    // This appears in a 2-peers network where one of them refresh its "page".
    // We receive the join event before the 'close' event
    // we need to delete it before engaging the _onJoin process.
    // this._checkPartialView()
    if (this.partialView.size > 0) {
      // #1 all neighbors -> peerId
      debug('[%s] %s ===> join %s ===> %s neighbors', this.PID, peerId, this.PEER, this.partialView.size)
      const pv = []
      this.partialView.forEach((ages, neighbor) => {
        pv.push({ages, neighbor})
      })
      pv.reduce((acc, cur) => acc.then(() => {
        return new Promise((resolve, reject) => {
          cur.ages.reduce((a, c) => a.then(() => {
            return new Promise((res, rej) => { //eslint-disable-line
              this.connect4u(cur.neighbor, peerId).then(() => {
                res()
              }).catch(e => {
                console.error(e)
                rej(e)
              })
            })
          }), Promise.resolve())
        })
      }), Promise.resolve())
    } else {
      this.send(this.options.spray.protocol, peerId, new MJoinBack()).catch(e => {
        console.error(this.messages + 'cannot send back the MJonBack message.', e)
      })
      this._start()
    }
  }

  // /**
  //    * Leave the network. If time is given, it tries to patch the network before
  //    * leaving.
  //    * @param {number} [time = 0] The time (in milliseconds) given to this peer
  //    * to patch the network before trully leaving.
  //    */
  // leave (time = 0) {
  //   // ugly way
  //   const saveNITimeout = this.NI.options.timeout
  //   const saveNOTimeout = this.NO.options.timeout
  //   this.NI.options.timeout = time
  //   this.NO.options.timeout = time
  //
  //   // #0 stop shufflings
  //   this._stop()
  //   if (time > 0) {
  //     // #1 patch the network in total must remove a.log(N) + b arcs
  //     // inview -> this -> outview   becomes   inview -> outview
  //     // #A flatten the inview and the outview
  //     let inview = this.getInview()
  //     let flattenI = []
  //     inview.forEach((occ, peerId) => flattenI.push(peerId))
  //     let outview = this.getOutview()
  //     let flattenO = []
  //     outview.forEach((occ, peerId) => flattenO.push(peerId))
  //     // #B process the number of arc to save
  //     // (TODO) double check this proportion
  //     let toKeep = outview.size - this.options.a
  //     // #C bridge connections
  //     // (TODO) check more than 2 in flattenI and flattenO is ≠
  //     for (let i = 0 i < Math.floor(toKeep) ++i) {
  //       const rnI = Math.floor(Math.random() * flattenI.length)
  //       let different = flattenO
  //         .filter((peerId) => peerId !== flattenI[rnI])
  //       if (different.length > 0) {
  //         const rnO = Math.floor(Math.random() * different.length)
  //         this.connect(flattenI[rnI], different[rnO])
  //       }
  //     }
  //     // (TODO) add probabilistic bridging if toKeep is a floating number
  //
  //     flattenI.forEach((peerId) => {
  //       this.send(peerId, new MLeave(), this.options.retry)
  //         .catch((e) => { })
  //     })
  //
  //     flattenO.forEach((peerId) => {
  //       this._onLeave(peerId)
  //     })
  //   } else {
  //     // #2 just leave
  //     this.partialView.clear()
  //     this.disconnect()
  //   }
  //
  //   this.NI.options.timeout = saveNITimeout
  //   this.NO.options.timeout = saveNOTimeout
  // }
  //
  // /**
  //    * @private A remote peer we target just left the network. We remove it from
  //    * our partial view.
  //    * @param {string} peerId The identifier of the peer that just left.
  //    */
  // _onLeave (peerId) {
  //   if (this.partialView.has(peerId)) {
  //     debug('[%s] %s ==> ††† %s †††', this.PID, this.PEER, peerId)
  //     const occ = this.partialView.removeAll(peerId)
  //     for (let i = 0 i < occ ++i) {
  //       this.disconnect(peerId)
  //     }
  //   }
  // }
  //
  // /**
  //    * Get k neighbors from the partial view. If k is not reached, it tries to
  //    * fill the gap with neighbors from the inview.  It is worth noting that
  //    * each peer controls its outview but not its inview. The more the neigbhors
  //    * from the outview the better.
  //    * @param {number} k The number of neighbors requested. If k is not defined,
  //    * it returns every known identifiers of the partial view.
  //    * @return {string[]} Array of identifiers.
  //    */
  // getPeers (k) {
  //   let peers = []
  //   if (typeof k === 'undefined') {
  //     // #1 get all the partial view
  //     this.partialView.forEach((occ, peerId) => {
  //       peers.push(peerId)
  //     })
  //   } else {
  //     // #2 get random identifier from outview
  //     let out = []
  //     this.partialView.forEach((ages, peerId) => out.push(peerId))
  //     while (peers.length < k && out.length > 0) {
  //       let rn = Math.floor(Math.random() * out.length)
  //       peers.push(out[rn])
  //       out.splice(rn, 1)
  //     }
  //     // #3 get random identifier from the inview to fill k-entries
  //     let inView = []
  //     this.i.forEach((occ, peerId) => inView.push(peerId))
  //     while (peers.length < k && inView.length > 0) {
  //       let rn = Math.floor(Math.random() * inView.length)
  //       peers.push(inView[rn])
  //       inView.splice(rn, 1)
  //     }
  //   }
  //   debug('[%s] %s provides %s peers', this.PID, this.PEER, peers.length)
  //   return peers
  // }
  //
  // /* *********************************
  //    * Spray's protocol implementation *
  //    ***********************************/
  //
  /**
     * @private Check the partial view, i.e., weither or not connections are
     * still up and usable.
     */
  _checkPartialView () {
    let down = []
    this.partialView.forEach((ages, peerId) => {
      if (!this.view.livingOutview.exist(peerId)) {
        down.push(peerId)
      }
    })
    down.forEach((peerId) => {
      this._onPeerDown(peerId)
    })
  }
  /**
     * @private Get a sample of the partial view.
     * @param {string} [peerId] The identifier of the oldest neighbor chosen to
     * perform a view exchange.
     * @return {string[]} An array containing the identifiers of neighbors from
     * this partial view.
     */
  _getSample (peerId) {
    let sample = []
    // #1 create a flatten version of the partial view
    let flatten = []
    this.partialView.forEach((ages, neighbor) => {
      ages.forEach((age) => {
        flatten.push(neighbor)
      })
    })
    // #2 process the size of the sample
    const sampleSize = Math.ceil(flatten.length / 2)
    // #3 initiator removes a chosen neighbor entry and adds it to sample
    if (typeof peerId !== 'undefined') {
      flatten.splice(flatten.indexOf(peerId), 1)
      sample.push(peerId)
    }
    // #4 add neighbors to the sample chosen at random
    while (sample.length < sampleSize) {
      const rn = Math.floor(Math.random() * flatten.length)
      sample.push(flatten[rn])
      flatten.splice(rn, 1)
    }
    return sample
  }
  /**
     * @private Periodically called function that aims to balance the partial
     * view and to mix the neighborhoods.
     */
  _exchange () {
    // this._checkPartialView()
    // #0 if the partial view is empty --- could be due to disconnections,
    // failure, or _onExchange started with other peers --- skip this round.
    if (this.partialView.size <= 0) { return }
    this.partialView.increment()
    const oldest = this.partialView.oldest
    // #1 send the notification to oldest that we perform an exchange
    this.view.send(oldest, new MExchange(this.id)).then(() => {
      // #A setup the exchange
      // #2 get a sample from our partial view
      let sample = this._getSample(oldest)
      debug('[%s] %s ==> exchange %s ==> %s', this.options.spray.protocol, this.PEER, sample.length, oldest)
      // #3 replace occurrences to oldest by ours
      sample = sample.map((peerId) => {
        if (peerId === oldest) {
          this.partialView.removeOldest(peerId)
          return this.id
        } else {
          this.partialView.removeYoungest(peerId)
          return peerId
        }
      })
      // #4 connect oldest -> sample
      sample.reduce((acc, peerId) => acc.then(() => {
        return new Promise((resolve, reject) => {
          this.connect4u(oldest, peerId).then(() => {
            if (peerId === this.id) {
              this.disconnect(oldest).then(() => {
                resolve()
              }).catch(e => {
                this.partialView.add(peerId)
                reject(e)
              })
            } else {
              this.disconnect(peerId).then(() => {
                resolve()
              }).catch(e => {
                this.partialView.add(peerId)
                reject(e)
              })
            }
          }).catch(e => {
            if (peerId === this.id) {
              this.partialView.add(oldest)
            } else {
              this.partialView.add(peerId)
            }
            resolve()
          })
        })
      }), Promise.resolve())
    }).catch((e) => {
      console.error(e)
      // #B the peer cannot be reached, he is supposedly dead
      debug('[%s] %s =X> exchange =X> %s', this.PID, this.PEER, oldest)
      this._onPeerDown(oldest)
    })
  }
  //
  /**
     * @private Behavior when this peer receives a shuffling request.
     * @param {string} neighbor The identifier of the peer that sent this
     * exchange request.
     * @param {MExchange} message message containing the identifier of the peer
     * that started the exchange.
     */
  _onExchange (neighbor, message) {
    this._checkPartialView()
    // #1 get a sample of neighbors from our partial view
    this.partialView.increment()
    let sample = this._getSample()
    debug('[%s] %s ==> exchange %s ==> %s',
      this.PID, neighbor, sample.length, this.PEER)
    // #2 replace occurrences of the initiator by ours
    sample = sample.map((peerId) => {
      this.partialView.removeYoungest(peerId)
      if (peerId === neighbor) return this.id
      return peerId
    })
    sample.reduce((acc, peerId) => acc.then(() => {
      return new Promise((resolve, reject) => {
        this.connect4u(neighbor, peerId).then(() => {
          if (peerId === this.id) {
            this.disconnect(neighbor).then(() => {
              resolve()
            }).catch(e => {
              this.partialView.add(peerId)
              reject(e)
            })
          } else {
            this.disconnect(peerId).then(() => {
              resolve()
            }).catch(e => {
              this.partialView.add(peerId)
              reject(e)
            })
          }
        }).catch(e => {
          if (peerId === this.id) {
            this.partialView.add(neighbor)
          } else {
            this.partialView.add(peerId)
          }
          resolve()
        })
      })
    }), Promise.resolve()).catch(e => {
      console.error(e)
    })
  }
  //
  // /**
  //    * @private The function called when a neighbor is unreachable and
  //    * supposedly crashed/departed. It probabilistically duplicates an arc.
  //    * @param {string} peerId The identifier of the peer that seems down.
  //    */
  _onPeerDown (peerId) {
    debug('[%s] onPeerDown ==> %s ==> XXX %s XXX', this.PID, this.PEER, peerId)
    // #1 remove all occurrences of the peer in the partial view
    const occ = this.partialView.removeAll(peerId)
    // #2 probabilistically recreate arcs to a known peer
    // (TODO) double check this
    const proba = this.options.spray.a / (this.partialView.size + occ)

    if (this.partialView.size > 0) {
      // #A normal behavior
      for (let i = 0; i < occ; ++i) {
        if (Math.random() > proba) {
          // probabilistically duplicate the least frequent peers
          this.connect4u(null, this.partialView.leastFrequent)
        }
      }
    } else {
      // #B last chance behavior (TODO) ask inview
    }
  }
  /**
     * @private A connection failed to establish properly, systematically
     * duplicates an element of the partial view.
     * @param {string|null} peerId The identifier of the peer we failed to
     * establish a connection with. Null if it was yet to be known.
     */
  _onArcDown (peerId) {
    debug('[%s] ==> %s =X> %s', this.PID, this.PEER, peerId || 'unknown')
    if (this.partialView.size > 0) {
      // #1 normal behavior
      this.connect4u(null, this.partialView.leastFrequent)
    } else {
      // #2 last chance behavior
      // (TODO) ask inview
      // const rn = Math.floor(Math.random() * this.i.size)
      // let it = this.i.keys()
      // this.II.connect(null, this.i.
    }
  }

  /**
     * @private Inject a*log(N) + b arcs leading to peerId. When parameters are
     * not integers, the floating part is added probabilistically.
     * @param {number} a  a * log
     * @param {number} b + b
     * @param {string} peerId The identifier of the peer to duplicate.
     */
  _inject (a, b, peerId) {
    console.log('Inject: ', a, b, peerId)
    let copyA = a
    let copyB = b
    let resA = []
    let resB = []
    for (let i = 0; i < Math.floor(a); ++i) resA.push(i)
    for (let i = 0; i < Math.floor(b); ++i) resB.push(i)
    return resA.reduce((acc, cur) => acc.then(() => {
      return new Promise((resolve, reject) => {
        copyA -= 1
        this.connect4u(null, peerId).then(() => {
          // console.log('lobInject A')
          resolve()
        }).catch(e => {
          console.error(e)
          reject(e)
        })
      })
    }), Promise.resolve()).then(() => {
      return new Promise((resolve, reject) => {
        if (Math.random() < copyA) {
          this.connect4u(null, peerId).then(() => {
            // console.log('lobInject A random')
            resolve()
          }).catch(e => {
            console.error(e)
            reject(e)
          })
        } else {
          resolve()
        }
      })
    }).then(() => {
      return resB.reduce((acc, cur) => acc.then(() => {
        return new Promise((resolve, reject) => {
          copyB -= 1
          this.connect4u(null, peerId).then(() => {
            // console.log('lobInject B')
            resolve()
          }).catch(e => {
            console.error(e)
            reject(e)
          })
        })
      }), Promise.resolve())
    }).then(() => {
      return new Promise((resolve, reject) => {
        if (Math.random() < copyB) {
          this.connect4u(null, peerId).then(() => {
            // console.log('lobInject A random')
            resolve()
          }).catch(e => {
            console.error(e)
            reject(e)
          })
        } else {
          resolve()
        }
      })
    })
  }

  /**
     * @private Inject a*log(N) + b arcs leading to peerId. When parameters are
     * not integers, the floating part is added probabilistically.
     * @param {number} a  a * log
     * @param {number} b + b
     * @param {string} peerId The identifier of the peer to duplicate.
     * @return {Promise} Resolved when all connection are done. reject when one is rejected.
     */
  _injectReverse (a, b, peerId) {
    console.log('InjectBack: ', a, b, peerId)
    let copyA = a
    let copyB = b
    let resA = []
    let resB = []
    for (let i = 0; i < Math.floor(a); ++i) resA.push(i)
    for (let i = 0; i < Math.floor(b); ++i) resB.push(i)
    return resA.reduce((acc, cur) => acc.then(() => {
      return new Promise((resolve, reject) => {
        copyA -= 1
        this.connect4u(peerId, null).then(() => {
          // console.log('logInjectBack A')
          resolve()
        }).catch(e => {
          console.error(e)
          reject(e)
        })
      })
    }), Promise.resolve()).then(() => {
      return new Promise((resolve, reject) => {
        if (Math.random() < copyA) {
          this.connect4u(peerId, null).then(() => {
            // console.log('logInjectBack A random')
            resolve()
          }).catch(e => {
            console.error(e)
            reject(e)
          })
        } else {
          resolve()
        }
      })
    }).then(() => {
      return resB.reduce((acc, cur) => acc.then(() => {
        return new Promise((resolve, reject) => {
          copyB -= 1
          this.connect4u(peerId, null).then(() => {
            // console.log('logInjectBack B')
            resolve()
          }).catch(e => {
            console.error(e)
            reject(e)
          })
        })
      }), Promise.resolve())
    }).then(() => {
      return new Promise((resolve, reject) => {
        if (Math.random() < copyB) {
          this.connect4u(peerId, null).then(() => {
            // console.log('logInjectBack A random')
            resolve()
          }).catch(e => {
            console.error(e)
            reject(e)
          })
        } else {
          resolve()
        }
      })
    })
  }
}

module.exports = Spray
