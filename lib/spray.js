'use strict';

const debug = require('debug')('spray-wrtc');
const N2N = require('n2n-overlay-wrtc');
const _ = require('lodash');

const PartialView = require('./partialview.js');

const IRPS = require('./interfaces/irps.js');

const MExchange = require('./messages/mexchange.js');
const MJoin = require('./messages/mjoin.js');

const ExEmptyView = require('./exceptions/exemptyview.js');
const ExProtocol = require('./exceptions/exprotocol.js');
const ExMessage = require('./exceptions/exmessage.js');

/**
 * Implementation of the random peer-sampling Spray. 
 */
class Spray extends N2N {
    /**
     * You can pass other parameters such as webrtc options
     * @param {object} [options = {}] Object with all options
     * @param {string} [options.pid = 'spray-wrtc'] The identifier of this
     * protocol. 
     * @param {number} options.delta Every delta milliseconds, Spray shuffles
     * its partial view with its oldest neighbor.
     */
    constructor (options = {}) {
        // #0 initialize our N2N-parent
        super( _.merge({ pid: 'spray-wrtc',
                         delta: 1000 * 60 * 2,
                         timeout: 1000 * 60 * 1,
                         retry: 5}, options) );
        // #1 constants (from N2N)
        // this.PID = protocol identifier
        // this.PEER = peer Id comprising inview and outview Ids
        debug('[%s] Initalized with ==> %s ==>', this.PID, this.PEER);
        // #2 initialize the partial view containing ages
        this.partialView = new PartialView();
        // #3 initialize the connectedness state of this protocol
        this.state = 'disconnected';
        // #4 periodic shuffling
        this.periodic = null;
        // #5 events
        this.on('receive', (peerId, message) => this._receive(peerId, message));
        // this.on('stream', (peerId, message) => { } ); // (TODO) ?;
        this.on('open', (peerId) => {
            this._open(peerId);
            this._updateState();
        });
        this.on('close', (peerId) => {
            this._close(peerId);
            this._updateState();
        });
        this.on('fail', (peerId) => {
            this._onArcDown(peerId);
            this._updateState();
        });
        // #6 table of protocols using Spray
        this.protocols = new Map();
    };

    /**
     * Registers the protocol to Spray.
     * @param {string} protocolId The identifier of the protocol that registers.
     * @returns {IRPS} An interface providing easy-to-use functions on top of
     * Spray
     */
    register(protocolId) {
        if (!this.protocols.has(protocolId)) {
            this.protocols.set(protocolId, new IRPS(protocolId, this));
            return this.protocols.get(protocolId);
        } else {
            throw new ExProtocol('register', protocolId, 'already exists');
        };
    };

    /**
     * Unregisters the protocol.
     * @param {string} protocolId The identifier of the protocol that
     * unregisters.
     */
    unregister(protocolId) {
        if (this.protocols.has(protocolId)){
            this.protocols.get(protocolId).destroy();
            this.protocols.delete(protocolId);
        } else {
            throw new ExProtocol('unregister', protocolId, 'does not exist');
        };
    };
    
    /**
     * @private
     * Start periodic shuffling.
     */
    _start (delay = this.options.delta) {
        this.periodic = setInterval( () => {
            this._exchange();
        }, delay);
    };

    /**
     * @private
     * Stop periodic shuffling.
     */
    _stop () {
        clearInterval(this.periodic);
    };

    /**
     * @private
     * Called each time this protocol receives a message. Since it only sends 
     * MExchange messages, the rest are redirected to the appropriate protocol
     * registered on top of Spray.
     * @param {string} peerId The identifier of the peer that sent the message.
     * @param {object|MExchange} message The message received.
     */ 
    _receive (peerId, message) {        
        if (message.type && message.type === 'MExchange') {
            this._onExchange(peerId, message);
        } else if (message.type && message.type === 'MJoin') {
            this._onJoin(peerId);
        } else if (message.type && message.type === 'MEvent') {
            if (this.protocols.has(message.pid)) {
                this.protocols.get(message.pid)._receive(message);
            } else {
                throw new ExProtocol('_receive', message.pid, 'does not exist');
            };            
        } else {
            throw new ExMessage('_receive', message, 'unhandled');
        };
    };

    /**
     * @private
     * Behavior when a connection is ready to be added in the partial view.
     * @param {string} peerId The identifier of the new neighbor.
     */
    _open (peerId) {
        debug('[%s] %s ===> %s', this.PID, this.PEER, peerId);
        this.partialView.addNeighbor(peerId);
    };

