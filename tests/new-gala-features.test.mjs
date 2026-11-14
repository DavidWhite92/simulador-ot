import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicReveal} from '../src/lib/publicReveal.js';
import {previousSoloSongs,prepareFinalistDuel} from '../src/lib/finalistDuels.js';
import {applyPopularity,audiencePercentages} from '../src/lib/academy.js';
import {favoriteComment,secondChance} from '../src/lib/juryComments.js';
import {teacherFeedback} from '../src/lib/teacherFeedback.js';
import {defaultStaff} from '../src/lib/staff.js';
import catalog from '../src/lib/staffCatalog.json' with {type:'json'};
import {existsSync} from 'node:fs';

test('random reveal always ends with one safe contestant and one duelist',()=>{
  let seed=9;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const first=new Set();
  for(let i=0;i<200;i++) {
    const reveal=createPublicReveal(Array.from({length:6},(_,id)=>({id,pct:30-id*4})),'duel',2,random);
    assert.equal(new Set(reveal.targets).size,6);
    assert.equal(reveal.targets.slice(-2).filter(index=>index>=4).length,1);
    first.add(reveal.targets[0]);
  }
  assert.ok(first.size>2);
});
test('duel reprises exclude Gala 0 and group songs; singing changes the subsequent public vote',()=>{
  const summaries={0:{0:{reparto:[{song:'Entrada',members:['a']}]}},2:{2:{reparto:[{song:'Dúo',members:['a','b']}]}},3:{3:{reparto:[{song:'Solo a',members:['a']},{song:'Solo b',members:['b']}]}}};
  assert.deepEqual(previousSoloSongs('a',summaries,14),['Solo a']);
  const people=[{id:'a',name:'A',popularity:49,stats:{afinacion:15,baile:15,presencia:15,emocion:15}},{id:'b',name:'B',popularity:51,stats:{afinacion:0,baile:0,presencia:0,emocion:0}}];
  const acts=prepareFinalistDuel(['a','b'],people,summaries,14,{},[],[],()=>.5);
  assert.deepEqual(acts.map(p=>p.song),['Solo a','Solo b']);
  const updated=applyPopularity(people,Object.fromEntries(acts.map(p=>[p.members[0].id,p.members[0].delta])));
  assert.ok(audiencePercentages(['a','b'],people,()=>.5)[0]<50);
  assert.ok(audiencePercentages(['a','b'],updated,()=>.5)[0]>50);
});
test('favorite feedback acknowledges poor performances and second chances require several weak acts',()=>{
  assert.match(favoriteComment({score:4}),/nominación segura/);
  assert.doesNotMatch(favoriteComment({score:9}),/suerte/);
  assert.equal(secondChance('a',{a:{score:5}}),'');
  assert.match(secondChance('a',Object.fromEntries(['a','b','c','d'].map(id=>[id,{score:5}]))),/confiamos/);
});
test('solo feedback uses singular; duos address each singer then the group and respect custom staff',()=>{
  for(let i=0;i<100;i++) {
    const comments=teacherFeedback({good:i%2===0,kind:'rehearsal',members:[{name:'Ana',score:i%2?4:9}]},Math.random);
    assert.ok(comments.every(c=>c.text.startsWith('Ana,')));
    assert.ok(comments.every(c=>!/(habéis|os escuch|amores|guardad|quitad)/i.test(c.text)));
  }
  const staff={...defaultStaff,teachers:{...defaultStaff.teachers,music:{name:'Mi director',photo:'/custom.png'}}};
  const comments=teacherFeedback({good:false,kind:'mic',members:[{name:'Ana',score:3},{name:'Bea',score:4}],staff},()=>.5);
  assert.equal(comments.length,3);
  assert.match(comments[0].text,/Ana,/);assert.match(comments[1].text,/Bea,/);
  assert.equal(comments[0].teacher,'Mi director');assert.equal(comments[0].photo,'/custom.png');
});
test('all supplied professor and jury portraits resolve to local assets',()=>{
  for(const entries of Object.values(catalog)) for(const person of entries) assert.ok(existsSync(`public${person.photo}`),person.photo);
});
