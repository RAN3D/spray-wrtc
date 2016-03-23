var S = require('spray-wrtc');

var opts = {webrtc: {trickle:true}};

// # create 3 peers 
var s1 = new S(opts);
var s2 = new S(opts);
var s3 = new S(opts);

var callbacks = function(src, dest){
    return {
        onInitiate: function(offer){
            dest.connection(callbacks(dest, src), offer);
        },
        onAccept: function(offer){
            dest.connection(offer);
        },
        onReady: function(){
            console.log("Connection established");
        }
    };
};

// #1 establishing a connection from n1 to n2
var id1 = s1.connection(callbacks(s1, s2));
// #2 establishing a connection from n1 to n3
// var id2 = n1.connection(callbacks(n1, n3));
// > console: should see 4 "connection established" messages


