import { updatePairs, relationshipOf, eventRelationships, rehearsalRelationships, performanceRelationships } from '../src/lib/relationships.js';
import { createChatEvents } from '../src/lib/chatEvents.js';
import { selectPerformanceNominees } from '../src/lib/juryPerformance.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { audiencePercentages, createAcademyEvents, createPerformances, applyPopularity, popularityOf, performanceNominationModifier, favoriteRanking, sortByPopularity } from '../src/lib/academy.js';

function rng(seed = 5) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
const people = () => Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, name: `Concursante ${i}`, status: 'active', popularity: 50, stats: { afinacion: 8, baile: 8, presencia: 8, emocion: 8 } }));
const reparto = [{ song: 'Tema trío', members: ['c0','c1','c2'] }, { song: 'Tema dúo', members: ['c3','c4'] }, ...['c5','c6','c7'].map(id => ({ song: 'Solo', members: [id] }))];

test('large popularity differences guarantee the leader and audience votes sum to 100', () => {
  const random = rng(222), contestants = [{ id: 'a', popularity: 70 }, { id: 'b', popularity: 30 }];
  let wins = 0;
  for (let i=0; i<5000; i++) {
    const votes = audiencePercentages(['a','b'], contestants, random);
    assert.equal(Math.round(votes.reduce((a,b) => a+b, 0) * 100), 10000);
    assert.notEqual(votes[0], votes[1]);
    if (votes[0] > votes[1]) wins++;
  }
  assert.equal(wins, 5000);
  for (const n of [1,3,5,18]) {
    const ids = Array.from({ length: n }, (_, i) => i);
    const votes = audiencePercentages(ids, [], random);
    assert.equal(votes.length, n);
    assert.equal(Math.round(votes.reduce((a,b) => a+b, 0) * 100), 10000);
  }
});

test('popularity starts at 50, clamps at limits, and does not mutate prior saves', () => {
  assert.equal(popularityOf({}), 50);
  const initial = [{ id: 'a', popularity: 99 }, { id: 'b', popularity: 1 }, { id: 'c' }];
  assert.deepEqual(applyPopularity(initial, { a: 7, b: -7, c: 3 }).map(popularityOf), [100,0,53]);
  assert.equal(initial[0].popularity, 99);
});

test('Academia covers every song with real partners and both positive and negative outcomes', () => {
  const contestants = [...people(), { id: 'gone', name: 'Gone', status: 'eliminado' }];
  const signs = new Set(), groups = new Set(), kinds = new Set();
  for (let seed=1; seed<=120; seed++) {
    const events = createAcademyEvents(contestants, reparto, [], rng(seed));
    assert.ok(events.length >= 5 + reparto.length*2 && events.length <= 10 + reparto.length*2);
    const paired = new Set();
    for (const event of events) {
      signs.add(Math.sign(event.delta)); kinds.add(event.kind);
      assert.ok(!event.ids.includes('gone'));
      if (event.kind === 'rehearsal') {
        assert.ok(reparto.some(row => JSON.stringify(row.members) === JSON.stringify(event.ids)));
        groups.add(event.ids.length);
      }
      if (event.pair) for (const id of event.pair) { assert.ok(!paired.has(id)); paired.add(id); }
    }
  }
  assert.equal(signs.size, 2);
  assert.deepEqual([...groups].sort(), [1,2,3]);
  assert.equal(kinds.size, 5);
});

