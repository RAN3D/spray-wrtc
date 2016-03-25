/*!
 * \brief message requesting an exchange of neighborhood
 * \param inview the identifier of the inview
 * \param outview the identifier of the outview
 * \param protocol the protocol that creates the message
 */
module.exports.MExchange = function(inview, outview, protocol){
    return {protocol: 'spray-wrtc',
            type: 'MExchange',
            inview: inview,
            outview: outview,
            protocol: protocol};
};
