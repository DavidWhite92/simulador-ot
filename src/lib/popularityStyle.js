export function popularityCellStyle(c, s, gala) {
  if (gala === 8 && s?.repechage?.selected?.includes(c.id)) return { background: c.history?.some(h=>h.gala===8 && /^Eliminado/.test(h.evento)) ? 'linear-gradient(to right, red 0%, red 50%, #fff3a6 50%, #fff3a6 100%)' : '#fff3a6', color:'#111' };
  if (s?.falseNominees?.includes(c.id)) return { background:'#65a1a5', color:'#111' };
  if (s?.repechage?.winner === c.id) return {background:'#d879d8',color:'#111'};
  if (s?.repechage?.candidates?.includes(c.id)) return { background:'tomato', color:'white' };
  if (c.history?.some(h => h.gala === gala && /eliminad|expulsad/i.test(h.evento))) return { background: 'red', color: 'white' };
  if (s?.gala0?.eliminados?.includes(c.id)) return { background: 'red', color: 'white' };
  if (s?.favoritoId === c.id) return { background: 'DodgerBlue', color: 'white' };
  if (s?.finalNominees?.includes(c.id)) return { background: 'orange', color: '#111' };
  if (s?.profesorSalvoId === c.id || s?.gala0?.salvoProfes === c.id || s?.g10?.cuarto === c.id) return { background: 'yellowgreen', color: '#111' };
  if (s?.salvadoCompanerosId === c.id || s?.g10?.quinto === c.id) return { background: 'khaki', color: '#111' };
  if (s?.gala0?.salvoPublico === c.id) return { background: 'orange', color: '#111' };
  if (s?.top3Ids?.includes(c.id)) return { background: '#AFEEEE', color: '#111' };
  return { background: 'white', color: '#111' };
}

export function popularityMarker(c, s) {
  return s?.top3Ids?.includes(c.id) && (s?.falseNominees?.includes(c.id) || s?.finalNominees?.includes(c.id) || s?.profesorSalvoId === c.id || s?.salvadoCompanerosId === c.id) ? 'º' : '';
}
