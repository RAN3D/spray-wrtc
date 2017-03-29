'use strict';

/**
 * Message requesting an exchange of neighborhood.
 */
class MExchange {
    /**
     * @param {string} inview The identifier of the inview.
     */
    constructor (inview) {
        this.inview = inview;
        this.type = 'MExchange';
    };
 };

module.exports = MExchange;
