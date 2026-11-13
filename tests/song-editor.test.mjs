import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReparto,validateDistribution} from '../src/lib/songEditor.js';
import {audiencePercentages} from '../src/lib/academy.js';

const songs=['Grupal','A','B','C','D'];
const rows=[{type:'solo',song:'A',members:['a']},{type:'solo',song:'B',members:['b']},{type:'trio',song:'C',members:['c','d','e']}];
test('manual distribution preserves nominees, complete groups and unique songs',()=>{
  const check=r=>validateReparto(r,'Grupal',songs,['a','b','c','d','e'],['a','b']);
  assert.equal(check(rows),'');
  assert.equal(check([rows[1],rows[0],rows[2]]),'');
  assert.ok(check([rows[2],rows[0],rows[1]]));
  assert.ok(check(rows.map((r,i)=>i===2?{...r,members:['c','d','d']}:r)));
  assert.ok(check(rows.map((r,i)=>i===2?{...r,song:'Grupal'}:r)));
  assert.ok(check(rows.map((r,i)=>i===2?{...r,song:'Inventada'}:r)));
  assert.ok(check(rows.map((r,i)=>i===2?{...r,members:['c']}:r)));
  assert.ok(validateReparto(rows,'Grupal',songs,['a','b','c','d','e'],[],true));
  assert.equal(validateReparto(rows.slice(0,2),'',songs,['a','b'],[],true),'');
});
test('duel percentages increase gradually with popularity differences',()=>{
  const vote=gap=>audiencePercentages(['a','b'],[{id:'a',popularity:gap},{id:'b',popularity:0}],()=>0.5)[0];
  assert.ok(vote(2)<52);
  assert.ok(vote(20)>60 && vote(20)<70);
  assert.ok(vote(60)>85 && vote(60)<90);
  assert.ok(vote(70)>vote(60));
  assert.ok(vote(100)>95);
  for(let gap=2;gap<100;gap++) assert.ok(vote(gap)>vote(gap-1));
});

test('removing an entire filled group cannot leave contestants without a song',()=>{
  const error=validateReparto(rows.slice(0,2),'Grupal',songs,['a','b','c','d','e'],['a','b']);
  assert.match(error,/Asigna a todos/);
});

test('manual steps validate capacity first, assignments second and songs last',()=>{
  const draft=[rows[0],rows[1],{type:'trio',song:'',members:[]}];
  const expected=['a','b','c','d','e'];
  assert.equal(validateDistribution(draft,expected,['a','b']),'');
  assert.ok(validateDistribution(draft,expected,['a','b'],false,true));
  assert.ok(validateDistribution(draft.slice(0,2),expected,['a','b']));
  assert.ok(validateDistribution([draft[2],draft[0],draft[1]],expected,['a','b']));
  assert.ok(validateDistribution(draft,expected,[],true));
  draft[2].members=['c','d','e'];
  assert.equal(validateDistribution(draft,expected,['a','b'],false,true),'');
  assert.ok(validateReparto(draft,'Grupal',songs,expected,['a','b']));
  draft[2].song='C';
  assert.equal(validateReparto(draft,'Grupal',songs,expected,['a','b']),'');
});
