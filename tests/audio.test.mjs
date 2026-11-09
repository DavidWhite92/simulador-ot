import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function harness() {
  const players=[], cleanups=[];
  class Audio {
    constructor() { this.events={}; this.paused=true; players.push(this); }
    addEventListener(name,callback) { this.events[name]=callback; }
    pause() { this.paused=true; }
    play() { this.paused=false; return Promise.resolve(); }
  }
  const context=vm.createContext({Audio,useEffect:fn=>cleanups.push(fn())});
  const source=readFileSync(new URL('../src/lib/audio.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
  vm.runInContext(source,context);
  return {context,players,cleanups};
}
test('a result interrupts tension and resumes it when the result music ends',()=>{
  const {context:c,players}=harness();
  c.useMusicBackground('tension',1);
  const p=players[0];
  assert.equal(p.src,'/audio/tension.mp3'); assert.equal(p.loop,true);
  c.useMusicCue('victory','a');
  assert.equal(players.length,1); assert.equal(p.src,'/audio/victory.mp3'); assert.equal(p.loop,false);
  p.events.ended();
  assert.equal(p.src,'/audio/tension.mp3'); assert.equal(p.loop,true);
  c.useMusicCue('nominee','b'); p.events.ended();
  assert.equal(p.src,'/audio/tension.mp3');
});
test('volume and mute persist through theme changes and result music',()=>{
  const {context:c,players}=harness();
  c.setMusicVolume(0.2,true); c.useMusicBackground('telecinco','home');
  c.useMusicBackground('rtve','home'); c.useMusicCue('victory','a');
  assert.equal(players[0].volume,0.2); assert.equal(players[0].muted,true);
  c.setMusicVolume(0.7,false);
  assert.equal(players[0].volume,0.7); assert.equal(players[0].muted,false);
});
test('performances stop music, interaction unlocks playback, and leaving cancels a cue',()=>{
  const {context:c,players,cleanups}=harness();
  c.useMusicBackground('rtve',0); const p=players[0];
  p.pause(); c.unlockMusic(); assert.equal(p.paused,false);
  cleanups.pop()(); c.useMusicBackground(null,0); assert.equal(p.paused,true);
  c.unlockMusic(); assert.equal(p.paused,true);
  c.useMusicBackground('tension',0); c.useMusicCue('nominee','a');
  cleanups.pop()(); assert.equal(p.src,'/audio/tension.mp3');
});
