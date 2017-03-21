import test from 'ava';
const PartialView = require('../lib/partialview.js');

test('PartialView test', t => {

  let partialView = new PartialView({
    usedCoef: 0.5
  });
  let id = 1;
  t.is(partialView.length(),0,'length should be 0');

  const config = (id) => {
    return {age: 0, id: id};
  };
  
  partialView.addNeighbor(config(id));
  t.is(partialView.length(),1,'length should be 1');
  console.log(partialView.get());

  t.deepEqual(partialView.get(),[{age: 0, id: id}],'get() should return [{age: 0, id: 1}]');

  t.deepEqual(partialView.getOldest(), {age: 0, id: id},'getOldest() should return {age: 0, id: 1}');

  t.is(partialView.getIndex(1),0,'index should be 0');

  t.is(partialView.contains(1),true,'contains(1) should be true');
  t.is(partialView.contains(22),false,'contains(22) should be false');

  let id2 = 2;
  partialView.addNeighbor(config(id2));

  t.deepEqual(partialView.get(),[{age: 0, id: 2 },{age: 0, id: 1 }],'get() should return [{age: 0, id: 1},{age: 0, id: 2}]');

  partialView.increment(); // increment age

  t.deepEqual(partialView.get(),[{age: 1, id: 2 },{age: 1, id: 1 }],'get() should return [{age: 0, id: 2},{age: 0, id: 3}]');
  t.is(partialView.get()[0].age, 1, 'id should be 2');
  t.is(partialView.get()[1].age, 1, 'id should be 3');

  t.deepEqual(partialView.removePeer(2, 1), {age: 1, id: 2 }, 'removePeer(2, 1) should be {age: 1, id: 2 }');
  t.deepEqual(partialView.removePeer(3, 3), null, 'removePeer(3, 3) should be null');

  partialView.clear();
  t.is(partialView.length(),0,'length should be 0');

  const idsList = [1, 2, 3, 5, 7];

  idsList.map( (id) => {
    partialView.addNeighbor(config(id));
  });

  let sample = partialView.getSample({age: 0, id: 1}, false);
  t.is(sample.length, 3, 'length should be ceil of 1/2 of length of the partialView : 3');

  let sample2 = partialView.getSample({age: 0, id: 1}, true);
  t.is(sample2.length, 3, 'length should be ceil of 1/2 of length of the partialView : 3');

  let isInArray = (array, nb) => {return array.find(x => x.id === nb) != null};
  t.is(isInArray(sample2, 8), false, 'sample2 should not contain id 8');
  t.is(isInArray(sample2, 1), true, 'sample2 should contain id 1');

  const fixedSample = [{age: 0, id: 1},{age: 0, id: 2}];
  const resultAfterRemoveSample = [{age: 0, id: 3},{age: 0, id: 7},{age: 0, id: 5}];
  partialView.removeSample(fixedSample);
  t.deepEqual(partialView.get(), resultAfterRemoveSample, 'removeSample should remove all element from sample');

  partialView.removeAll(3);
  const resultAfterRemoveAll = [{age: 0, id: 7}, {age: 0, id: 5}];
  t.deepEqual(partialView.get(), resultAfterRemoveAll, 'removeAll should remove all occurences of element of id 3');

  let sampleToModify = [{age: 0, id: 7}, {age: 0, id: 5}];
  let resultingSample = partialView.replace(sampleToModify, {age: 0, id: 7}, {age: 1, id: 7});
  const resultAfterReplace = [{age: 1, id: 7}, {age: 0, id: 5}];
  t.deepEqual(resultingSample, resultAfterReplace, 'replace should replace element of id 7');

});
