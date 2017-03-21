'use strict';

const  EventEmitter = require('events');
const  NO = require('n2n-overlay-wrtc');
const  PartialView = require('./partialview.js');
const  MExchange = require('./messages.js');
const  _ = require('lodash');

/**
 * Implementation of the random peer sampling Spray
 */
class Spray extends EventEmitter {
	/**
	 * You can pass other parameters such as webrtc options
	 * @param {object} options Object with all options
	 * @param {string} options.protocol The protocol of the network
	 * @param {integer} options.deltatime Each deltatime, we shuffle !
	 * @param {integer} options.retry Number of retry when we send a message
	 * @param {integer} options.usedCoef Amount of clients shuffled between 0 and 1 (ie, [0;1])
	 * @param {integer} options.profile your profile
	 * @param {integer} options.k k profile saved
	 */
	constructor (options = {}) {
		super();

		// merge of options with default options
		this.opts = _.merge({
			protocol: 'spray-wrtc',
			encoding: (message) => {
				return JSON.stringify(message);
				// return new Buffer('message');
			},
			decoding: (message) => {
				return JSON.parse(message);
			},
			deltatime: 1000 * 60 * 2,
			retry: 10,
			k: 10,
			profile: {},
			usedCoef: 0.5,
			verbose: false
		}, options);

		this.verbose = this.opts.verbose;
		// #A constants
		this.protocol = this.opts.protocol;
		this.DELTATIME = this.opts.deltatime; // 2min
		this.RETRY = this.opts.retry; // retry 10x to send messages

		// at each suffling the profile is sent to all neighbours
		this.k = this.opts.k;
		this.profile = this.opts.profile;

		// #B protocol variables
		this.partialView = new PartialView( {
			usedCoef: this.opts.usedCoef
		});

		this.neighborhoods = new NO(this.opts);

		// update the profile with some identifiers
		this.profile.inviewId = this.neighborhoods.i.ID;
		this.profile.outviewId = this.neighborhoods.o.ID;

		this.state = 'disconnect'; // (TODO) update state

		// #C periodic shuffling
		const self = this;
		setInterval(() => {
			if(self.partialView.length() > 0) {
				self.exchange();
			}
		}, this.DELTATIME);

		// #D receive event
		function receive (id, message) {
			// #0 must contain a message and a protocol, otherwise forward
			if (message && message.type === 'MExchange' && message.protocol !== self.protocol) {

				if(!message.view) {
					self.onExchange(message);
				} else {
					// this.log(message.view.outviewId, message.view);
					self.views.set(message.view.outviewId, message.view);
				}

			} else if (!message || message.protocol !== self.protocol) {
				if (message && message.protocol) {
					self.emit(`${message.protocol}-receive`, id, message);
				} else {
					self.emit('receive', id, message);
				}
			}
		}

		this.neighborhoods.on('receive', receive);
		this.neighborhoods.on('ready', (id, view) => {
			const config = {
				age: 0,
				id
			};
			(view === 'outview') && self.partialView.addNeighbor(config);
			self.updateState();
		});

		this.neighborhoods.on('failed', (id, view, reason) => {
			this.log('Spray:on:Failed:', id, view, reason);
			(view === 'outview') && self.onArcDown();
		});

		this.neighborhoods.on('disconnect', () => {
			self.updateState();
		});

	}

	log (...args) {
		if(this.verbose) {
			console.log('[SPRAY-WRTC]', args);
		}
	}

	/**
	 * Joining as; or contacted by an outsider
	 * @param {callback} callbacks the callbacks function, see module 'n2n-overlay-wrtc'.
	 * @param {object} message ...
	 * @return {void}
	 */
	connection (callbacks, message) {
		const self = this;
		const onReadyFunction = callbacks && callbacks.onReady;
		// #1 if this peer is the contact, overload the onready function
		// with the spray joining mechanism that will inject log(x) arcs in
		// the network
		if (message) {
			callbacks.onReady = id => {
				if (self.partialView.length() > 0) {
					// #A signal the arrival of a new peer to its outview
					self.partialView.get().forEach(n => {

						if(n.id !== id) {
							self.neighborhoods.connect(n, id);
						}else {
							this.log('n:', n, '| id:', id);
						}
					});
				} else {
					// #B adds it to its own outview (for only 2-peers network)
					self.neighborhoods.connect(null, id);
				}
				// #C callback the original onReady function
				onReadyFunction && onReadyFunction(id);
			};
		} else {
			callbacks.onReady = id => {
				onReadyFunction && onReadyFunction(id);
				// #D emit a join event
				self.emit('join', id);
			};
		}
		// #2 start establishing the first connection
		this.neighborhoods.connection(callbacks, message);
	}

