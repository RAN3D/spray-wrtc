/*!
 * MJoin(id)
 * MRequestTicket(id)
 * MOfferTicket(id, ticket, peer)
 * MStampedTicket(id, ticket)
 * MRequestExchange(id, offers)
 * MAnswerExchange(id, offers)
 */

/*!
 * \brief message requesting to join the network
 * \param id the identifier of the join message
 */
function MJoin(id){
    this.type = 'MJoin';
    this.id = id;
};
module.exports = MJoin;

/*!
 * \brief message requesting an offer ticket
 * \param id the identifier of the request message
 */
function MRequestTicket(id){
    this.type = 'MRequestTicket';
    this.id = id;
};
module.exports = MRequestTicket;

/*!
 * \brief an offer ticket containing the first part of the webrtc connection
 * establishment
 * \param id the unique identifier of the request message
 * \param ticket the first step of the connection establishement data
 * \param peer the peer that emit the offer ticket
 */
function MOfferTicket(id, ticket, peer){
    this.type = "MTicket";
    this.id = id;
    this.ticket = ticket;
    this.peer = peer;
};
module.exports = MTicket;

/*!
 * \brief an stamped ticket containing the second part of the webrtc connection
 * establishement
 * \param id the unique identifier of the request ticket
 * \param ticket the second step of the connection establishement data
 */
function MStampedTicket(id, ticket){
    this.type = "MStampedTicket";
    this.id = id;
    this.ticket = ticket;
};
module.exports = MStampedTicket;

/*!
 * \brief message embedding the offer ticket to send to the chosen neigbhor
 * \param id the identifier of the request message
 * \param offers the offer ticket messages
 */
function MRequestExchange(id, offers){
    this.type = "MRequestExchange";
    this.id = id;
    this.offers = offers;
};
module.exports = MRequestExchange;

/*!
 * \brief message embedding the answer of the exchanging request
 * \param id the identifier of the answer message
 * \param offers the offer ticket messages
 */
function MAnswerExchange(id, offers){
    this.type = "MAnswerExchange";
    this.id = id;
    this.offers = offers;
};
module.exports = MAnswerExchange;
