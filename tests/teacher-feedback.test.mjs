import test from 'node:test';
import assert from 'node:assert/strict';
import {teacherFeedback} from '../src/lib/teacherFeedback.js';
test('feedback varies across teachers and limits choreography to dancing songs or the groupal',()=>{
  let seed=27;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const names=new Set(),texts=new Set();
  for(let i=0;i<500;i++) {
    const comments=teacherFeedback({good:i%2===0,kind:'rehearsal',dance:10},random);
    comments.forEach(c=>{names.add(c.teacher);texts.add(c.text);});
    assert.ok(!teacherFeedback({good:true,kind:'mic',dance:0},random).some(c=>c.teacher==='Vicky Gómez'));
    assert.ok(teacherFeedback({good:false,kind:'mic',group:true},random).some(c=>c.teacher==='Manu Guix'));
  }
  assert.equal(names.size,6);assert.ok(texts.size>=40);
});
