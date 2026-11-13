import test from 'node:test';
import assert from 'node:assert/strict';
import {randomRosterCandidates} from '../src/lib/rosterRandom.js';

const pool=[{id:'a',edition:'OT2001'},{id:'b',edition:'OT2017'},{id:'c',edition:'OT2017'},{id:'d',isCustom:true}];
test('random excludes disabled seasons and previously selected contestants',()=>{
  assert.deepEqual(randomRosterCandidates(pool,['b'],['OT2001']).map(c=>c.id),['c','d']);
  assert.deepEqual(randomRosterCandidates(pool,[],['OT2001','OT2017','Custom']),[]);
  assert.deepEqual(randomRosterCandidates(pool,[],[]),pool);
  assert.equal(pool.length,4);
});
