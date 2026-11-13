export const customSongs = () => { try { return JSON.parse(localStorage.getItem('ot_custom_songs') || '[]'); } catch { return []; } };
export function validateDistribution(rows,expected,nominees=[],soloOnly=false,assigned=false) {
  const capacity={solo:1,duo:2,trio:3};
  if(rows.some(r=>!capacity[r.type]) || rows.reduce((n,r)=>n+(capacity[r.type] || 0),0)!==expected.length) return `La distribución debe tener ${expected.length} plazas en total.`;
  if(soloOnly && rows.some(r=>r.type!=='solo')) return 'En esta gala todos cantan solos.';
  if(nominees.some(id=>!rows.slice(0,nominees.length).some(r=>r.type==='solo' && r.members[0]===id))) return 'Los nominados deben conservar sus solos al principio.';
  if(assigned) {
    const ids=rows.flatMap(r=>r.members);
    if(rows.some(r=>r.members.length!==capacity[r.type]) || ids.length!==expected.length || expected.some(id=>ids.filter(x=>x===id).length!==expected.filter(x=>x===id).length)) return 'Asigna a todos los concursantes y completa cada grupo antes de continuar.';
  }
  return '';
}
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
