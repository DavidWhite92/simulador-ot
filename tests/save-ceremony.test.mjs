import { choosePeerSave } from '../src/lib/relationships.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function harness(file, manual = false) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const names = ['startCeremony', 'finishCeremony', 'continueCeremony', 'advanceCeremony', 'revealAllPeerVotes', 'iniciarDueloCiego', 'dueloRevelar', 'profesoresSalvanUno', 'companerosVotan'];
  const snippets = names.map(name => {
    const start = source.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, name);
    const rest = source.slice(start + 20);
    const next = rest.search(/^ {0,4}function \w+\(/m);
    return source.slice(start, start + 20 + next);
  });
  const logs = [];
  const people = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, name: `Name ${i}`, status: 'active', gender: 'm', history: [] }));
  const context = vm.createContext({ choosePeerSave, relationshipsEnabled: false, academy: {relationships:{},pairs:[]}, popularityEnabled: true,
    Set, manual, gala: 2, stage: 'profesSalvan', contestants: people, carryNominees: ['c6', 'c7'],
    gstate: { nominados: ['c1', 'c2', 'c3', 'c4'], salvados: new Set(['c0', 'c5', 'c6']), favoritoId: 'c0' },
    summaries: { 2: { juradoNominados: ['c1', 'c2', 'c3', 'c4'] } },
    nameOf: id => id, fmtPct: p => `${p.toFixed(2)}%`, pushLog: html => logs.push(html),
    setViewGala() {}, pickRandom: ids => [ids[0]], pickProfSave: ids => ids[0],
    countNomsThrough: () => 0, rellenarValoracionesReparto: (g, summaries) => summaries,
    audiencePercentages: () => [65, 35], randomDuelPercents: () => ({ high: 65, low: 35 }), nextStageFor: () => 'votoPublico',
    pickManually: ids => ids[0], gala10Profes() {}, gala10Compas() {}, g11_revelar() {}, g11_profesoresSalvan() {}, g12_duel() {},
    console: { log() {}, group() {}, table() {}, groupEnd() {} },
  });
  for (const [setter, key] of [['setGstate','gstate'], ['setSummaries','summaries'], ['setContestants','contestants'], ['setCarryNominees','carryNominees'], ['setStage','stage']]) {
    context[setter] = update => { context[key] = typeof update === 'function' ? update(context[key]) : update; };
  }
  vm.runInContext(`Math.random = () => 0.1; ${snippets.join('\n')}`, context);
  return { context, logs };
}