test('performances use song demands, individual skills, judges and group feedback', () => {
  const excellent = people().map(c => ({ ...c, stats: Object.fromEntries(['afinacion','baile','presencia','emocion'].map(k => [k,15])) }));
  const poor = excellent.map(c => ({ ...c, stats: Object.fromEntries(Object.keys(c.stats).map(k => [k,0])) }));
  const meta = { exact: Object.fromEntries(reparto.map(r => [r.song, { afinacion: 8, baile: 8, presencia: 8, emocion: 8 }])) };
  const judges = ['Ana','Luis','Eva','Mario'];
  const good = createPerformances(excellent, reparto, meta, judges, () => 0.5);
  const bad = createPerformances(poor, reparto, meta, judges, () => 0.5);
  assert.ok(good[0].group.includes('conectado') || good[0].group.includes('gran momento'));
  assert.ok(bad[0].group.includes('coordinación') || bad[0].group.includes('voces'));
  assert.equal(good[2].group, '');
  assert.equal(good[0].members[0].quality, 'muy buena');
  assert.equal(bad[0].members[0].quality, 'mala');
  assert.equal(good[0].members[0].judge, 'Ana');
  assert.ok(good[0].members[0].critique.includes('Tema trío'));
  assert.ok(performanceNominationModifier(good[0].members[0]) < 0);
  assert.ok(performanceNominationModifier(bad[0].members[0]) > 0);
  assert.equal(good[0].members[0].delta, 3);
  assert.equal(bad[0].members[0].delta, -2);
  const harder = { exact: { 'Tema trío': { afinacion: 15, baile: 15, presencia: 15, emocion: 15 } } };
  assert.ok(createPerformances(excellent, reparto, harder, judges, () => 0.5)[0].members[0].score < good[0].members[0].score);
});

test('close duels permit upsets, while an enormous lead gives a dominant percentage', () => {
  const random = rng(317);
  let upsets = 0;
  for (let i = 0; i < 3000; i++) {
    const close = audiencePercentages(['a','b'], [{id:'a',popularity:51},{id:'b',popularity:50}], random);
    if (close[1] > close[0]) upsets++;
    const landslide = audiencePercentages(['a','b'], [{id:'a',popularity:95},{id:'b',popularity:5}], random);
    assert.ok(landslide[0] > 99);
  }
  assert.ok(upsets > 500 && upsets < 1500);
});

test('favorites and table sort by popularity without mutating contestant order', () => {
  const contestants = [{id:'a',name:'A',popularity:30},{id:'b',name:'B',popularity:90},{id:'c',name:'C',popularity:60},{id:'d',name:'D',popularity:80}];
  assert.deepEqual(favoriteRanking(contestants).slice(0,3).map(c => c.id), ['b','d','c']);
  assert.deepEqual(sortByPopularity(contestants).map(c => c.id), ['b','d','c','a']);
  assert.equal(contestants[0].id, 'a');
});

test('performances have seven levels, third-person narration and consistent special incidents', () => {
  const qualities = new Set(), incidents = new Set(), comments = new Set(), deltas = new Set();
  const random = rng(902);
  for (let i = 0; i < 1000; i++) {
    const contestants = people().map(c => ({...c, stats: Object.fromEntries(Object.keys(c.stats).map(k => [k, random()*15]))}));
    const acts = createPerformances(contestants, reparto, {}, ['Ana','Luis','Eva','Mario'], random);
    for (const act of acts) {
      assert.ok(!/habéis|vuestro|vosotros/.test(act.group));
      for (const m of act.members) {
        qualities.add(m.quality); deltas.add(m.delta); comments.add(m.critique);
        assert.ok(m.detail.startsWith(contestants.find(c => c.id === m.id).name));
        assert.ok(!/\b(?:has|habéis|tu|tú)\b/i.test(m.detail));
        if (m.incident) incidents.add(m.incident);
        if (m.incident === 'letra') {
          assert.ok(m.detail.includes('olvidado'));
          assert.ok(m.critique.includes('olvido'));
        }
        if (m.incident === 'gallo') {
          assert.ok(m.detail.includes('gallo enorme'));
          assert.ok(m.critique.includes('gallo'));
        }
      }
    }
  }
  assert.equal(qualities.size, 7);
  assert.equal(incidents.size, 4);
  assert.equal(deltas.size, 7);
  assert.ok(comments.size > 500);
});

