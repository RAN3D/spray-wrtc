var SortedArray = require('sorted-cmp-array');

/*!
 * \brief array containing the list of sockets targeting this peer
 */
function InView(){
    this.sockets = new SortedArray(function(a,b){
        var first = a.id || a;
        var second = b.id || b;
        if (first < second) { return -1};
        if (first > second) { return  1};
        return 0;
    });
};

/*!
 * \brief add an element to the inview
 * \param socket the socket to add in the inview
 * \param id a unique identifier of the socket
 */
InView.prototype.add = function(socket, id){
    this.sockets.insert({id:id, socket:socket});
};

/*!
 * \brief remove the targeted socket from the inview
 * \param id the identifier of the inview
 * \return the socket removed from the inview, null if not found
 */
InView.prototype.remove = function(id){
    var index = this.sockets.indexOf(id),
        socket = null;
    if (index >= 0){
        socket = this.sockets.arr[index];
        this.sockets.arr.splice(index, 1);
    };
    return socket;
};

/*!
 * \brief get the length of the array
 */
InView.prototype.length = function(){
    return this.sockets.arr.length;
};

/*!
 * \brief clear the whole inview and close the sockets
 */
InView.prototype.clear = function(){
    for (var i = 0; i < this.sockets.arr.length; ++i){
        this.sockets.arr[i].socket.destroy();
    };
    this.sockets.arr.splice(0, this.sockets.arr.length);
};

module.exports = InView;
