export const rosterEdition = person => person.isCustom ? 'Custom' : person.edition || 'OT?';
export function randomRosterCandidates(pool, selected, excluded) {
  return pool.filter(person=>!selected.includes(String(person.id)) && !excluded.includes(rosterEdition(person)));
}
