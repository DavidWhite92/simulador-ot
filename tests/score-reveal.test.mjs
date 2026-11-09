import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { performanceNominationModifier } from '../src/lib/academy.js';
import { captureScoreResult, alignFinalistScores, scoreEvents, liveScoreRanking } from '../src/lib/scoreReveal.js';

function setup(file, manual) {
  const tc = file === 'SimuladorOT.jsx';
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const start = source.indexOf('    function applyScoreResults(');
  const end = source.indexOf(tc ? 'function gala10Profes(' : '    function g11_profesoresSalvan(', start);
  const contestants = Array.from({ length: tc ? 7 : 6 }, (_, i) => ({ id: `c${i}`, name: `Name ${i}`, status: 'active', history: [] }));
  const gala = tc ? 12 : 13;
  const stage = tc ? 'gala10_jueces' : 'g11_jurado';
  const context = vm.createContext({ performanceNominationModifier,
    contestants, manual, gala, stage, gstate: {}, galaLogs: {},
    summaries: { [gala]: { [gala]: { reparto: contestants.map(c => ({ members: [c.id], valor: '' })) } } },
    captureScoreResult, alignFinalistScores, scoreEvents,
    nameOf: id => id, pickManually: ids => ids.slice(-3), countNomsThrough: () => 0,
    randomHalfStep: () => 8, clamp: (n, a, b) => Math.min(b, Math.max(a, n)),
    rellenarValoracionesReparto: (g, s) => s, setViewGala() {}, alert: message => { throw new Error(message); },
  });
  for (const [setter, key] of [['setGstate','gstate'],['setContestants','contestants'],['setSummaries','summaries'],['setGalaLogs','galaLogs'],['setStage','stage']]) {
    context[setter] = update => { context[key] = typeof update === 'function' ? update(context[key]) : update; };
  }
  vm.runInContext(`Math.random = () => 0.4; ${source.slice(start, end)}`, context);
  context.start = tc ? context.gala10PuntuarJueces : context.g11_puntuarJurado;
  return context;
}

for (const file of ['SimuladorOT.jsx', 'SimuladorOT_RTVE.jsx']) {
  for (const manual of [false, true]) {
    test(`${file}: incremental scores match finalists and deferred summary (${manual})`, () => {
      const c = setup(file, manual);
      c.start();
      assert.equal(c.stage, 'scoreReveal');
      assert.equal(c.contestants.filter(p => p.status === 'finalista').length, 0);
      assert.equal(Object.keys(c.galaLogs).length, 0);
      const events = c.gstate.scoreReveal.events;
      assert.equal(events.length, c.contestants.length * 4);
      let total = 0;
      for (const event of events) {
        c.advanceScoreReveal();
        total += event.score;
        const ranking = liveScoreRanking(c.gstate.scoreReveal);
        assert.equal(ranking.reduce((sum, row) => sum + row.total, 0), total);
        assert.ok(ranking.every((row, i) => !i || ranking[i - 1].total >= row.total));
        assert.equal(c.contestants.filter(p => p.status === 'finalista').length, 0);
      }
      const expected = c.gstate.scoreReveal.finalists;
      assert.deepEqual([...liveScoreRanking(c.gstate.scoreReveal).slice(0, 3).map(r => r.id)], [...expected]);
      for (let i = 1; i <= 3; i++) {
        c.advanceScoreReveal();
        assert.equal(c.gstate.scoreReveal.revealedFinalists, i);
        assert.equal(c.stage, 'scoreReveal');
      }
      c.advanceScoreReveal();
      assert.equal(c.contestants.filter(p => p.status === 'finalista').length, 3);
      assert.equal(c.stage, file === 'SimuladorOT.jsx' ? 'gala10_profes' : 'g11_profes');
      assert.ok(c.galaLogs[c.gala].length > 0);
    });
    test(`${file}: reveal all uses the same prepared marks without rerolling (${manual})`, () => {
      const animated = setup(file, manual);
      animated.start();
      animated.advanceScoreReveal();
      const pending = animated.gstate.scoreReveal.pending;
      animated.applyScoreResults(pending);
      const skipped = setup(file, manual);
      skipped.start(true);
      assert.equal(JSON.stringify(animated.summaries), JSON.stringify(skipped.summaries));
      assert.equal(JSON.stringify(animated.contestants), JSON.stringify(skipped.contestants));
      assert.equal(animated.stage, skipped.stage);
    });
  }
}