function weekHarness() {
  let stored;
  const source = readFileSync(new URL('../src/lib/useAcademySeason.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
  const ctx = vm.createContext({
    updatePairs, eventRelationships, rehearsalRelationships, performanceRelationships,
    useState: init => { stored ??= init(); return [stored, update => { stored = typeof update === 'function' ? update(stored) : update; }]; },
    createChatEvents: (people, summary, random, allow, gala) => createChatEvents(people, summary, rng(53), allow, gala), applyPopularity, createAcademyEvents: (...args) => createAcademyEvents(...args, rng(8)), createPerformances: (...args) => createPerformances(...args, rng(20)), popularityOf,
  });
  vm.runInContext(source, ctx);
  const args = { contestants: people(), summaries: { 1: { 1: { reparto } } }, gala: 1, songsMeta: {} };
  args.setContestants = update => { args.contestants = update(args.contestants); };
  args.setSummaries = update => { args.summaries = update(args.summaries); };
  const render = () => ctx.useAcademySeason(args);
  render().setAcademy({ judges: ['A','B','C','D'], weeks: {}, pairs: [] });
  return { args, render };
}

test('week lifecycle survives save/reload without repeating popularity changes and gates each new gala', () => {
  const { args, render } = weekHarness();
  assert.equal(render().blocked, true);
  assert.equal(render().week, undefined);
  render().next(); // Reparto -> events
  const original = [...args.contestants];
  render().next(); // First event
  const first = render().week.events[0];
  for (const c of args.contestants) assert.equal(c.popularity, 50 + (first.ids.includes(c.id) ? first.delta : 0));
  render().setAcademy(JSON.parse(JSON.stringify(render().academy)));
  assert.equal(render().week.shown, 1);
  while (render().week.phase === 'events') render().next();
  const beforePerformance = args.contestants;
  render().next();
  const result = render().week.performances[0];
  assert.equal(args.summaries[1].performances.c0.judge, 'A');
  assert.equal(args.contestants[0].popularity, Math.max(0,Math.min(100,beforePerformance[0].popularity + result.members[0].delta)));
  render().setAcademy(JSON.parse(JSON.stringify(render().academy)));
  assert.equal(render().week.performed, 1);
  for (let i=0; i<10 && render().blocked; i++) render().next();
  assert.equal(render().blocked, false);
  assert.equal(Object.keys(args.summaries[1].popularity).length, 8);
  assert.equal(args.summaries[1].popularity.c0, args.contestants[0].popularity);
  assert.equal(original[0].popularity, 50);
  args.gala = 2;
  args.summaries[2] = { 2: { reparto } };
  assert.equal(render().blocked, true);
  assert.equal(render().week, undefined);
  render().next();
  assert.ok(render().academy.weeks[1].done);
  assert.equal(render().academy.judges[0], 'A');
});

test('popularity table colours reflect favourite, saves, nominations and elimination precedence', () => {
  const source = readFileSync(new URL('../src/lib/popularityStyle.js', import.meta.url), 'utf8').split('export default')[0].replaceAll('export ', '');
  const ctx = vm.createContext({}); vm.runInContext(source, ctx);
  const style = (s, c = { id: 'a' }) => ctx.popularityCellStyle(c,s,2).background;
  assert.equal(style({ favoritoId: 'a' }), 'DodgerBlue');
  assert.equal(style({ profesorSalvoId: 'a' }), 'yellowgreen');
  assert.equal(style({ salvadoCompanerosId: 'a' }), 'khaki');
  assert.equal(style({ finalNominees: ['a'] }), 'orange');
  assert.equal(style({ top3Ids: ['a'] }), '#AFEEEE');
  assert.equal(ctx.popularityMarker({id:'a'}, {top3Ids:['a'],profesorSalvoId:'a'}), 'º');
  assert.equal(ctx.popularityMarker({id:'a'}, {top3Ids:['a'],finalNominees:['a']}), 'º');
  assert.equal(ctx.popularityMarker({id:'a'}, {top3Ids:['a']}), '');
  assert.equal(style({ favoritoId: 'a' }, { id: 'a', history: [{ gala: 2, evento: 'Eliminado (duelo)' }] }), 'red');
});

test('jury nominations follow comparative performance, with variation only between close results', () => {
  const contestants = people();
  const performances = Object.fromEntries(contestants.map((c,i) => [c.id,{score:i<4 ? 2+i*0.3 : 7.5+i*0.2}]));
  for (let seed=1; seed<=100; seed++) {
    assert.deepEqual(selectPerformanceNominees(contestants.map(c => c.id),performances,contestants,4,rng(seed)).sort(), ['c0','c1','c2','c3']);
  }
  const tied = Object.fromEntries(contestants.map(c => [c.id,{score:8}]));
  const outcomes = new Set(Array.from({length:50},(_,i) => selectPerformanceNominees(contestants.map(c => c.id),tied,contestants,4,rng(i)).sort().join(',')));
  assert.ok(outcomes.size > 5);
});

test('Gala 0 has no Academy events, skipping uses the same performances exactly once', () => {
  const normal = weekHarness(), skipped = weekHarness();
  for (const h of [normal, skipped]) {
    h.args.gala = 0;
    h.args.summaries = {0:{0:{reparto}}};
    h.render().next();
    assert.equal(h.render().week.phase, 'performances');
    assert.equal(h.render().week.events.length, 0);
    h.render().next();
  }
  skipped.render().skipPerformances();
  while (normal.render().blocked) normal.render().next();
  assert.equal(JSON.stringify(skipped.args.contestants), JSON.stringify(normal.args.contestants));
  assert.equal(JSON.stringify(skipped.args.summaries), JSON.stringify(normal.args.summaries));
  const before = JSON.stringify(skipped.args.contestants);
  skipped.render().skipPerformances();
  assert.equal(JSON.stringify(skipped.args.contestants), before);
});

test('El Chat is limited to survivors, includes nomination reactions and has a smaller effect', () => {
  const contestants = [...people(), {id:'out',name:'Eliminado',status:'eliminado'}];
  const reactions = new Set(), signs = new Set();
  for (let seed=1; seed<=100; seed++) {
    const events = createChatEvents(contestants,{finalNominees:['c0','c1']},rng(seed));
    assert.ok(events.length >= 3 && events.length <= 7);
    assert.ok(['c0','c1'].includes(events[0].ids[0]));
    for (const event of events) {
      assert.ok(!event.ids.includes('out'));
      assert.ok(Math.abs(event.delta) <= 2);
      reactions.add(event.text); signs.add(Math.sign(event.delta));
    }
  }
  assert.ok(reactions.size > 25);
  assert.equal(signs.size,2);
});

test('El Chat blocks the next phase, persists mid-event and updates end-of-gala popularity', () => {
  const {args,render} = weekHarness();
  render().next();
  while (render().week.phase === 'events') render().next();
  render().skipPerformances();
  args.stage = 'galaCerrada';
  args.summaries[1].finalNominees = ['c0','c1'];
  assert.equal(render().blocked,true);
  assert.equal(render().chatGala,1);
  render().nextChat();
  const saved = JSON.parse(JSON.stringify(render().academy));
  const first = saved.weeks[1].chat.events[0];
  assert.equal(args.summaries[1].popularity[first.ids[0]],args.contestants.find(c=>c.id===first.ids[0]).popularity);
  render().setAcademy(saved);
  assert.equal(render().chat.shown,1);
  for (let i=0;i<8 && render().chat;i++) render().nextChat();
  assert.equal(render().blocked,false);
  assert.equal(render().week.chatDone,true);
  assert.equal(render().chat,null);
});

test('El Chat is disabled after Gala 0 and both finals, including loaded pending chats', () => {
  for (const [mode,gala] of [['telecinco',0],['telecinco',17],['rtve',0],['rtve',15]]) {
    const {args,render}=weekHarness();
    args.mode=mode; args.gala=gala; args.stage='galaCerrada';
    render().setAcademy({judges:['A','B','C','D'],pairs:[],weeks:{[gala]:{done:true,chat:{events:[],shown:0}}}});
    assert.equal(render().chat,null);
    assert.equal(render().blocked,false);
    args.gala=1;
    args.summaries[0]={gala0:{eliminados:[]}};
    if (gala===0) assert.equal(render().chat,null);
  }
});

test('weekly events never repeat a template, including microphone checks and couples', () => {
  let microphones=0;
  for (let seed=0;seed<500;seed++) {
    const events=createAcademyEvents(people(),reparto,[['c0','c1']],rng(seed));
    assert.equal(new Set(events.map(e=>e.template)).size,events.length);
    for(const event of events.filter(e=>e.kind==='mic')) {
      microphones++;
      assert.ok(event.text.includes('pase de micros'));
      assert.ok(reparto.some(row=>JSON.stringify(row.members)===JSON.stringify(event.ids)));
    }
  }
  assert.ok(microphones>100);
  const one=[people()[0]], solo=[{members:['c0'],song:'Solo'}];
  for(const value of [0,0.5,0.99]) {
    const events=createAcademyEvents(one,solo,[],()=>value);
    assert.equal(new Set(events.map(e=>e.template)).size,events.length);
  }
});

test('post-finalist chats exclude nomination reactions in both formats', () => {
  for(const [mode,gala] of [['telecinco',12],['telecinco',16],['rtve',13],['rtve',14]]) {
    const {args,render}=weekHarness();
    args.mode=mode; args.gala=gala; args.stage='galaCerrada';
    args.summaries[gala]={finalNominees:['c0','c1'],profesorSalvoId:'c2'};
    render().setAcademy({judges:['A','B','C','D'],pairs:[],weeks:{[gala]:{done:true}}});
    render().nextChat();
    assert.ok(render().chat.events.every(e=>!e.text.includes('nominad') && !e.text.includes('nominación')));
  }
});

test('skipping remaining Academy events preserves couples and all effects exactly once', () => {
  const normal=weekHarness(), skipped=weekHarness();
  for(const h of [normal,skipped]) { h.render().next(); h.render().next(); }
  skipped.render().skipEvents();
  while(normal.render().week.phase==='events') normal.render().next();
  assert.equal(JSON.stringify(normal.args.contestants),JSON.stringify(skipped.args.contestants));
  assert.equal(JSON.stringify(normal.render().academy.pairs),JSON.stringify(skipped.render().academy.pairs));
  assert.equal(JSON.stringify(normal.render().week.performances),JSON.stringify(skipped.render().week.performances));
  const before=JSON.stringify(skipped.args.contestants);
  skipped.render().skipEvents();
  assert.equal(JSON.stringify(skipped.args.contestants),before);
});

test('skipping El Chat uses pending events and persists its completion', () => {
  const normal=weekHarness(), skipped=weekHarness();
  for(const h of [normal,skipped]) {
    h.render().next(); h.render().skipEvents(); h.render().skipPerformances();
    h.args.stage='galaCerrada'; h.render().nextChat(); h.render().nextChat();
  }
  skipped.render().skipChat();
  while(normal.render().chat) normal.render().nextChat();
  assert.equal(JSON.stringify(normal.args.contestants),JSON.stringify(skipped.args.contestants));
  assert.equal(JSON.stringify(normal.args.summaries),JSON.stringify(skipped.args.summaries));
  assert.equal(skipped.render().blocked,false);
  const saved=JSON.parse(JSON.stringify(skipped.render().academy));
  skipped.render().setAcademy(saved);
  skipped.render().skipChat();
  assert.equal(skipped.render().chat,null);
});

test('disabled popularity produces identical votes after reversing all popularity values', () => {
  const high=[{id:'a',popularity:100},{id:'b',popularity:0},{id:'c',popularity:70}];
  const low=high.map(c=>({...c,popularity:100-c.popularity}));
  let lowWins=0;
  for(let seed=1;seed<=200;seed++) {
    assert.deepEqual(audiencePercentages(['a','b','c'],high,rng(seed),4,false),audiencePercentages(['a','b','c'],low,rng(seed),4,false));
    const first=favoriteRanking(high,false,rng(seed));
    assert.deepEqual(first.map(c=>c.id),favoriteRanking(low,false,rng(seed)).map(c=>c.id));
    if(first[0].id==='b') lowWins++;
  }
  assert.ok(lowWins>20);
  assert.equal(favoriteRanking(high,true)[0].id,'a');
  assert.equal(favoriteRanking(low,true)[0].id,'b');
});

test('Academy orders five to ten household events before every rehearsal and every microphone check', () => {
  const cast=Array.from({length:18},(_,i)=>({id:`p${i}`,name:`Persona ${i}`,status:'active'}));
  const songs=cast.map(c=>({members:[c.id],song:`Tema ${c.id}`}));
  for(const seed of [1,10,50,500]) {
    const events=createAcademyEvents(cast,songs,[],rng(seed));
    const home=events.filter(e=>!['mic','rehearsal'].includes(e.kind));
    assert.ok(home.length>=5 && home.length<=10);
    assert.deepEqual(events.slice(0,home.length),home);
    assert.deepEqual(events.slice(home.length,home.length+18).map(e=>e.kind),Array(18).fill('rehearsal'));
    assert.deepEqual(events.slice(-18).map(e=>e.kind),Array(18).fill('mic'));
    assert.deepEqual(events.filter(e=>e.kind==='mic').map(e=>e.song),songs.map(r=>r.song));
    assert.equal(new Set(events.map(e=>e.template)).size,events.length);
    assert.ok(events.filter(e=>e.kind==='mic').every(e=>e.text.includes('ensayo')));
  }
});

test('zero-vote sympathy appears only in galas 1 to 5 for contestants who actually received no votes', () => {
  const summary={finalNominees:['c0','c1'],salvadoCompanerosId:'c2',votosCompaneros:[{voterId:'c3',votedId:'c2'},{voterId:'c4',votedId:'c1'}]};
  for(const gala of [0,1,5,6,10]) {
    const events=createChatEvents(people(),summary,rng(4),true,gala);
    const support=events.filter(e=>e.kind==='compassion');
    assert.equal(support.length,gala>=1 && gala<=5 ? 1 : 0);
    if(support.length) { assert.deepEqual(support[0].ids,['c0']); assert.ok(support[0].delta>0); }
    assert.ok(events.length<=7);
  }
  assert.ok(!createChatEvents(people(),{...summary,votosCompaneros:[]},rng(4),true,2).some(e=>e.kind==='compassion'));
});

test('first Chat click reveals sympathy and saving or skipping cannot apply its bonus twice', () => {
  const {args,render}=weekHarness();
  render().next(); render().skipEvents(); render().skipPerformances();
  args.stage='galaCerrada';
  args.summaries[1].finalNominees=['c0','c1'];
  args.summaries[1].votosCompaneros=[{voterId:'c3',votedId:'c1'}];
  const before=args.contestants.find(c=>c.id==='c0').popularity;
  render().nextChat();
  assert.equal(render().chat.shown,1);
  assert.equal(render().chat.events[0].kind,'compassion');
  assert.equal(args.contestants.find(c=>c.id==='c0').popularity,Math.min(100,before+4));
  const saved=JSON.parse(JSON.stringify(render().academy));
  render().setAcademy(saved);
  render().skipChat();
  const after=JSON.stringify(args.contestants);
  render().skipChat(); assert.equal(JSON.stringify(args.contestants),after);
});

test('collective household moments include large groups and affect only their participants', () => {
  const sizes=new Set(),signs=new Set();
  const cast=[...people(),{id:'out',name:'Fuera',status:'eliminado'}];
  for(let seed=0;seed<150;seed++) {
    const events=createAcademyEvents(cast,reparto,[],rng(seed));
    const home=events.filter(e=>!['mic','rehearsal'].includes(e.kind));
    assert.ok(home.length>=5 && home.length<=10);
    for(const event of home.filter(e=>e.kind==='group')) {
      sizes.add(event.ids.length); signs.add(Math.sign(event.delta));
      assert.equal(new Set(event.ids).size,event.ids.length);
      assert.ok(!event.ids.includes('out'));
      const updated=applyPopularity(cast,Object.fromEntries(event.ids.map(id=>[id,event.delta])));
      for(const c of updated.filter(c=>c.id!=='out')) assert.equal(c.popularity,50+(event.ids.includes(c.id)?event.delta:0));
      const relations=eventRelationships({},event,cast);
      assert.equal(relationshipOf(relations,event.ids[0],event.ids[1]),event.delta>0 ? 53+Math.abs(event.delta) : 44-Math.abs(event.delta));
    }
  }
  assert.ok([...sizes].some(n=>n>=5));
  assert.equal(signs.size,2);
});

