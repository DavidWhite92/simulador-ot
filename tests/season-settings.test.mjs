import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'esbuild';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {resolveRepechage, displayGala, nextGala, visibleGalas, lastElimination, galaLog} from '../src/lib/seasonSchedule.js';
import {repechageCell} from '../src/lib/repechage.js';

test('repesca on, off and random choose a persistent outcome without changing it after reload',()=>{
  assert.equal(resolveRepechage('off',()=>0),false);
  assert.equal(resolveRepechage('on',()=>0.99),true);
  assert.equal(resolveRepechage('random',()=>0.49),true);
  assert.equal(resolveRepechage('random',()=>0.5),false);
  const saved=JSON.parse(JSON.stringify({academy:{repechageEnabled:resolveRepechage('random',()=>0.2)}}));
  assert.equal(saved.academy.repechageEnabled,true);
});
test('without repesca calendar numbers are continuous and retain original season duration',()=>{
  for(const final of [15,17]) {
    let current=0, rounds=[0];
    while(current<final) {current=nextGala(current,false);rounds.push(current);}
    assert.deepEqual(rounds,visibleGalas(final,false));
    assert.deepEqual(rounds.map(g=>displayGala(g,false)),Array.from({length:final-1},(_,i)=>i));
    assert.equal(displayGala(final,false),final-2);
    assert.equal(nextGala(9,true),10);
  }
  assert.equal(galaLog('Gala 17 · G12',false),'Gala 15 · G10');
});
test('candidates keep elimination order and returning contestants use their latest exit',()=>{
  const old={id:'a',gender:'m',history:[{gala:3,evento:'Eliminado'}]};
  const latest={id:'b',gender:'f',history:[{gala:8,evento:'Eliminado'}]};
  const summaries={8:{repechage:{candidates:['a','b','c'],selected:['a','b']}},9:{repechage:{candidates:['a','b'],winner:'a'}}};
  assert.equal(repechageCell(old,summaries,8).text,'Candidato');
  assert.equal(repechageCell(latest,summaries,8).text,'Eli. | Can.');
  assert.equal(repechageCell({id:'c',gender:'m'},summaries,8).background,'tomato');
  assert.equal(repechageCell(old,summaries,9).text,'Repescado');
  assert.equal(lastElimination(old),3);
  old.history.push({gala:9,evento:'Repescado'},{gala:14,evento:'Eliminado'});
  assert.equal(lastElimination(old),14);
  assert.ok(lastElimination(old)>lastElimination(latest));
});
test('portrait and long names render in separate native table cells',()=>{
  const source=readFileSync(new URL('../src/components/TablePerson.jsx',import.meta.url),'utf8');
  const code=transformSync(source,{loader:'jsx',format:'cjs',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'}).code;
  const context=vm.createContext({React,module:{exports:{}}}); vm.runInContext(code,context);
  const TablePerson=context.module.exports.default;
  const html=renderToStaticMarkup(React.createElement('table',null,React.createElement('tbody',null,React.createElement('tr',null,React.createElement(TablePerson,{person:{name:'Nombre muy largo del concursante',photo:'/ot_photos/sinfoto.gif'}})))));
  assert.match(html,/<td[^>]*>.*<img[^>]*\/>.*<\/td><th[^>]*>Nombre muy largo del concursante<\/th>/);
  assert.match(html,/width:31px;min-width:31px;padding:0/);
  assert.match(html,/text-align:center;white-space:nowrap/);
});
