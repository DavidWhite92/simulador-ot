import {prepareFinalistDuel} from '../src/lib/finalistDuels.js';
import {applyPopularity} from '../src/lib/academy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createPublicReveal, assignPublicPercentage } from '../src/lib/publicReveal.js';

function harness(tc, manual, duel = false) {
  const source = readFileSync(new URL(`../src/${tc ? 'SimuladorOT' : 'SimuladorOT_RTVE'}.jsx`, import.meta.url), 'utf8');
  const names = ['selectPublicIdentity', 'advancePublicReveal', ...(tc
    ? ['g12_setup', 'g12_duel', 'g15_setup', 'g15_revealThird', 'g15_revealWinner']
    : ['g13_setupFase1', 'g13_setupFase2', 'g13_reveal5th', 'g13_reveal4th', 'g13_reveal3rd', 'g13_revealWinner'])];
  const count = tc ? duel ? 6 : 3 : 5;
  const gala = tc ? duel ? 14 : 17 : 15;
  const contestants = Array.from({ length: count }, (_, i) => ({ id: `c${i}`, name: `Name ${i}`, status: 'finalista', gender: 'm', history: [] }));
  const context = vm.createContext({ prepareFinalistDuel,applyPopularity,songs:['Tema de prueba'],songsMeta:{},academy:{judges:[]}, popularityEnabled: true,
    Set, manual, gala, contestants, stage: 'initial', gstate: {},
    summaries: { [gala]: { [gala]: { reparto: contestants.map(c => ({ members: [c.id], valor: '' })) } } },
    createPublicReveal, assignPublicPercentage, nameOf: id => id, fmtPct: p => `${p.toFixed(2)}%`,
    audiencePercentages: ids => ids.length === 2 ? [67, 33] : ids.map((id, i) => (ids.length - i) * 100 / (ids.length * (ids.length + 1) / 2)),
    randomDuelPercents: () => ({ high: 67, low: 33 }), shuffle: ids => [...ids].reverse(),
    rellenarValoracionesReparto: (g, s) => s,
    pushLog() {}, setViewGala() {}, pickManually: () => { throw new Error('Manual choices must be made before reveal'); },
    stripPercentsRepartoG13() {},
  });
  for (const [setter, key] of [['setGstate','gstate'], ['setContestants','contestants'], ['setSummaries','summaries'], ['setStage','stage']]) {
    context[setter] = update => { context[key] = typeof update === 'function' ? update(context[key]) : update; };
  }
  const snippets = names.map(name => {
    const match = new RegExp(`^ {0,4}function ${name}\\(`, 'm').exec(source);
    const start = match.index;
    const next = source.slice(start + 20).search(/^ {0,4}(?:function \w+\(|return \()/m);
    return source.slice(start, start + 20 + next);
  });
  vm.runInContext(`Math.random = () => 0.5; ${snippets.join('\n')}`, context);
  return context;
}

for (const tc of [true, false]) {
  for (const manual of [false, true]) {
    test(`${tc ? 'Telecinco' : 'TVE'} final: ordered reveal and coherent percentages (${manual})`, () => {
      const c = harness(tc, manual);
      if (tc) c.g15_setup(); else c.g13_setupFase1();
      let reveals = [];
      let phaseTwoSeen = tc;
      for (let step = 0; step < 20 && c.stage === 'publicReveal'; step++) {
        const r = c.gstate.publicReveal;
        if (r.phase === 2) {
          phaseTwoSeen = true;
          assert.equal(r.entries.length, 3);
        }
        if (r.screen === 'announce') {
          const target = r.targets[r.cursor];
          assert.ok(!r.visible.includes(target));
          const chosen = manual ? r.entries.filter((_, i) => !r.visible.includes(i)).at(-1).id : r.entries[target].id;
          if (manual) c.selectPublicIdentity(chosen);
          const pct = r.entries[target].pct;
          c.advancePublicReveal();
          const next = c.gstate.publicReveal;
          assert.equal(next.entries[target].id, chosen);
          assert.equal(next.entries[target].pct, pct);
          assert.ok(next.visible.includes(target));
          reveals.push(target + 1);
          if (target === 0) assert.ok(next.visible.includes(1));
        } else c.advancePublicReveal();
      }
      assert.ok(phaseTwoSeen);
      assert.deepEqual(reveals, tc ? [3, 1] : [5, 4, 3, 1]);
      assert.equal(c.stage, 'galaCerrada');
      assert.equal(c.contestants.filter(p => p.status === 'ganador').length, 1);
      if (tc) {
        const result = c.summaries[17].g15;
        const sorted = [...result.tabla].sort((a, b) => b.pct - a.pct);
        assert.equal(result.winner, sorted[0].id);
        assert.equal(result.third, sorted[2].id);
      } else {
        const result = c.summaries[15];
        assert.equal(new Set([result.fifth.id, result.fourth.id, result.third.id, result.second.id, result.winner.id]).size, 5);
        assert.ok(result.winner.pct >= result.second.pct && result.second.pct >= result.third.pct);
      }
    });
  }
}
for (const manual of [false, true]) {
  test(`Telecinco duels: reveal every percentage once, then winner and duel percentage (${manual})`, () => {
    const c = harness(true, manual, true);
    c.g12_setup();
    let chosenWinner;
    for (let step = 0; step < 20 && c.stage === 'publicReveal'; step++) {
      const r = c.gstate.publicReveal;
      if (manual && r.screen === 'announce') c.selectPublicIdentity(r.entries.filter((_, i) => !r.visible.includes(i)).at(-1).id);
      if (r.screen === 'duel') {
        assert.equal(r.visible.length, 6);
        assert.equal(new Set(r.entries.map(row => row.id)).size, 6);
        if (manual) { chosenWinner = r.entries.at(-1).id; c.selectPublicIdentity(chosenWinner); }
      }
      c.advancePublicReveal();
    }
    assert.equal(c.stage, 'galaCerrada');
    assert.equal(c.summaries[14].duelPerformances.length,2);
    assert.equal(Object.keys(c.summaries[14].popularity).length,2);
    const result = c.summaries[14].g12_14;
    assert.equal(result.duel.pctWin, 67);
    assert.equal(c.contestants.filter(p => p.status === 'eliminado').length, 1);
    if (manual) assert.equal(result.duel.winner, chosenWinner);
  });
}

test('manual assignment rejects already revealed names and does not mutate previous ranking', () => {
  const before = createPublicReveal([{ id: 'a', pct: 60 }, { id: 'b', pct: 40 }], 'duel');
  const next = assignPublicPercentage(before, 'b');
  assert.equal(before.entries[0].id, 'a');
  assert.equal(next.entries[0].id, 'b');
  assert.equal(assignPublicPercentage({ ...next, cursor: 1 }, 'b'), null);
});
