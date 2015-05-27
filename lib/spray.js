var EventEmitter = require('events').EventEmitter;
var Socket = require('simple-peer');
var util = require('util');

var PartialView = require('./partialview.js');
var Sockets = require('./sockets.js');
var GUID = require('./guid.js');

var Messages = require('./messages.js');
var MJoin = Messages.MJoin;
var MRequestTicket = Messages.MRequestTicket;
var MOfferTicket = Messages.MOfferTicket;
var MStampedTicket = Messages.MStampedTicket;
var MExchange = Messages.MExchange;

util.inherits(Spray, EventEmitter);

/*!
 * \brief Implementation of the random peer sampling called Spray on top of
 * socket.io
 * \param port the port listened
 */
function Spray(id, options){
    EventEmitter.call(this);
    // #A constants
    this.DELTATIME = 1000 * 60 * 10; // 10min
    this.TIMEOUT = 1000 * 60 * 2 // 2min
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
    var message = new MJoin(GUID());
    this.send(message, contact);
};

/*!
 * \brief periodically called function that aims to balance the partial view
 * and to mix the neighbors inside them
 */
Spray.prototype.exchange = function(){
    var self = this;
    var occ = 0; // number of occurrences to the other neighbor in the sample
    // #1 get the oldest neighbor
    var oldest = this.partialView.getOldest();
    // #2A get a sample
    var sample = this.partialView.getSample(oldest, true);
    for (var i = 0; i < sample.length; ++i){
        // #2B register the forwarding destination
        if (sample[i].id !== oldest.id){
            var message = new MRequestTicket(GUID());
            this.forwards.addSocket(this.sockets.getSocket(oldest),message);
            // #2C send a ticket request        
            this.send(message, sample[i]);
        } else {
            occ += 1;
        };
    };
    // #2D notify chosen peer that we start an exchange with it
    var mExchange = new MExchange(GUID(), {id:this.ID}, occ);
    this.send(mExchange, oldest);
    // #3 remove the sent sample from our partial view
    this.partialView.removeSample(sample);
    // #4 remove from the sockets dictionnary
    for (var i = 0; i < sample.length; ++i){
        if (!this.partialView.contains(sample[i])){
            var socket = this.sockets.removeSocket(sample[i])
            // #5 close the connection after timeout
            setTimeout(function(s){
                s.destroy();
            }, this.TIMEOUT, socket);
        };
    };

};

/*!
 * \brief event executed when "this" receives an exchange request
 * \param socket the socket from which we get the exchange message
 * \param initiator the peer that request the exchange
 * \param occ the number of occurrences in the sample of initiator
 */
Spray.prototype.onExchange = function(id, initiator, occ){
    // #1 get a sample
    var sample = this.partialView.getSample(this.ID, initiator, false);
    // #2 ask each peer in the sample to create offers to give to the initiator
    for (var i = 0; i < sample.length; ++i){
        // #2A register the forwarding destination
        if (sample[i].id !== initiator.id){
            var message = new MRequestTicket(GUID());
            this.forwards.addSocket(this.forwards.getSocket({id:id}), message);
            // #2B send a ticket request        
            this.send(message, sample[i]);
        } else {
            // #2C directly send a message stating the neighbor should add us
            var message = new MOfferTicket(id, null, {id:this.ID});
            this.send(message);
        };
    };
    // #3 add the socket to the dictionnary
    if (this.partialView.contains(initiator)){
        setTimeout(function(s){
            s.destroy();
        },this.TIMEOUT,this.forwards.getSocket({id:id}));
    } else {
        this.sockets.addSocket(this.forwards.getSocket({id:id}), initiator);
    }
    for (var i = 0; i < occ; ++i){
        this.partialView.addNeighbor(initiator);
    };

};

/*!
 * \brief the function called when a neighbor is unreachable and supposedly
 * crashed/departed. It probabilistically keeps an arc up
 * \param peer the peer that cannot be reached
 */
