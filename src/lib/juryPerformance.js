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

export function reconcileJuryPlan(state, contestants, performances = {}, random = Math.random) {
  const evaluated = new Set((state.evalResults || []).map(row => row.id));
  const nominees = [...new Set(state.nominados || [])];
  const pending = contestants.filter(c => c.status === 'active' && c.id !== state.favoritoId
    && !evaluated.has(c.id) && !nominees.includes(c.id) && !state.salvados?.has(c.id)).map(c => c.id);
  const needed = Math.max(0, 4 - nominees.length);
  const oldPlan = state.performanceNominees;
  const valid = oldPlan && oldPlan.filter(id => pending.includes(id)).length === needed
    && nominees.every(id => oldPlan.includes(id))
    && !(state.evalResults || []).some(row => (row.result === 'nominado') !== oldPlan.includes(row.id));
  if (valid && state.juryOrderReady && !state.juryManualOverride) return state;

  let selected = selectPerformanceNominees(pending, performances, contestants, needed, random);
  const current = pending.includes(state.currentEvaluadoId) ? state.currentEvaluadoId : null;
  // An already announced contestant stays on screen. Reserve both outcomes for
  // the final pair even when manual mode is switched off halfway through a card.
  if (current && pending.length > 2) {
    const allowed = manualJuryOptions(pending.length, needed);
    const decision = selected.includes(current) ? 'nominado' : 'salvado';
    if (!allowed.includes(decision)) {
      const nominate = allowed.includes('nominado');
      selected = [...(nominate ? [current] : []), ...selectPerformanceNominees(
        pending.filter(id => id !== current), performances, contestants, needed - (nominate ? 1 : 0), random)];
    }
  }
  const performanceNominees = [...nominees, ...selected];
  const rest = mixedJuryOrder(pending.filter(id => id !== current), performanceNominees, random);
  return { ...state, performanceNominees, evaluacionOrden: current ? [current, ...rest] : rest,
    juryOrderReady: true, juryManualOverride: false, finalTwoPlan: undefined };
}
