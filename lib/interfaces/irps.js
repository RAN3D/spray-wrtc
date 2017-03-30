'use strict';

const debug = require('debug')('irps');
const EventEmitter = require('events');

const MEvent = require('../messages/mevent.js');

/**
 * An interface providing easy-to-use functions on top of Spray
 */
class IRPS extends EventEmitter {
    /**
     * @param {string} protocolId The identifier of the protocol that request
     * the interface.
     * @param {object} parent The instanciator. It must implement 
     * 'send(to, message [,retry])'.
     */
    constructor (protocolId, parent) {
        super();
        this.PID = protocolId;
        this.parent = parent;
        
        debug('[%s] just registered to %s.', this.PID, this.parent.PID);
        
        // #1 replace the basic behavior of eventemitter.emit
        this._emit = this.emit;
        this.emit = (event, peerId, ...args) => {
            parent.send(peerId, new MEvent(this.PID, event, args))
                .then( () => debug('[%s] %s --> %s', this.PID, event, peerId))
                .catch( (e) =>debug('[%s] %s -X> %s', this.PID, event, peerId));
        };
    };

    /**
     * @private
     * Destroy all listeners and remove the send capabilities
     */
    _destroy () {
        debug('[%s] just unregistered from %s.', this.PID, this.parent.PID);
        this.removeAllListener();
        this.emit = this._emit; // retrieve basic behavior
    };
    
    /**
     * @private
     * Receiving a MEvent message triggers an event
     * @param {MEvent} message The message received.
     */
    _receive (message) {
        debug('[%s] ??? --> triggers %s', this.PID, message.event);
        this._emit(message.event, ...(message.args));
    };

};

module.exports = IRPS;
