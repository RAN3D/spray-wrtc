var EventEmitter = require('events').EventEmitter;
var Socket = require('simple-peer');
var util = require('util');

var Spray = require('./spray.js');
var GUID = require('./guid.js');

util.inherits(Membership, EventEmitter);

/*!
 * \brief implementation of the interface at
 * \url https://github.com/justayak/network.git
 */
function Membership(id, options){
    // #0 initialize the random peer sampling protocol
    EventEmitter.call(this);    
    this.rps = new Spray(id, options);
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
    var socket = new Socket({initiator:true, trickle:true}),
        self = this,
        id = GUID();
    // #A get the offer ticket from the stun service
    socket.on('signal', function(data){
        // #1 register this socket in pending sockets dictionnary
        var message = new MOfferTicket(id, data, {id:self.rps.ID});
        self.rps.pending.addSocket(socket, message);
        // #2 sends it to the requester with along with a unique identifier
        callback(message);
    });
    // #B timeout on the offer ticket
    setTimeout(function(){
        if (self.rps.pending.contains({id:id})){
            var socket = self.rps.pending.remove({id:id});
            socket.close();
        };
    }, this.rps.TIMEOUT);
};

Membership.prototype.answer = function(message, callback){
    var socket = new Socket({initiator:false, trickle:true}),
        id = message.id
        ticket = message.ticket,
        peer = message.peer,
        self = this;
    // #A get the offer ticket from the stun service
    socket.on('signal', function(data){
        // #1 register this socket in pending sockets dictionnary
        var message = new MStampedTicket(id, data, {id:self.rps.ID});
        self.rps.pending.addSocket(socket, message);
        // #2 sends it to the requester with along with a unique identifier
        callback(message);
    });
    // #B successful connection establishment
    socket.on('connect', function(){
        console.log('wrtc: successful connection establishment');
        // #1 remove from the pending sockets dictionnary
        self.rps.pending.removeSocket(message);
    });
    // #C receive a message
    socket.on('data', function(receive){
        // #1 check if it is a membership message, otherwise do nothing
        self.rps.receive(receive, socket);
    });
    // #D disconnection
    socket.on('close', function(){
        console.log('wrtc: a connection has been closed');
    });
    
    socket.signal(ticket);
    
    // #E timeout on the offer ticket
    setTimeout(function(){
        if (self.rps.pending.contains({id:id})){
            var socket = self.rps.pending.remove({id:id});
            socket.close();
        };
    }, this.rps.TIMEOUT);
};

Membership.prototype.handshake = function(message){
    var socket = this.rps.pending.removeSocket(message),
        id = message.id,
        ticket = message.ticket,
        peer = message.peer;
    // #A successful connection establishment
    socket.on('connect', function(){
        console.log('wrtc: successful connection establishment');
        // #1 add it into the partial view
        self.rps.partialView.addNeighbor(peer);
        self.rps.sockets.addSocket(socket, peer);
        // #2 send the join request
        var message = new MJoin(GUID());
        self.rps.send(message, peer);
    });
    // #B receive a message
    socket.on('data', function(receive){
        // #1 check if it is a membership message, otherwise do nothing
        self.rps.receive(receive, socket);
    });
    // #C disconnection
    socket.on('close', function(regular){
        console.log('wrtc: a connection has been closed');
        if (!regular){ self.rps.onPeerDown(peer); };
    });
};

Membership.prototype.ready = function(callback){
    if (this.rps.partialView.length() > 0){ callback(); };
};
