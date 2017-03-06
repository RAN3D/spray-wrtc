import test from 'ava';
const SortedArray = require('../lib/extended-sorted-array.js');

test('Extended Sorted Array test', t => {

  let cmpFunction = function(a, b) { return a - b; };
  let sortedArray = new SortedArray(cmpFunction, [2,3,5]); // SortedArray doesn't sort SortedArray.arr on init. It assumes the array is sorted. It uses the comparison function on insert, indexOf and remove to get the element. It perform a binary search to find the element.

  t.is(sortedArray.get(2),2,'get(2) should be 2');
  t.is(sortedArray.get(5),5,'get(5) should be 5');
  t.is(sortedArray.get(4),null,'get(5) should be null');
  t.is(sortedArray.contains(5), true, 'contains(5) should be true');
  t.is(sortedArray.contains(4), false, 'contains(4) should be false');

  sortedArray.insert(4);

  t.is(sortedArray.get(2),2,'get(2) should be 2');
  t.is(sortedArray.get(4),4,'get(4) should be 4');
  t.is(sortedArray.get(5),5,'get(5) should be 5');
  t.is(sortedArray.contains(4), true, 'contains(4) should be true');

});
