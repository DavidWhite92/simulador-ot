export const resolveRepechage = (option, random=Math.random) => option === 'on' || (option === 'random' && random()<0.5);
export const displayGala = (gala, enabled=true) => !enabled && gala>=12 ? gala-2 : gala;
export const nextGala = (gala, enabled=true) => !enabled && gala===9 ? 12 : gala+1;
export const visibleGalas = (last, enabled=true) => Array.from({length:last+1},(_,i)=>i).filter(g=>enabled || (g!==10 && g!==11));
export const galaLog = (text, enabled=true) => enabled ? text : String(text).replace(/(Gala\s+|GALA\s+|\bG)(1[2-7])\b/g,(_,prefix,n)=>prefix+displayGala(Number(n),false));
export const lastElimination = person => Math.max(0,...(person.history || []).filter(h=>/^Eliminado/.test(h.evento)).map(h=>h.gala));

// Random outcomes must not be disclosed by the number of future table columns.
export const repechageColumnsVisible = (option, enabled, galaEight) => Boolean(enabled && (option !== 'random' || galaEight?.repechageAnnounced || galaEight?.falseNominees || galaEight?.repechage));
