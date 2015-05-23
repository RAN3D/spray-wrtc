# spray-wrtc

<i>Keywords: Random peer sampling, adaptive, browser-to-browser communication,
WebRTC</i>

This project aims to provide a [WebRTC](http://www.webrtc.org) implementation of
Spray.

Spray is a random peer sampling protocol [1] which adapts the partial view of
each member to the network size using local knowledge only. Therefore, without
any configurations, each peer automatically adjust itself to the need of the
network.

## References

[1] M. Jelasity, S. Voulgaris, R. Guerraoui, A.-M. Kermarrec, and M. Van
Steen. Gossip-based peer sampling. <i>ACM Transactions on Computer Systems
(TOCS)</i>, 25(3):8, 2007.