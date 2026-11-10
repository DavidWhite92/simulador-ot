export function contestantFlags(contestant, gala, summaries, carryNominees=[]) {
  const active=contestant.status==='active';
  return {
    isFav:active && gala<=11 && summaries[gala]?.favoritoId===contestant.id,
    isNom:active && carryNominees.includes(contestant.id),
  };
}