Spray.prototype.onPeerDown = function(peer){
    // #A remove all occurrences of the peer in the partial view
    var occ = this.partialView.removeAll(peer);
    // #B probabilistically recreate an arc to a known peer
    for (var i = 0; i < occ; ++i){
        if (Math.random() > (1/(this.partialView.length()+occ))){
            var rn = Math.floor(Math.random()*this.partialView.length());
            this.partialView.addNeigbhor(this.partialView.array.arr[rn]);
        };
    };
};

/*!
 * \brief a connection failed to establish properly, systematically duplicates
 * an element of the partial view.
 */
Spray.prototype.onArcDown = function(){
    var rn = Math.floor(Math.random()*this.partialView.length());
    this.partialView.addNeighbor(this.partialView.array.arr[rn]);
};

/*!
 * \brief leave the network without giving notice
 */
Spray.prototype.leave = function(){
    // #A clean the partial view
    for (var i = 0; i < this.partialView.length(); ++i){
        var socket = this.sockets.getSocket(this.partialView.array.arr[i]);
        socket.close();
    };
    this.partialView.array.arr.splice(0, this.partialView.length());
    // #B clean the forward routes
    for (var i = 0; i < this.forwards.length(); ++i){
        var socket = this.forwards.array.arr[i].socket;
        socket.close();
    };
    this.forwards.array.arr.splice(0,this.forwards.length());
    // #C clean inview ? (TODO)
};

/*!
 * \brief WebRTC specific event. A neighbor wants to exchange 'this' peer
 * with another of its neighbors.
 * \param peer the identifier of the message which states the request
 */