	/**
	 * Leave the network
	 * @param {integer} timer the timeout before really shutting down. The time can
	 * be spent on healing the network before departure. (In milliseconds)
	 * @return {void}
	 */
	leave (timer) {
		setTimeout(function () {
			this.partialView.clear();
			this.neighborhoods.disconnect();
		}, timer);
	}


	/**
	 * Get a set of neighbors from both inview and outview. It is worth
	 * noting that each peer controls its outview, but not its inview. Thus, the
	 * outview may be less versatile.
	 * @param {integer} k the number of neighbors requested, if k is not defined, it returns
	 * every known identifiers.
	 * @return {object} { i:[id1,id2...idk], o:[id1,id2...idk] }
	 */
	getPeers (k) {
		let result = {
			i: [],
			o: []
		};
		// #A copy the identifiers of the inview
		const inview = this.neighborhoods.get('inview');
		for (let i = 0; i < inview.length; ++i) {
			result.i.push(inview[i].id);
		}
		// #B remove entries if there are too many
		while (k && (result.i.length > k) && (result.i.length > 0)) {
			const rn = Math.floor(Math.random() * result.i.length);
			result.i.splice(rn, 1);
		}
		// #C copy the identifiers of the outview
		const outview = this.neighborhoods.get('outview');
		for (let i = 0; i < outview.length; ++i) {
			result.o.push(outview[i].id);
		}
		// #D remove entries if there are too many
		while (k && (result.o.length > k) && (result.o.length > 0)) {
			const rn = Math.floor(Math.random() * result.o.length);
			result.o.splice(rn, 1);
		}
		return result;
	}

	/**
	 * Send a message using the id of the arc used to communicate
	 * @param {string} id the identifier of the communication channel
	 * @param {object} message the message to send
	 * @param {integer} retry the number of times the protocol tries to send the message each seconds
	 * @return {boolean} true if the message has been sent at first try, false otherwise
	 */
	send (id, message, retry) {
		const r = retry || this.RETRY;
		const result = this.neighborhoods.send(id, message);
		const self = this;
		if (!result && r === 0) {
			// #1 if it fails to send the message, the peer is considered down
			self.onPeerDown(id);
		} else if (!result && r > 0) {
			// #2 give it another try
			setTimeout(() => {
				self.send(id, message, r - 1);
			}, 1000);
		}
		return result;
	}

	/**
	 * Get the string representation of the partial view of spray
	 * @return {string} String representation of the partialView
	 */
	toString () {
		let result = `@${this.neighborhoods.inview.ID};${this.neighborhoods.outview.ID}   [ `;
		const pv = this.partialView.get();
		for (let i = 0; i < pv.length; ++i) {
			result += `(${pv[i].age} ${pv[i].id}) `;
		}
		result += ']';
		return result;
	}


	// ====================================
	//        PRIVATE functions         //
	// ====================================

	/**
	 * Update the local connection state of the peer and emit an event
	 * if the state is different than at the previous call of this function.
	 * The emitted event is 'statechange' with the
	 * arguments 'connect' | 'partial' | 'disconnect'
	 * @return {void}
	 */
	updateState () {
		// (TODO) handle it without reaching the neighbor-wrtc module...
		if (this.neighborhoods.o.living.ms.arr.length > 0 &&
			this.neighborhoods.i.living.ms.arr.length > 0 &&
			this.state !== 'connect') {
			// #1 connected means (1+ inview, 1+ outview)
			this.state = 'connect';
			this.emit('statechange', 'connect');
		} else if (
			(this.neighborhoods.o.living.ms.arr.length === 0 &&
				this.neighborhoods.i.living.ms.arr.length > 0) ||
			(this.neighborhoods.o.living.ms.arr.length > 0 ||
				this.neighborhoods.i.living.ms.arr.length === 0) &&
			(this.state !== 'partial')) {
			// #2 partially connected means (1+ inview, 0 outview) or (0 i, 1+ o)
			this.state = 'partial';
			this.emit('statechange', 'partial');
		} else if (this.neighborhoods.o.living.ms.arr.length === 0 &&
			this.neighborhoods.i.living.ms.arr.length === 0 &&
			this.state !== 'disconnect') {
			// #3 disconnected means (0 inview, 0 outview)
			this.state = 'disconnect';
			this.emit('statechange', 'disconnect');
		}
	}

