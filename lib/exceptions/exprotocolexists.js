'use strict';

/**
 * Exception that rise when a protocol registers and its identifier already
 * exists in registered protocols of spray.
 */
class ExProtocolExists {
    /**
     * @param {string} protocolId The identifier of the protocol that already
     * exists
     */
    constructor (protocolId) {
        this.pid = protocolId;
        this.message = 'The idenfifier of the registering protocol already exists.';
    };
};

module.exports = ExProtocolExists;
