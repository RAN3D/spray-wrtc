

/*!
 * \brief an offer ticket containing the first part of the webrtc connection
 * establishment
 * \param id the unique identifier of the ticket
 * \param ticket the first step of the connection establishement data
 * \param peer the identifier of the peer
 */
function MTicket(id, ticket, peer){
    this.type = "MTicket";
    this.id = id;
    this.ticket = ticket;
    this.peer = peer;
};
module.exports = MTicket;

/*!
 * \brief an stamped ticket containing the second part of the webrtc connection
 * establishement
 * \param id the unique identifier of the ticket
 * \param ticket the second step of the connection establishement data
 */
function MStampedTicket(id, stampedTicket){
    this.type = "MStampedTicket";
    this.id = id;
    this.ticket = stampedTicket;
};
module.exports = MStampedTicket;