	/* *****************************************************************************
	 * Spray's protocol implementation
	 ******************************************************************************/

	/**
	 * Periodically called function that aims to balance the partial view
	 * and to mix the neighborhoods
	 * @return {void}
	 */
	exchange () {
		const self = this;

		let oldest = null;
		let sent = false;
		this.partialView.increment();
		// #1 get the oldest neighbor reachable
		while (!oldest && !sent && this.partialView.length() > 0) {
			// oldest = this.partialView.getOldest();
			oldest = this.partialView.getOldest();
			const message = new MExchange(null, this.neighborhoods.i.ID, this.neighborhoods.o.ID);
			sent = this.send(oldest.id, message, 0);
		}
		if (this.partialView.length() === 0) {
			this.log('Partial view is 0 length');
			return;
		}
		// #2 get a sample from our partial view
		const sample = this.partialView.getSample(oldest, true);
		// #3 establish connections oldest -> sample
		// #A remove the chosen arcs
		let i = 0;
		while (i < sample.length) {
			const e = sample[i];
			const removed = self.neighborhoods.disconnect(e.id);
			if (!removed) { // the partial view is late
				// #a inform the partial view of the departure of the peer
				self.onPeerDown(e.id);
				// #b clear the sample from references to this id
				let j = 0;
				while (j < sample.length) {
					if (sample[j].id === e.id) {
						sample.splice(j, 1);
					} else {
						++j;
					}
				}
			} else {
				// normal behavior
				self.partialView.removePeer(e.id, e.age);
				++i;
			}
		}
		// #B from oldest to chosen neighbor
		sample.forEach(e => {
			self.neighborhoods.connect(oldest.id, (e.id !== oldest.id) && e.id);
		});
		this.emit('shuffling', 'exchange');
	}


	/**
	 * Event executed when we receive an exchange request
	 * @param {object} msg message containing the identifier of the peer that started the
	 * exchange
	 * @return {void}
	 */
	onExchange (msg) {
		const self = this;
		// #1 get a sample of neighbors from our partial view
		this.partialView.increment();
		const sample = this.partialView.getSample(msg.inview, false);
		// #A remove the chosen neighbor from our partialview
		let i = 0;
		while (i < sample.length) {
			const e = sample[i];
			const removed = self.neighborhoods.disconnect(e.id);
			if (!removed) { // the partial view is late
				// #a inform the partial view of the departure of the peer
				self.onPeerDown(e.id);
				// #b clear the sample from references to this id
				let j = 0;
				while (j < sample.length) {
					if (sample[j].id === e.id) {
						sample.splice(j, 1);
					} else {
						++j;
					}
				}
			} else {
				// normal behavior
				self.partialView.removePeer(e.id, e.age);
				++i;
			}
		}
		// #B from initiator to chosen neigbhor
		sample.forEach(e => {
			self.neighborhoods.connect(msg.outview, (e.id !== msg.inview) && e.id);
		});
		this.emit('shuffling', 'onExchange');
	}

	/**
	 * The function called when a neighbor is unreachable and supposedly
	 * crashed/departed. It probabilistically keeps an arc up
	 * @param {string} id the identifier of the channel that seems down
	 * @return {void}
	 */
	onPeerDown (id) {
		this.log(`@spray: The peer ${JSON.stringify(id)} seems down.`);
		// #A remove all occurrences of the peer in the partial view
		const occ = this.partialView.removeAll(id);
		// #B probabilistically recreate an arc to a known peer
		if (this.partialView.length() > 0) {
			for (let i = 0; i < occ; ++i) {
				if (Math.random() > (1 / (this.partialView.length() + occ))) {
					const rn = Math.floor(Math.random() * this.partialView.length());
					this.neighborhoods.connect(null, this.partialView.array.arr[rn]);
				}
			}
		}
	}

	/**
	 * A connection failed to establish properly, systematically duplicates
	 * an element of the partial view.
	 * @return {void}
	 */
	onArcDown () {
		this.log('@spray: An arc failed to establish.');
		if (this.partialView.length() > 0) {
			const rn = Math.floor(Math.random() * this.partialView.length());
			this.neighborhoods.connect(null, this.partialView.array.arr[rn]);
		}
	}

}


module.exports = Spray;
