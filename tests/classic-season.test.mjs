import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassicActions, classicMerit } from '../src/lib/classicSeason.js';
import { visibleGalas, displayGala, nextGala } from '../src/lib/seasonSchedule.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { choosePeerSave } from '../src/lib/relationships.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import { repechageCell, absentAfterElimination } from '../src/lib/repechage.js';
import { lastElimination } from '../src/lib/seasonSchedule.js';

function harness(count=7) {
  const state={gala:12,contestants:Array.from({length:count},(_,i)=>({id:`c${i}`,name:`Persona ${i}`,gender:'f',status:'active',popularity:50,history:[]})),summaries:{},gstate:{},stage:'gala10_jueces',manual:false,popularityEnabled:true};
  const logs=[];
  for(const key of ['contestants','summaries','gstate','stage']) state[`set${key[0].toUpperCase()+key.slice(1)}`]=update=>{state[key]=typeof update==='function'?update(state[key]):update;};
  state.nameOf=id=>state.contestants.find(c=>c.id===id)?.name;
  state.pushLog=text=>logs.push(text);
  state.pickManually=ids=>ids[0];
  const act=()=>createClassicActions(state);
  return {state,act,logs};
}

test('TVE 2001 opens with sixteen entries and no elimination',()=>{
  const {state:s,act,logs}=harness(16);s.gala=0;
  s.summaries={0:{0:{reparto:s.contestants.map(c=>({members:[c.id],song:'Tema'}))}}};
  act().closeOpening();
  assert.equal(s.stage,'galaCerrada');
  assert.equal(s.contestants.filter(c=>c.status==='active').length,16);
  assert.equal(s.summaries[0].gala0.entraJurado.length,16);
  assert.equal(s.summaries[0].gala0.eliminados.length,0);
  assert.ok(logs[0].includes('favorito'));
});

test('merit considers all performances, nominations and ignores suspended nominations',()=>{
  const {state:s}=harness(3);
  s.summaries={1:{performances:{c0:{score:9},c1:{score:8},c2:{score:5}},juradoNominados:['c2']},2:{juradoNominados:['c2']},8:{falseNominees:['c0'],juradoNominados:['c0']}};
  const ranking=classicMerit(s.contestants,s.summaries,12);
  assert.deepEqual(ranking.map(r=>r.id),['c0','c1','c2']);
  assert.equal(ranking[0].nominations,0);
  assert.equal(ranking[2].nominations,2);
});

