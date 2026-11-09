import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { favoriteRanking } from '../src/lib/academy.js';

for (const file of ['SimuladorOT.jsx', 'SimuladorOT_RTVE.jsx']) {
  for (const manual of [false, true]) {
    test(`${file}: favorites reveal individually and leave the winner visible (${manual ? 'manual' : 'automatic'})`, () => {
      const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
      const body = source.slice(source.indexOf('    function iniciarVotoPublico()'), source.indexOf('    function evaluarSiguientePorJurado('));
      const logs = [];
      const context = vm.createContext({ popularityEnabled: true,
        favoriteRanking, manual, gala: 2, stage: 'votoPublico',
        contestants: Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, status: 'active', popularity: [95,90,80,70,20][i] })),
        gstate: { salvados: new Set(), top3Ban: new Set() }, summaries: { 1: { finalNominees: ['c0','c4'] }, 2: { duel: { winner: 'c0' } } },
        audiencePercentages: () => [40, 25, 20, 10, 5],
        nameOf: id => id, fmtPct: p => `${p}%`, pushLog: html => logs.push(html),
        setViewGala() {}, alert: message => { throw new Error(message); },
        pickManually: (ids, multiple) => multiple ? ['c1', 'c2', 'c3'] : 'c3',
      });
      context.setGstate = update => { context.gstate = typeof update === 'function' ? update(context.gstate) : update; };
      context.setSummaries = update => { context.summaries = update(context.summaries); };
      context.setStage = stage => { context.stage = stage; };
      vm.runInContext(`Math.random = () => 0; ${body}`, context);
      context.iniciarVotoPublico();
      assert.equal(context.gstate.favoritoId, undefined);
      assert.equal(context.gstate.top3RevealCount, 0);
      assert.ok(!context.gstate.top3.includes('c0'));
      assert.deepEqual([...context.gstate.top3].sort(), ['c1','c2','c3']);
      assert.notDeepEqual([...context.gstate.top3RandomOrder], [...context.gstate.top3]);
      for (let count = 1; count <= 3; count++) {
        context.revelarTop3YFavorito();
        assert.equal(context.gstate.top3RevealCount, count);
        assert.equal(context.gstate.favoritoId, undefined);
        assert.equal(context.stage, 'votoPublico');
      }
      assert.ok(logs.every(log => !log.includes('%')));
      // Save/reload the reveal progress before revealing the winner.
      const saved = JSON.parse(JSON.stringify({ ...context.gstate, salvados: [...context.gstate.salvados] }));
      context.gstate = { ...saved, salvados: new Set(saved.salvados) };
      context.revelarTop3YFavorito();
      assert.equal(context.gstate.favoritoId, manual ? 'c3' : 'c1');
      assert.equal(context.gstate.favoriteRevealed, true);
      assert.equal(context.stage, 'votoPublico');
      assert.ok(context.gstate.salvados.has(context.gstate.favoritoId));
      assert.equal(context.summaries[2].favoritoId, context.gstate.favoritoId);
      const logCount = logs.length;
      context.revelarTop3YFavorito();
      assert.equal(logs.length, logCount);
      assert.ok(logs.at(-1).includes('Favorito/a'));
    });
  }
}
