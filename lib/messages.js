/*!
 * \brief message requesting an exchange of neighborhood
 * \param id the identifier of the exchange initiator
 */
module.exports.MExchange = function(id){
    return {protocol: 'spray-wrtc',
            type: 'MExchange',
            id: id };
};
