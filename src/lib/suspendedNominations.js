export function suspendedNominationLabel(id, summary, contestants, publicRank = []) {
  const person = contestants.find(c => c.id === id);
  const suffix = person?.gender === 'f' ? 'a' : person?.gender === 'm' ? 'o' : 'e';
  const percentage = value => Number.isFinite(value) ? ` (${value.toFixed(2)}%)` : '';
  if (id === summary.favoritoId) {
    const pct = summary.favoritePct ?? publicRank.find(r => r.id === id)?.pct ?? summary.top3Pct?.[0];
    return `Favorit${suffix} del Público${percentage(pct)}`;
  }
  const duel = summary.duel;
  if (duel && [duel.a, duel.b].includes(id)) {
    const pct = id === duel.a ? duel.pctA : duel.pctB;
    if (id !== duel.winner) return `Expulsad${suffix} por el Público${percentage(pct)}`;
    return `Salvad${suffix} por el Público${percentage(pct)} > Salvad${suffix} por el Jurado > Nominaciones Suspendidas`;
  }
  return `Salvad${suffix} por el Jurado > Nominaciones Suspendidas`;
}
