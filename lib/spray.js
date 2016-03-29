var EventEmitter = require('events').EventEmitter;
var NO = require('n2n-overlay-wrtc');
var clone = require('clone');
var util = require('util');

var PartialView = require('./partialview.js');
var GUID = require('./guid.js');

var MExchange = require('./messages.js').MExchange;

util.inherits(Spray, EventEmitter);

/*!
 * \brief Implementation of the random peer sampling Spray
 */
function Spray(options){
    EventEmitter.call(this);
    var opts = (options && clone(options)) || {};
    // #A constants
    this.protocol = (options && options.protocol) || 'spray-wrtc';
    this.DELTATIME = (options && options.deltatime) || 1000 * 60 * 2; // 2min
    
    opts.protocol = this.protocol+'-n2n';
    // #B protocol variables
    this.partialView = new PartialView();
    this.neighborhoods = new NO(opts);
    this.state = 'disconnect'; // (TODO) update state

    // #C periodic shuffling
    var self = this;
    setInterval(function(){
        (self.partialView.length()>0) && exchange.call(self);
    }, this.DELTATIME);
    
    // #D receive event
    function receive(socket, message){
        // #0 must contain a message and a protocol
        if (!message || message.protocol!==self.protocol){
            self.emit('receive', socket, message);
            return;
        };
        // #2 handle messages from spray
        switch (message.type){
        case 'MExchange':
            onExchange.call(self, message);
            break;
        };
    };

    this.neighborhoods.inview.on('receive', receive);
    this.neighborhoods.outview.on('receive', receive);
    this.neighborhoods.on('ready', function (id, view){
        (view === 'outview') && self.partialView.addNeighbor(id);
    });
    
    // (TODO) remove fast access usefull 4 debug
    this.exchange = function(){ exchange.call(self) };
};


/*!
 * \brief Joining as; or contacted by an outsider
 * \param callbacks the callbacks function, see module 'n2n-overlay-wrtc'.
 */
Spray.prototype.connection = function(callbacks, message){
    var self = this;
    var onReadyFunction = callbacks && callbacks.onReady;
    // #1 if this peer is the contact, overload the onready function
    // with the spray joining mechanism that will inject log(x) arcs in
    // the network
    if (message){ 
        callbacks.onReady = function(id){
            var outview = self.neighborhoods.get('outview');
            if (outview.length > 0){
                // #A signal the arrival of a new peer to its outview
                for (var i = 0; i < outview.length; ++i){
                    self.neighborhoods.connect(outview[i].id, id);
                };
            } else {
                // #B adds it to its own outview (for only 2-peers network)
                self.neighborhoods.connect(null, id);
            };
            onReadyFunction && onReadyFunction(id);
        };
    };
    // #2 start establishing the first connection
    this.neighborhoods.connection(callbacks, message);    
};
    
/*!
 * \brief Leave the network
 * \param timer the timeout before really shutting down. The time can
 * be spent on healing the network before departure.
 */
Spray.prototype.leave = function(timer){
    this.partialView.clear(); // (TODO) should be automatic
    this.neighborhoods.clear(); // (TODO)
};

/*!
 * \brief get a set of neighbors. (TODO) include the sockets from the inView
 * \param k the number of neighbors requested
 * \return a list of sockets
 */
Spray.prototype.getPeers = function(k){
    var result = [];
    // #A copy the sockets of the partial view
    var cloneSockets = [];
    for (var i = 0; i < this.sockets.length(); ++i){
        cloneSockets[i] = this.sockets.array.arr[i];
    };
    // #B get as much neighbors as possible
    while (0 < cloneSockets.length && result.length < k){
        var rn = Math.floor(Math.random()*cloneSockets.length);
        result.push(cloneSockets[rn].socket);
        cloneSockets.splice(rn, 1);
    };
    // #C last chance socket
    if (k>0 && result.length===0 && this.sockets.lastChance!==null){
        result.push(this.sockets.lastChance);
    };
    return result;
};


Spray.prototype.send = function(socket, message){
    var sent = false;
    if (socket && socket.connected &&
        socket._channel && socket._channel.readyState === 'open'){
        this.neighborhoods.send(socket, message);
        sent = true;
    } else {
        this.onPeerDown({id:id});
    };
    return sent;
};


/*!
 * \brief get the string representation of the partial view of spray
 */ 
Spray.prototype.toString = function(){
    var result = '@'+this.neighborhoods.inview.ID +';'+
        this.neighborhoods.outview.ID + '   [ ';
    var pv = this.partialView.get();
    for (var i = 0; i < pv.length; ++i){
        result += '('+(pv[i].age + ' ' + pv[i].id +') ');
    };
    result += ']';
    return result;
};

