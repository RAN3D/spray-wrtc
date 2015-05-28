var EventEmitter = require('events').EventEmitter;
var Socket = require('simple-peer');
var util = require('util');

var Spray = require('./spray.js');
var GUID = require('./guid.js');

var Messages = require('./messages');
var MJoin = Messages.MJoin;
var MOfferTicket = Messages.MOfferTicket;
var MStampedTicket = Messages.MStampedTicket;

util.inherits(Membership, EventEmitter);

/*!
 * \brief implementation of the interface at
 * \url https://github.com/justayak/network.git
 */
function Membership(id, options){
    // #0 initialize the random peer sampling protocol
    EventEmitter.call(this);    
    this.rps = new Spray(""+id+"", options);
    this.state = 'disconnect';

    // #1 create the events
    var self = this;
    this.rps.on('bdcast-receive', function(message, socket){
        self.emit('churn', message, socket); // (TODO) change the event name
    });
    this.rps.on('connect', function(){
        if (self.state === 'disconnect'){
            self.emit('statechange', 'connect');
            self.state = 'connect'
        };
    });
    this.rps.on('disconnect', function(){
        if (self.state === 'connect' && self.rps.sockets.length()===0){
            self.emit('statechange', 'disconnect');
            self.state = 'disconnect';
        };
    });    
};

// #2 create the functions
Membership.prototype.launch = function(callback){
    var socket = new Socket({initiator:true, trickle:false}),
        self = this,
        id = GUID();
    // #A get the offer ticket from the stun service
    socket.on('signal', function(data){
        // #1 register this socket in pending sockets dictionnary
        var message = new MOfferTicket(id, data, {id: self.rps.ID});
        self.rps.pending.addSocket(socket, message);
        // #2 sends it to the requester with along with a unique identifier
        callback(message);
    });
    // #B timeout on the offer ticket
    setTimeout(function(){
        if (self.rps.pending.contains({id:id})){
            self.rps.pending.removeSocket({id:id});
            socket.destroy();
        };
    }, this.rps.TIMEOUT);
};

Membership.prototype.answer = function(message, callback){
    var socket = new Socket({initiator:false, trickle:false}),
        id = message.id,
        ticket = message.ticket,
        peer = message.peer,
        self = this;
    // #A get the offer ticket from the stun service
    socket.on('signal', function(data){
        // #1 register this socket in pending sockets dictionnary
        var stampedTicket = new MStampedTicket(id, data, {id:self.rps.ID});
        self.rps.pending.addSocket(socket, stampedTicket);
        // #2 sends it to the requester with along with a unique identifier
        callback(stampedTicket);
    });
    // #B successful connection establishment
    socket.on('connect', function(){
        console.log('wrtc: successful connection establishment');
        // #1 remove from the pending sockets dictionnary
        self.rps.pending.removeSocket(message);
    });
    // #C receive a message
    socket.on('data', function(receivedMessage){
        // #1 check if it is a membership message, otherwise do nothing
        self.rps.receive(receivedMessage, socket);
    });
    // #D disconnection
    socket.on('close', function(){
        console.log('wrtc: a connection has been closed');
    });

    socket.signal(ticket);
    
    // #E timeout on the offer ticket
    setTimeout(function(){
        if (self.rps.pending.contains({id:id})){
            var socket = self.rps.pending.removeSocket({id:id});
            socket.destroy(true);
        };
    }, this.rps.TIMEOUT);
};

Membership.prototype.handshake = function(message){
    var socket = this.rps.pending.removeSocket(message),
        id = message.id,
        ticket = message.ticket,
        peer = message.peer,
        self = this;
    // #A successful connection establishment
    socket.on('connect', function(){
        console.log('wrtc: successful connection establishment');
        // #1 add it into the partial view
        self.rps.partialView.addNeighbor(peer);
        self.rps.sockets.addSocket(socket, peer);
        // #2 send the join request
        self.rps.join(peer);
    });
    // #B receive a message
    socket.on('data', function(receivedMessage){
        // #1 check if it is a membership message, otherwise do nothing
        self.rps.receive(receivedMessage, socket);
    });
    // #C disconnection
    socket.on('close', function(){
        console.log('wrtc: a connection has been closed');
    });

    socket.signal(ticket);
};

Membership.prototype.ready = function(callback){
    if (this.rps.partialView.length() > 0){ callback(); };
};


/*!
 * \brief leave the network
 */
Membership.prototype.disconnect = function(){
    // #A clean the partial view
    for (var i = 0; i < this.rps.partialView.length(); ++i){
        var socket = this.rps.sockets.getSocket(
            this.rps.partialView.array.arr[i]);
        socket.destroy();
    };
    this.rps.partialView.array.arr.splice(0, this.rps.partialView.length());
    // #B clean the forward routes
    for (var i = 0; i < this.rps.forwards.length(); ++i){
        var socket = this.rps.forwards.array.arr[i].socket;
        socket.close();
    };
    this.rps.forwards.array.arr.splice(0,this.rps.forwards.length());
    // #C clean inview ? (TODO)
};

module.exports = Membership;
