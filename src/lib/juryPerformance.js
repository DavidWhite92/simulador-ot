// Only close performances can swap places. Skill breaks close calls, not a clear gap.
export function selectPerformanceNominees(ids, performances, contestants, count = 4, random = Math.random) {
  return ids.map(id => {
    const stats = contestants.find(c => c.id === id)?.stats || {};
    const values = Object.values(stats).filter(Number.isFinite);
    const skill = values.length ? values.reduce((a,b) => a+b,0) / values.length : 7.5;
    return { id, rating: (performances[id]?.score ?? 6) + (skill - 7.5) * 0.02 + (random() - 0.5) * 0.6 };
  }).sort((a,b) => a.rating - b.rating).slice(0,count).map(row => row.id);
}

export function mixedJuryOrder(ids, nominees, random = Math.random) {
  const order = [...new Set(ids)];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const nominated = new Set(nominees);
  const lastNominee = order.find(id => nominated.has(id));
  const lastSaved = order.find(id => !nominated.has(id));
  if (lastNominee === undefined || lastSaved === undefined) return order;
  const tail = random() < 0.5 ? [lastNominee, lastSaved] : [lastSaved, lastNominee];
  return [...order.filter(id => id !== lastNominee && id !== lastSaved), ...tail];
}

export function manualJuryOptions(remaining, needed) {
  // Keep both outcomes available for the final pair, without changing earlier choices.
  const canSave = remaining > 2 ? remaining - needed > 1 : remaining > needed;
  const canNominate = remaining > 2 ? needed > 1 : needed > 0;
  const choices = [...(canSave ? ['salvado'] : []), ...(canNominate ? ['nominado'] : [])];
  return choices.length ? choices : needed > 0 ? ['nominado'] : ['salvado'];
}