//////////////////////////////////////
//        PRIVATE functions         //
//////////////////////////////////////

/*!
 * \brief update the local connection state of the peer and emit an event
 * if the state is different than at the previous call of this function.
 * The emitted event is 'statechange' with the 
 * arguments 'connect' | 'partial' | 'disconnect'
 */
function updateState(){
    if (this.partialView.length() > 0 && this.state !== 'connect'){
        this.state = 'connect';
        this.emit('statechange', 'connect');
    } else if ((this.partialView.length() === 0 && this.inView.length() > 0 ||
                this.partialView.length() > 0 && this.inView.length() === 0 ) &&
               this.state !== 'partial'){
        this.state = 'partial';
        this.emit('statechange', 'partial');
    } else if (this.partialView.length() === 0 && this.pending.length() === 0 &&
               this.state !== 'disconnect'){
        this.state = 'disconnect';
        this.emit('statechange', 'disconnect');
    };
};

/*******************************************************************************
 * Spray's protocol implementation
 ******************************************************************************/

/*!
 * \brief periodically called function that aims to balance the partial view
 * and to mix the neighbors inside them
 */
function exchange(){
    var self = this, socketOldest = null;
    this.partialView.increment();
    // #1 get the oldest neighbor reachable
    while (!socketOldest && this.partialView.length()>0){
        var oldest = this.partialView.getOldest();
        socketOldest = this.neighborhoods.get(oldest);
        (socketOldest && this.send(socketOldest.socket,
                                   MExchange(this.neighborhoods.inview.ID,
                                             this.neighborhoods.outview.ID,
                                             this.protocol))) ||
            onPeerDown.call(this, oldest);
    };
    if (this.partialView.length()===0){return;}; // ugly return
    // #2 get a sample from our partial view
    var sample = this.partialView.getSample(oldest, true);
    // #3 establish connections oldest -> sample
    for (var i = 0; i < sample.length; ++i){
        // #A remove the arcs
        this.neighborhoods.disconnect(sample[i].id);
        this.partialView.removePeer(sample[i].id, sample[i].age);
    };
    for (var i = 0; i < sample.length; ++i){
        // #B from oldest to chosen neighbor
        this.neighborhoods.connect(oldest.id,
                                   (sample[i].id!==oldest.id) &&
                                   sample[i].id);
    };
};

/*!
 * \brief event executed when we receive an exchange request
 * \param msg message containing the identifier of the peer that started the 
 * exchange
 */
function onExchange(msg){
    // #1 get a sample of neighbors from our partial view
    var sample = this.partialView.getSample(msg.inview, false);
    for (var i = 0; i < sample.length; ++i){
        // #A remove the chosen neighbor from our partialview
        this.neighborhoods.disconnect(sample[i].id);
        this.partialView.removePeer(sample[i].id, sample[i].age);
    };
    for (var i = 0; i < sample.length; ++i){
        // #B from initiator to chosen neigbhor
        this.neighborhoods.connect(msg.outview,
                                   ((sample[i].id!==msg.inview) &&
                                    sample[i].id));
    };
};

/*!
 * \brief the function called when a neighbor is unreachable and supposedly
 * crashed/departed. It probabilistically keeps an arc up
 * \param peer the peer that cannot be reached
 */
function onPeerDown(peer){
    console.log('wrtc: a neighbor crashed/left');
    // #A remove all occurrences of the peer in the partial view
    var occ = this.partialView.removeAll(peer);
    this.sockets.removeSocket(peer);
    // #B probabilistically recreate an arc to a known peer
    if (this.partialView.length() > 0){
        for (var i = 0; i < occ; ++i){
            if (Math.random() > (1/(this.partialView.length()+occ))){
                var rn = Math.floor(Math.random()*this.partialView.length());
                this.partialView.addNeighbor(this.partialView.array.arr[rn]);
                console.log('wrtc: create a duplicate');
            };
        };
    };
    this.updateState();
};

/*!
 * \brief a connection failed to establish properly, systematically duplicates
 * an element of the partial view.
 */
function onArcDown(){
    console.log('wrtc: an arc did not properly established');
    if (this.partialView.length()>0){
        var rn = Math.floor(Math.random()*this.partialView.length());
        this.partialView.addNeighbor(this.partialView.array.arr[rn]);
    };
    this.updateState();
};

module.exports = Spray;
