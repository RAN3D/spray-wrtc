import test from 'ava';
const MExchange = require('../lib/messages.js').MExchange;

test('Messages test', t => {

  let message = MExchange('inViewLabel', 'outViewLabel', 'protocol-name');
  t.is(message.protocol, 'protocol-name', 'message.protocol should be protocol-name');
  t.is(message.type, 'MExchange', 'message.type should be MExchange')
  
  let message2 = MExchange('inViewLabel', 'outViewLabel');
  t.is(message2.protocol, 'spray-wrtc', 'message2.protocol should be spray-wrtc');
  
});
