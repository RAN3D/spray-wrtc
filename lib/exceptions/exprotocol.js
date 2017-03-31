'use strict';

/**
 * Exception that rise when protocols do not behave!
 */
class ExProtocol {
    /**
     * @param {string} source The name of the function that threw this
     * exception.
     * @param {string} protocolId The identifier of the protocol that already
     * exists.
     * @param {string} reason The reason of this exception.
     */
    constructor (source, protocolId, reason) {
        this.pid = protocolId;
        this.message = 'The idenfifier of the registering protocol already exists.';
    };
};

module.exports = ExProtocol;
