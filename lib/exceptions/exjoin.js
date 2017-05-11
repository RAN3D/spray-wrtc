'use strict';

/**
 * Exception threw when the joining phase of Spray does not work as intended.
 */
class ExJoin {
    /**
     * @param {string} source The name of the function that threw the exception.
     * @param {string} reason The reason the joining failed.
     */
    constructor (source, reason) {
        this.source = source;
        this.message = reason;
    };
};

module.exports = ExJoin;
