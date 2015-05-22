var PartialView = require("./partialview.js");
var Sockets = require("./sockets.js");

/*!
 * \brief Implementation of the random peer sampling called Spray on top of
 * socket.io
 * \param port the port listened
 */
function Spray(port, options){
    // #A constants
    this.DELTATIME = 1000 * 60 * 10; // 10min

    // #B protocol variables
    this.partialView = new PartialView();
    this.sockets = new Sockets();

    // #C webrtc specifics
    var self = this;
    setInterval(function(){
        if (self.partialView.length()>0){
            // #1 get the oldest neighbor            
            // #2 get a sample
            // #2A send a ticket request
            // #2B when the ticket request arrive, forward it to the oldest
            // neighbor
            // #2C it comes back sends it to the chosen neighbor
            // #3 send the sample to the exchanging peer
            // #4 remove the sent sample from our partial view and integrate
            // the received neighborhood
        };
    }, this.DELTATIME);
};

/*!
 * \brief join the network using the kwnon contact peer 
 * \param contact the known peer that will introduce us to the network
 */
Spray.prototype.join = function(contact){
    // #A gently ask to the contact peer to advertise your presence in the
    // network
};

/*!
 * \brief periodically called function that aims to balance the partial view
 * and to mix the neighbors inside them
 */
Spray.prototype.exchange = function(){
    // #A select the oldest peer
    // #B create a sample
    // #C send the sample
    // #D merge the received sample and remove the sent one
};

/*!
 * \brief the function called when a neighbor is unreachable and supposedly
 * crashed/departed
 * \param peer the peer that cannot be reached
 */
Spray.prototype.onUnreachable = function(peer){
    // #A remove all occurrences of the peer in the partial view
    // #B probabilistically recreate an arc to a known peer
};

/*!
 * \brief leave the network without giving notice
 */
Spray.prototype.leave = function(){
    // #A clean everything
    // #B that's all folks
};

/*!
 * \brief WebRTC specific event. A neighbor wants to exchange 'this' peer
 * with another of its neighbors.
 * \param peer the identity of the neighbor that requested the ticket
 * \return the ticket
 */
Spray.prototype.onTicketRequest = function(peer){
    
};


module.exports = Spray;
