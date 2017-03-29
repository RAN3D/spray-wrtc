'use strict';

/**
 * Message requesting an exchange of neighborhood
 */
class MExchange {
    /**
     * @param {string} inview the identifier of the inview
     * @param {string} outview the identifier of the outview
     */
    constructor (inview, outview) {
        this.inview = inview;
        this.outview = outview;
        this.type = 'MExchange';
    };
 };

module.exports = MExchange;
