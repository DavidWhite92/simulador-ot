import test from 'node:test';
import assert from 'node:assert/strict';
import { relationshipOf,relationKey,eventRelationships,rehearsalRelationships,performanceRelationships,choosePeerSave } from '../src/lib/relationships.js';

const people=['a','b','c','d'].map(id=>({id,status:'active'}));
test('relationships start at 50, are symmetric and preserve historical snapshots',()=>{
  const initial={};
  assert.equal(relationshipOf(initial,'a','b'),50);
  const next=eventRelationships(initial,{ids:['a','b'],delta:5,kind:'rehearsal'},people);
  assert.equal(relationshipOf(next,'a','b'),58);
  assert.equal(relationshipOf(next,'b','a'),58);
  assert.deepEqual(initial,{});
  assert.equal(relationshipOf(next,'a','c'),50);
  assert.equal(relationshipOf(next,'a','a'),null);
  const saved=JSON.parse(JSON.stringify(next));
  const final=eventRelationships(next,{ids:['a','b'],delta:-4,kind:'mic'},people);
  assert.equal(relationshipOf(final,'a','b'),48);
  assert.equal(relationshipOf(saved,'a','b'),58);
});
test('working together rewards every pair in a trio only if they have not clashed',()=>{
  const reparto=[{members:['a','b','c']},{members:['a','b']}];
  const friction=[{ids:['a','b'],delta:-4}];
  const result=rehearsalRelationships({},reparto,friction);
  assert.equal(relationshipOf(result,'a','b'),50);
  assert.equal(relationshipOf(result,'a','c'),56);
  assert.equal(relationshipOf(result,'b','c'),56);
  assert.equal(relationshipOf(rehearsalRelationships({},reparto,[]),'a','b'),56);
});
test('romance and shared performances strengthen relationships within limits',()=>{
  const romantic=eventRelationships({},{ids:['a','b'],pair:['a','b'],delta:3},people);
  assert.equal(relationshipOf(romantic,'a','b'),68);
  const good=performanceRelationships(romantic,{members:[{id:'a',score:8},{id:'b',score:7}]});
  assert.equal(relationshipOf(good,'a','b'),71);
  const capped=eventRelationships({[relationKey('a','b')]:99},{ids:['a','b'],pair:['a','b'],delta:3},people);
  assert.equal(relationshipOf(capped,'a','b'),100);
  const low=eventRelationships({[relationKey('a','b')]:1},{ids:['a','b'],delta:-5},people);
  assert.equal(relationshipOf(low,'a','b'),0);
});
test('household events and Chat affect trust without involving eliminated contestants',()=>{
  const result=eventRelationships({},{ids:['a'],kind:'solo',delta:-5},[...people,{id:'gone',status:'eliminado'}]);
  assert.equal(relationshipOf(result,'a','b'),47);
  assert.equal(relationshipOf(result,'a','gone'),50);
  assert.equal(relationshipOf(eventRelationships(result,{ids:['a'],delta:1},people,true),'a','b'),49);
});
test('peer votes prioritize romance, exceptional friendship and then songmates',()=>{
  const settings={voterId:'a',candidates:['b','c','d'],reparto:[{members:['a','b']}],relations:{[relationKey('a','c')]:89}};
  assert.equal(choosePeerSave(settings,()=>0.5),'b');
  settings.relations[relationKey('a','c')]=90;
  assert.equal(choosePeerSave(settings,()=>0.5),'c');
  settings.pairs=[['a','d']];
  assert.equal(choosePeerSave(settings,()=>0.5),'d');
  settings.candidates=['b','c'];
  assert.equal(choosePeerSave(settings,()=>0.5),'c');
});
test('trio partners are ordered by affinity and self votes are excluded',()=>{
  const settings={voterId:'a',candidates:['a','b','c','d'],reparto:[{members:['a','b','c']}],relations:{[relationKey('a','b')]:60,[relationKey('a','c')]:70,[relationKey('a','d')]:89}};
  assert.equal(choosePeerSave(settings,()=>0.5),'c');
  assert.equal(choosePeerSave({...settings,candidates:['a']},()=>0.5),null);
  assert.equal(choosePeerSave({...settings,reparto:[]},()=>0.5),'d');
});
test('disabled relationships ignore partners, songmates and affinity',()=>{
  const settings={voterId:'a',candidates:['b','c','d'],pairs:[['a','b']],reparto:[{members:['a','b']}],relations:{[relationKey('a','b')]:100},enabled:false};
  assert.equal(choosePeerSave(settings,()=>0),'b');
  assert.equal(choosePeerSave(settings,()=>0.5),'c');
  assert.equal(choosePeerSave(settings,()=>0.99),'d');
});
