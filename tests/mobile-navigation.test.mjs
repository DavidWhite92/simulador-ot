import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {eventRelationships,relationshipOf} from '../src/lib/relationships.js';
for(const file of ['SimuladorOT.jsx','SimuladorOT_RTVE.jsx']) {
  test(`${file}: logo and restart return safely to the empty home screen`,()=>{
    const source=readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
    const start=source.indexOf('  function reiniciar(){'),end=source.indexOf('    const onDownloadRecorrido',start);
    const state={};
    const context={emptyAcademy:()=>({weeks:{},pairs:[],relationships:{}}),window:{scrollTo:()=>{state.scrolled=true;}}};
    for(const key of ['Academy','ShowPopularity','ShowRelationships','Contestants','Gala','ViewGala','GalaLogs','CarryNominees','Stage','Gstate','Summaries']) context[`set${key}`]=v=>{state[key]=v;};
    vm.runInNewContext(source.slice(start,end)+'\nreiniciar();',context);
    assert.equal(state.Stage,'inicio');assert.equal(state.Gala,0);
    assert.equal(state.Contestants.length,0);assert.equal(state.CarryNominees.length,0);
    assert.equal(typeof state.Gstate,'object');assert.notEqual(state.Gstate,null);
    assert.equal(Object.keys(state.Summaries).length,0);assert.equal(state.scrolled,true);
    const logo=source.slice(source.indexOf('alt="Simulador Web'),source.indexOf('alt="Simulador Web')+650);
    assert.ok(logo.includes('onClick={reiniciar}'));
  });
}
test('relationship intensity varies with the event without modifying popularity',()=>{
  const cast=[{id:'a',status:'active',popularity:61},{id:'b',status:'active',popularity:54}];
  const before=JSON.stringify(cast);
  const small=eventRelationships({},{ids:['a','b'],delta:3},cast);
  const large=eventRelationships({},{ids:['a','b'],delta:7},cast);
  const fight=eventRelationships({},{ids:['a','b'],delta:-7},cast);
  const breakup=eventRelationships({},{ids:['a','b'],breakup:['a','b'],delta:-2},cast);
  assert.ok(relationshipOf(large,'a','b')>relationshipOf(small,'a','b'));
  assert.ok(relationshipOf(fight,'a','b')<40);
  assert.ok(relationshipOf(breakup,'a','b')<relationshipOf(fight,'a','b'));
  assert.equal(JSON.stringify(cast),before);
});
