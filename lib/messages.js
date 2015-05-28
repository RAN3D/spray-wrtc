/*!
 * MJoin(id)
 * MRequestTicket(id)
 * MOfferTicket(id, ticket, peer)
 * MStampedTicket(id, ticket, peer)
 * MExchange(id, peer)
 */

/*!
 * \brief message requesting to join the network
 * \param id the identifier of the join message
 */
function MJoin(id){
    this.type = 'MJoin';
    this.id = id;
};
module.exports.MJoin = MJoin;

/*!
 * \brief message requesting an offer ticket
 * \param id the identifier of the request message
 */
function MRequestTicket(id){
    this.type = 'MRequestTicket';
    this.id = id;
};
module.exports.MRequestTicket = MRequestTicket;

/*!
 * \brief an offer ticket containing the first part of the webrtc connection
 * establishment
 * \param id the unique identifier of the request message
 * \param ticket the first step of the connection establishement data
 * \param peer the peer that emit the offer ticket
 */
function MOfferTicket(id, ticket, peer){
    this.type = "MOfferTicket";
    this.id = id;
    this.ticket = ticket;
    this.peer = peer;
};
module.exports.MOfferTicket = MOfferTicket;

/*!
 * \brief an stamped ticket containing the second part of the webrtc connection
 * establishement
 * \param id the unique identifier of the request ticket
 * \param ticket the second step of the connection establishement data
 * \param peer the peer that emit the stamped ticket
 */
function MStampedTicket(id, ticket, peer){
    this.type = "MStampedTicket";
    this.id = id;
    this.ticket = ticket;
    this.peer = peer;
};
module.exports.MStampedTicket = MStampedTicket;

/*!
 * \brief message requesting an exchange of neighborhood
 * \param id the identifier of the request message
 * \param peer the identity of the initiator of the exchange
 */
function MExchange(id, peer){
    this.type = "MExchange";
    this.id = id;
    this.peer = peer;
};
module.exports.MExchange = MExchange;
