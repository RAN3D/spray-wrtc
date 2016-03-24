/*!
 * \brief message requesting an exchange of neighborhood
 * \param inview the identifier of the inview
 * \param outview the identifier of the outview
 */
module.exports.MExchange = function(inview, outview){
    return {protocol: 'spray-wrtc',
            type: 'MExchange',
            inview: inview,
            outview: outview};
};
