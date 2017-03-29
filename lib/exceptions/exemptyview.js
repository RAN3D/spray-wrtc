'use strict';

/**
 * Exception that rises when the partial view is used as if there were neighbors
 * populating it, whereas there are none.
 */
class ExEmptyView {
    /**
     * @param {string} source The function that throws the exception.
     */
    constructor (source) {
        this.source = source;
        this.message = 'Partial view is used as it was not empty, yet it is.';
    };
};

module.exports = ExEmptyView;

