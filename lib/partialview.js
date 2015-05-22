var SortedArray = require("sorted-cmp-array");

/*!
 * \brief structure containing the neighborhood of a peer.
 */
function PartialView(){
    // #1 initialize the partial view as an array sorted by age
    this.array = new SortedArray(
        function(a,b){
            if (a.age < b.age){ return -1;};
            if (a.age > b.age){ return  1;};
            return 0;
        });
};

/*!
 * \return the oldest peer in the array
 */
PartialView.prototype.getOldest = function(){
    return this.array.arr[0];
};

/*!
 * \brief increment the age of the whole partial view
 */
PartialView.prototype.incrementAge = function(){
    for (var i=0; i<this.array.arr.length; ++i){
        this.array.arr[i].age += 1;
    };
};

/*!
 * \brief get a sample of the partial to send to the neighbor
 * \param myself the caller identity
 * \param neighbor the neighbor which performs the exchange with us
 * \param isInitiator whether or not the caller is the initiator of the
 * exchange
 * \return an array containing neighbors from this partial view
 */
PartialView.prototype.getSample = function(myself, neighbor, isInitiator){
};

/*!
 * \brief replace the occurrences of the old peer by the fresh one
 * \param sample the sample to modify
 * \param old the old reference to replace
 * \param fresh the new reference to insert
 * \return an array with the replaced occurences
 */
PartialView.prototype.replace = function(sample, old, fresh){
};

/*!
 * \brief remove the old sample while adding the new sample
 * \param myself the reference to myself
 * \param neighbot the reference to the neigbhor which exchanges
 * \param newSample the received sample
 * \param oldSample the sent sample
 */
PartialView.prototype.mergeSample = function(myself, neighbor,
                                             newSample, oldSample){
};


/*!
 * \brief add the neigbhor to the partial view with an age of 0
 * \param peer the peer to add to the partial view
 */
PartialView.prototype.addNeighbor = function(peer){
    peer.age = 0;
    this.array.push(peer);
};


/*!
 * \brief get the index of the peer in the partialview
 * \return the index of the peer in the array, -1 if not found
 */
PartialView.prototype.getIndex = function(peer){
    var i = 0,
        index = -1;
        found = false;
    while (!found && i < this.array.arr.length){
        if (peer.id === this.array.arr[i].id){
            found = true;
            index = i;
        };
        ++i;
    };
    return index;
};

/*!
 * \brief remove the peer from the partial view
 * \param peer the peer to remove
 * \return the removed entry if it exists, null otherwise
 */
PartialView.prototype.removePeer = function(peer){
    var index = this.getIndex(peer),
        removedEntry = null;
    if (index > -1){
        removedEntry = this.array.arr[index];
        this.array.arr.splice(index, 1);
    };
    return removedEntry;
};

/*!
 * \brief remove the peer with the associated age from the partial view
 * \param peer the peer to remove
 * \param age the age of the peer to remove
 * \return the removed entry if it exists, null otherwise
 */
PartialView.prototype.removePeerAge = function(peer, age){
    var found = false,
        i = 0,
        removedEntry = null;
    while(!found && i < this.array.arr.length){
        if (peer.id === this.array.arr[i].id && age === this.array.arr[i].age){
            found = true;
            removedEntry = this.array.arr[i];
            this.array.splice(i, 1);
        };
        ++i;
    };
    return removedEntry;
};

/*!
 * \brief remove all occurrences of the peer and return the number of removals
 * \param peer the peer to remove
 * \return the number of occurrences of the removed peer
 */
PartialView.prototype.removeAll = function(peer){
    var occ = 0,
        i = 0;
    while (i < this.array.arr.length){
        if (this.array.arr[i].id === peer.id){
            this.array.arr.splice(i, 1);
            occ += 1;
        } else {
            ++i;
        };
    };
    return occ;
};

/*!
 * \brief get the size of the partial view
 */
PartialView.prototype.length = function(){
    return this.array.arr.length;
};

module.exports = PartialView;