    /**
     * @private
     * Behavior when a connection is closed.
     * @param {string} peerId The identifier of the removed arc.
     */
    _close (peerId) {
        debug('[%s] %s =†=> %s', this.PID, this.PEER, peerId);
    };

    
    /**
     * @private
     * Update the connectedness state of the peer.
     */
    _updateState () {
        const remember = this.state;
        if (this.i.size > 0 && this.o.size > 0 && remember !== 'connected'){
            this.state = 'connected';
        } else if ((this.i.size > 0 && this.o.size <= 0 ||
                    this.o.size > 0 && this.i.size <= 0) &&
                   remember !== 'partially connected'){
            this.state = 'partially connected';
        } else if (this.i.size <= 0 && this.o.size <= 0 &&
                   remember !== 'disconnected') {
            this.state = 'disconnected';
            // this._stop();
        };
        (remember !== this.state) && this.emit('statechange', this.state);
    };
    
    /**
     * Joining a network.
     * @param {callback} sender Function that will be called each time an offer
     * arrives to this peer. It is the responsability of the caller to send 
     * these offer (using sender) to the contact inside the network.
     * @returns {Promise} A promise that is resolved when the peer joins the 
     * network; rejected after a timeout, or already connected state.
     */
    join (sender) {
        const joinPromise = new Promise( (resolve, reject) => {
            // #0 connectedness state check
            (this.state !== 'disconnected') && reject('connected');
            // #1 set timeout before reject
            let to = setTimeout( () => {
                reject('timeout'); // (TODO) Join exception
            }, this.options.timeout);
            // #2 very first call, only done once
            this.once('open', (peerId) => {
                this.send(peerId, new MJoin(), this.options.retry);
                this._start(); // start shuffling process
                clearTimeout(to);
                resolve();
            });
        });
        this.connect(sender);
        return joinPromise;
    };

    /**
     * Behavior of the contact peer when a newcomer arrives.
     * @param {string} peerId The identifier of the newcomer.
     */ 
    _onJoin (peerId) {
        if (this.partialView.size > 0){
            // #1 all neigbors -> peerId
            debug('[%s] %s ===> join %s ===> %s neigbhors',
                  this.PID, peerId, this.PEER, this.partialView.size);
            this.partialView.forEach( (ages, neighbor) => {
                ages.forEach( (age) => {
                    this.connect(neighbor, peerId);
                });
            });
        } else {
            // #2 this -> peerId
            debug('[%s] %s ===> join %s ===> %s',
                  this.PID, peerId, this.PEER, peerId);
            this.connect(null, peerId);
            this._start();
        };
    };

    /**
     * Get k neighbors from the partial view. If k is not reached, it tries to
     * fill the gap with neighbors from the inview.  It is worth noting that
     * each peer controls its outview but not its inview. The more the neigbhors
     * from the outview the better.
     * @param {number} k The number of neighbors requested. If k is not defined,
     * it returns every known identifiers of the partial view.
     * @return {string[]} Array of identifiers.
     */
    getPeers (k) {
        let peers = []; 
        if (typeof k === 'undefined') {
            // #1 get all the partial view
            this.partialView.forEach( (occ, peerId) => {
                peers.push(peerId);
            });
        } else {
            // #2 get random identifier from outview
            let out = [];
            this.partialView.forEach( (ages, peerId) => out.push(peerId) );
            while (peers.length < k && out.length > 0) {
                let rn = Math.floor( Math.random() * out.length );
                peers.push( out[rn] );
                out.splice( rn, 1 );
            };
            // #3 get random identifier from the inview to fill k-entries
            let inView = [];
            this.i.forEach( (occ, peerId) => inView.push(peerId) );
            while (peers.length < k && inView.length > 0){
                let rn = Math.floor( Math.random() * inView.length );
                peers.push( inView[rn] );
                inView.splice( rn, 1 );
            };
        };
        debug('[%s] %s provides %s peers', this.PID, this.PEER, peers.length);
        return peers;       
    };

    /* *********************************
     * Spray's protocol implementation *
     ***********************************/

    /**
     * @private
     * Get a sample of the partial view.
     * @param {string} [peerId] The identifier of the oldest neighbor chosen to
     * perform a view exchange.
     * @return {string[]} An array containing the identifiers of neighbors from
     * this partial view.
     */
    _getSample (peerId) {
        let sample = [];
        // #1 create a flatten version of the partial view
        let flatten = [];
        this.partialView.forEach( (ages, neighbor) => {
            ages.forEach( (age) => {
                flatten.push(neighbor);
            });
        });
        // #2 process the size of the sample
        const sampleSize = Math.ceil(flatten.length / 2);
        // #3 initiator removes a chosen neighbor entry and adds it to sample
        if (typeof peerId !== 'undefined') {
            flatten.splice(flatten.indexOf(peerId), 1);
            sample.push(peerId);
        };
        // #4 add neighbors to the sample chosen at random
        while (sample.length < sampleSize) {
            const rn = Math.floor(Math.random() * flatten.length);
            sample.push(flatten[rn]);
            flatten.splice(rn, 1);
        };
        return sample;
    };

