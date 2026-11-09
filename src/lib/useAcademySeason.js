import { updatePairs, eventRelationships, rehearsalRelationships, performanceRelationships } from './relationships.js';
import { useState } from 'react';
import { applyPopularity, createAcademyEvents, createPerformances, popularityOf } from './academy.js';
import { createChatEvents } from './chatEvents.js';

export const emptyAcademy = () => ({ judges: ['', '', '', ''], weeks: {}, pairs: [], relationships: {} });
export function useAcademySeason({ contestants, setContestants, summaries, setSummaries, gala, songsMeta, stage, mode = 'telecinco' }) {
  const [academy, setAcademy] = useState(emptyAcademy);
  const week = academy.weeks[gala];
  const reparto = summaries[gala]?.[gala]?.reparto || [];
  const finalGala = mode === 'rtve' ? 15 : 17;
  const chatGala = gala > 0 && gala < finalGala && stage === 'galaCerrada' && week?.done && !week.chatDone ? gala : null;
  const chat = chatGala == null ? null : academy.weeks[chatGala]?.chat || { events: [], shown: 0 };
  const blocked = contestants.length > 0 && (!week?.done || chatGala != null);
  function recordRelationships(relationships, target = gala) {
    setAcademy(a => ({ ...a, relationships }));
    setSummaries(s => ({ ...s, [target]: { ...s[target], relationships, pairs: academy.pairs } }));
  }
  function saveWeek(next) {
    setAcademy(a => ({ ...a, weeks: { ...a.weeks, [gala]: next } }));
  }
  function next() {
    if (!week) {
      saveWeek({ phase: gala === 0 ? 'performances' : 'events', shown: 0,
        events: gala === 0 ? [] : createAcademyEvents(contestants, reparto, academy.pairs),
        performances: gala === 0 ? createPerformances(contestants, reparto, songsMeta, academy.judges) : [], performed: 0 });
      return;
    }
    if (week.phase === 'events') {
      if (week.shown < week.events.length) {
        const event = week.events[week.shown];
        recordRelationships(eventRelationships(academy.relationships, event, contestants));
        setSummaries(s=>({...s,[gala]:{...s[gala],pairs:updatePairs(academy.pairs,event)}}));
        const changes = Object.fromEntries(event.ids.map(id => [id, event.delta]));
        setContestants(list => applyPopularity(list, changes));
        setAcademy(a => ({ ...a, pairs: updatePairs(a.pairs,event),
          weeks: { ...a.weeks, [gala]: { ...week, shown: week.shown + 1 } } }));
      } else {
        recordRelationships(rehearsalRelationships(academy.relationships, reparto, week.events));
        saveWeek({ ...week, phase: 'performances', performances: createPerformances(contestants, reparto, songsMeta, academy.judges) });
      }
      return;
    }
    if (week.performed < week.performances.length) {
      const performance = week.performances[week.performed];
      recordRelationships(performanceRelationships(academy.relationships, performance));
      setContestants(list => applyPopularity(list, Object.fromEntries(performance.members.map(m => [m.id, m.delta]))));
      setSummaries(s => {
        const old = s[gala] || { gala };
        const performances = { ...old.performances };
        for (const member of performance.members) {
          const prior = performances[member.id];
          // Finals can contain more than one solo: keep a fair mean for judging.
          const attempts = (prior?.attempts || 0) + 1;
          performances[member.id] = { ...member, score: ((prior?.score || 0) * (attempts - 1) + member.score) / attempts, attempts };
        }
        return { ...s, [gala]: { ...old, performances } };
      });
      saveWeek({ ...week, performed: week.performed + 1 });
      return;
    }
    const popularity = Object.fromEntries(contestants.filter(c => ['active','finalista'].includes(c.status)).map(c => [c.id, popularityOf(c)]));
    setSummaries(s => ({ ...s, [gala]: { ...s[gala], popularity, relationships: academy.relationships || {}, pairs: academy.pairs, judges: academy.judges } }));
    saveWeek({ ...week, done: true });
  }
  function skipPerformances() {
    if (week?.phase !== 'performances' || week.done) return;
    let updated = contestants;
    const performances = { ...summaries[gala]?.performances };
    let relationships = academy.relationships || {};
    for (const performance of week.performances.slice(week.performed)) {
      relationships = performanceRelationships(relationships, performance);
      updated = applyPopularity(updated, Object.fromEntries(performance.members.map(m => [m.id,m.delta])));
      for (const member of performance.members) {
        const prior = performances[member.id];
        const attempts = (prior?.attempts || 0) + 1;
        performances[member.id] = { ...member, score: ((prior?.score || 0) * (attempts - 1) + member.score) / attempts, attempts };
      }
    }
    recordRelationships(relationships);
    setContestants(() => updated);
    const popularity = Object.fromEntries(updated.filter(c => ['active','finalista'].includes(c.status)).map(c => [c.id,popularityOf(c)]));
    setSummaries(s => ({ ...s, [gala]: { ...s[gala], performances, popularity, judges: academy.judges } }));
    saveWeek({ ...week, performed: week.performances.length, done: true });
  }
  function nextChat() {
    if (chatGala == null) return;
    const stored = academy.weeks[chatGala];
    const current = stored.chat ? stored : { ...stored, chat: { events: createChatEvents(contestants, summaries[chatGala], undefined, chatGala < (mode === 'rtve' ? 13 : 12), chatGala), shown: 0 } };
    if (current.chat.shown < current.chat.events.length) {
      const event = current.chat.events[current.chat.shown];
      recordRelationships(eventRelationships(academy.relationships, event, contestants, true), chatGala);
      const updated = applyPopularity(contestants, Object.fromEntries(event.ids.map(id => [id,event.delta])));
      setContestants(() => updated);
      setSummaries(s => ({ ...s, [chatGala]: { ...s[chatGala], popularity: {
        ...s[chatGala]?.popularity, ...Object.fromEntries(event.ids.map(id => [id,popularityOf(updated.find(c => c.id === id))]))
      } } }));
      setAcademy(a => ({ ...a, weeks: { ...a.weeks, [chatGala]: { ...current, chat: { ...current.chat, shown: current.chat.shown + 1 } } } }));
      return;
    }
    setAcademy(a => ({ ...a, weeks: { ...a.weeks, [chatGala]: { ...current, chatDone: true } } }));
  }
  function skipEvents() {
    if (week?.phase !== 'events' || week.done) return;
    let updated = contestants;
    let pairs = [...academy.pairs];
    let relationships = academy.relationships || {};
    for (const event of week.events.slice(week.shown)) {
      relationships = eventRelationships(relationships, event, contestants);
      updated = applyPopularity(updated, Object.fromEntries(event.ids.map(id => [id,event.delta])));
      pairs = updatePairs(pairs,event);
    }
    setContestants(() => updated);
    recordRelationships(rehearsalRelationships(relationships, reparto, week.events));
    setSummaries(s=>({...s,[gala]:{...s[gala],pairs}}));
    setAcademy(a => ({ ...a, pairs, weeks: { ...a.weeks, [gala]: { ...week, shown: week.events.length, phase: 'performances', performances: createPerformances(updated, reparto, songsMeta, academy.judges) } } }));
  }
  function skipChat() {
    if (chatGala == null) return;
    const current = academy.weeks[chatGala];
    const pendingChat = current.chat || { events: createChatEvents(contestants, summaries[chatGala], undefined, chatGala < (mode === 'rtve' ? 13 : 12), chatGala), shown: 0 };
    let updated = contestants;
    let relationships = academy.relationships || {};
    for (const event of pendingChat.events.slice(pendingChat.shown)) {
      relationships = eventRelationships(relationships, event, contestants, true);
      updated = applyPopularity(updated, Object.fromEntries(event.ids.map(id => [id,event.delta])));
    }
    setContestants(() => updated);
    recordRelationships(relationships, chatGala);
    const popularity = Object.fromEntries(updated.filter(c => ['active','finalista','ganador'].includes(c.status)).map(c => [c.id,popularityOf(c)]));
    setSummaries(s => ({ ...s, [chatGala]: { ...s[chatGala], popularity: { ...s[chatGala]?.popularity, ...popularity } } }));
    setAcademy(a => ({ ...a, weeks: { ...a.weeks, [chatGala]: { ...current, chatDone: true, chat: { ...pendingChat, shown: pendingChat.events.length } } } }));
  }
  return { academy, setAcademy, week, reparto, blocked, next, skipPerformances, chat, chatGala, nextChat, skipEvents, skipChat };
}
