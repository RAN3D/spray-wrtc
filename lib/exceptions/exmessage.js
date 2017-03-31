'use strict';

/**
 * Spray encountered a problem with a message.
 */
class ExMessage {
    /**
     * @param {string} source The name of the function that threw.
     * @param {object} message The incriminated message.
     * @param {string} reason The reason of the throw.
     */
    constructor (source, message, reason){
        this.source = source;
        this.message = message;
        this.reason = reason;
    };
};


module.exports = ExMessage;
