'use strict';

const SortedArray = require('sorted-cmp-array');

SortedArray.prototype.get = function (entry) {
	const index = this.indexOf(entry);
	return ((index >= 0)&&this.arr[index]) || null;
};


SortedArray.prototype.contains = function (entry) {
	return (this.arr.includes(entry));
};

module.exports = SortedArray;