for (const file of ['SimuladorOT.jsx', 'SimuladorOT_RTVE.jsx']) {
  test(`${file}: animated and bulk peer votes use the same relationship priorities`, () => {
    for (const bulk of [false,true]) {
      const {context:c}=harness(file);
      c.relationshipsEnabled=true;
      c.academy={relationships:{},pairs:[['c0','c3']]};
      c.gstate.nominados=['c1','c2','c3'];
      c.gstate.salvados=new Set(['c0','c5']);
      c.summaries[2][2]={reparto:[{members:['c0','c1']},{members:['c5','c2']}]};
      c.startCeremony('peers',['c1','c2','c3'],'peers',['c0','c5']);
      if(bulk) c.revealAllPeerVotes();
      else { c.advanceCeremony(); c.advanceCeremony(); c.advanceCeremony(); }
      const votes=bulk ? c.gstate.votosCompaneros : c.gstate.ceremony.votes;
      assert.equal(votes.find(v=>v.voterId==='c0').votedId,'c3');
      assert.equal(votes.find(v=>v.voterId==='c5').votedId,'c2');
    }
  });
  for (const manual of [false, true]) {
    test(`${file}: duel reveals phrase, winning percentage, then survivor (${manual})`, () => {
      const { context: c, logs } = harness(file, manual);
      c.iniciarDueloCiego();
      assert.equal(c.stage, 'ceremony');
      assert.equal(c.gstate.ceremony.phase, 'intro');
      assert.ok(!logs.join('').includes('%'));
      c.advanceCeremony();
      assert.equal(c.gstate.ceremony.phase, 'phrase');
      assert.ok(!logs.join('').includes('%'));
      c.advanceCeremony();
      assert.equal(c.gstate.ceremony.phase, 'percentage');
      assert.ok(logs.at(-1).includes('65.00%'));
      assert.equal(c.summaries[2].duel, undefined);
      c.advanceCeremony();
      assert.equal(c.gstate.ceremony.phase, 'result');
      assert.equal(c.stage, 'ceremony');
      const duel = c.summaries[2].duel;
      assert.equal(duel.winner === duel.a ? duel.pctA : duel.pctB, 65);
      assert.equal(c.contestants.filter(p => p.status === 'eliminado').length, 1);
      c.continueCeremony();
      assert.equal(c.stage, 'votoPublico');
    });
    test(`${file}: teacher and peer ceremonies preserve voting and results (${manual})`, () => {
      const { context: c } = harness(file, manual);
      c.startCeremony('teachers', c.gstate.nominados, 'teachers');
      assert.equal(c.summaries[2].profesorSalvoId, undefined);
      c.advanceCeremony();
      assert.equal(c.gstate.ceremony.phase, 'result');
      assert.equal(c.summaries[2].profesorSalvoId, 'c1');
      c.continueCeremony();
      assert.equal(c.stage, 'companerosVotan');
      c.startCeremony('peers', c.gstate.nominados, 'peers', [...c.gstate.salvados]);
      const voters = [...c.gstate.ceremony.voters];
      for (let i = 0; i < voters.length; i++) {
        if (i > 0) c.advanceCeremony();
        c.advanceCeremony();
        assert.equal(c.gstate.ceremony.votes.length, i + 1);
        assert.equal(c.gstate.ceremony.votes[i].voterId, voters[i]);
        assert.equal(c.gstate.salvadoCompanerosId, undefined);
      }
      // Reload the in-progress presentation without rerolling the votes.
      const saved = JSON.parse(JSON.stringify(c.gstate.ceremony));
      c.gstate.ceremony = saved;
      c.advanceCeremony();
      assert.equal(c.gstate.ceremony.phase, 'result');
      assert.equal(c.gstate.salvadoCompanerosId, 'c2');
      assert.equal(c.gstate.votosCompaneros.length, voters.length);
      assert.equal(c.carryNominees.length, 2);
      c.continueCeremony();
      assert.equal(c.stage, 'galaCerrada');
    });
  }
  test(`${file}: cancelling a manual vote does not increment the tally`, () => {
    const { context: c } = harness(file, true);
    c.startCeremony('peers', ['c1', 'c2', 'c3'], 'peers', ['c0']);
    c.pickManually = () => null;
    c.advanceCeremony();
    assert.equal(c.gstate.ceremony.votes.length, 0);
    assert.equal(c.gstate.ceremony.phase, 'intro');
  });
}

