import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeasonStorage} from '../src/lib/seasonStorage.js';
import {mergeCustomLibraries} from '../src/lib/customLibrary.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import LZString from 'lz-string';

function fixture(initial={}) {
  const values=new Map(Object.entries(initial)),db=new Map();
  const local={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:key=>values.get(key)??null,removeItem:key=>values.delete(key),setItem(){throw new Error('QuotaExceededError');}};
  const adapter={local,read:async key=>db.get(key),write:async(key,value)=>{db.set(key,value);}};
  return {values,db,adapter,store:createSeasonStorage(adapter)};
}
test('saving with a full localStorage uses the database and updates a single record',async()=>{
  const f=fixture({ot_custom_contestants:'custom photos',ot_custom_songs:'songs'});
  const code=await f.store.availableCode();
  await f.store.save(code,'gala 1');await f.store.save(code,'gala 8');
  assert.equal(f.db.size,1);assert.equal(await f.store.load(code),'gala 8');
  assert.equal(f.values.get('ot_custom_contestants'),'custom photos');
  assert.equal(f.values.get('ot_custom_songs'),'songs');
});
test('migration preserves codes and only removes verified season copies, never customs',async()=>{
  const f=fixture({ot_save_1234:'old save',ot_save_5678:'other save',ot_custom_contestants:'all custom photos',ot_custom_songs:'all songs'});
  assert.equal(await f.store.load('1234'),'old save');
  await f.store.migrateLegacy();
  assert.equal(await f.store.load('1234'),'old save');assert.equal(await f.store.load('5678'),'other save');
  assert.deepEqual([...f.values.keys()],['ot_custom_contestants','ot_custom_songs']);
});
test('failed migration or verification preserves the entire original save',async()=>{
  const f=fixture({ot_save_1234:'old save',ot_custom_contestants:'customs'});
  const failing=createSeasonStorage({...f.adapter,write:async()=>{throw new Error('Disk full');}});
  await assert.rejects(failing.migrateLegacy(),/Disk full/);
  assert.equal(f.values.get('ot_save_1234'),'old save');
  const unverified=createSeasonStorage({...f.adapter,write:async()=>{}});
  await unverified.migrateLegacy();assert.equal(f.values.get('ot_save_1234'),'old save');
});
test('conflicting legacy data is retained and an existing database save is never replaced by migration',async()=>{
  const f=fixture({ot_save_1234:'older'});await f.store.save('1234','latest');await f.store.migrateLegacy();
  assert.equal(await f.store.load('1234'),'latest');assert.equal(f.values.get('ot_save_1234'),'older');
});
test('codes avoid existing saves in either storage',async()=>{
  const f=fixture(Object.fromEntries(Array.from({length:8999},(_,i)=>[`ot_save_${1000+i}`,'old'])));
  assert.equal(await f.store.availableCode(),'9999');
  await f.store.save('9999','new');await assert.rejects(f.store.availableCode(),/códigos libres/);
});
test('importing custom contestants preserves conflicting local versions and is idempotent',()=>{
  const old=[{id:'a',name:'Ana',photo:'data:image/webp;base64,original',gender:'f',stats:{baile:5}}];
  const incoming=[{...old[0],photo:'data:image/webp;base64,new'},{id:'b',name:'Bea',photo:'portrait'}];
  const merged=mergeCustomLibraries(old,incoming);
  assert.equal(merged.length,3);assert.deepEqual(merged[0],old[0]);assert.notEqual(merged[1].id,'a');
  assert.deepEqual(mergeCustomLibraries(merged,incoming),merged);assert.equal(old.length,1);
});
for(const file of ['SimuladorOT.jsx','SimuladorOT_RTVE.jsx']) test(`${file}: portable backup retains photos, all custom contestants, Sets and Maps`,()=>{
  const source=readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
  const start=source.indexOf('const replacer ='),end=source.indexOf('// Utils',start);
  const context=vm.createContext({LZString,Set,Map});
  vm.runInContext(source.slice(start,end),context);
  const payload={v:1,saveCode:'1234',contestants:[{id:'a',photo:'data:image/webp;base64,photo'}],gstate:{salvados:new Set(['a']),map:new Map([['a',5]])},customContestants:[{id:'a'},{id:'not-in-season',photo:'custom portrait'}]};
  const result=context.unpackState(context.packState(payload));
  assert.equal(result.gstate.salvados.has('a'),true);assert.equal(result.gstate.map.get('a'),5);
  assert.equal(result.customContestants.length,2);assert.equal(result.contestants[0].photo,payload.contestants[0].photo);
});