for(const manual of [false,true]) test(`seven assessments precede three finalist reveals; teachers and peers select fourth and fifth (${manual})`,()=>{
  const {state:s,act}=harness();s.manual=manual;
  s.summaries={12:{12:{reparto:s.contestants.map(c=>({members:[c.id],song:'Tema'}))}}};
  act().startJury();
  for(let i=0;i<7;i++) {act().nextJury();assert.equal(s.gstate.classicJury.revealed,0);}
  for(let i=1;i<=3;i++) {act().nextJury();assert.equal(s.gstate.classicJury.revealed,i);}
  act().nextJury();
  assert.equal(s.stage,'gala10_profes');
  assert.equal(s.contestants.filter(c=>c.status==='finalista').length,3);
  assert.equal(s.gstate.nominados.length,4);
  assert.equal(s.summaries[12].g10.sumas,undefined);
  // Run the actual shared teacher/peer/final-duel code used by this mode.
  const source=readFileSync(new URL('../src/SimuladorOT.jsx',import.meta.url),'utf8');
  Object.assign(s,{choosePeerSave, relationshipsEnabled:false,academy:{relationships:{},pairs:[]},carryNominees:[],
    setCarryNominees:ids=>{s.carryNominees=ids;},setViewGala(){},pickProfSave:ids=>ids[0],countNomsThrough:()=>0,
    pickRandom:ids=>[ids[0]],rellenarValoracionesReparto:(g,s)=>s,console:{log(){},group(){},table(){},groupEnd(){}},
    audiencePercentages:()=>[65,35]});
  const context=vm.createContext(s);
  for(const name of ['startCeremony','finishCeremony','continueCeremony','revealAllPeerVotes','gala10Profes','gala10Compas','g11_iniciarCiegos','g11_revelar']) {
    const start=source.search(new RegExp(`^ *function ${name}\\(`,'m'));
    const rest=source.slice(start+20);const end=rest.search(/^ {0,4}function \w+\(/m);
    vm.runInContext(source.slice(start,start+20+end),context);
  }
  context.startCeremony('teachers',s.gstate.nominados,'specialTeachers');context.gala10Profes();context.continueCeremony();
  assert.equal(s.contestants.filter(c=>c.status==='finalista').length,4);
  context.startCeremony('peers',s.gstate.nominados,'specialPeers',s.contestants.filter(c=>c.status==='finalista').map(c=>c.id));
  context.revealAllPeerVotes();
  assert.equal(s.stage,'ceremony');assert.equal(s.gstate.ceremony.phase,'result');
  assert.equal(s.contestants.filter(c=>c.status==='finalista').length,5);
  assert.equal(s.carryNominees.length,2);
  context.continueCeremony();
  s.gala=13;context.g11_iniciarCiegos();context.g11_revelar();context.continueCeremony();
  assert.equal(s.contestants.filter(c=>c.status==='finalista').length,6);
  assert.equal(s.contestants.filter(c=>c.status==='eliminado').length,1);
  assert.equal(s.stage,'galaCerrada');
});

for(const manual of [false,true]) test(`six-person final reveals 6,5,4,3 then winner, preserving state on reload (${manual})`,()=>{
  const {state:s,act}=harness(6);s.gala=14;s.manual=manual;
  s.contestants.forEach(c=>{c.status='finalista';});
  s.summaries={14:{14:{reparto:s.contestants.map(c=>({members:[c.id],song:'Tema'}))}}};
  act().startFinal();
  for(const index of [5,4,3,2,0]) {
    const chosen=s.gstate.classicFinal.entries.find((_,i)=>!s.gstate.classicFinal.visible.includes(i)).id;
    act().nextFinal(chosen);
    assert.ok(s.gstate.classicFinal.visible.includes(index));
    assert.equal(s.stage,'classicFinal');
    s.gstate=JSON.parse(JSON.stringify(s.gstate));
    act().nextFinal();
  }
  assert.equal(s.stage,'galaCerrada');
  assert.equal(s.gstate.classicFinal.visible.length,6);
  assert.equal(s.contestants.filter(c=>c.status==='ganador').length,1);
  assert.equal(s.summaries[14].classicFinal.entries.length,6);
  assert.equal(Math.round(s.summaries[14].classicFinal.entries.reduce((n,r)=>n+r.pct,0)*100),10000);
});

test('calendar ends directly after sixth finalist, with two additional galas for repechage',()=>{
  for(const repechage of [false,true]) {
    assert.equal(nextGala(13,repechage),14);
    assert.equal(displayGala(12,repechage),repechage?12:10);
    assert.equal(displayGala(14,repechage),repechage?14:12);
    assert.equal(visibleGalas(14,repechage).length,repechage?15:13);
  }
});

test('actual TVE 2001 routing stops favourites after Gala 9 or 11 and goes directly to the final',()=>{
  const source=readFileSync(new URL('../src/SimuladorOT.jsx',import.meta.url),'utf8');
  const start=source.indexOf('  const nextStageFor =');
  const end=source.indexOf('    const repechage =',start);
  const c=vm.createContext({carryNominees:[],classic:true,scoreGala:12,sixthGala:13});
  vm.runInContext(source.slice(start,end)+'\nglobalThis.next=nextStageFor;',c);
  for(const enabled of [false,true]) {
    const galas=visibleGalas(14,enabled);
    const favorites=galas.filter(g=>g>0 && c.next(g)==='votoPublico');
    assert.equal(displayGala(favorites.at(-1),enabled),enabled?11:9);
    assert.equal(c.next(12),'gala10_jueces');
    assert.equal(c.next(13),'gala11_publico');
    assert.equal(c.next(14),'classicFinalReady');
  }
});

test('classic journey table has six ranked finalists, no numeric jury scores and the correct final column',()=>{
  const source=readFileSync(new URL('../src/SimuladorOT.jsx',import.meta.url),'utf8');
  const start=source.indexOf('function RecorridoTable(');
  const code=transformSync(source.slice(start)+'\nglobalThis.Table=RecorridoTable;', {loader:'jsx',jsxFactory:'React.createElement'}).code;
  const c=vm.createContext({React,visibleGalas,displayGala,lastElimination,repechageCell,absentAfterElimination,normName:s=>s,
    TablePerson:({person})=>React.createElement('td',null,person.name),SplitJourneyCell:()=>null});
  vm.runInContext(code,c);
  const {state:s}=harness(6);
  s.contestants.forEach(person=>{person.status='finalista';});
  const entries=s.contestants.map((person,i)=>({id:person.id,pct:30-i*4}));
  const summaries={0:{gala0:{entraJurado:entries.map(r=>r.id),eliminados:[]}},12:{g10:{top3:['c0','c1','c2'],cuarto:'c3',quinto:'c4'}},14:{classicFinal:{entries,winner:'c0'}}};
  for(const enabled of [false,true]) {
    const html=renderToStaticMarkup(React.createElement(c.Table,{contestants:s.contestants,summaries,classic:true,repechageEnabled:enabled}));
    assert.ok(html.includes('Gala Final'));
    assert.ok(!html.includes('Gala 15'));
    assert.ok(html.includes(enabled?'Gala 13':'Gala 11'));
    assert.ok(!html.includes('Nota:'));
    assert.ok(html.includes('Ganadora'));
    assert.ok(html.includes('6ª Finalista'));
    assert.ok(html.indexOf('Persona 0')<html.indexOf('Persona 5'));
  }
});

test('last qualifying gala puts the two nominees first and the classic final contains six solos',()=>{
  const source=readFileSync(new URL('../src/SimuladorOT.jsx',import.meta.url),'utf8');
  const start=source.indexOf('      function prepararNuevaGala(');
  const end=source.indexOf('  function iniciar()',start);
  const finalists=Array.from({length:6},(_,i)=>({id:`c${i}`,status:'finalista'}));
  const c=vm.createContext({classic:true,publicMode:false,scoreGala:12,sixthGala:13,contestants:finalists,carryNominees:[],summaries:{},songs:['Tema'],shuffle:ids=>ids,
    buildRepartoConCanciones:({reparto})=>({reparto,groupSong:'Grupal'}),nextStageFor:()=>'',
    setGstate(){},setViewGala(){},setGalaLogs(){},setStage(){},setSummaries:update=>{c.summaries=update(c.summaries);}});
  vm.runInContext(source.slice(start,end),c);
  c.prepararNuevaGala(14);
  assert.equal(c.summaries[14][14].reparto.length,6);
  assert.ok(c.summaries[14][14].reparto.every(row=>row.type==='solo' && row.members.length===1));
  c.contestants=[...finalists.slice(0,5),{id:'a',status:'active'},{id:'b',status:'active'}];
  c.carryNominees=['b','a'];
  c.prepararNuevaGala(13);
  assert.deepEqual(Array.from(c.summaries[13][13].reparto.slice(0,2),row=>row.members[0]),['b','a']);
});
