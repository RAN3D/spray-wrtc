import test from 'ava';
const Spray = require('./spray.js');

test.beforeEach(t => {

  const sprayOptions = {
    protocol: 'spray-wrtc',
    deltatime: 1000 * 60 * 2,
    retry: 10
  };
  t.context.spray = new Spray(sprayOptions);

});

test('Spray: toString test', t => {

  let serializedSpray = t.context.spray.toString();
  t.is(serializedSpray.charAt(0), '@', 'toString should begin by a @');
  t.is(serializedSpray.charAt(serializedSpray.length-1), ']', 'toString should end with a ]');

});
