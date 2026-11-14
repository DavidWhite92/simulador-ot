import {createPerformances} from './academy.js';
export function previousSoloSongs(id,summaries,gala) {
  return [...new Set(Object.entries(summaries).filter(([g])=>Number(g)>0 && Number(g)<gala).flatMap(([g,s])=>(s[g]?.reparto || []).filter(row=>row.members?.length===1 && row.members[0]===id).map(row=>row.song)).filter(Boolean))];
}
export function prepareFinalistDuel(ids,contestants,summaries,gala,songsMeta,judges,songs,random=Math.random) {
  const rows=ids.map(id=>{const previous=previousSoloSongs(id,summaries,gala);const pool=previous.length?previous:songs;return {members:[id],song:pool[Math.floor(random()*pool.length)],type:'solo',reprise:previous.length>0};});
  return createPerformances(contestants,rows,songsMeta,judges,random).map((p,i)=>({...p,reprise:rows[i].reprise,members:p.members.map(m=>({...m,delta:m.delta*2}))}));
}
