// Run the existing jury rules against a fresh snapshot after each step.
// Bulk reveal stops at the teachers' save, or when a manual choice is cancelled.
export function runJuryReveal(step, initial, gala, revealAll = false) {
  let state = { ...initial };
  const set = key => update => {
    state = { ...state, [key]: typeof update === "function" ? update(state[key]) : update };
  };
  const setters = {
    setGstate: set("gstate"), setGalaLogs: set("galaLogs"),
    setSummaries: set("summaries"), setStage: set("stage"),
    pushLog: (html, targetGala = gala) => set("galaLogs")(logs => ({
      ...logs, [targetGala]: [...(logs[targetGala] || []), html],
    })),
  };
  for (let i = 0; i < 100 && state.stage === "juradoEvaluando"; i++) {
    const before = state;
    step({ ...state, ...setters });
    if (state === before) break; // A cancelled manual prompt must not reopen.
    if (revealAll) continue;
    const jury = state.gstate;
    const justInitialized = !before.gstate.evaluacionOrden?.length && !before.gstate.evalResults?.length && !jury.currentEvaluadoId;
    // Leave the final verdict and crossing visible until the next explicit click.
    if (!justInitialized) break;
  }
  return state;
}

export function blindDuelPercentages(pctA, pctB, random = Math.random) {
  return random() < 0.5 ? [pctA, pctB] : [pctB, pctA];
}
