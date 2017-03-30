const S = require('spray-wrtc');

// #1 create 3 peers 
const s1 = new S({config:{trickle:true}});
const s2 = new S({config:{trickle:true}});
const s3 = new S({config:{trickle:true}});
// #2 create 3 protocols
const p1 = s1.register('1');
const p2 = s2.register('1');
const p3 = s3.register('1');

// #3 simulate signaling server
const callback = (from, to) => {
    return (offer) => {
        to.connect( (answer) => { from.connect(answer); }, offer);
    };
};

// #4 s1 contacts s2,  2-peers network
s1.join(callback(s1, s2)).then(console.log('s1 just joined the network.'));

// #5 s3 contacts s2, 3-peers network
setTimeout( () => {
    s3.join(callback(s3, s2)).then( () => {
        p3.emit('meow', s3.getPeers(1)[0], 'i', 'am', 'a', 'cat');
    });
}, 4000);

p1.on('meow',(i, am, a, cat) => console.log('@p1: %s %s %s %s', i, am, a, cat));
p2.on('meow',(i, am, a, cat) => console.log('@p2: %s %s %s %s', i, am, a, cat));
p3.on('meow',(i, am, a, cat) => console.log('@p3: %s %s %s %s', i, am, a, cat));
