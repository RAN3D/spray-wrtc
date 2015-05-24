var Socket = require("simple-peer");

var PartialView = require("./partialview.js");
var Sockets = require("./sockets.js");
var GUID = require("./guid.js");

/*!
 * \brief Implementation of the random peer sampling called Spray on top of
 * socket.io
 * \param port the port listened
 */
function Spray(id, options){
    // #A constants
    this.DELTATIME = 1000 * 60 * 10; // 10min
    this.TIMEOUT = 1000 * 60 * 0.5 // 30s
    this.ID = id;
    
    // #B protocol variables
    this.partialView = new PartialView();
    this.sockets = new Sockets();
    this.pending = new Sockets();
    this.forwards = new Sockets();
    
    // #C webrtc specifics
    var self = this;
    setInterval(function(){
        if (self.partialView.length()>0){
            self.exchange();
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
    var message = new MJoin();
    this.send(message, contact);
};

/*!
 * \brief periodically called function that aims to balance the partial view
 * and to mix the neighbors inside them
 */
Spray.prototype.exchange = function(){
    // #1 get the oldest neighbor
    var oldest = self.partialView.getOldest();
    // #2A get a sample
    var sample = self.partialView.getSample(self.ID, oldest, true);
    // #2B register the forwarding destination
    var message = new MRequest(GUID());
    self.forwards.addSocket(self.sockets.getSocket(oldest),message);
    // #2C send a ticket request
    for (var i = 0; i < sample.length; ++i){
        self.send(message, sample[i]);
    };
    // #3 remove the sent sample from our partial view
    // (TODO) maybe wait for the stamped ticket to remove
    // #4 remove from the sockets dictionnary
};

/*!
 * \brief the function called when a neighbor is unreachable and supposedly
 * crashed/departed. It probabilistically keeps an arc up
 * \param peer the peer that cannot be reached
 */
Spray.prototype.onPeerDown = function(peer){
    // #A remove all occurrences of the peer in the partial view
    // #B probabilistically recreate an arc to a known peer
};

/*!
 * \brief a connection failed to establish properly, systematically duplicates
 * an element of the partial view.
 */
Spray.prototype.onArcDown = function(){
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
 * \param peer the identifier of the message which states the request
 */
Spray.prototype.onTicketRequest = function(id){
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

/*!
 * \brief send a message to a particular peer. If no peer are passed in
 * arguments, it will try to forwards it the appropriate peer.
 * \param message the message to send
 * \param peer the peer targeted
 */
Spray.prototype.send = function(message, peer){
    if (peer === null || peer === undefined){
        // #1 check in the forward database
    } else {
        // #2 check in the dictionnary of socket
        var socket = this.sockets.getSocket(peer);
        if (socket !== null){
            // #3 send the message
            socket.send(message);
        };
    };
};

/*!
 * \brief receive a membership message and process it accordingly
 * \param message the received message
 * \param socket the socket from which we receive the message
 */
Spray.prototype.receive = function(message, socket){
    switch (message.type){
    case 'MJoin':
        // #0 register the join message
        this.forwards.addSocket(socket, message);
        for (var i = 0; i < this.partialView.length(); ++i){
            // #1 request an offer ticket for each neighbor
            var mRequestTicket = new MRequestTicket(GUID());
            // #2 register the forwarding
            this.forwards.addSocket(
                this.sockets.getSocket(this.partialView.array.arr[i]),
                mRequestTicket);
            // #3 send the message to the newcomer
            this.send(mRequestTicket, message);
        };
        // #4 unregister the joining message
        this.forwards.removeSocket(); // (XXX)
        break;
    case 'MRequestTicket': break;
    case 'MOfferTicket': break;
    case 'MStampedTicket': break;
    };
};

module.exports = Spray;
