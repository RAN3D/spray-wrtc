'use strict';

const ExPeerNotFound = require('./exceptions/expeernotfound.js');

/**
 * Structure containing the neighborhood of a peer.
 * Map of {idPeer => [age_1, age_2.. age_k]} where age_1 <= age_2 <= .. <= age_k
 */
class PartialView {
    constructor () {
        this.view = new Map();
        this.length = 0;
    };
    
    /**
     * Get the oldest peer in the partial view.
     * @returns {string} The oldest peer in the array.
     */
    getOldest () {
        if (this.view.size <= 0) { throw new ExPeerNotFound('getOldest'); };
        let oldestPeer = null;
        let oldestAge = 0;
        this.view.forEach( (ages, peerId) => {
            if (oldestAge <= ages[ages.length - 1]) {
                oldestPeer = peerId;
                oldestAge = ages[ages.length - 1];
            };
        });
        return oldestPeer;
    };


    /**
     * Increment the age of the whole partial view
     */
    increment () {
        this.view.forEach( (ages, peerId) => {
            this.view.set(peerId, ages.map( (age) => {return age+1;} ));
        });
    };

    /**
     * Get a sample of the partial view.
     * @param {string} [peerId] The identifier of the oldest neighbor chosen to
     * perform a view exchange.
     * @return {string[]} An array containing the identifiers of neighbors from
     * this partial view.
     */
    getSample (peerId) {
        let sample = [];
        // #1 create a flatten version of the partial view
        let flatten = [];
        this.view.forEach( (ages, neighbor) => {
            ages.forEach( (age) => {
                flatten.push(neighbor);
            });
        });       
        // #2 process the size of the sample
        const sampleSize = Math.ceil(flatten.length / 2);
        // #3 initiator removes a chosen neighbor entry and adds it to sample
        if (typeof peerId === 'undefined') {
            flatten.splice(flatten.indexOf(peerId), 1);
            sample.push(peerId);
        };
        // #4 add neighbors to the sample chosen at random
        while (sample.length < sampleSize) {
            const rn = Math.floor(Math.random() * flatten.length);
            sample.push(flatten[rn]);
            flatten.splice(rn, 1);
        };
        return sample;
    };

    /**
     * Add the peer to the partial view with an age of 0.
     * @param {string} peerId The identifier of the peer added to the partial
     * view.
     */
    addNeighbor (peerId) {
        (!this.view.has(peerId)) && this.view.set(peerId, new Array());        
        this.view.get(peerId).unshift(0); // add 0 in front of the array
        this.length += 1;
    };

    /**
     * Remove the newest entry of the peer from the partial view.
     * @param {string} peerId The identifier of the peer to remove from the 
     * partial view. 
     */
    removeNeighbor (peerId) {
        if (!this.view.has(peerId)) { throw new ExPeerNotFound('removeNeighbor',
                                                               peerId); };
        this.view.get(peerId).shift();
        (this.view.get(peerId).length === 0) && this.view.delete(peerId);
        this.length -= 1;
    };

    /**
     * Remove all entries of the peer from the partial view.
     * @param {string} peerId The identifier of the peer to remove from the 
     * partial view.
     * @returns {number} The number of occurrences of peerId removed.
     */
    removeAllNeighbor (peerId) {
        if (!this.view.has(peerId)) { throw new ExPeerNotFound('removeNeighbor',
                                                               peerId); };
        const occ = this.view.get(peerId).length;
        this.view.delete(peerId);
        return occ;
    };
    
    
    /**
     * Remove all the elements contained in the sample in argument
     * @param {array} sample the elements to remove
     * @return {void}
     */
    removeSample (sample) {
        for (let i = 0; i < sample.length; ++i) {
            this.removePeer(sample[i].id, sample[i].age);
        }
    };

    /**
     * Check if the partial view contains the identifier of the neighbor.
     * @param {string} peerId The identifier of the peer to check.
     * @return {boolean} true if the identifier is in the partial view, false
     * otherwise.
     */
    contains (peerId) {
        return this.store.has(peerId);
    };

    /**
     * Get the least frequent peer. If multiple peers have the same number of
     * occurrences, it chooses one among them at random.
     * @returns {string} The identifier of a least frequent peer.
     */
    getLeastFrequent () {
        let leastFrequent = [];
        let frequency = Infinity;
        this.store.forEach( (ages, peerId) => {
            if (ages.length < frequency){
                leastFrequent = [];
                frequency = ages.length;
            };
            (ages.length === frequency) && leastFrequent.push(peerId);
        });
        return leastFrequent[Math.floor(Math.random() * leastFrequent.length)];
        
    };
    
}


module.exports = PartialView;
