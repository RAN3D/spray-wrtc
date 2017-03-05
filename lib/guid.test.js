import test from 'ava';
const GUID = require('./guid.js');

test('GUID test', t => {
	
  let randomGuid = GUID();
  t.is(randomGuid.length, 36, 'Should have 36 characters');
  
  t.is((randomGuid.match(/-/g) || []).length, 4, 'Should have 4 - characters');
  
});
