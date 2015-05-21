var SortedArray = require("sorted-cmp-array");

/*!
 * \brief represent the array containing the sockets associated sorted by peer
 * id
 */
function Sockets(){
    this.array = new SortedArray(
        function(a, b){
            if (a.id < b.id){ return -1; };
            if (a.id > b.id){ return  1; };
            return 0;
        }
    );
};

/*!
 * \brief add the socket linked with the peer to the array structure
 * \param socket the socket to communicate with peer
 * \param peer the peer targeted by the socket
 * \return true if the socket as been added, false otherwise
 */ 
Sockets.prototype.addSocket = function(socket, peer){
    var contains = this.contains(peer);
    if (!contains){
        this.array.insert({id:peer.id, socket:socket});
    };
    return !contains;
};

/*!
 * \brief remove the peer and the corresponding socket from the array and
 * return the socket.
 * \param peer the peer to remove
 * \return the socket of the peer to remove, null if it does not exist
 */
Sockets.prototype.removeSocket = function(peer){
    var socket = this.getSocket(peer);
    if (socket !== null){
        this.array.remove(peer);
    };
    return socket;
};

/*!
 * \brief get the socket attached to the peer identity
 * \param peer the peer targeted by the socket to search
 * \return the socket if the neighbor exists, null otherwise
 */
Sockets.prototype.getSocket = function(peer){
    var index = this.array.getIndex(peer),
        socket = null;
    if (index !== -1){
        socket = this.array.arr[index].socket;
    };
    return socket;
};

/*!
 * \brief check if their is a socket associated to the peer
 * \param peer the peer to check
 * \return true if a socket targeting the peer exists, false otherwise
 */
Socket.prototype.contains = function(peer){
    return (this.array.getIndex(peer); !== -1);
};