for (const file of ['SimuladorOT.jsx', 'SimuladorOT_RTVE.jsx']) {
  for (const manual of [false, true]) {
    test(`${file}: last finalist duel keeps the same staged reveal (${manual})`, () => {
      const { context: c, logs } = harness(file, manual);
      const tc = file === 'SimuladorOT.jsx';
      const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
      const names = tc ? ['g11_iniciarCiegos', 'g11_revelar'] : ['g12_setup', 'g12_duel'];
      for (const name of names) {
        const start = source.indexOf(`    function ${name}(`);
        const rest = source.slice(start + 20);
        const end = rest.search(/^ {0,4}function \w+\(/m);
        vm.runInContext(source.slice(start, start + 20 + end), c);
      }
      c.blindDuelPercentages = (a, b) => [a, b];
      c.gala = tc ? 13 : 14;
      c.summaries = { 13: { finalNominees: ['c6', 'c7'] } };
      c[names[0]]();
      assert.equal(c.gstate.ceremony.phase, 'intro');
      assert.ok(!logs.join('').includes('%'));
      c.advanceCeremony();
      c.advanceCeremony();
      const announced = c.gstate.ceremony.pct;
      c.advanceCeremony();
      assert.equal(c.gstate.ceremony.phase, 'result');
      assert.equal(c.stage, 'ceremony');
      const duel = tc ? c.summaries[13].g11 : c.summaries[14].duel;
      assert.equal(duel.winner === duel.a ? duel.pctA : duel.pctB, announced);
      c.continueCeremony();
      assert.equal(c.stage, 'galaCerrada');
    });
  }
}

for (const file of ['SimuladorOT.jsx', 'SimuladorOT_RTVE.jsx']) {
  test(`${file}: ties explain favorite priority and random fallback`, () => {
    for (const favorite of ['c0', null]) {
      const { context: c } = harness(file);
      c.gstate.nominados = ['c1', 'c2', 'c3'];
      c.gstate.salvados = new Set(['c0', 'c4']);
      c.gstate.favoritoId = favorite;
      c.startCeremony('peers', c.gstate.nominados, 'peers', ['c0', 'c4']);
      c.gstate.ceremony.votes = [{ voterId: 'c0', votedId: 'c1' }, { voterId: 'c4', votedId: 'c2' }];
      c.advanceCeremony();
      assert.equal(c.gstate.peerTie.ids.length, 2);
      assert.ok(c.gstate.peerTie.message.includes(favorite ? 'favorito' : 'sorteo'));
      assert.equal(c.gstate.peerTie.counts.c1, 1);
    }
  });
  test(`${file}: bulk reveal keeps earlier votes and goes directly to the summary`, () => {
    const { context: c, logs } = harness(file);
    c.gstate.nominados = ['c1', 'c2', 'c3'];
    c.gstate.salvados = new Set(['c0', 'c4']);
    c.startCeremony('peers', c.gstate.nominados, 'peers', ['c0', 'c4']);
    c.gstate.ceremony.votes = [{ voterId: 'c0', votedId: 'c2' }];
    c.revealAllPeerVotes();
    assert.equal(c.stage, 'galaCerrada');
    assert.equal(c.gstate.votosCompaneros.length, 2);
    assert.equal(c.gstate.votosCompaneros[0].votedId, 'c2');
    assert.ok(logs.some(log => log.includes('c0 → c2')));
  });
}

test('Telecinco G10: the jury-score tiebreak is explained and its extra vote is counted', () => {
  const { context: c } = harness('SimuladorOT.jsx');
  const source = readFileSync(new URL('../src/SimuladorOT.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('    function gala10Compas(');
  const end = source.indexOf('    function g11_iniciarCiegos(', start);
  vm.runInContext(source.slice(start, end), c);
  c.gala = 12;
  c.gstate.nominados = ['c1', 'c2', 'c3'];
  c.gstate.salvados = new Set(['c0', 'c4', 'c5']);
  c.contestants = c.contestants.map(p => ({ ...p, status: ['c0', 'c4', 'c5'].includes(p.id) ? 'finalista' : 'active' }));
  c.summaries = { 12: { g10: { sumas: { c0: 39, c4: 36, c5: 35 } } } };
  c.startCeremony('peers', c.gstate.nominados, 'specialPeers', ['c0', 'c4', 'c5']);
  c.gstate.ceremony.votes = [{ voterId: 'c0', votedId: 'c1' }, { voterId: 'c4', votedId: 'c2' }, { voterId: 'c5', votedId: 'c3' }];
  c.advanceCeremony();
  assert.equal(c.gstate.peerTie.ids.length, 3);
  assert.equal(c.gstate.peerTie.counts.c1, 2);
  assert.ok(c.gstate.peerTie.message.includes('mejor nota del jurado'));
  assert.equal(c.gstate.salvadoCompanerosId, 'c1');
});

for (const file of ['SimuladorOT.jsx', 'SimuladorOT_RTVE.jsx']) {
  test(`${file}: announcing the next voter does not reveal or count their vote`, () => {
    const {context:c}=harness(file,true);
    c.startCeremony('peers',['c1','c2','c3'],'peers',['c0','c4']);
    let selections=0;
    c.pickManually=()=>{ selections++; return 'c2'; };
    c.advanceCeremony();
    assert.equal(c.gstate.ceremony.phase,'board');
    assert.equal(c.gstate.ceremony.votes.length,1);
    c.advanceCeremony();
    assert.equal(c.gstate.ceremony.phase,'announceVote');
    assert.equal(c.gstate.ceremony.votes.length,1);
    assert.equal(selections,1);
    c.gstate.ceremony=JSON.parse(JSON.stringify(c.gstate.ceremony));
    c.pickManually=()=>null;
    c.advanceCeremony();
    assert.equal(c.gstate.ceremony.phase,'announceVote');
    assert.equal(c.gstate.ceremony.votes.length,1);
    c.pickManually=()=> 'c3';
    c.advanceCeremony();
    assert.equal(c.gstate.ceremony.phase,'board');
    assert.equal(c.gstate.ceremony.votes.length,2);
    assert.equal(c.gstate.ceremony.votes[1].voterId,'c4');
  });
}

for (const file of ['SimuladorOT.jsx','SimuladorOT_RTVE.jsx']) for(const manual of [false,true]) {
  test(`${file}: extra ordinary galas continue to favourites after the duel (${manual})`,()=>{
    for(const gala of [10,11]) {
      const {context:c}=harness(file,manual);
      c.gala=gala;c.summaries={[gala]:{}};
      // Reproduce the stale-closure route that previously returned to dueloPendiente.
      c.nextStageFor=()=> 'dueloPendiente';
      c.iniciarDueloCiego();c.advanceCeremony();c.advanceCeremony();c.advanceCeremony();
      assert.equal(c.gstate.ceremony.nextStage,'votoPublico');
      c.continueCeremony();assert.equal(c.stage,'votoPublico');
      assert.equal(c.carryNominees.length,0);
    }
  });
  test(`${file}: original Gala 10 without repechage reaches its normal phase (${manual})`,()=>{
    const {context:c}=harness(file,manual);
    c.gala=12;c.summaries={12:{}};
    c.iniciarDueloCiego();c.advanceCeremony();c.advanceCeremony();c.advanceCeremony();c.continueCeremony();
    assert.equal(c.stage,file==='SimuladorOT.jsx'?'gala10_jueces':'juradoEvaluando');
  });
}

for(const file of ['SimuladorOT.jsx','SimuladorOT_RTVE.jsx']) {
  test(`${file}: teachers in extended galas save the least-nominated candidate`,()=>{
    for(const gala of [9,10,11,12]) {
      const {context:c}=harness(file);
      const source=readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
      const start=source.indexOf('  function countNomsThrough('),end=source.indexOf('// === CANCIONES',start);
      vm.runInContext(source.slice(start,end),c);
      c.gala=gala;
      c.summaries={1:{juradoNominados:['c1','c2']},2:{juradoNominados:['c1','c3']},3:{juradoNominados:['c1','c2']},4:{juradoNominados:['c1','c3']},5:{juradoNominados:['c1','c4']},6:{juradoNominados:['c1','c4']},8:{falseNominees:['c2'],juradoNominados:['c2']},[gala]:{juradoNominados:['c1','c2','c3','c4']}};
      c.gstate.nominados=['c1','c2','c3','c4'];
      c.startCeremony('teachers',c.gstate.nominados,'teachers');
      c.advanceCeremony();
      assert.notEqual(c.gstate.profesorSalvoId,'c1');
      assert.equal(c.countNomsThrough('c1',c.summaries,7),6);
      assert.equal(c.countNomsThrough('c2',c.summaries,8),2);
      assert.ok(['c2','c3','c4'].includes(c.gstate.profesorSalvoId));
    }
  });
}
