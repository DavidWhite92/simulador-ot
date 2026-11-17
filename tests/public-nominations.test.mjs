import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicNominationActions, publicNominationSlots, publicNominationCell, juryRescueColor } from '../src/lib/publicNominations.js';
import { useRepechage } from '../src/lib/repechage.js';

function harness(count=17, options={}) {
  const s={gala:1,contestants:Array.from({length:count},(_,i)=>({id:`c${i}`,name:`Persona ${i}`,gender:'f',status:'active',popularity:100-i*4,history:[]})),gstate:{},summaries:{},manual:false,popularityEnabled:true,repechageEnabled:false,...options};
  for(const key of ['gstate','summaries','stage','contestants','carryNominees']) s[`set${key[0].toUpperCase()+key.slice(1)}`]=v=>{s[key]=typeof v==='function'?v(s[key]):v;};
  Object.assign(s,{pushLog(){},nameOf:id=>id,pickManually:ids=>ids[0],onRepechage:ids=>{s.danger=ids;}});
  return {s,act:()=>createPublicNominationActions(s)};
}

for(const count of [17,10,8]) for(const manual of [false,true]) test(`public ranking ${count}, manual=${manual}: exact danger zone and mixed final pair`,()=>{
  const {s,act}=harness(count,{manual});act().start();
  let guard=0;
  while(s.stage==='publicNomination' && guard++<100) {
    const r=s.gstate.publicNomination;
    if(r.screen==='placement') act().next(publicNominationSlots(r).at(-1)); else act().next();
  }
  assert.ok(guard<100);
  assert.equal(s.gstate.nominados.length,count===8?4:5);
  assert.equal(s.stage,count===8?'profesSalvan':'publicJurySave');
  assert.equal(new Set(s.gstate.publicNomination.revealed).size,count);
  assert.deepEqual(new Set(s.gstate.evalResults.slice(-2).map(r=>r.result)),new Set(['salvado','nominado']));
  if(!manual) assert.equal(s.summaries[1].favoritoId,'c0');
  if(count!==8) {
    const ids=s.gstate.nominados;
    s.summaries[1].performances=Object.fromEntries(ids.map((id,i)=>[id,{score:i+5}]));
    act().saveJury();
    assert.equal(s.summaries[1].jurySavedId,manual?ids[0]:ids.at(-1));
    assert.equal(s.gstate.nominados.length,4);
    assert.equal(s.stage,'ceremony');
    assert.equal(s.gstate.ceremony.nextStage,'profesSalvan');
  }
});

test('Christmas reveals safe contestants first then suspends all five public nominations',()=>{
  const {s,act}=harness(10,{gala:8,repechageEnabled:true});act().start();
  for(let i=0;i<20;i++) act().next();
  assert.equal(s.danger.length,5);
  assert.equal(s.gstate.publicNomination.revealed.length,5);
  assert.ok(s.danger.every(id=>!s.gstate.publicNomination.revealed.includes(id)));
  Object.assign(s,{songs:['Tema'],songsMeta:{},academy:{judges:['A','B','C','D']}});
  const rep=()=>useRepechage(s);
  rep().start(s.danger);
  assert.equal(s.gstate.repechage.phase,'surprise');
  rep().advance();
  assert.equal(s.summaries[8].publicNomination.revealed.length,10);
  assert.equal(s.summaries[8].falseNominees.length,5);
  assert.deepEqual(s.carryNominees,[]);
  assert.equal(s.gstate.repechage.phase,'announcement');
});

test('ranking cells keep gender, rank, rescue colours and only the current duel percentage',()=>{
  const people=Array.from({length:8},(_,i)=>({id:`c${i}`,gender:'f'}));
  const summary={publicNomination:{entries:people,revealed:people.map(p=>p.id),dangerCount:5},jurySavedId:'c3',profesorSalvoId:'c4',salvadoCompanerosId:'c5',finalNominees:['c6','c7']};
  const cell=i=>publicNominationCell(people[i],summary,9);
  assert.equal(cell(0).text,'Favorita (1ª)');
  assert.equal(cell(0).background,'DodgerBlue');
  assert.equal(cell(1).background,'#AFEEEE');
  assert.equal(cell(3).background,juryRescueColor);
  assert.match(cell(3).label,/Propuesta por el Público > Salvada por el Jurado \(4ª\)/);
  assert.equal(cell(4).background,'yellowgreen');
  assert.equal(cell(5).background,'khaki');
  assert.equal(cell(6).background,'orange');
  summary.duel={a:'c3',b:'out',winner:'c3',pctA:62,pctB:38};
  assert.match(cell(3).label,/^Salvada por el Público \(62.00%\) >/);
  assert.equal(publicNominationCell({id:'out',gender:'m'},summary,9).label,'Expulsado por el Público (38.00%)');
  delete summary.duel;
  assert.ok(!cell(3).label.includes('%'));
});
