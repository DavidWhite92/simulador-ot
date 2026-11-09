export function captureScoreResult(action, initial, gala) {
  let state = { ...initial };
  const setters = {};
  for (const key of ["gstate", "contestants", "summaries", "galaLogs", "stage"]) {
    setters[`set${key[0].toUpperCase()}${key.slice(1)}`] = update => {
      state = { ...state, [key]: typeof update === "function" ? update(state[key]) : update };
    };
  }
  setters.pushLog = (html, target = gala) => setters.setGalaLogs(logs => ({ ...logs, [target]: [...(logs[target] || []), html] }));
  action({ ...initial, ...setters });
  return state;
}

// Keep manual/preselected finalists consistent with the numerical ranking.
export function alignFinalistScores(scores, finalists) {
  const total = id => scores[id].reduce((a, b) => a + b, 0);
  const sorted = Object.keys(scores).sort((a, b) => total(b) - total(a));
  const vectors = sorted.map(id => scores[id]);
  const target = [...sorted.filter(id => finalists.includes(id)), ...sorted.filter(id => !finalists.includes(id))];
  target.forEach((id, i) => { scores[id] = vectors[i]; });
}

export function scoreEvents(ids, scores) {
  return [0, 1, 2, 3].flatMap(judge => ids.map(id => ({ id, judge, score: scores[id][judge] })));
}

export function liveScoreRanking(reveal) {
  const totals = Object.fromEntries(reveal.ids.map(id => [id, 0]));
  reveal.events.slice(0, reveal.shown).forEach(event => { totals[event.id] += event.score; });
  const tieOrder = reveal.shown === reveal.events.length
    ? [...reveal.finalists, ...reveal.ids.filter(id => !reveal.finalists.includes(id))] : reveal.ids;
  return reveal.ids.map(id => ({ id, total: totals[id] }))
    .sort((a, b) => b.total - a.total || tieOrder.indexOf(a.id) - tieOrder.indexOf(b.id));
}
