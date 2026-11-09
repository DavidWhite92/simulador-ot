import test from 'node:test';
import assert from 'node:assert/strict';
import { mixedJuryOrder, manualJuryOptions } from '../src/lib/juryPerformance.js';
import { catwalkGroups } from '../src/lib/catwalk.js';

function rng(seed) { return () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }; }
test('random jury order always ends with one nominee and one survivor without changing outcomes', () => {
  const ids = Array.from({length:15},(_,i)=>`c${i}`);
  const nominees = ['c0','c3','c6','c10'];
  const orders = new Set(), tailTypes = new Set();
  for (let seed=1;seed<=100;seed++) {
    const order = mixedJuryOrder(ids,nominees,rng(seed));
    assert.deepEqual([...order].sort(),[...ids].sort());
    assert.equal(order.slice(-2).filter(id=>nominees.includes(id)).length,1);
    orders.add(order.join(',')); tailTypes.add(nominees.includes(order.at(-1)));
  }
  assert.ok(orders.size>20); assert.equal(tailTypes.size,2);
  assert.equal(ids[0],'c0');
});
test('manual choices reserve exactly one nomination for the final pair', () => {
  for (const prefer of ['salvado','nominado']) {
    let needed=4;
    for (let remaining=15;remaining>0;remaining--) {
      if (remaining===2) assert.equal(needed,1);
      const options=manualJuryOptions(remaining,needed);
      const choice=options.includes(prefer)?prefer:options[0];
      if (choice==='nominado') needed--;
    }
    assert.equal(needed,0);
  }
});
test('catwalk only shows disclosed decisions, placing favorite first and survivors in crossing order', () => {
  const ids=['a','b','c','d','e'];
  assert.deepEqual(catwalkGroups(ids,[],'c'),{saved:['c'],seated:['a','b','d','e'],nominated:[]});
  const result=catwalkGroups(ids,[{id:'b',result:'salvado'},{id:'a',result:'nominado'},{id:'e',result:'salvado'}],'c');
  assert.deepEqual(result.saved,['c','b','e']);
  assert.deepEqual(result.seated,['a','d']);
  assert.deepEqual(result.nominated,['a']);
  assert.deepEqual(catwalkGroups(ids,[]).saved,[]);
});