    /**
     * @private
     * Periodically called function that aims to balance the partial view
     * and to mix the neighborhoods.
     */
    _exchange () {
        // #0 if the partial view is empty --- could be due to disconnections,
        // failure, or _onExchange started with other peers --- skip this round.
        if (this.partialView.size <= 0) { return; }
        this.partialView.increment();
        const oldest = this.partialView.getOldest();
        // #1 send the notification to oldest that we perform an exchange
        this.send(oldest, new MExchange(this.getInviewId()), this.options.retry)
            .then( () => {
                // #A setup the exchange
                // #2 get a sample from our partial view
                let sample = this._getSample(oldest);
                debug('[%s] %s ==> exchange %s ==> %s',
                      this.PID, this.PEER, sample.length, oldest);
                // #3 replace occurrences to oldest by ours
                sample = sample.map( (peerId) => {
                    return ((peerId===oldest) && this.getInviewId()) || peerId;
                });
                // #4 connect oldest -> sample
                sample.forEach( (peerId) => {
                    this.connect(oldest, peerId);
                });
                // #5 remove our own connection
                // (TODO) maybe be more careful, i.e., wait for an answer
                sample = sample.map( (peerId) => {
                    return ((peerId===this.getInviewId()) && oldest) || peerId;
                });                
                sample.forEach( (peerId) => {
                    this.disconnect(peerId);
                    this.partialView.removeNeighbor(peerId);
                });
            }).catch( (e) => {
                // #B the peer cannot be reached, he is supposedly dead
                debug('[%s] %s =X> exchange =X> %s',
                      this.PID, this.PEER, oldest);                
                this._onPeerDown(oldest);
            });
    };


    /**
     * @private
     * Behavior when this peer receives a shuffling request.
     * @param {string} neighbor The identifier of the peer that sent this
     * exchange request.
     * @param {MExchange} message message containing the identifier of the peer
     * that started the exchange.
     */
    _onExchange (neighbor, message) {
        // #1 get a sample of neighbors from our partial view
        this.partialView.increment();
        let sample = this._getSample();
        debug('[%s] %s ==> exchange %s ==> %s',
              this.PID, neighbor, sample.length, this.PEER);
        // #2 replace occurrences of the initiator by ours
        sample = sample.map( (peerId) => {
            return (peerId===message.inview) && this.getInviewId() || peerId;
        });
        // #3 establish connections
        sample.forEach( (peerId) => {
            this.connect(neighbor, peerId);
        });
        // #4 inverse replacement
        sample = sample.map( (peerId) => {
            return (peerId===this.getInviewId()) && message.inview || peerId;
        });
        // #5 disconnect arcs
        sample.forEach( (peerId) => {
            this.disconnect(peerId);
            this.partialView.removeNeighbor(peerId);
        });
    };

    /**
     * @private
     * The function called when a neighbor is unreachable and supposedly
     * crashed/departed. It probabilistically duplicates an arc.
     * @param {string} peerId The identifier of the peer that seems down.
     */
    _onPeerDown (peerId) {
        debug('[%s] ==> %s ==> ††† %s †††', this.PID, this.PEER, peerId);
        // #1 remove all occurrences of the peer in the partial view
        const occ = this.partialView.removeAllNeighbor(peerId);
        // #2 probabilistically recreate arcs to a known peer
        if (this.partialView.size > 0) {
            // #A normal behavior
            for (let i = 0; i < occ; ++i) {
                if (Math.random() > (1 / (this.partialView.size + occ))) {
                    // probabilistically duplicates one of the least frequent
                    // peers
                    this.connect(null, this.partialView.getLeastFrequent());
                }
            }
        } else {
            // #B last chance behavior (TODO) ask inview
        };
    };

    /**
     * @private
     * A connection failed to establish properly, systematically duplicates
     * an element of the partial view.
     * @param {string|null} peerId The identifier of the peer we failed to 
     * establish a connection with. Null if it was yet to be known.
     */
    _onArcDown (peerId) {
        debug('[%s] ==> %s =X> %s', this.PID, this.PEER, peerId||'unknown');
        if (this.partialView.size > 0) {
            // #1 normal behavior
            this.connect(null, this.partialView.getLeastFrequent());
        } else {
            // #2 last chance behavior
            // (TODO) ask inview
            // const rn = Math.floor(Math.random() * this.i.size);
            // let it = this.i.keys();                        
            // this.II.connect(null, this.i.
        };
    };
};


module.exports = Spray;
