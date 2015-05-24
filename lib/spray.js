var Socket = require("simple-peer");

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
    this.TIMEOUT = 1000 * 60 * 0.5 // 30s
    
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
    var socket = new Socket({initiator:true, trickle:true});// (TODO) add config
    
    // #A get the offer ticket from the stun service    
    socket.on('signal', function(data){
        // #1 register this socket in pending sockets dictionnary
        // #2 sends it to the requester with along with a unique identifier
    });
    // #B successful connection establishment
    socket.on("connect", function(){
        console.log("wrtc: successful connection establishment");
    });
    socket.on("close", function(){
        console.log("wrtc: a connection has been closed");
    });
    // #C receive a message
    socket.on("data", function(){
        // #1 check if it is a membership message, otherwise do nothing
    });
    
    // #D add a timeout on connection establishment
    setTimeout(function(){
        // #1 check if it the connection established, otherwise, clean socket
    }, this.TIMEOUT);
};

/*!
 * \brief WebRTC specific event. A neighbor sent a ticket to stamp.
 * \param id the identifier of the message carrying the ticket
 * \param ticket the offer ticket to stamp
 * \param peer the identifier of the emitting peer
 */
Spray.prototype.onStampedTicketRequest = function(id, ticket, peer){
    // #A if the socket already exists in the partial view, duplicate the entry
    
    // #B otherwise creates an answer
    var socket = new Socket({initiator:false, trickle:true});//(TODO) add config
    
    // #C get the stamped ticket from the stun service
    socket.on('signal', function(data){
        // #1 send it back to the emitter        
    });
    // #D successful connection establishment
    socket.on('connect', function(){
        console.log('wrtc: successful connection establishment');
        // #1 add it to the partial view
        // #2 add it to the dictionnary of sockets
    });
    // #E receive a message
    socket.on('data', function(message){
        // #1 check if it is a membership message, otherwise do nothing
    });

    // #F a timeout on connection establishment
    setTimeout(function(){
        // #1 check if the connection established, otherwise create a duplicate
        // at random in the partial view
    }, this.TIMEOUT);
};

module.exports = Spray;
