import test from 'node:test';
import assert from 'node:assert/strict';
import { useRepechage, repechageCandidates, repechageRanking, repechageCell, absentAfterElimination } from '../src/lib/repechage.js';
import { updatePairs, relationshipColor, choosePeerSave } from '../src/lib/relationships.js';
import { createAcademyEvents } from '../src/lib/academy.js';

function harness(manual=false) {
  const contestants=Array.from({length:18},(_,i)=>({id:`c${i}`,name:`C ${i}`,gender:'f',popularity:40+i,status:i<9?'active':'eliminado',history:i<9?[]:[{gala:i<16?i-8:0,evento:'Eliminado'}],stats:{afinacion:7,baile:7,presencia:7,emocion:7}}));
  const args={gala:8,gstate:{favoritoId:'c0'},contestants,summaries:{8:{top3Ids:['c0','c1','c2'],performances:Object.fromEntries(contestants.map((c,i)=>[c.id,{score:10-i/2}]))}},songs:Array.from({length:40},(_,i)=>`Tema ${i}`),songsMeta:{},academy:{judges:['A','B','C','D']},manual,popularityEnabled:true,pickManually:ids=>ids[0],nameOf:id=>id,pushLog:()=>{}};
  for(const [setter,key] of [['setGstate','gstate'],['setContestants','contestants'],['setSummaries','summaries'],['setStage','stage'],['setCarryNominees','carryNominees']]) args[setter]=value=>{args[key]=typeof value==='function'?value(args[key]):value;};
  return {args,render:()=>useRepechage(args)};
}
for(const manual of [false,true]) test(`G8 surprise, seven candidates and G9 return preserve popularity (${manual})`,()=>{
  const {args:a,render}=harness(manual);
  assert.equal(repechageCandidates(a.contestants).length,7);
  const pops=Object.fromEntries(a.contestants.map(c=>[c.id,c.popularity]));
  render().start();
  assert.equal(a.gstate.repechage.saved.length,4);
  assert.equal(a.gstate.repechage.falseNominees.length,4);
  render().advance(); assert.equal(a.gstate.repechage.crossingStep,'comment');
  assert.equal(a.gstate.repechage.shown,0);
  for(let i=0;i<20 && a.gstate.repechage.phase!=='surprise';i++) render().advance();
  assert.equal(a.gstate.repechage.shown,4);
  assert.equal(a.gstate.repechage.phase,'surprise');
  render().advance(); assert.equal(a.summaries[8].finalNominees.length,0);
  // Reload midway through the special gala.
  a.gstate.repechage=JSON.parse(JSON.stringify(a.gstate.repechage));
  for(let i=0;i<30 && a.stage!=='galaCerrada';i++) render().advance();
  assert.equal(a.stage,'galaCerrada');
  assert.equal(a.summaries[8].repechage.selected.length,2);
  assert.equal(a.summaries[8].repechage.ranking.length,7);
  assert.equal(a.contestants.filter(c=>c.status==='active').length,9);
  a.gala=9; a.gstate={}; a.summaries[9]={};
  assert.equal(render().startReturn(),true);
  render().advance(); assert.equal(a.gstate.repechage.phase,'returnPercentage');
  render().advance();
  assert.equal(a.contestants.filter(c=>c.status==='active').length,10);
  const winner=a.summaries[9].repechage.winner;
  assert.equal(a.contestants.find(c=>c.id===winner).popularity,pops[winner]);
  render().advance(); assert.equal(a.stage,'votoPublico');
  assert.equal(a.carryNominees.length,0);
});
test('repechage cells preserve elimination and return history',()=>{
  const c={id:'a',gender:'f',history:[{gala:8,evento:'Eliminado'},{gala:9,evento:'Repescado'},{gala:11,evento:'Eliminado'}]};
  const summaries={8:{repechage:{candidates:['a'],selected:['a']}},9:{repechage:{candidates:['a','b'],winner:'a'}}};
  assert.equal(repechageCell(c,summaries,8).split,true);
  assert.equal(absentAfterElimination(c,summaries,10),false);
  assert.equal(absentAfterElimination(c,summaries,12),true);
  assert.equal(repechageCell({id:'b',gender:'m'},summaries,9).text,'Eliminado');
  assert.equal(repechageCell(c,{8:{falseNominees:['a'],top3Ids:['a']}},8).text,'Salvadaº');
});
test('friendship starts at 55 and couples override it in pink',()=>{
  assert.equal(relationshipColor(54),'white'); assert.equal(relationshipColor(55),'#dcfce7');
  assert.equal(relationshipColor(40,true),'#f9a8d4');
  const old=[['a','b']], next=updatePairs(old,{breakup:['b','a']});
  assert.equal(next.length,0); assert.equal(old.length,1);
  assert.equal(choosePeerSave({voterId:'a',candidates:['b','c'],pairs:next,reparto:[{members:['a','c']}]},()=>0),'c');
});
test('breakups are possible but uncommon and romance templates stay unique',()=>{
  let breaks=0;
  const people=Array.from({length:8},(_,i)=>({id:`c${i}`,name:`C ${i}`,status:'active'}));
  let seed=5; const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<500;i++) { const e=createAcademyEvents(people,[],[['c0','c1']],random); if(e.some(e=>e.breakup))breaks++; assert.equal(new Set(e.map(e=>e.template)).size,e.length); }
  assert.ok(breaks>0 && breaks<100);
});
test('disabled popularity ignores previous scores in repechage',()=>{
  const ids=['a','b']; const first=repechageRanking(ids,[{id:'a',popularity:90},{id:'b',popularity:10}],false,()=>0.4);
  const second=repechageRanking(ids,[{id:'a',popularity:10},{id:'b',popularity:90}],false,()=>0.4);
  assert.deepEqual(first,second);
});

// Check the routing used by the real simulator, including the two extra weeks.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
for(const [file,scoreGala,finalGala] of [['SimuladorOT.jsx',12,17],['SimuladorOT_RTVE.jsx',13,15]]) {
  test(`${file}: extended calendar reaches scores with the correct number of contestants`,()=>{
    const source=readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
    const start=source.indexOf('  const nextStageFor =');
    const end=source.indexOf('    const repechage =',start);
    const c=vm.createContext({carryNominees:[]});
    vm.runInContext(source.slice(start,end)+'\nglobalThis.next=nextStageFor;',c);
    assert.equal(c.next(10),'votoPublico'); assert.equal(c.next(11),'votoPublico');
    assert.equal(c.next(scoreGala),file==='SimuladorOT.jsx'?'gala10_jueces':'gala11_publico');
    assert.equal(c.next(finalGala),file==='SimuladorOT.jsx'?'g15_final':'g13_fase1');
    // Nine survivors of G8, one returns in G9; ordinary eliminations resume in G10.
    let count=10;
    for(let g=10;g<=scoreGala;g++) {
      c.carryNominees=['a','b']; assert.equal(c.next(g),'dueloPendiente'); count--;
    }
    assert.equal(count,file==='SimuladorOT.jsx'?7:6);
  });
}
