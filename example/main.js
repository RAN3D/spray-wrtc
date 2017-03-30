const S = require('spray-wrtc');

// # create 3 peers 
const s1 = new S({config:{trickle:true}});
const s2 = new S({config:{trickle:true}});
const s3 = new S({config:{trickle:true}});

const callback = (from, to) => {
    return (offer) => {
        to.connect( (answer) => { from.connect(answer); }, offer);
    };
};


s1.join(callback(s1, s2)).then(console.log('s1 just joined the network.'));

setTimeout( () => {
    s3.join(callback(s3, s2)).then(console.log('s1 just joined the network.'));
}, 4000);

// #1 s1 joins s2 and creates a 2-peers networks
// var id1 = s1.connection(callbacks(s1, s2));
// // #2 after a bit, s3 joins the network through s1
// setTimeout(function(){
//     var id2 = s3.connection(callbacks(s3, s1));
// }, 5000);

// // #3 connection state changes
// function changes(peer){
//     return function(state){
//         console.log('@'+peer + ' connection state '+ state);
//     };
// };

// s1.on('statechange', changes('s1'));
// s2.on('statechange', changes('s2'));
// s3.on('statechange', changes('s3'));
