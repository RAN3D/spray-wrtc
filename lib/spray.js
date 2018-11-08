const n2n = require('n2n-wrtc')
const N2N = n2n.N2N
// const N2NErrors = n2n.errors
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
   *
   * @extend N2N
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
        debug: false,
        protocol: 'spray-wrtc',
        delta: 1000 * 60 * 2,
        a: 1,
        b: 5
      },
      n2n: {
        timeout: 5000
      },
      socket: {
        timeout: 5000
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
    this.once('out', (peerId) => {
      // start the shuffling mechanism in case we are the first peer.
      // this handle the case of direct connections where the _start method is never called.
      if (!this._active) this._start()
    })
    // #4 events
    this.on('out', (peerId, outview) => {
      this._open(peerId)
      this._out++
    })
    this.on('close_out', (peerId, outview, fail) => {
      this._close(peerId)
      this._closeOut++
    })
    this.on('crash_in', (peerId, occurences) => {
      this.debug('[%s] a peer crash...', this.id, peerId, occurences)
      this._onPeerDown(peerId, occurences)
    })
    this._active = false
    // statistics
    this._balance = 0
    this._out = 0
    this._closeOut = 0
    // if shuffling do not shuffle
    this._shuffling = false
    this._joining = false
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
     * Start periodic shuffling.
     * @param {Number} time between each shuffling
     * @return {void}
     */
  _start (delay = this.options.spray.delta) {
    if (!this._active) {
      this._active = true
      this.periodic = setInterval(() => {
        this._exchange().catch(e => {
          console.warn('[%s] an exchange is errored...', e)
        })
      }, delay)
    } else {
      this.debug('[%s] periodic shuffling already activated', this.id)
    }
  }

  /**
     * Stop periodic shuffling.
     * @return {void}
     */
  _stop () {
    clearInterval(this.periodic)
  }

  /**
     * Called each time this protocol receives a message.
     * @param {string} peerId The identifier of the peer that sent the message.
     * @param {object|MExchange|MJoin} message The message received.
     * @private
     */
  ___receive (id, message) {
    switch (message.type) {
      case MExchange.type:
        this._onExchange(message.id, message).then(() => {
          this.debug('[%s] onExchange finished', this.id)
        }).catch(e => {
          this.debug('[%s] onExchange crashed: ', this.id, e)
        })
        break

      case MJoin.type:
        this._onJoin(message.jobId, id).then(() => {
          this.debug('[%s] _onJoin part finished for the joining peer %s', this.id, id)
        }).catch(e => {
          this.debug('[%s] _onJoin is errored...', e)
        })
        break

      case MJoinBack.type:
        this.events.emit(message.jobId, id, message.topology, message.arcs)
        break

      case MLeave.type:
        this._onLeave(id)
        break

      case 'response':
        this.events.emit(message.jobId)
        break

      default:
        throw new Error('message not handled')
    }
  }

  /**
     * Behavior when a connection is ready to be added in the partial
     * view.
     * @param {string} peerId The identifier of the new neighbor.
     * @return {void}
     * @private
     */
  _open (peerId) {
    this.debug('[%s] Arc opened (%s ===> %s)', this.id, this.id, peerId)
  }

  /**
     * Behavior when a connection is closed.
     * @param {string} peerId The identifier of the removed arc.
     * @return {void}
     * @private
     */
  _close (peerId) {
    this.debug('[%s] Arc closes (%s =†=> %s)', this.id, this.id, peerId)
  }

  /**
   * Connect Spray peer to another Spray peer, follow the style of N2N
   * Then begin the Join mechanism of Spray
   * @param  {Spray|null}  Args N2N arguments see (https://github.com/ran3d/n2n-wrtc)
   * @return {Promise}
   */
  async connect (...Args) {
    this._joining = true
    return super.connect(...Args).then((id) => {
      if (id) {
        return new Promise((resolve, reject) => {
          const done = (e) => {
            this._joining = false
            if (e) reject(e)
            resolve()
          }
          this.lock(id)
          this._start() // start shuffling process
          const a = this.options.spray.a - 1
          this.debug('[%s] connect: injecting %f more arcs to %s...', this.id, a, id)
          this._inject(a, 0, null, id).then((injectRes) => {
            const jobId = translator.new()
            this.debug('[%s] connect: waiting for a response from %s...', this.id, id)
            this.events.once(jobId, (id, topology) => {
              if (topology) {
                this.debug('[%s] connect: injecting %f more arcs from %s to us...', this.id, 2 * this.options.spray.a + 2 * this.options.spray.b, id)
                this._inject(2 * this.options.spray.a, 2 * this.options.spray.b, id, null).then((res) => {
                  this.unlock(id)
                  done()
                }).catch(e => {
                  this.unlock(id)
                  done()
                })
              } else {
                this.unlock(id)
                done()
              }
            })
            this.send(this.options.spray.protocol, id, new MJoin(jobId)).then(() => {
              this.debug('[%s] MJoin message sent', this.id)
            }).catch(e => {
              throw new Error('Cannot contact the first peer: ' + e.message, e)
            })
          }).catch(e => {
            this.debug('[%s] inject a arcs crashed: ', this.id, e)
            done(e)
          })
        })
      } else {
        this._joining = false
        // means we are alone in the dark...
        this._start() // start shuffling process
        return Promise.resolve()
      }
    })
  }
  /**
     * Behavior of the contact peer when a newcomer arrives.
     * @param {string} peerId The identifier of the newcomer.
     * @return {Promise}
     * @private
     */
  _onJoin (jobId, peerId) {
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
                this.unlock(cur.neighbor)
                res()
              }).catch(error => {
                this.debug('[%s] onJoin error: ', this.id, error)
                // problem with connection establishment, onArcDown
                this._onArcDown(cur.neighbor)
                this.unlock(cur.neighbor)
                res()
              })
            })
          }), Promise.resolve())
        }), Promise.resolve()).then(() => {
          this.send(this.options.spray.protocol, peerId, new MJoinBack(jobId, false), false).then(() => {
            resolve()
          }).catch(e => {
            this.debug('[%s]cannot send back the MJoinBack message.', this.id, e)
            resolve()
          })
        }).catch(e => {
          console.error('[%s] You cannot have error in this part please report...', this.id)
          reject(e)
        })
      } else {
        this.send(this.options.spray.protocol, peerId, new MJoinBack(jobId, true, 0), false).then(() => {
          resolve()
        }).catch(e => {
          this.debug('[%s] Cannot send back the MJoinBack message.', this.id, e)
          resolve()
        })
      }
    })
  }

  /**
    * Leave the network.
    * It tries to patch the network before leaving the network.
    * By only removing a * log(N) + b arcs
    * @param {String|null} peerId Identifier of the peer to disconnect, or null for leaving the network
    * @return {Promise} Resolved when the disconnect is finished
    */
  async disconnect (peerId) {
    if (peerId) {
      // apply the behavior of N2N
      return super.disconnect(peerId)
    } else {
      return new Promise((resolve, reject) => {
        // patch the network by adding peerId.occurences arcs to inview -> peerId
        const tab = []
        let a = this.options.spray.a
        this.livingOutview.forEach((v, k) => {
          if (a === 0) {
            for (let i = 0; i < v.occurences; ++i) {
              tab.push(k)
            }
          } else {
            a--
          }
        })
        const inview = [...this.livingInview.keys()]
        // foreach occurences, iterate, add an arc from a random inview peer to our neighbor
        tab.reduce((acc, id) => acc.then(() => {
          return new Promise((res, rej) => { // eslint-disable-line
            const filter = inview.filter(e => e !== id)
            if (filter.length > 0) {
              // pick a different random inview neighbor
              const rn = Math.floor(Math.random() * filter.length)
              this.bridgeIO(filter[rn], id).then(() => {
                res()
              }).catch(e => {
                this.debug('[%s] Please report, error, we need to try another peer...', this.id, e)
                // we need to retry with another peer...
                res()
              })
            } else {
              this.debug('[%s] Disconnect, we cannot make the bridge because we do not have neighbor different of %s ', this.id, id)
              res()
            }
          })
        }), Promise.resolve()).then(() => {
          [...this.livingInview.keys()].reduce((acc, cur) => acc.then(() => {
            return new Promise((res) => { // eslint-disable-line
              this.send(this.options.spray.protocol, cur, new MLeave(), false).then(() => {
                res()
              }).catch(e => {
                this.debug('[%s] Cannot warn %s that we will leave...', this.id, cur)
                res()
              })
            })
          }), Promise.resolve()).then(() => {
            super.disconnect().then(() => {
              resolve()
            }).catch(e => {
              reject(e)
            })
          }).catch(e => {
            console.warn('[%s] Please report, not possible...', this.id)
          })
        }).catch(e => {
          console.error('[%s] Please report, not possible, leave', this.id)
          reject(e)
        })
      })
    }
  }

  /**
     * A remote peer we target just left the network. We remove it from
     * our partial view.
     * @param {string} peerId The identifier of the peer that just left.
     * @return {void}
     * @private
     */
  _onLeave (peerId) {
    if (this.livingOutview.has(peerId)) {
      this.debug('[%s] %s ==> ††† %s †††', this.options.spray.protocol, this.id, peerId)
      const occ = this.livingOutview.get(peerId).occurences
      for (let i = 0; i < occ; ++i) {
        this.disconnect(peerId)
      }
    }
  }
  /* *********************************
     * Spray's protocol implementation *
     ***********************************/
  /**
   * Connect a sample of ids to 'to'
   * @param  {String}  to     identifier of the initiator for all conenction
   * @param  {Array<String>}  sample sample of identifier to connect from 'to' to each id of the sample
   * @return {Promise} Resolved when all connection are finished
   * @private
   */
  async _connectSample (to, sample) {
    const res = {
      connected: [],
      notconnected: []
    }
    const promises = []
    sample.forEach(peerId => {
      promises.push(new Promise((resolve, reject) => {
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
  /**
   * Disconnect a sample, unlock them before, return an array of undisconnected peer
   * @param  {Array<String>}  sample array of ids to disconnect from us
   * @param  {String}  oldest identifier of the peer we just connect sample ids
   * @return {Promise} Resolved when all disconnection are finished
   * @private
   */
  async _disconnectSample (sample, oldest) {
    const notdisconnected = []
    const promises = []
    sample.forEach(peerId => {
      promises.push(new Promise((resolve, reject) => {
        this.unlock(peerId) // eslint-disable-line
        this.disconnect(peerId).then(() => {
          this._balance--
          resolve()
        }).catch(e => {
          this.debug(new Error(`PeerId: ${peerId} oldest=${oldest} Message:` + e.message, e))
          notdisconnected.push(peerId)
          resolve()
        })
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
   * @private
   */
  _pickNeighbour (arr) {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  /**
   * Get a sample of peers with the oldest
   * @param  {Boolean} [withOldest=true] determine if we want the oldest or not
   * @return {Object} Object = {available: Array<String>, oldest: <String>}
   * @private
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
      if (this._shuffling) {
        this.debug('[%s] Shuffling already active...', this.id)
        resolve()
      } else {
        this.bufferize(this._exchangeBis, [], resolve, reject)
      }
    })
  }

  /**
   * Exchange mechanism
   * @return {Promise}
   * @private
   */
  _exchangeBis () {
    return new Promise((resolve, reject) => {
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
                  console.warn('[%s] Please remove a random arc', this.id)
                }
                done()
              }).catch(e => {
                console.warn('[%s] Please report, not possible in this part (disconnect oldest only)', this.id)
              })
            }).catch(e => {
              this._disconnectSample([oldest], oldest).then((res) => {
                if (res.length > 0) {
                  console.warn('[%s] Please remove a random arc', this.id)
                }
                done()
              }).catch(e => {
                console.warn('[%s] Please report, not possible in this part (disconnect oldest only)', this.id)
              })
            })
          }).catch(e => {
            done(e)
          })
        } else {
          // no neighbor, perhaps disconnected.
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
                const toDisconnect = []
                result.notconnected.forEach(id => {
                  if (id === this.id) {
                    // this.unlock(oldest)
                    // problem with connection establishment, onArcDown
                    this._onArcDown(oldest)
                    toDisconnect.push(oldest)
                  } else {
                    // this.unlock(id)
                    // problem with connection establishment, onArcDown
                    this._onArcDown(id)
                    toDisconnect.push(id)
                  }
                })
                result.connected.forEach(id => {
                  if (id === this.id) {
                    toDisconnect.push(oldest)
                  } else {
                    toDisconnect.push(id)
                  }
                })
                // add the connection to oldest into the list of disconnected socket
                // result.connected.push(oldest)
                toDisconnect.push(oldest)
                // need to unlock all connections and disconnect all result.connected peer from us
                this.debug('[%s] Disconnect a sample of %f peers', this.id, toDisconnect.length)
                this._disconnectSample(toDisconnect /* result.connected */, oldest).then((notdisconnected) => {
                  if (notdisconnected.length > 0) {
                    console.error(new Error('Need to delete arcs, please report.'))
                  }
                  done()
                }).catch(e => {
                  // need to remove a random arcs
                  console.error('[%s] disconnect a sample crashed: Must never happen, please report!', e)
                  done(e)
                })
              }).catch(e => {
                console.error('[%s] connect a sample crashed: Must never happen, please report!', e)
                done(e)
              })
            }).catch(e => {
              this.debug('[%s] Cannot contact the oldest, perhaps make a onPeerDown?', this.id, e)
              done(e)
            })
          }).catch(e => {
            this.debug('[%s] Cannot reverse the arc (exchange part 2)', this.id, e)
            done(e)
          })
        } else {
          this.debug('[%s] We do not have oldest (%s) in our outview, stop.', this.id)
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
   * @private
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
          const toDisconnect = []
          result.notconnected.forEach(id => {
            if (id === this.id) {
              this._onArcDown(neighbor)
              toDisconnect.push(neighbor)
            } else {
              this._onArcDown(id)
              toDisconnect.push(id)
            }
          })
          // replace occurences of our id by the exchanging peer.
          result.connected.forEach(id => {
            if (id === this.id) {
              toDisconnect.push(neighbor)
            } else {
              toDisconnect.push(id)
            }
          })
          // readd the occurence of the neighbor before disconnecting them
          this.debug('[%s] Disconnect a sample of %f peers', this.id, toDisconnect.length)
          this._disconnectSample(toDisconnect /* result.connected */, neighbor).then((notdisconnected) => {
            if (notdisconnected.length > 0) {
              console.error(new Error('Need to delete arcs, please report.'))
            }
            done()
          }).catch(e => { // catch disconnectSample
            console.error('[%s] disconnect a sample crashed: Must never happen, please report!', e)
            done(e)
          })
        }).catch(e => { // catch connectSample
          console.error('[%s] connect a sample crashed: Must never happen, please report!', e)
          done(e)
        })
      }
    })
  }
  /**
     * The function called when a neighbor is unreachable and
     * supposedly crashed/departed. It probabilistically duplicates an arc.
     * @param {string} peerId The identifier of the peer that seems down.
     * @parem {Number} occurences Number of occurences for the connection to the peer identified by peerId
     * @return {void}
     * @private
     */
  _onPeerDown (peerId, occurences) {
    let occ = occurences
    // #2 probabilistically recreate arcs to a known peer
    const out = [...this.livingOutview.values()].reduce((acc, cur) => acc + cur.occurences, 0)
    const proba = this.options.spray.a / (out + occ)
    if (this.getNeighbours().size > 0) {
      this.debug('[%s] (outview) onPeerDown %s ==> XXX %s XXX', this.id, this.id, peerId)
      let neigh = this.getNeighbours()
      neigh = neigh.map(p => p.id)
      // remove the down peer identifier from the view...
      if (neigh.includes(peerId)) {
        neigh.splice(neigh.indexOf(peerId), 1)
      }
      this.debug('[%s] (outview) onPeerDown %s ==> %s, outview size: %f', this.id, this.id, peerId, neigh.length)
      // #A normal behavior
      for (let i = 0; i < occ; ++i) {
        if (Math.random() > proba) {
          const rn = Math.floor(Math.random() * neigh.length)
          const p = neigh[rn]
          // probabilistically duplicate the least frequent peers
          this.debug('[%s] (outview) onPeerDown(%s) adding probabilistically an arc from %s to us', this.id, peerId, p)
          this.lock(p)
          this.connect4u(null, p).then(() => {
            this.unlock(p)
            this.debug('[%s] (outview) onPeerDown(%s) arc added from us to %s.', this.id, peerId, p)
            this._balance++
          }).catch(e => {
            this.unlock(p)
            console.warn('[%s] (onPeerDown(%s), outview) An arc could not be established with %s, It could unbalance the network.', this.id, p, e.message)
          })
        }
      }
    } else {
      let neigh = this.getNeighboursInview()
      neigh = neigh.map(p => p.id)
      // remove the down peer identifier from the view...
      if (neigh.includes(peerId)) {
        neigh.splice(neigh.indexOf(peerId), 1)
      }
      this.debug('[%s] (inview) onPeerDown %s ==> %s, inview size: %f', this.id, this.id, peerId, neigh.length)
      if (neigh.length > 0) {
        this.debug('[%s] (inview) onPeerDown %s ==> XXX %s XXX', this.id, this.id, peerId)
        // #A normal behavior
        for (let i = 0; i < occ; ++i) {
          if (Math.random() > proba) {
            const rn = Math.floor(Math.random() * neigh.length)
            const p = neigh[rn]
            // probabilistically duplicate the least frequent peers
            this.debug('[%s] (inview) onPeerDown(%s) adding probabilistically an arc from %s to us', this.id, peerId, p)
            // try the inview
            this.connectToUs(p, undefined, false).then(() => {
              this.debug('[%s] (inview) onPeerDown(%s) arc added from %s to us.', this.id, peerId, p)
              this._balance++
            }).catch(e => {
              console.warn('[%s] (onPeerDown(%s), inview) An arc could not be established with %s, It could unbalance the network.', this.id, p, e.message)
            })
          }
        }
      } else {
        console.warn('[%s] (onPeerDown(%s), outview and inview) cannot establish %f connections: No neighbors....', this.id, peerId, occurences)
      }
    }
  }
  /**
     * A connection failed to establish properly, systematically
     * duplicates an element of the partial view.
     * @param {string|null} peerId The identifier of the peer we failed to
     * establish a connection with. Null if it was yet to be known.
     * @return {void}
     * @private
     */
  _onArcDown (peerId) {
    let neigh = this.getNeighboursIds()
    if (neigh.includes(peerId)) {
      // remove peerId
      neigh.splice(neigh.indexOf(peerId), 1)
    }
    if (neigh.length > 0) {
      // #1 normal behavior
      const rNeigh = this._pickNeighbour(neigh)
      this.debug('[%s] (onArcDown/outview) %s =x> %s, add an arc to: %s', this.id, this.id, peerId, rNeigh)
      this.connect4u(null, rNeigh).then(() => {
        this._balance++
      }).catch(e => {
        console.warn('[%s] (onArcDown) An arc could not be established with %s, It could unbalance the network.', this.id, rNeigh, e.message)
      })
    } else {
      // #2 last chance behavior
      // ask inview
      let inview = this.getNeighboursInview()
      inview = inview.map(p => p.id)
      if (inview.includes(peerId)) {
        // remove peerId
        inview.splice(inview.indexOf(peerId), 1)
      }
      if (inview.length > 0) {
        const rNeigh = this._pickNeighbour(inview)
        this.debug('[%s] (onArcDown/inview) %s =x> %s, add an arc to: %s', this.id, this.id, peerId, rNeigh)
        this.connectToUs(rNeigh, undefined, false).then(() => {
          this._balance++
        }).catch(e => {
          console.warn('[%s] An arc could not be established with %s. Error: ', this.id, rNeigh, e.message)
        })
      } else {
        console.warn('[%s] No arcs in the outview and in the outview, it means that we are alone in the dark...', this.id)
      }
    }
  }

  /**
     * Inject a*log(N) + b arcs leading to peerId. When parameters are
     * not integers, the floating part is added probabilistically.
     * @param {number} a  a * log
     * @param {number} b + b
     * @param {string} peerId The identifier of the peer to duplicate.
     * @return {Promise} Resolved when all connections are finished whenever they are rejected or resolved.
     * @private
     */
  _inject (a, b, from, to) {
    let res = {
      yes: 0,
      no: 0
    }
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
          res.yes++
          resolve()
        }).catch(e => {
          if (from === null) {
            // problem with connection establishment, onArcDown
            this._onArcDown(to)
          } else {
            // problem with connection establishment, onArcDown
            this._onArcDown(from)
          }
          res.no++
          this.debug('[%s] error copyA normal inject, an arc was not added: ', this.id, e)
          resolve()
        })
      }))
    })
    if (Math.random() < copyA) {
      promises.push(new Promise((resolve, reject) => {
        this.connect4u(from, to).then(() => {
          res.yes++
          resolve()
        }).catch(e => {
          if (from === null) {
            // problem with connection establishment, onArcDown
            this._onArcDown(to)
          } else {
            // problem with connection establishment, onArcDown
            this._onArcDown(from)
          }
          res.no++
          this.debug('[%s] error copyA random inject, an arc was not added: ', this.id, e)
          resolve()
        })
      }))
    }
    resB.forEach(p => {
      copyB -= 1
      promises.push(new Promise((resolve, reject) => {
        this.connect4u(from, to).then(() => {
          res.yes++
          resolve()
        }).catch(e => {
          if (from === null) {
            // problem with connection establishment, onArcDown
            this._onArcDown(to)
          } else {
            // problem with connection establishment, onArcDown
            this._onArcDown(from)
          }
          res.no++
          this.debug('[%s] error copyB normal inject, an arc was not added: ', this.id, e)
          resolve()
        })
      }))
    })
    if (Math.random() < copyB) {
      promises.push(new Promise((resolve, reject) => {
        this.connect4u(from, to).then(() => {
          res.yes++
          resolve()
        }).catch(e => {
          if (from === null) {
            // problem with connection establishment, onArcDown
            this._onArcDown(to)
          } else {
            // problem with connection establishment, onArcDown
            this._onArcDown(from)
          }
          res.no++
          this.debug('[%s] error copyB random inject, an arc was not added: ', this.id, e)
          resolve()
        })
      }))
    }

    return Promise.all(promises).then(() => {
      return res
    })
  }
}

module.exports = Spray
