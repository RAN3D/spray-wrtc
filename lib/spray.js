var Socket = require("simple-peer");

var PartialView = require("./partialview.js");
var Sockets = require('./sockets.js');
var GUID = require('./guid.js');

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
    var oldest = this.partialView.getOldest();
    // #2A get a sample
    var sample = this.partialView.getSample({id:this.ID}, oldest, true);
    for (var i = 0; i < sample.length; ++i){
        // #2B register the forwarding destination
        var message = new MRequestTicket(GUID());
        this.forwards.addSocket(this.sockets.getSocket(oldest),message);
        // #2C send a ticket request        
        this.send(message, sample[i]);
    };
    // #2D notify chosen peer that we start an exchange with it
    var mExchange = new MExchange(GUID(), this.ID);
    this.send(mExchange, oldest);
    // #3 remove the sent sample from our partial view
    // #4 remove from the sockets dictionnary
};

/*!
 * \brief event executed when "this" receives an exchange request
 * \param initiator the peer that request the exchange
 */
Spray.prototype.onExchange = function(initiator){
    // #1 get a sample
    var sample = this.partialView.getSample(this.ID, initiator, false);
    // #2A 
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
    var socket = new Socket({initiator:true, trickle:true}),// (TODO) add config
        self = this;
    
    // #A get the offer ticket from the stun service    
    socket.on('signal', function(data){
        // #1 register this socket in pending sockets dictionnary
        var message = new MRequestTicket(id);
        self.pending.addSocket(socket, message);
        // #2 sends it to the requester with along with a unique identifier
        self.send(message);
    });
    // #B successful connection establishment
    socket.on('connect', function(){
        console.log('wrtc: successful connection establishment');
        // #1 remove from the pending sockets dictionnary
        self.pending.removeSocket(message);
    });
    socket.on('close', function(){
        console.log('wrtc: a connection has been closed');
    });
    // #C receive a message
    socket.on('data', function(){
        // #1 check if it is a membership message, otherwise do nothing
        // (TODO) split type of possible message between
        // partial view (stampedticket) and inview (here) ?
        self.receive(message, socket);
    });
    
    // #D add a timeout on connection establishment
    setTimeout(function(){
        // #1 check if it the connection established, otherwise, clean socket
        if (self.pending.contains(message){
            self.pending.removeSocket(message);
            socket.destroy();            
        };
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
        self.receive(message, socket);
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
        this.forwards.removeSocket(message);
        break;
    case 'MRequestTicket':
        // #0 register the requester
        this.forwards.addSocket(socket, message);
        // #1 do the rest (create ticket and send it)
        this.onTicketRequest(message.id);
        break;
    case 'MOfferTicket':
        // #0 register the sender to forward the stamped ticket
        this.forwards.addSocket(socket, message);
        // #1 pack the offers to send them at once (TODO)
        break;
    case 'MStampedTicket':
        // #0 get the initial offer
        var offer = this.pending.getSocket(message);
        // #1 apply the stamped ticket
        offer.signal(message.ticket);
        break;
    case 'MRequest':
        // #0 register the requester
        this.forwards.addSocket(socket, message);
        // #1 starts to request offers from its neighborhood 
        break;
    };
};

module.exports = Spray;
