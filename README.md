# spray-wrtc

<i>Keywords: Random peer sampling, adaptive, browser-to-browser communication,
WebRTC</i>

This project aims to provide a [WebRTC](http://www.webrtc.org) implementation of
Spray.

Spray [1] is a random peer-sampling protocol [2] inspired by both Cyclon [3] and
Scamp [4]. It adapts the partial view of each member to the network size using
local knowledge only. Therefore, without any configuration, each peer
automatically adjust its functioning to the need of the network.

## Installation

Using npm: ```$ npm install spray-wrtc```

or using bower: ```$ bower install spray-wrtc```

## API

You can find the API [here](https://ran3d.github.io/spray-wrtc/).

## Example

A usage example of this module is available [here](https://ran3d.github.io/spray-wrtc/example/browser.html).

## Miscellaneous

Peersim [5] simulations of Spray are available at
[peersim-spray](https://github.com/justayak/peersim-spray).

## References

[1] B. Nédelec, J. Tanke, D. Frey, P. Molli, and A. Mostéfaoui. Spray: an
Adaptive Random Peer Sampling Protocol. <i>Technical Report, LINA-University of
Nantes; INRIA Rennes - Bretagne Atlantique, Sept 2015.</i>

[2] M. Jelasity, S. Voulgaris, R. Guerraoui, A.-M. Kermarrec, and M. Van
Steen. Gossip-based peer sampling. <i>ACM Transactions on Computer Systems
(TOCS)</i>, 25(3):8, 2007.

[3] S. Voulgaris, D. Gavidia, and M. van Steen. Cyclon: Inexpensive membership
management for unstructured p2p overlays. <i>Journal of Network and Systems
Management</i>, 13(2):197–217, 2005.

[4] A. Ganesh, A.-M. Kermarrec, and L. Massoulié. Peer-to-peer membership
management for gossip-based protocols. <i>IEEE Transactions on Computers</i>,
52(2):139–149, Feb 2003.

[5] A. Montresor and M. Jelasity. Peersim: A scalable P2P simulator. <i>Proc. of
the 9th Int. Conference on Peer-to-Peer (P2P’09)</i>, pages 99–100, Seattle, WA,
Sept. 2009.
