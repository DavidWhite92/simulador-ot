import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'esbuild';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('duelists remain anonymous in percentage rows until the duel finishes',()=>{
  const source=readFileSync(new URL('../src/components/PublicReveal.jsx',import.meta.url),'utf8');
  const code=transformSync(source,{loader:'jsx',format:'cjs',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'}).code;
  const context=vm.createContext({React,module:{exports:{}},require:name=>name.includes('audio')?{useMusicCue(){}}:name.includes('button')?{Button:({children})=>React.createElement('button',null,children)}:{useReducedMotion:()=>true,motion:{div:({children})=>React.createElement('div',null,children)}}});
  vm.runInContext(code,context);
  const Component=context.module.exports.default;
  const reveal={kind:'duel',phase:2,entries:[{id:'a',pct:60},{id:'b',pct:30},{id:'c',pct:10}],visible:[0,1,2],targets:[0,1,2],cursor:2,screen:'revealed'};
  const contestants=[{id:'a',name:'Seguro'},{id:'b',name:'Duelista B'},{id:'c',name:'Duelista C'}];
  const html=renderToStaticMarkup(React.createElement(Component,{reveal,contestants}));
  const table=html.slice(html.indexOf('<table'),html.indexOf('</table>'));
  assert.match(table,/Seguro/);assert.doesNotMatch(table,/Duelista/);
  assert.match(html,/No cuentas con el suficiente apoyo/);
  const result=renderToStaticMarkup(React.createElement(Component,{reveal:{...reveal,screen:'duelResult'},contestants,duelResult:{winner:'c',pctWin:55}}));
  assert.match(result.slice(result.indexOf('<table'),result.indexOf('</table>')),/Duelista B/);
});
