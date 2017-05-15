const S = require('spray-wrtc');

let graph = new window.P2PGraph('.graph');

let N = 25;

let a = 1;
let b = 0;

document.getElementById("theoretical").innerHTML = ""+ (N* (a*Math.log(N) + b));

// #1 create N peers 
let peers = [];
let revertedIndex = new Map();
for (let i = 0; i < N; ++i) {
    peers.push(new S({peer: i,
                      delta: 60*1000,
                      a: a,
                      b: b,
                      config:{trickle:true}}));
    revertedIndex.set(peers[i].NI.PEER, peers[i].PEER);
};

// #2 simulate signaling server
const callback = (from, to) => {
    return (offer) => {
        to.connect( (answer) => { from.connect(answer); }, offer);
    };
};

// #3 peers join the network 1 by 1
for (let i = 1; i < N ; ++i) {
    setTimeout( (nth) => {
        const rn = Math.floor(Math.random() * nth);
        peers[nth].join(callback(peers[nth], peers[rn]));
    }, i*1000, i);
};


var totalLinks = 0;

for (let i = 0; i < N; ++i ){
    graph.add({
        id: peers[i].PEER,
        me: false,
        name: i
    });

    peers[i].on('open', (peerId) => {
        !graph.hasLink(peers[i].PEER, revertedIndex.get(peerId)) &&
            graph.connect(peers[i].PEER, revertedIndex.get(peerId));
        totalLinks += 1;
        document.getElementById("actual").innerHTML = ""+ totalLinks;
    });
    peers[i].on('close', (peerId) => {
        (!peers[i].o.has(peerId)) &&
            graph.disconnect(peers[i].PEER, revertedIndex.get(peerId));
        totalLinks -= 1;
        document.getElementById("actual").innerHTML = ""+ totalLinks;
    });
};


let scramble = (delay = 0) => {
    for (let i = 0; i < N; ++i) {
        setTimeout ( (nth) => {
            peers[nth]._exchange(); // force exchange
        }, i*delay, i);
    };
};
