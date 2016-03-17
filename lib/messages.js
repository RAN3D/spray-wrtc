/*!
 * \brief message requesting an exchange of neighborhood
 * \param id the identifier of the request message
 * \param peer the identity of the initiator of the exchange
 */
function MExchange(id, peer){
    this.protocol = 'spray';
    this.type = 'MExchange';
    this.id = id;
    this.peer = peer;
};
module.exports.MExchange = MExchange;