Spray.prototype.onTicketRequest = function(id){
    var socket = new Socket({initiator:true, trickle:false}),//(TODO) add config
        self = this;
    
    // #A get the offer ticket from the stun service    
    socket.on('signal', function(data){
        // #1 register this socket in pending sockets dictionnary
        var message = new MOfferTicket(id, data, {id: self.ID});
        self.pending.addSocket(socket, message);
        // #2 sends it to the requester with along with a unique identifier
        self.send(message);
        // #3 remove the route for now
        self.forwards.removeSocket(message);
    });
    // #B successful connection establishment
    socket.on('connect', function(){
        console.log('wrtc: successful connection establishment');
        // #1 remove from the pending sockets dictionnary
        self.pending.removeSocket(id);
    });
    socket.on('close', function(){
        console.log('wrtc: a connection has been closed');
    });
    // #C receive a message
    socket.on('data', function(message){
        // #1 check if it is a membership message, otherwise do nothing
        // (TODO) split type of possible message between
        // partial view (stampedticket) and inview (here) ?
        self.receive(message, socket);
    });
    
    // #D add a timeout on connection establishment
    setTimeout(function(){
        // #1 check if it the connection established, otherwise, clean socket
        if (self.pending.contains({id:id})){
            self.pending.removeSocket({id:id});
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
    var self = this;
    // #A if the socket already exists in the partial view, duplicate the entry
    if (this.partialView.contains(peer)){
        console.log("wrtc: create a duplicate");
        this.partialView.addNeighbor(peer);
        return; // do nothing else. Ugly return
    };
    // #B otherwise creates an answer
    var socket = new Socket({initiator:false, trickle:false});//(TODO)add config
    
    // #C get the stamped ticket from the stun service
    socket.on('signal', function(data){
        // #1 send it back to the emitter
        var message = new MStampedTicket(id, data, self.ID);
        self.send(message);
        // #2 remove the forwarding route
        self.forwards.removeSocket(message);
    });
    // #D successful connection establishment
    socket.on('connect', function(){
        console.log('wrtc: successful connection establishment');
        // #1 remove from pending
        self.pending.removeSocket({id:id});        
        // #1 add it to the partial view
        self.partialView.addNeighbor(peer);
        // #2 add it to the dictionnary of sockets
        self.sockets.addSocket(socket, peer);
    });
    // #E receive a message
    socket.on('data', function(message){
        // #1 check if it is a membership message, otherwise do nothing
        self.receive(message, socket);
    });

    // #F signal the offer ticket to the fresh socket
    socket.signal(ticket);
    this.pending.addSocket(socket, {id:id});
    // #G a timeout on connection establishment
    setTimeout(function(){
        // #1 check if the connection established, otherwise create a duplicate
        // at random in the partial view
        if (self.pending.contains({id:id})){
            self.pending.removeSocket({id:id});
            socket.close();
            self.onArcDown();
        };
    }, this.TIMEOUT);
};

/*!
 * \brief send a message to a particular peer. If no peer are passed in
 * arguments, it will try to forwards it the appropriate peer.
 * \param message the message to send
 * \param object the object containing the id to send the message
 */
Spray.prototype.send = function(message, object){    
    var id = (object && object.id) || message.id;
    var socket = this.sockets.getSocket({id:id});
    if (socket !== null){
        socket.send(message);
    } else {
        socket = this.forwards.getSocket({id:id});
        if(socket !== null){
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
        console.log('wrtc: a new member joins the network');
        this.forwards.addSocket(socket, message);
        // #1 if it is the very first connection
        if (this.partialView.length()===0){
            var mRequestTicket = new MRequestTicket(GUID());            
            this.send(mRequestTicket, message);
        } else {
            for (var i = 0; i < this.partialView.length(); ++i){
                // #1 request an offer ticket for each neighbor
                var mRequestTicket = new MRequestTicket(GUID());
                // #2 register the forwarding route for the answers
                this.forwards.addSocket(this.sockets.getSocket(
                    this.partialView.array.arr[i]),
                                        mRequestTicket);
                // #3 send a message to the joiner for each neighbor
                this.send(mRequestTicket, message);
            };
        };
        this.forwards.removeSocket(message);
        break;
    case 'MRequestTicket':
        console.log('wrtc: a member request an offer ticket');
        // #0 register the requester
        this.forwards.addSocket(socket, message);
        // #1 do the rest (create ticket and send it)
        this.onTicketRequest(message.id);
        break;
    case 'MOfferTicket':
        console.log('wrtc: you received an offer ticket');
        // #1 check if the offer is for this peer        
        if (!this.forwards.contains(message)){
            // #1A if the peer is already a neigbhor
            if (message.ticket===null){
                if (this.partialView.contains(message.peer)){
                    setTimeout(function(s){
                        s.destroy();
                    },this.TIMEOUT, socket);                    
                };
                this.partialView.addNeighbor(message.peer);
            } else {
                this.forwards.addSocket(socket, message);
                this.onStampedTicketRequest(message.id,
                                            message.ticket,
                                            message.peer);
            };
        } else {
            // #2A otherwise, forward it
            this.send(message, message);
            // #2B invert the direction of forwarding route in order to
            // consistently redirect the stamped ticket
            this.forwards.removeSocket(message);
            this.forwards.addSocket(socket, message);
        };        
        break;
    case 'MStampedTicket':
        console.log('wrtc: you received a stamped ticket');
        // #1 check if the stamp is for this peer
        if (!this.forwards.contains(message)){
            var pendingSocket = this.pending.getSocket(message);
            pendingSocket.signal(message.ticket);
        } else {
            // #2A otherwise, forward it
            this.send(message);
            // #2B remove the direction from the known forwarding routes
            this.forwards.removeSocket(message);
        };
        break;
    case 'MExchange':
        console.log('wrtc: a peer starts to exchange with you');
        // #0 register the requester
        this.forwards.addSocket(socket, message);
        // #1 starts to request offers from its neighborhood
        this.onExchange(message.id, message.peer, message.occ);
        break;
    };
};

module.exports = Spray;
