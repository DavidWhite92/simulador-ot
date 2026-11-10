import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {freshGroups,previousGroups,assignmentPlanGala,groupKey} from '../src/lib/assignments.js';
const rng=()=>{let seed=7;return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};};
test('group identity ignores order but distinguishes a duo from a trio',()=>{
  const history={1:{1:{reparto:[{members:['a','b','c']},{members:['d','e']}]}}};
  const used=previousGroups(history,2);
  assert.ok(used.has(groupKey(['c','b','a'])));
  assert.ok(!used.has(groupKey(['a','b'])));
  assert.ok(used.has(groupKey(['e','d'])));
  assert.equal(freshGroups(['a','b'],{duos:1},used,()=>0)[0].type,'duo');
  assert.equal(freshGroups(['a','b','d'],{trios:1},used,()=>0)[0].type,'trio');
  assert.ok(freshGroups(['c','a','b'],{trios:1},used,()=>0).every(r=>r.type==='solo'));
});
test('matching finds a complete fresh allocation and uses solos only when needed',()=>{
  const used=new Set([groupKey(['a','b']),groupKey(['a','c']),groupKey(['b','d'])]);
  const rows=freshGroups(['a','b','c','d'],{duos:2},used,()=>0.5);
  assert.equal(rows.length,2);assert.ok(rows.every(r=>r.type==='duo'&&!used.has(groupKey(r.members))));
  assert.equal(new Set(rows.flatMap(r=>r.members)).size,4);
  const blocked=new Set([groupKey(['a','b'])]);
  assert.equal(freshGroups(['a','b'],{duos:1},blocked).length,2);
});
test('a season never repeats a complete group, including after save and reload',()=>{
  let summaries={};const random=rng();const ids=Array.from({length:18},(_,i)=>`c${i}`);
  for(let gala=1;gala<=17;gala++) {
    const used=previousGroups(summaries,gala);
    const rows=freshGroups(ids,{trios:2,duos:5},used,random);
    assert.deepEqual(rows.flatMap(r=>r.members).sort(),[...ids].sort());
    for(const row of rows.filter(r=>r.members.length>1)) assert.ok(!used.has(groupKey(row.members)));
    summaries[gala]={[gala]:{reparto:rows}};
    summaries=JSON.parse(JSON.stringify(summaries));
  }
});
for(const file of ['SimuladorOT.jsx','SimuladorOT_RTVE.jsx']) {
  test(`${file}: repechage repeats earlier formats and keeps nominees in solos`,()=>{
    const source=readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
    const start=source.indexOf('    function repartoPlan('),end=source.indexOf('    function rellenarValoracionesReparto',start);
    const c=vm.createContext({freshGroups,previousGroups,assignmentPlanGala});
    vm.runInContext(source.slice(start,end),c);
    const ids=Array.from({length:11},(_,i)=>`c${i}`),summary={8:{repechage:{selected:['c0','c1']}}};
    for(const gala of [9,10,11]) {
      const rows=c.buildRepartoParaGala(gala,ids,['c0','c1'],summary);
      assert.deepEqual(Array.from(rows.slice(0,2),r=>r.members[0]),['c0','c1']);
      assert.ok(rows.slice(0,2).every(r=>r.type==='solo'));
      const expected=c.repartoPlan(gala-2);
      assert.equal(rows.filter(r=>r.type==='duo').length,expected.duos);
      assert.equal(rows.flatMap(r=>r.members).length,11);
    }
    assert.equal(assignmentPlanGala(9,false),9);
    assert.equal(assignmentPlanGala(12,true),12);
  });
}
