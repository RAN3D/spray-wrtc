'use strict';

const debug = require('debug')('spray-wrtc');
// const  EventEmitter = require('events'); (TODO) maybe keep it
const N2N = require('n2n-overlay-wrtc');
const _ = require('lodash');

const PartialView = require('./partialview.js');

const MExchange = require('./messages/mexchange.js');
const MJoin = require('./messages/mjoin.js');

const ExEmptyView = require('./exceptions/exemptyview.js');

/**
 * Implementation of the random peer-sampling Spray. 
 */
class Spray extends N2N {
    /**
     * You can pass other parameters such as webrtc options
     * @param {object} [options = {}] Object with all options
     * @param {string} [options.pid = 'spray-wrtc'] The identifier of this
     * protocol. 
     * @param {integer} options.delta Every delta milliseconds, Spray shuffles
     * its partial view with its oldest neighbor.
     */
    constructor (options = {}) {
        // #0 initialize our N2N-parent
        super(_.merge({ pid: 'spray-wrtc',
                        delta: 1000 * 60 * 2 }, options));
        // #1 constants (from N2N)
        // this.PID = protocol identifier
        // this.PEER = peer Id comprising inview and outview Ids
        debug('[%s] Initalized with ==> %s ==>', this.PID, this.PEER);
        // #2 initialize the partial view containing ages
        this.partialView = new PartialView();
        // #3 initialize the connectedness state of this protocol
        this.state = 'disconnect';
        // #4 periodic shuffling
        this.periodic = null;
        // #5 events
        this.on('receive', (peerId, message) => this._receive(peerId, message));
        this.on('stream', (peerId, message) => { } ); // (TODO) ?;
        this.on('ready', (peerId) => this._ready(peerId));
        this.on('fail', (peerId) => this._onArcDown(peerId));
    };

    /**
     * @private
     * Start periodic shuffling.
     */
    _start () {
        this.periodic = setInterval( () => {
            this._exchange();
        }, this.options.delta);
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
        } else if (message.pid) {
            // (TODO) vvvvv
            // this.protocols.get(message.pid).emit('receive', peerId, message.payoad);
        };
    };

    /**
     * @private
     * Behavior when a connection is ready to be added in the partial view.
     * @param {string} peerId The identifier of the new neighbor.
     */
    _ready (peerId) {
        this.partialView.addNeighbor(peerId);
    };
    
    /**
     * Joining as; or contacted by an outsider
     * @param {callback|MResponse} arg1 the callbacks function, see module
     * n2n-overlay-wrtc. Or a response message from the contact peer.
     * @param {MRequest} [arg2] A request message from the newcomer.
     */
    join (arg1, arg2) {
        if (typeof arg1 === 'function' && typeof arg2 === 'undefined') {
            // #1 very first call
            this.once('ready', (peerId) => {
                this.send(peerId, new MJoin());
            });
        };
        this.connect(arg1, arg2);            
    };

    /**
     * Behavior of the contact peer when a newcomer arrives.
     * @param {string} peerId The identifier of the newcomer.
     */ 
    _onJoin (peerId) {
        if (this.partialView.length > 0){
            // #1 all neigbors -> peerId
            this.partialView.forEach( (ages, neighbor) => {
                this.ages.forEach( (age) => {
                    this.connect(neighbor, peerId);
                });
            });
        } else {
            // #2 this -> peerId
            this.connect(null, peerId);
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
            this.partialView.view.forEach( (occ, peerId) => {
                peers.push(peerId);
            });
        } else {
            // #2 get random identifier from outview
            let out = [];
            this.partialView.view.forEach( (ages, peerId) => out.push(peerId) );
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
        return peers;       
    };

    /* *********************************
     * Spray's protocol implementation *
     ***********************************/

    /**
     * @private
     * Periodically called function that aims to balance the partial view
     * and to mix the neighborhoods.
     */
    _exchange () {
        if (this.partialView.length <= 0) { throw new ExEmptyView('exchange');};
        this.partialView.increment();
        const oldest = this.partialView.getOldest();
        // #1 send the notification to oldest that we perform an exchange
        this.send(oldest, new MExchange(this.II.peer))
            .then( () => {
                debug('[%s] %s ==> exchange ==> %s',
                      this.PID, this.PEER, oldest);
                // #A setup the exchange
                // #2 get a sample from our partial view
                let sample = this.partialView.getSample(oldest, true);
                // #3 replace occurrences to oldest by ours
                sample = sample.map( (peerId) => {
                    return ((peerId === oldest) && this.II.peer) || peerId;
                });
                // #4 connect oldest -> sample
                sample.forEach( (peerId) => {
                    this.connect(oldest, peerId);
                });
                // #5 remove our own connection
                // (TODO) maybe be more careful, i.e., wait for an answer
                sample = sample.map( (peerId) => {
                    return ((peerId === this.II.peer) && oldest) || peerId;
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
        debug('[%s] %s ==> exchange ==> %s', this.PID, neighbor, this.PEER);
        // #1 get a sample of neighbors from our partial view
        this.partialView.increment();
        let sample = this.partialView.getSample();
        // #2 replace occurrences of the initiator by ours
        sample = sample.map( (peerId) => {
            return (peerId === message.inview) && this.II.peer || peerId;
        });
        // #3 establish connections
        sample.forEach( (peerId) => {
            this.connect(neighbor, peerId);
        });
        // #4 inverse replacement
        sample = sample.map( (peerId) => {
            return (peerId === this.II.peer) && message.inview || peerId;
        });
        // #5 disconnect arcs
        sample.forEach( (peerId) => {
            this.disconnect(peerId);
            this.partialView.removeNeigbhor(peerId);
        });
    };

    /**
     * @private
     * The function called when a neighbor is unreachable and supposedly
     * crashed/departed. It probabilistically duplicates an arc.
     * @param {string} peerId The identifier of the peer that seems down.
     */
    _onPeerDown (peerId) {
        debug('[%s] ==> %s ==> ††† %s †††', this.PID, this.PEER, this.peerId);
        // #1 remove all occurrences of the peer in the partial view
        const occ = this.partialView.removeAll(peerId);
        // #2 probabilistically recreate arcs to a known peer
        if (this.partialView.length > 0) {
            // #A normal behavior
            for (let i = 0; i < occ; ++i) {
                if (Math.random() > (1 / (this.partialView.length + occ))) {
                    // probabilistically duplicates one of the least frequent
                    // peers
                    this.IO.connect(null, this.partialView.getLeastFrequent());
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
        if (this.partialView.length() > 0) {
            // #1 normal behavior
            this.IO.connect(null, this.partialView.getLeastFrequent());
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
