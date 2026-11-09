import { selectPerformanceNominees, mixedJuryOrder, manualJuryOptions } from '../src/lib/juryPerformance.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { performanceNominationModifier } from '../src/lib/academy.js';
import { runJuryReveal, blindDuelPercentages } from '../src/lib/juryReveal.js';

function juryHarness(file, gala, manual = false, choose = () => null) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('    function evaluarSiguientePorJurado('), source.indexOf('    function profesoresSalvanUno('));
  const contestants = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, name: `Name ${i}`, gender: i % 2 ? 'm' : 'f', status: 'active' }));
  const context = vm.createContext({ selectPerformanceNominees, mixedJuryOrder, manualJuryOptions, performanceNominationModifier,
    contestants, gala, manual, pickManually: choose, nameOf: id => id, runJuryReveal, setViewGala() {},
    buildValoracionesOrder: ids => ids, getSongFor: () => null, songsMeta: {},
    performanceModifier: () => 0, BASE_NOM_PROB: 0.5, PUBLIC_WEIGHT: 0,
    clamp: (x, a, b) => Math.max(a, Math.min(b, x)), console: { log() {}, warn() {} },
  });
  vm.runInContext(`Math.random = () => 0.3; ${body}; globalThis.step = evaluarPasoJurado;`, context);
  const initial = {
    stage: 'juradoEvaluando', summaries: {}, galaLogs: { [gala]: ['Previous event'] },
    gstate: { evaluacionOrden: [], evalResults: [], nominados: [], salvados: new Set(['c0']), favoritoId: 'c0', publicRank: [] },
  };
  return { step: context.step, initial, context };
}

for (const file of ['SimuladorOT.jsx', 'SimuladorOT_RTVE.jsx']) {
  test(`${file}: performance-based nominations override old order constraints`, () => {
    const { step, initial, context } = juryHarness(file,1);
    initial.summaries[1] = { performances: Object.fromEntries(context.contestants.map((c,i) => [c.id, { score: i>=1 && i<=4 ? 2 : 8, judge:'Risto Mejide', critique:'Valoración de prueba.' }])) };
    const result = runJuryReveal(step, initial, 1, true);
    assert.deepEqual([...result.gstate.nominados].sort(), ['c1','c2','c3','c4']);
    assert.equal(result.stage,'profesSalvan');
    assert.ok(result.galaLogs[1].some(log=>log.includes('Risto Mejide a <strong>c1</strong>')));
    assert.ok(!result.gstate.nominados.includes('c0'));
    assert.equal(result.gstate.evalResults.slice(-2).filter(r => r.result === 'nominado').length, 1);
  });
  test(`${file}: the final verdict remains visible until an explicit continuation`, () => {
    const { step, initial, context } = juryHarness(file,1);
    initial.summaries[1] = { performances: Object.fromEntries(context.contestants.map((c,i)=>[c.id,{score:i<5?3:8}])) };
    let state=initial;
    for(let i=0;i<40 && state.gstate.evalResults.length<11;i++) state=runJuryReveal(step,state,1);
    assert.equal(state.gstate.evalResults.length,11);
    assert.equal(state.stage,'juradoEvaluando');
    assert.equal(state.gstate.evalResults.slice(-2).filter(r=>r.result==='nominado').length,1);
    state=runJuryReveal(step,state,1);
    assert.equal(state.stage,'profesSalvan');
  });
  test(`${file}: custom judge speaks before nomination and escaped feedback remains in summary`, () => {
    const { context: c, initial } = juryHarness(file, 1);
    Object.assign(c, initial);
    c.summaries = { 1: { performances: Object.fromEntries(c.contestants.map(p => [p.id, { score: 8, judge: '<Ana>', critique: 'Has defendido bien <tu tema>.' }])) } };
    for (const key of ['gstate','summaries','galaLogs','stage']) c[`set${key[0].toUpperCase()}${key.slice(1)}`] = update => { c[key] = typeof update === 'function' ? update(c[key]) : update; };
    c.evaluarSiguientePorJurado();
    assert.ok(c.gstate.currentEvaluadoId);
    assert.equal(c.gstate.juryCommentShown, false);
    c.evaluarSiguientePorJurado();
    assert.equal(c.gstate.juryCommentShown, true);
    assert.equal(c.gstate.evalResults.length, 0);
    c.evaluarSiguientePorJurado();
    assert.equal(c.gstate.evalResults.length, 1);
    assert.ok(c.galaLogs[1].some(log => log.includes('&lt;Ana&gt;') && log.includes('&lt;tu tema&gt;')));
    assert.ok(c.galaLogs[1].at(-1).includes('Jurado evalúa'));
  });
  for (const gala of [1, 8, 9]) {
    test(`${file} gala ${gala}: individual and bulk reveal agree and stop before teachers`, () => {
      const { step, initial } = juryHarness(file, gala);
      let single = runJuryReveal(step, initial, gala);
      assert.equal(single.gstate.currentEvaluadoId, 'c1');
      assert.equal(single.gstate.evalResults.length, 0);
      single = runJuryReveal(step, single, gala);
      assert.equal(single.gstate.evalResults.length, 1);
      assert.equal(single.gstate.currentEvaluadoId, undefined);
      const partialBulk = runJuryReveal(step, single, gala, true);
      for (let i = 0; i < 30 && single.stage === 'juradoEvaluando'; i++) single = runJuryReveal(step, single, gala);
      const bulk = runJuryReveal(step, initial, gala, true);
      for (const result of [single, bulk, partialBulk]) {
        assert.equal(result.stage, 'profesSalvan');
        assert.equal(result.gstate.nominados.length, 4);
        assert.equal(result.gstate.evalResults.length, 11);
        assert.ok(!result.gstate.nominados.includes('c0'));
        assert.equal(new Set(result.gstate.evalResults.map(r => r.id)).size, 11);
        assert.equal(result.galaLogs[gala].length, 13);
        assert.equal(result.summaries[gala].juradoNominados.length, 4);
      }
      assert.deepEqual(bulk.gstate.evalResults, single.gstate.evalResults);
      assert.deepEqual(partialBulk.gstate.evalResults, single.gstate.evalResults);
    });
  }
  test(`${file}: manual bulk respects cancellation and can resume`, () => {
    let calls = 0;
    let cancel = true;
    const { step, initial } = juryHarness(file, 1, true, options => {
      calls++;
      return cancel ? null : options[0];
    });
    const paused = runJuryReveal(step, initial, 1, true);
    assert.equal(calls, 1);
    assert.equal(paused.stage, 'juradoEvaluando');
    assert.equal(paused.gstate.currentEvaluadoId, 'c1');
    cancel = false;
    const finished = runJuryReveal(step, paused, 1, true);
    assert.equal(finished.stage, 'profesSalvan');
    assert.equal(finished.gstate.nominados.length, 4);
    assert.equal(finished.gstate.evalResults.length, 11);
  });
}

test('blind percentages can appear in either order without changing their values', () => {
  assert.deepEqual(blindDuelPercentages(61.25, 38.75, () => 0.1), [61.25, 38.75]);
  assert.deepEqual(blindDuelPercentages(61.25, 38.75, () => 0.9), [38.75, 61.25]);
});
