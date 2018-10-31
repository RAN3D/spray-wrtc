const N2N = require('n2n-wrtc').N2N
const lmerge = require('lodash.merge')
const short = require('short-uuid')
const translator = short()
const MExchange = require('./messages/mexchange.js')
const MJoin = require('./messages/mjoin.js')
const MJoinBack = require('./messages/mjoinback.js')
const MLeave = require('./messages/mleave.js')

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
        b: 5
      }
    }, options))
    this.debug = (require('debug'))('spray-wrtc')
    this.debug('initialized with: ', this.options.spray)
    // #2 initialize the partial view containing ages
    // this.partialView = new PartialView()
    // #3 periodic shuffling
    this.periodic = null
    this.on(this.options.spray.protocol, (id, message) => {
      this.___receive(id, message)
    })
    // #4 events
    this.on('out', (peerId, outview) => {
      this._open(peerId)
      this._out++
    })
    this.on('close_out', (peerId, outview, fail) => {
      if (fail) {
        this._onArcDown(peerId)
      }
      this._close(peerId)
      this._closeOut++
    })

    // statistics
    this._balance = 0
    this._out = 0
    this._closeOut = 0
    // if shuffling do not shuffle
    this._shuffling = false

    // init buffer variables and functions
    this.buffer = []
    this._bufferActive = false
    this.bufferize = (fun, args, resolve, reject) => {
      this.buffer.push({ fun, args, resolve, reject })
      this._reviewBuffer()
    }
    this._reviewBuffer = () => {
      if (!this._bufferActive && this.buffer.length > 0) {
        this._bufferActive = true
        const fun = this.buffer[0].fun
        const args = this.buffer[0].args
        const resolve = this.buffer[0].resolve
        const reject = this.buffer[0].reject
        fun.apply(this, args).then((res) => {
          this._bufferActive = false
          this.buffer.shift()
          resolve()
          this._reviewBuffer()
        }).catch(e => {
          this._bufferActive = false
          this.buffer.shift()
          reject(e)
          this._reviewBuffer()
        })
      }
    }
  }

  /**
     * @private Start periodic shuffling.
     */
  _start (delay = this.options.spray.delta) {
    this.periodic = setInterval(() => {
      this._exchange()
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
    try {
      if (message && 'type' in message && message.type === MExchange.type) {
        this._onExchange(message.id, message).then(() => {
          console.log('[%s] onExchange finished', this.id)
        }).catch(e => {
          console.error('onExchange: ', e)
        })
      } else if (message && 'type' in message && message.type === MJoin.type) {
        this._onJoin(id, message.jobId).then(() => {
          this.debug('[%s] _onJoin part finished for the joining peer %s', this.id, id)
        }).catch(e => {
          this.debug('[%s] _onJoin is errored...', e)
        })
      } else if (message && 'topology' in message && 'type' in message && message.type === MJoinBack.type) {
        this.events.emit(message.jobId, id, message.topology)
      } else if (message && 'type' in message && message.type === MLeave.type) {
        this._onLeave(id)
      } else if (message && 'jobId' in message && 'type' in message && message.type === 'response') {
        this.events.emit(message.jobId)
      }
    } catch (e) {
      console.error(e)
    }
  }

  /**
     * @private Behavior when a connection is ready to be added in the partial
     * view.
     * @param {string} peerId The identifier of the new neighbor.
     */
  _open (peerId) {
    this.debug('[%s] Arc opened (%s ===> %s)', this.id, this.options.spray.protocol, this.id, peerId)
    // this.partialView.add(peerId)
  }

  /**
     * @private Behavior when a connection is closed.
     * @param {string} peerId The identifier of the removed arc.
     */
  _close (peerId) {
    this.debug('[%s] Arc closes (%s =†=> %s)', this.id, this.options.spray.protocol, this.id, peerId)
  }

  /**
   * Connect Spray peer to another Spray peer, follow the style of N2N
   * Then begin the Join mechanism of Spray
   * @param  {Spray|null}  Args N2N arguments see (https://github.com/ran3d/n2n-wrtc)
   * @return {Promise}
   */
  async connect (...Args) {
    return super.connect(...Args).then((id) => {
      if (id) {
        return new Promise((resolve, reject) => {
          this.lock(id)
          this._start() // start shuffling process
          this._inject(this.options.spray.a - 1, 0, null, id).then(() => {
            const jobId = translator.new()
            this.events.once(jobId, (id, topology) => {
              console.log(id, topology)
              if (topology) {
                this._inject(2 * this.options.spray.a, 2 * this.options.spray.b, id, null).then(() => {
                  this.unlock(id)
                  resolve()
                }).catch(e => {
                  this.unlock(id)
                  resolve()
                })
              } else {
                this.unlock(id)
                resolve()
              }
            })
            this.send(this.options.spray.protocol, id, new MJoin(jobId)).then(() => {
              this.debug('[%s] MJoin message sent', this.id)
            }).catch(e => {
              throw new Error('Cannot contact the first peer: ' + e.message, e)
            })
          }).catch(e => {
            console.error(e)
            reject(e)
          })
        })
      } else {
        // means we are alone in the dark...
        this._start() // start shuffling process
        return Promise.resolve()
      }
    })
  }
  /**
     * @private Behavior of the contact peer when a newcomer arrives.
     * @param {string} peerId The identifier of the newcomer.
     */
  _onJoin (peerId, jobId) {
    // need to be bufferize, because we are locking connections
    return new Promise((resolve, reject) => {
      this._start()
      if (this.getNeighbours().length > 0) {
        // #1 all neighbors -> peerId
        this.debug('[%s] %s ===> join %s ===> %s neighbors', this.options.spray.protocol, peerId, this.id, this.getNeighbours().length)
        const pv = []
        this.getNeighbours().forEach(({ peer, id }) => {
          const ages = []
          for (let i = 0; i < peer.occurences - peer.lock; ++i) {
            ages.push(id)
          }
          this.debug('[%s] chosing %f times the peer %s...', this.id, peer.occurences, id)
          pv.push({ ages, neighbor: id })
        })
        pv.reduce((acc, cur) => acc.then(() => {
          return cur.ages.reduce((a, c) => a.then(() => {
            return new Promise((res, rej) => { //eslint-disable-line
              this.debug('[%s] joining %s with %s...', this.id, cur.neighbor, peerId)
              // use bridgeOI because we bridge from an outview neighbor to the joining peer
              this.lock(cur.neighbor)
              this.bridgeOI(cur.neighbor, peerId).then(() => {
                console.log('[%s] onJoin finish to connect the neighbor with the joining peer: %s -> %s', this.id, cur.neighbor, peerId)
                this.unlock(cur.neighbor)
                res()
              }).catch(e => {
                console.log('[%s] onJoin error: ', this.id, e)
                this.unlock(cur.neighbor)
                res()
              })
            })
          }), Promise.resolve())
        }), Promise.resolve()).then(() => {
          this.send(this.options.spray.protocol, peerId, new MJoinBack(jobId, false), false).catch(e => {
            console.error('cannot send back the MJoinBack message.', e)
          })
          resolve()
        }).catch(e => {
          console.warning('[%s] you cnanot have error in this part please report...', this.id)
          reject(e)
        })
      } else {
        this.send(this.options.spray.protocol, peerId, new MJoinBack(jobId, true), false).catch(e => {
          console.error('[%s] cannot send back the MJoinBack message.', this.id, e)
        })
        resolve()
      }
    })
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
  // }

  /**
     * @private A remote peer we target just left the network. We remove it from
     * our partial view.
     * @param {string} peerId The identifier of the peer that just left.
     */
  _onLeave (peerId) {
    // console.log('[%s]OnLeave %s ', this.id, peerId)
    // if (this.partialView.has(peerId)) {
    //   this.debug('[%s] %s ==> ††† %s †††', this.options.spray.protocol, this.id, peerId)
    //   const occ = this.partialView.removeAll(peerId)
    //   for (let i = 0; i < occ; ++i) {
    //     this.disconnect(peerId)
    //   }
    // }
  }
  /* *********************************
     * Spray's protocol implementation *
     ***********************************/
  async _connectSample (to, sample) {
    console.log('[%s] connecting to %s ...', this.id, to, sample)
    const res = {
      connected: [],
      notconnected: []
    }
    const promises = []
    sample.forEach(peerId => {
      promises.push(new Promise((resolve, reject) => {
        console.log('[%s] connect4u: %s -> %s ', this.id, to, peerId)
        this.connect4u(to, peerId).then(() => {
          res.connected.push(peerId)
          this._balance++
          resolve()
        }).catch(e => {
          this.debug(`[${this.id}] connection errored. (just a log) Error catched. Reason: ${e.message}`)
          res.notconnected.push(peerId)
          resolve()
        })
      }))
    })
    return Promise.all(promises).then(() => {
      return res
    })
  }

  async _disconnectSample (sample, oldest) {
    const notdisconnected = []
    const promises = []
    sample.forEach(peerId => {
      promises.push(new Promise((resolve, reject) => {
        try {
          this.debug(`[${this.id}] Peer:${peerId} occurences=${this.livingOutview.get(peerId).occurences} | lock=${this.livingOutview.get(peerId).lock}`)
          const unlock = this.unlock(peerId) // eslint-disable-line
          this.disconnect(peerId).then(() => {
            this._balance--
            resolve()
          }).catch(e => {
            console.error(new Error(`PeerId: ${peerId} oldest=${oldest} Message:` + e.message, e))
            notdisconnected.push(peerId)
            resolve()
          })
        } catch (e) {
          console.error(new Error(`PeerId: ${peerId} oldest=${oldest} Message:` + e.message, e))
          reject(e)
        }
      }))
    })
    return Promise.all(promises).then(() => {
      return notdisconnected
    })
  }

  /**
   * Return a random neighbour from an array
   * @param {Array} arr array
   * @return {*} Random value from this array
   */
  _pickNeighbour (arr) {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  /**
   * Get a sample of peers with the oldest
   * @param  {Boolean} [withOldest=true] determine if we want the oldest or not
   * @return {Object} Object = {available: Array<String>, oldest: <String>}
   */
  _getSample (withOldest = true) {
    // #1 check if we have available conenctions
    const res = []
    this.getNeighbours().forEach(({ peer, id }) => {
      // this.debug(`[${this.id}] Peer ${id}: occ=${peer.occurences}, lock=${peer.lock}`)
      const available = peer.occurences - peer.lock
      if (available > 0) {
        for (let i = 0; i < available; ++i) res.push(id)
      }
    })
    if (res.length === 0) {
      return { available: [], oldest: null }
    } else {
      let oldest
      if (withOldest) {
        // pick oldest and remove it from connection available, lock it
        oldest = this._pickNeighbour(res)
        res.splice(res.indexOf(oldest), 1)
      }
      // #2 process the size of the sample
      const sampleSize = Math.ceil(res.length / 2)
      let sample = []
      console.log(res)
      // #4 add neighbors to the sample chosen at random
      while (sample.length < sampleSize) {
        const rn = Math.floor(Math.random() * res.length)
        const chosen = res[rn]
        sample.push(chosen)
        res.splice(rn, 1)
      }
      return {
        available: sample,
        oldest
      }
    }
  }

  /**
   * Begin the exchange mechanism (buffered method)
   * @return {Promise}
   */
  _exchange () {
    return new Promise((resolve, reject) => {
      this.bufferize(this._exchangeBis, [], resolve, reject)
    })
  }

  /**
   * Exchange mechanism
   * @return {Promise}
   */
  _exchangeBis () {
    return new Promise((resolve, reject) => {
      if (this._shuffling) {
        this.debug('[%s] Shuffling already active...', this.id)
        resolve()
      } else {
        // callback called when finish, set shuffling off
        const done = (error) => {
          this._shuffling = false
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        }
        this._shuffling = true
        let sample = this._getSample(true)
        if (sample.available.length <= 0) {
          if (sample.oldest) {
            // just reverse the arc with oldest
            const oldest = sample.oldest
            this.lock(oldest)
            this.debug('[%s] Reverse the arc with oldest %s', this.id, oldest)
            this.connectToUs(oldest).then(() => {
              this._balance++
              this.debug('[%s] send MExchange message to %s', this.id, oldest)
              this.send(this.options.spray.protocol, oldest, new MExchange(this.id)).then(() => {
                this.debug('[%s] disconnect oldest', this.id, oldest)
                this._disconnectSample([oldest], oldest).then((res) => {
                  if (res.length > 0) {
                    console.warning('[%s] Please remove a random arc', this.id)
                  }
                  done()
                }).catch(e => {
                  console.warning('[%s] Please report, not possible in this part (disconnect oldest only)', this.id)
                })
              }).catch(e => {
                this._disconnectSample([oldest], oldest).then((res) => {
                  if (res.length > 0) {
                    console.warning('[%s] Please remove a random arc', this.id)
                  }
                  done()
                }).catch(e => {
                  console.warning('[%s] Please report, not possible in this part (disconnect oldest only)', this.id)
                })
              })
            }).catch(e => {
              done(e)
            })
          } else {
            done()
          }
        } else {
          // #1 get the oldest peer to exchange with
          const oldest = sample.oldest
          this.lock(oldest)
          // ensure that the link is reversed before continuing the connection
          // The oldest can now exchanging offers using its outview
          if (this.livingOutview.has(oldest)) {
            this.debug('[%s] Reverse the arc with oldest %s', this.id, oldest)
            this.connectToUs(oldest).then(() => {
              this._balance++
              this.debug('[%s] send MExchange message to %s', this.id, oldest)
              this.send(this.options.spray.protocol, oldest, new MExchange(this.id)).then(() => {
                sample.available = sample.available.map((peerId) => {
                  this.lock(peerId)
                  if (peerId === oldest) {
                    return this.id
                  } else {
                    return peerId
                  }
                })
                this.debug('[%s] %s ==> exchange %f ==> %s', this.id, this.id, sample.available.length, oldest)
                // set outview to false because we are connected to oldest
                this._connectSample(oldest, sample.available).then((result) => {
                  result.notconnected.forEach(id => {
                    if (id === this.id) {
                      const unlock = this.unlock(oldest) // eslint-disable-line
                    } else {
                      const unlock = this.unlock(id) // eslint-disable-line
                    }
                  })
                  result.connected = result.connected.map(id => {
                    if (id === this.id) {
                      return oldest
                    } else {
                      return id
                    }
                  })
                  // add the connection to oldest into the list of disconnected socket
                  result.connected.push(oldest)
                  // need to unlock all connections and disconnect all result.connected peer from us
                  this.debug('[%s] Disconnect a sample of %f peers', this.id, result.connected.length)
                  this._disconnectSample(result.connected, oldest).then((res) => {
                    if (res.length > 0) {
                      console.warning('[%s] Please remove random arc(s) (Not disconnected = %f)', this.id, res.length)
                    }
                    done()
                  }).catch(e => {
                    // need to remove a random arcs
                    console.warning('[%s] Please report, not possible in this part (disconnect sample)', this.id, e)
                    done(e)
                  })
                }).catch(e => {
                  console.warning('[%s] Please report, not possible in this part (connect sample)', this.id, e)
                  done(e)
                })
              }).catch(e => {
                // onPeerDown perhaps?
                console.warning('[%s] Cannot contact the oldest, perhaps make a onPeerDown?', this.id, e)
                done(e)
              })
            }).catch(e => {
              console.error('[%s] Cannot reverse the arc (exchange part 2)', this.id, e)
              done(e)
            })
          } else {
            console.warning('[%s] We do not have oldest (%s) in our outview, stop.', this.id)
          }
        }
      }
    })
  }

  /**
   * (PASSIVE) When we receive an exchange order (buffered method)
   * @param  {String} neighbor id of the peer who to exchange with us
   * @param  {Object} message  contain the redundant id of the peer who want to exchange with us
   * @return {Promise}
   */
  _onExchange (neighbor, message) {
    return new Promise((resolve, reject) => {
      this.bufferize(this._onExchangeBis, [neighbor, message], resolve, reject)
    })
  }
  /**
   * (PASSIVE) onExchange mechanism
   * @param  {String} neighbor id of the peer who to exchange with us
   * @param  {Object} message  contain the redundant id of the peer who want to exchange with us
   * @return {Promise}
   */
  _onExchangeBis (neighbor, message) {
    return new Promise((resolve, reject) => { // eslint-disable-line
      if (!this.livingOutview.has(neighbor)) {
        resolve()
      } else {
        this.debug('[%s] Begin the passive part of Spray...', this.id)
        const done = (e) => {
          this.debug('[%s] Passive part of Spray finished.', this.id)
          this.unlock(neighbor)
          if (e) {
            reject(e)
          } else {
            resolve()
          }
        }
        // #1 lock the neighbor
        this.lock(neighbor)
        let sample = this._getSample()
        if (sample.available.includes(neighbor)) {
          // remove one occurence of the neighbor
          sample.available.splice(sample.available.indexOf(neighbor), 1)
        }
        sample.available = sample.available.map((id) => {
          this.lock(id)
          if (id === neighbor) {
            return this.id
          } else {
            return id
          }
        })
        // set outview to true because neigh is connected to us
        this.debug('[%s] %s ==> exchange %f ==> %s', this.id, this.id, sample.available.length, neighbor)
        this._connectSample(neighbor, sample.available).then((result) => {
          result.notconnected.forEach(id => {
            if (id === this.id) {
              // this.partialView.add(neighbor)
              const unlock = this.unlock(neighbor) // eslint-disable-line
            } else {
              // this.partialView.add(id)
              const unlock = this.unlock(id) // eslint-disable-line
            }
          })
          // replace occurences of our id by the exchanging peer.
          result.connected = result.connected.map(id => {
            if (id === this.id) return neighbor
            return id
          })
          // readd the occurence of the neighbor before disconnecting them
          this.debug('[%s] Disconnect a sample of %f peers', this.id, result.connected.length)
          this._disconnectSample(result.connected, neighbor).then((notdisconnected) => {
            if (notdisconnected.length > 0) {
              console.log('need to delete arcs....')
            }
            done()
          }).catch(e => { // catch disconnectSample
            console.error('_disconnectSample: Must never happen, please report!', e)
            done(e)
          })
        }).catch(e => { // catch connectSample
          console.error('_connectSample: Must never happen, please report!', e)
          done(e)
        })
      }
    })
  }
  /**
     * @private The function called when a neighbor is unreachable and
     * supposedly crashed/departed. It probabilistically duplicates an arc.
     * @param {string} peerId The identifier of the peer that seems down.
     */
  _onPeerDown (peerId) {
    console.log('[%s] onPeerDown %s ', this.id, peerId)
    this.debug('[%s] onPeerDown ==> %s ==> XXX %s XXX', this.options.spray.protocol, this.id, peerId)
    let occ = 0
    if (this.livingOutview.has(peerId)) {
      // #1 remove all occurrences of the peer in the partial view
      occ = this.livingOutview.get(peerId).occurences
    }
    // #2 probabilistically recreate arcs to a known peer
    // (TODO) double check this
    const proba = this.options.spray.a / (this.partialView.size + occ)
    if (this.getNeighbours().size > 0) {
      const neigh = this.getNeighbours()
      // #A normal behavior
      for (let i = 0; i < occ; ++i) {
        if (Math.random() > proba) {
          const rn = Math.floor(Math.random() * neigh.length)
          const p = neigh[rn].id
          // probabilistically duplicate the least frequent peers
          this.connect4u(null, p).then(() => {
            this._balance++
          }).catch(e => {
            console.warning('[%s] (onPeerDown) An arc could not be established with %s, It could unbalance the network.', this.id, p, e.message)
          })
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
    this.debug('[%s] onArcDown ==> %s =X> %s', this.id, this.id, peerId || 'unknown')
    if (this.getNeighbours().length > 0) {
      // #1 normal behavior
      const rNeigh = this._pickNeighbour(this.getNeighboursIds())
      this.connect4u(null, rNeigh).then(() => {
        this._balance++
      }).catch(e => {
        console.warning('[%s] (onArcDow) An arc could not be established with %s, It could unbalance the network.', this.id, rNeigh, e.message)
      })
    } else {
      // #2 last chance behavior
      // ask inview
      const inview = this.getNeighboursInview()
      if (inview.length > 0) {
        const rNeigh = Math.floor(Math.random() * inview.length)
        this.connect4u(rNeigh, null).then(() => {
          this._balance++
        }).catch(e => {
          console.warning('[%s] An arc has been removed but not readded in the system. It could unbalance the network.', this.id, e.message)
        })
      } else {
        console.warning('[%s] No arcs in the outview and in the outview, it means that we are alone in the dark...', this.id)
      }
    }
  }

  /**
     * @private Inject a*log(N) + b arcs leading to peerId. When parameters are
     * not integers, the floating part is added probabilistically.
     * @param {number} a  a * log
     * @param {number} b + b
     * @param {string} peerId The identifier of the peer to duplicate.
     * @return {Promise} Resolved when all connections are finished whenever they are rejected or resolved.
     */
  _inject (a, b, from, to) {
    let copyA = a
    let copyB = b
    let resA = []
    let resB = []
    for (let i = 0; i < Math.floor(a); ++i) resA.push(i)
    for (let i = 0; i < Math.floor(b); ++i) resB.push(i)

    let promises = []
    resA.forEach(p => {
      copyA -= 1
      promises.push(new Promise((resolve, reject) => {
        this.connect4u(from, to).then(() => {
          resolve()
        }).catch(e => {
          console.error('[%s] error copyA normal inject: ', this.id, e)
          resolve()
        })
      }))
    })
    if (Math.random() < copyA) {
      promises.push(new Promise((resolve, reject) => {
        this.connect4u(from, to).then(() => {
          resolve()
        }).catch(e => {
          console.error('[%s] error copyA random inject: ', this.id, e)
          resolve()
        })
      }))
    }
    resB.forEach(p => {
      copyB -= 1
      promises.push(new Promise((resolve, reject) => {
        this.connect4u(from, to).then(() => {
          resolve()
        }).catch(e => {
          console.error('[%s] error copyB normal inject: ', this.id, e)
          resolve()
        })
      }))
    })
    if (Math.random() < copyB) {
      promises.push(new Promise((resolve, reject) => {
        this.connect4u(from, to).then(() => {
          resolve()
        }).catch(e => {
          console.error('[%s] error copyB random inject: ', this.id, e)
          resolve()
        })
      }))
    }

    return Promise.all(promises)
  }
}

module.exports = Spray
