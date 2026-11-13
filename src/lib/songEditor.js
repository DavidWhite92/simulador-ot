export const customSongs = () => { try { return JSON.parse(localStorage.getItem('ot_custom_songs') || '[]'); } catch { return []; } };
export function validateReparto(rows, group, songs, expected, nominees=[], soloOnly=false) {
  if (!rows.length || rows.some(r=>!songs.includes(r.song)) || (group && !songs.includes(group))) return 'Selecciona canciones del catálogo.';
  const titles=[...rows.map(r=>r.song),...(group?[group]:[])];
  if(new Set(titles).size!==titles.length) return 'No puedes repetir canciones en esta gala.';
  if(rows.some(r=>r.members.length!==({solo:1,duo:2,trio:3}[r.type] || 1))) return 'Completa todos los grupos.';
  if(soloOnly && rows.some(r=>r.type!=='solo')) return 'En esta gala todos cantan solos.';
  const ids=rows.flatMap(r=>r.members);
  if(ids.length!==expected.length || expected.some(id=>ids.filter(x=>x===id).length!==expected.filter(x=>x===id).length)) return 'Asigna a todos los concursantes, sin duplicarlos.';
  if(nominees.some((id,i)=>rows[i]?.members.length!==1 || !rows.slice(0,nominees.length).some(r=>r.members[0]===id))) return 'Los nominados deben cantar solos al principio.';
  return '';
}
