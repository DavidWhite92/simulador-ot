export function catwalkGroups(ids, results, favoriteId) {
  const available = new Set(ids);
  const saved = [...new Set([favoriteId, ...results.filter(r => r.result === 'salvado').map(r => r.id)].filter(id => available.has(id)))];
  const nominated = results.filter(r => r.result === 'nominado').map(r => r.id);
  return { saved, seated: ids.filter(id => !saved.includes(id)), nominated };
}
