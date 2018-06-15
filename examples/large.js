const S = require('spray-wrtc')

let graph = new window.P2PGraph('.graph')

let N = 5

let a = 1
let b = 0

let harmonic = 3 * a + 2 * b
for (let i = 3; i <= N; ++i) {
  harmonic += harmonic / (i - 1) + a
};
harmonic = harmonic

document.getElementById('theoretical').innerHTML = '' + (N * (a * Math.log(N) + b))
document.getElementById('harmonical').innerHTML = '' + harmonic

// #1 create N peers
let peers = []
let revertedIndex = new Map()
for (let i = 0; i < N; ++i) {
  peers.push(new S({peer: i,
    delta: 60 * 1000,
    a: a,
    b: b,
    config: {trickle: true}}))
  revertedIndex.set(peers[i].NI.PEER, peers[i].PEER)
};

// #2 simulate signaling server
const callback = (from, to) => {
  return (offer) => {
    to.connect((answer) => { from.connect(answer) }, offer)
  }
}

function nbNeighbors (p) {
  let result = 0
  p.partialView.forEach((ages) => {
    result += ages.length
  })
  return result
}

// #3 peers join the network 1 by 1
for (let i = 1; i < N; ++i) {
  setTimeout((nth) => {
    let avg = totalLinks / (nth - 1)
    let min = 12391284
    let chosen = 0
    for (let j = 0; j < (nth - 1); ++j) {
      if (Math.abs(nbNeighbors(peers[j]) - avg) < min) {
        min = Math.abs(nbNeighbors(peers[j]) - avg)
        chosen = j
      }
    }

    // const rn = Math.floor(Math.random() * nth);
    peers[nth].join(callback(peers[nth], peers[chosen]))
    setTimeout(() => {
      peers[nth]._exchange()
    }, 1000)
  }, i * 3000, i)
};

var totalLinks = 0

for (let i = 0; i < N; ++i) {
  graph.add({
    id: peers[i].PEER,
    me: false,
    name: i
  })

  peers[i].on('open', (peerId) => {
    !graph.hasLink(peers[i].PEER, revertedIndex.get(peerId)) &&
            graph.connect(peers[i].PEER, revertedIndex.get(peerId))
    totalLinks += 1
    document.getElementById('actual').innerHTML = '' + totalLinks
  })
  peers[i].on('close', (peerId) => {
    (!peers[i].o.has(peerId)) &&
            graph.disconnect(peers[i].PEER, revertedIndex.get(peerId))
    totalLinks -= 1
    document.getElementById('actual').innerHTML = '' + totalLinks
  })
};

let scramble = (delay = 0) => {
  for (let i = 0; i < N; ++i) {
    setTimeout((nth) => {
      peers[nth]._exchange() // force exchange
    }, i * delay, i)
  };
}
