var io = require('socket.io-client');
var wrtc = require('wrtc');
var Spray = require('../lib/membership.js');
var GUID = require('../lib/guid.js');

var PUBLIC = null;
var ACCESS = null;

process.argv.forEach(function (val, index, array) {
    var splitedArgs = val.split('=');
    if (splitedArgs.length>1){
        switch (splitedArgs[0]) {
        case '--public': PUBLIC = splitedArgs[1]; break;
        case '--access': ACCESS = splitedArgs[1]; break;
        default: console.log('unknown option: ' + splitedArgs[0]); break;
        };
    };
});

// #1 create the websocket to access to the signaling server
var signaling = io.connect('https://ancient-shelf-9067.herokuapp.com');
// #2 create the random peer sampling protocol
var n = new Spray(GUID(), {wrtc:wrtc});
// #3 set the events
signaling.on('connect', function(){
    console.log('Successful connection to the signaling service');
    if (PUBLIC !== null){ signaling.emit('share', PUBLIC); };
    if (ACCESS !== null){
        n.launch(function(offerTicket){
            console.log('Create an offer ticket');
            signaling.emit('launch', ACCESS, offerTicket.id, offerTicket);
        });
    };
});

signaling.on('disconnect', function(){
    console.log('Disconnected from the signaling service');
});

signaling.on('launchResponse', function(offerTicket){
    n.answer(offerTicket, function(stampedTicket){
        console.log('Create a stamped ticket');
        stampedTicket.destUid = offerTicket.id;
        signaling.emit('answer', PUBLIC, stampedTicket);
    });
});

signaling.on('answerResponse', function(stampedTicket){
    console.log('Handshake');
    n.handshake(stampedTicket);
    if (PUBLIC === null){ signaling.disconnect(); };
});
