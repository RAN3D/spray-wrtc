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
    // #A constants
    this.protocol = (options && options.protocol) || 'spray-wrtc';
    this.DELTATIME = (options && options.deltatime) || 1000 * 60 * 2; // 2min
    this.RETRY = (options && options.retry) || 10; // retry 10x to send messages
    
    var opts = (options && clone(options)) || {};
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
    function receive(id, message){
        // #0 must contain a message and a protocol, otherwise forward
        if (!message || message.protocol!==self.protocol){
            if (message && message.protocol){
                self.emit(message.protocol+'-receive', id, message);
            } else {
                self.emit('receive', id, message);
            }
        } else {
            // #2 handle messages from spray
            switch (message.type){
            case 'MExchange':
                onExchange.call(self, message);
                break;
            };
        };
    };
    
    this.neighborhoods.on('receive', receive);
    this.neighborhoods.on('ready', function (id, view){
        (view === 'outview') && self.partialView.addNeighbor(id);
        updateState.call(self);
    });
    
    this.neighborhoods.on('fail', function(id, view){
        (view === 'outview') && onArcDown.call(self);
    });
    
    this.neighborhoods.on('disconnect', function (id, view){
        updateState.call(self);
    });
    
    // (TODO) remove fast access usefull 4 debug
    this.exchange = function(){ exchange.call(self); };
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
            if (self.partialView.length() > 0){
                // #A signal the arrival of a new peer to its outview
                self.partialView.get().forEach(function(n){
                    self.neighborhoods.connect(n, id);
                });
            } else {
                // #B adds it to its own outview (for only 2-peers network)
                self.neighborhoods.connect(null, id);
            };
            // #C callback the original onReady function
            onReadyFunction && onReadyFunction(id);
        };
    } else {
        callbacks.onReady = function(id){
            onReadyFunction && onReadyFunction(id);
            // #D emit a join event
            self.emit('join');
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
    this.partialView.clear(); 
    this.neighborhoods.disconnect();
};

/*!
 * \brief get a set of neighbors from both inview and outview. It is worth
 * noting that each peer controls its outview, but not its inview. Thus, the 
 * outview may be less versatile.
 * \param k the number of neighbors requested, if k is not defined, it returns
 * every known identifiers.
 * \return { i:[id1,id2...idk], o:[id1,id2...idk] }
 */
Spray.prototype.getPeers = function(k){
    var result = {i:[], o:[]};
    // #A copy the identifiers of the inview
    var inview = this.neighborhoods.get('inview');
    for (var i = 0; i < inview.length; ++i){
        result.i.push(inview[i].id);
    };
    // #B remove entries if there are too many
    while (k && (result.i.length > k) && (result.i.length > 0)){
        var rn = Math.floor(Math.random()*result.i.length);
        result.i.splice(rn, 1);
    };
    // #C copy the identifiers of the outview
    var outview = this.neighborhoods.get('outview');
    for (var i = 0; i < outview.length; ++i){
        result.o.push(outview[i].id);
    };
    // #D remove entries if there are too many
    while (k && (result.o.length > k) && (result.o.length > 0)){
        var rn = Math.floor(Math.random()*result.o.length);
        result.o.splice(rn, 1);
    };
    return result;
};

/*!
 * \brief send a message using the id of the arc used to communicate
 * \param id the identifier of the communication channel
 * \param message the message to send
 * \param return true if the message is sent, false otherwise
 * \param retry the number of times the protocol tries to send the message
 * \return true if the message has been sent at first try, false otherwise
 */
Spray.prototype.send = function(id, message, retry){
    var r = retry || this.RETRY;
    var result = this.neighborhoods.send(id, message), self = this;
    if (!result && r===0){
        // #1 if it fails to send the message, the peer is considered down
        onPeerDown.call(this,id);
    } else if (!result && r>0) {
        // #2 give it another try 
        setTimeout(function(){
            self.send(id, message, r-1);
        }, 1000);
    };
    return result;
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
    // (TODO) handle it without reaching the neighbor-wrtc module...
    if (this.neighborhoods.o.living.ms.arr.length > 0 &&
        this.neighborhoods.i.living.ms.arr.length > 0 &&
        this.state !== 'connect'){
        // #1 connected means (1+ inview, 1+ outview)
        this.state = 'connect';
        this.emit('statechange', 'connect');
    } else if (
        (this.neighborhoods.o.living.ms.arr.length === 0 &&
         this.neighborhoods.i.living.ms.arr.length > 0) ||
            (this.neighborhoods.o.living.ms.arr.length > 0 ||
             this.neighborhoods.i.living.ms.arr.length === 0) &&
            (this.state !== 'partial')){
        // #2 partially connected means (1+ inview, 0 outview) or (0 i, 1+ o)
        this.state = 'partial';
        this.emit('statechange', 'partial');
    } else if (this.neighborhoods.o.living.ms.arr.length === 0 &&
               this.neighborhoods.i.living.ms.arr.length === 0 &&               
               this.state !== 'disconnect'){
        // #3 disconnected means (0 inview, 0 outview)
        this.state = 'disconnect';
        this.emit('statechange', 'disconnect');
    };
};

/*******************************************************************************
 * Spray's protocol implementation
 ******************************************************************************/

/*!
 * \brief periodically called function that aims to balance the partial view
 * and to mix the neighborhoods
 */
function exchange(){
    var self = this, oldest = null, sent = false;
    this.partialView.increment();
    // #1 get the oldest neighbor reachable
    while (!oldest && !sent && this.partialView.length()>0){
        oldest = this.partialView.getOldest();
        sent = this.send(oldest.id, MExchange(this.neighborhoods.i.ID,
                                              this.neighborhoods.o.ID,
                                              this.protocol), 0);
    };
    if (this.partialView.length()===0){return;}; // ugly return
    // #2 get a sample from our partial view
    var sample = this.partialView.getSample(oldest, true); 
    // #3 establish connections oldest -> sample
    // #A remove the chosen arcs
    var i = 0;
    while (i<sample.length){
        var e = sample[i];
        var removed = self.neighborhoods.disconnect(e.id);
        if (!removed){ // the partial view is late
            // #a inform the partial view of the departure of the peer
            onPeerDown.call(this, e.id);
            // #b clear the sample from references to this id
            var j = 0;
            while (j<sample.length){
                if (sample[j].id === e.id){
                    sample.splice(j, 1);
                } else {
                    ++j;
                };                
            };
        } else {
            // normal behavior
            self.partialView.removePeer(e.id, e.age);
            ++i;
        };
    };
    // #B from oldest to chosen neighbor
    sample.forEach(function(e){
        self.neighborhoods.connect(oldest.id, (e.id !== oldest.id) && e.id);
    });
};

/*!
 * \brief event executed when we receive an exchange request
 * \param msg message containing the identifier of the peer that started the 
 * exchange
 */
function onExchange(msg){
    var self = this;
    // #1 get a sample of neighbors from our partial view
    this.partialView.increment();
    var sample = this.partialView.getSample(msg.inview, false);
    // #A remove the chosen neighbor from our partialview
    var i = 0;
    while (i<sample.length){
        var e = sample[i];
        var removed = self.neighborhoods.disconnect(e.id);
        if (!removed){ // the partial view is late
            // #a inform the partial view of the departure of the peer
            onPeerDown.call(this, e.id);
            // #b clear the sample from references to this id
            var j = 0;
            while (j<sample.length){
                if (sample[j].id === e.id){
                    sample.splice(j, 1);
                } else {
                    ++j;
                };                
            };
        } else {
            // normal behavior
            self.partialView.removePeer(e.id, e.age);
            ++i;
        };
    };
    // #B from initiator to chosen neigbhor
    sample.forEach(function(e){
        self.neighborhoods.connect(msg.outview, (e.id !== msg.inview) && e.id);
    });
};

/*!
 * \brief the function called when a neighbor is unreachable and supposedly
 * crashed/departed. It probabilistically keeps an arc up
 * \param id the identifier of the channel that seems down
 */
function onPeerDown(id){
    console.log('@spray: The peer '+ JSON.stringify(id) + ' seems down.');
    // #A remove all occurrences of the peer in the partial view
    var occ = this.partialView.removeAll(id);
    // #B probabilistically recreate an arc to a known peer
    if (this.partialView.length() > 0){
        for (var i = 0; i < occ; ++i){
            if (Math.random() > (1/(this.partialView.length()+occ))){
                var rn = Math.floor(Math.random()*this.partialView.length());
                this.neighborhoods.connect(null,this.partialView.array.arr[rn]);
            };
        };
    };
};

/*!
 * \brief a connection failed to establish properly, systematically duplicates
 * an element of the partial view. (TODO) integrates this
 */
function onArcDown(){
    console.log('@spray: An arc failed to establish.');
    if (this.partialView.length()>0){
        var rn = Math.floor(Math.random()*this.partialView.length());
        this.neighborhoods.connect(null, this.partialView.array.arr[rn]);
    };
};

module.exports = Spray;
