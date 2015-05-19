var PartialView = require("./partialview.js");

/*!
 * \brief Implementation of the random peer sampling called Spray on top of
 * socket.io
 * \param port the port listened
 */
function Spray(port){
    this.DELTATIME = 1000 * 60 * 10; // 10min
    this.port = port;
    this.partialView = new PartialView();

    // #1 create the serving part of the peer
    var io = require('socket.io')(this.port);
    // #2 create all the incoming events
    io.on("connection", function(socket){
        socket.on("onExchange", function(neighbors){
            // #A get a sample
            // #B send the sample to the exchanging peer
            // #C remove the sent sample from our partial view and integrate
            // the received neighborhood
        });
    });
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


module.exports = Spray;
