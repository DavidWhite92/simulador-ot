// Older saves can contain a public-save prefix carried over from another gala.
export function currentGalaLabel(value, id, summary) {
  if (summary?.duel?.winner === id) return value;
  return String(value || '').split(' > ')
    .filter(part => !/^Salvad[oa e] por el p[uú]blico\s*\([^)]*%\)$/i.test(part.trim()))
    .join(' > ');
}
