'use strict';

/**
 * Exception that rises when the peer looked for does not exist in the partial
 * view.
 */
class ExPeerNotFound {
    /**
     * @param {string} source The function that throw the error.
     * @param {string} [peerId = 'unknown'] The identifier of the peer if
     * defined.
     */
    constructor (source, peerId = 'unknown') {
        this.source = source;
        this.peer = peerId;
    };
};


module.exports = ExPeerNotFound;
