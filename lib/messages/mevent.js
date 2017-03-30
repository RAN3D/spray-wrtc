'use strict';

/**
 * A message that will trigger an event at protocolId.
 */ 
class MEvent {
    /**
     * @param {string} protocolId The identifier of the protocol that send and
     * receive the event.
     * @param {string} event The event name to trigger. 
     * @param {object[]} args The arguments of the event.
     */
    constructor (protocolId, event, args) {
        this.pid = protocolId;
        this.event = event;
        this.args = args;
        this.type = 'MEvent';
    };    
};


module.exports = MEvent;
