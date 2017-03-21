'use strict';
/**
 * message requesting an exchange of neighborhood
 * @param {string} inview the identifier of the inview
 * @param {string} outview the identifier of the outview
 * @param {string} protocol the protocol that creates the message
 * @param {object} view View of the client
 * @return {object} Return an object with all parameters and some other details
 */
const MExchange = (inview, outview, protocol) => {
	return {
		protocol: protocol || 'spray-wrtc',
		type: 'MExchange',
		inview: inview,
    outview: outview
	};
 };

module.exports = MExchange;
