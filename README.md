# spray-wrtc

<i>Keywords: Random peer sampling, adaptive, browser-to-browser communication,
WebRTC</i>

This project aims to provide a [WebRTC](http://www.webrtc.org) implementation of
Spray.

Spray is a random peer sampling protocol [1] inspired by both Cyclon [2] and
Scamp [3]. It adapts the partial view of each member to the network size using
local knowledge only. Therefore, without any configurations, each peer
automatically adjust itself to the need of the network.

## Installation

```
$ npm install spray-wrtc
```
or
```
$ bower install spray-wrtc
```

## Usage

The module has been [browserified](http://browserify.org) and
[uglified](https://github.com/mishoo/UglifyJS). To include spray-wrtc within your
browser, put the following line in your html:
```html
<script src='./build/spray-wrtc.bundle.js'></script>
```
In both case, spray-wrtc provides:
```javascript
var Spray = require('spray-wrtc');

(TODO)
```

## References

[1] M. Jelasity, S. Voulgaris, R. Guerraoui, A.-M. Kermarrec, and M. Van
Steen. Gossip-based peer sampling. <i>ACM Transactions on Computer Systems
(TOCS)</i>, 25(3):8, 2007.

[2] S. Voulgaris, D. Gavidia, and M. van Steen. Cyclon: Inexpensive membership
management for unstructured p2p overlays. <i>Journal of Network and Systems
Management</i>, 13(2):197–217, 2005.

[3] A. Ganesh, A.-M. Kermarrec, and L. Massoulié. Peer-to-peer membership
management for gossip-based protocols. <i>IEEE Transactions on Computers</i>,
52(2):139–149, Feb 2003.