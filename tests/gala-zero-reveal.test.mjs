import { selectPerformanceNominees } from '../src/lib/juryPerformance.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { performanceNominationModifier } from '../src/lib/academy.js';
import { captureScoreResult } from '../src/lib/scoreReveal.js';
import { prepareGalaZeroJury } from '../src/lib/galaZeroReveal.js';

function setup(file, manual) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const contestants = Array.from({ length: 18 }, (_, i) => ({ id: `c${i}`, name: `Name ${i}`, status: 'active', history: [] }));
  const c = vm.createContext({ popularityEnabled: true, selectPerformanceNominees, performanceNominationModifier,
    Set, contestants, manual, gala: 0, stage: 'g0_eval',
    gstate: { g0: { order: contestants.map(p => p.id), idx: 0, entered: new Set(), doubt: new Set() } },
    summaries: { 0: { 0: { reparto: contestants.map(p => ({ members: [p.id] })) } } }, galaLogs: {},
    captureScoreResult, prepareGalaZeroJury, nameOf: id => id,
    pickManually: (ids, multi) => multi ? ids.slice(-4) : ids[0],
    pickProfSave: ids => ids[0], countNomsThrough: () => 0,
    getSongFor: () => null, getSongMetaFor: () => null, songsMeta: {},
    audiencePercentages: () => [60, 25, 15], fmtPct: n => `${n}%`,
    console: { debug() {} }, alert() {}, setViewGala() {},
    songs: [], shuffle: ids => ids, buildRepartoParaGala: (g, ids) => ids.map(id => ({ members: [id] })),
    buildRepartoConCanciones: ({ reparto }) => ({ reparto, groupSong: 'Song' }),
  });
  for (const key of ['gstate', 'contestants', 'summaries', 'galaLogs', 'stage', 'gala']) {
    c[`set${key[0].toUpperCase()}${key.slice(1)}`] = update => { c[key] = typeof update === 'function' ? update(c[key]) : update; };
  }
  c.pushLog = (html, g = c.gala) => { c.galaLogs = { ...c.galaLogs, [g]: [...(c.galaLogs[g] || []), html] }; };
  const start = source.indexOf('    function g0_snapshot(');
  const end = source.indexOf('   const goNext', start);
  vm.runInContext(`Math.random = () => 0.5; ${source.slice(start, end)}`, c);
  return c;
}

for (const file of ['SimuladorOT.jsx', 'SimuladorOT_RTVE.jsx']) {
  test(`${file}: Gala 0 feedback appears between the call and the decision`, () => {
    const c = setup(file, false);
    c.summaries[0].performances = Object.fromEntries(c.contestants.map(p => [p.id, { score: 8, judge: 'Ana', critique: 'Buena actuación.' }]));
    c.g0_revealNext();
    assert.equal(c.gstate.g0Reveal.phase, 'present');
    c.g0_revealNext();
    assert.equal(c.gstate.g0Reveal.phase, 'comment');
    assert.equal(c.gstate.g0.entered.size, 0);
    c.g0_revealNext();
    assert.equal(c.gstate.g0Reveal.phase, 'result');
    c.g0_revealNext(true);
    assert.equal(c.stage, 'g0_profes');
    assert.equal(c.gstate.g0.doubt.size, 4);
  });
  for (const manual of [false, true]) {
    test(`${file}: Gala 0 reveals jury, teachers and public before advancing (${manual})`, () => {
      const c = setup(file, manual);
      c.g0_revealNext();
      const seen = [];
      for (let i = 0; i < 18; i++) {
        assert.equal(c.gstate.g0Reveal.phase, 'present');
        seen.push(c.gstate.g0Reveal.events[c.gstate.g0Reveal.index].id);
        c.g0_revealNext();
        assert.equal(c.gstate.g0Reveal.phase, 'result');
        assert.equal(c.gstate.g0.entered.size, 0);
        assert.equal(Object.keys(c.galaLogs).length, 0);
        c.g0_revealNext();
      }
      assert.equal(new Set(seen).size, 18);
      assert.equal(c.stage, 'g0_profes');
      assert.equal(c.gstate.g0.entered.size, 14);
      assert.equal(c.gstate.g0.doubt.size, 4);
      c.g0_profesSalvan();
      assert.equal(c.stage, 'g0_profes');
      assert.ok(c.gstate.g0Reveal.pending.gstate.g0.profesSaved);
      assert.equal(c.gstate.g0.entered.size, 14);
      c.g0_profesSalvan();
      assert.equal(c.stage, 'g0_publico');
      assert.equal(c.gstate.g0.doubt.size, 3);
      c.g0_publicoVota();
      assert.equal(c.stage, 'g0_publico');
      assert.equal(c.contestants.filter(p => p.status === 'eliminado').length, 0);
      const result = c.gstate.g0Reveal.pending.gstate.g0.public;
      assert.equal(result.losers.length, 2);
      c.g0_publicoVota();
      assert.equal(c.stage, 'g0_cerrar');
      assert.equal(c.gstate.g0.entered.size, 16);
      c.g0_cerrar();
      assert.equal(c.gala, 1);
      assert.equal(c.stage, 'votoPublico');
      assert.equal(c.contestants.filter(p => p.status === 'active').length, 16);
      assert.equal(c.summaries[0].gala0.salvoPublico, result.winner);
      assert.equal(c.summaries[1][1].reparto.length, 16);
    });
    test(`${file}: reveal all keeps prepared jury results (${manual})`, () => {
      const c = setup(file, manual);
      c.g0_revealNext();
      c.g0_revealNext();
      const pending = c.gstate.g0Reveal.pending;
      c.g0_revealNext(true);
      assert.equal(c.stage, 'g0_profes');
      assert.equal(c.gstate, pending.gstate);
      assert.equal(c.galaLogs, pending.galaLogs);
    });
  }
  test(`${file}: cancelled manual choices do not advance reveals`, () => {
    const c = setup(file, true);
    const picker = c.pickManually;
    c.pickManually = () => null;
    c.g0_revealNext();
    assert.equal(c.stage, 'g0_eval');
    assert.equal(c.gstate.g0Reveal, undefined);
    c.pickManually = picker;
    c.g0_revealNext(true);
    c.pickManually = () => null;
    c.g0_profesSalvan();
    assert.equal(c.stage, 'g0_profes');
    assert.equal(c.gstate.g0Reveal, undefined);
    c.pickManually = picker;
    c.g0_profesSalvan();
    c.g0_profesSalvan();
    c.pickManually = () => null;
    c.g0_publicoVota();
    assert.equal(c.stage, 'g0_publico');
    assert.equal(c.gstate.g0Reveal, undefined);
  });
}
