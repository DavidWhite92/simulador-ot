import test from 'node:test';
import assert from 'node:assert/strict';
import { seasonBackdrop } from '../src/lib/seasonBackdrop.js';

test('background follows the visible event and returns to the studio for performances', () => {
  const week = { phase: 'events', shown: 0, events: [{kind:'romance'}, {kind:'rehearsal'}, {kind:'mic'}] };
  const scene = () => seasonBackdrop({started:true, week});
  assert.equal(scene(), 'salon');
  week.shown = 1;
  assert.equal(scene(), 'salon');
  week.shown = 2;
  assert.equal(scene(), 'aula');
  week.shown = 3;
  assert.equal(scene(), 'micros');
  week.phase = 'performances';
  assert.equal(scene(), 'studio');
  week.done = true;
  assert.equal(scene(), 'studio');
  assert.equal(seasonBackdrop({started:true, week, chat:{events:[],shown:0}}), 'salon');
  assert.equal(seasonBackdrop({started:false, week, chat:{}}), 'studio');
  assert.equal(seasonBackdrop({started:true}), 'studio');
});
