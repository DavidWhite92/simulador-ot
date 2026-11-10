import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {returnPerformanceLabel} from '../src/lib/returnLabels.js';
import {repechageCell} from '../src/lib/repechage.js';
const cast=[{id:'a',gender:'m'},{id:'b',gender:'f'}];
const base={repechage:{winner:'a',candidates:['a','b'],ranking:[{id:'a',pct:65.3},{id:'b',pct:34.7}]}};
const cases=[
  [{juradoNominados:[]},'Salvado por el Jurado','Sal','#fff'],
  [{juradoNominados:['a'],finalNominees:['a']},'Propuesto por el Jurado > Nominado','Nom','orange'],
  [{juradoNominados:['a'],profesorSalvoId:'a'},'Propuesto por el Jurado > Salvado por los Profesores','Sal','yellowgreen'],
  [{juradoNominados:['a'],salvadoCompanerosId:'a'},'Propuesto por el Jurado > Salvado por los Compañeros','Sal','khaki'],
];
for(const [decision,label,short,color] of cases) test(`returned contestant retains percentage and ${label}`,()=>{
  const summary={...base,...decision};
  const value=returnPerformanceLabel('a',summary,cast);
  assert.equal(value,`Repescado por el Público (65.30%) > ${label}`);
  const cell=repechageCell(cast[0],{9:summary},9);
  assert.equal(cell.parts[0].text,'Rep.');assert.equal(cell.parts[1].text,short);assert.equal(cell.parts[1].background,color);
  for(const file of ['SimuladorOT.jsx','SimuladorOT_RTVE.jsx']) {
    const source=readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
    const start=source.indexOf('    function valorBgColor('),end=source.indexOf('  function reiniciar()',start);
    const context=vm.createContext({});vm.runInContext(source.slice(start,end),context);
    assert.equal(context.valorBgColor(value,9).bg,color);
    assert.equal(context.valorBgColor(returnPerformanceLabel('b',summary,cast),9).bg,'red');
  }
});
test('loser is expelled with their own percentage and old returns do not leak into other contestants',()=>{
  assert.equal(returnPerformanceLabel('b',base,cast),'Expulsada por el Público (34.70%)');
  assert.equal(returnPerformanceLabel('c',base,cast,'Salvado'),'Salvado');
  assert.equal(returnPerformanceLabel('a',base,cast),'Repescado por el Público (65.30%)');
});
test('G8 only false nominees retain the top-three marker and split labels have no periods',()=>{
  const s={falseNominees:['b'],top3Ids:['a','b']};
  assert.equal(repechageCell(cast[0],{8:s},8).text,'Salvado');
  assert.equal(repechageCell(cast[1],{8:s},8).text,'Salvadaº');
  const c={...cast[0],history:[{gala:8,evento:'Eliminado'}]};
  const cell=repechageCell(c,{8:{repechage:{candidates:['a'],selected:['a']}}},8);
  assert.deepEqual(cell.parts.map(p=>p.text),['Eli','Can']);
});
