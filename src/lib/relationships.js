export const relationKey = (a,b) => JSON.stringify([String(a),String(b)].sort());
export const relationshipOf = (relations, a, b) => a === b ? null : relations?.[relationKey(a,b)] ?? 50;
function adjust(relations, a, b, delta) {
  if (a === b) return;
  const key=relationKey(a,b);
  relations[key]=Math.max(0,Math.min(100,(relations[key] ?? 50)+delta));
}
const alive = contestants => contestants.filter(c=>['active','finalista','ganador'].includes(c.status)).map(c=>c.id);
export function eventRelationships(relations, event, contestants, chat=false) {
  const next={...relations};
  if (event.kind === 'compassion') return next;
  const ids=event.ids || [];
  if (ids.length>1) {
    const delta=event.pair ? 12 : event.delta>0 ? 3 : -4;
    for(let i=0;i<ids.length;i++) for(let j=i+1;j<ids.length;j++) adjust(next,ids[i],ids[j],delta);
  } else if (ids.length===1 && (chat || event.kind==='solo')) {
    // Convivencia changes trust within the household; solo rehearsals do not.
    for(const other of alive(contestants)) adjust(next,ids[0],other,event.delta>0 ? 1 : -1);
  }
  return next;
}
export function rehearsalRelationships(relations, reparto, events) {
  const next={...relations}, rewarded=new Set();
  for(const row of reparto) for(let i=0;i<row.members.length;i++) for(let j=i+1;j<row.members.length;j++) {
    const a=row.members[i],b=row.members[j],key=relationKey(a,b);
    const friction=events.some(e=>e.delta<0 && e.ids.includes(a) && e.ids.includes(b));
    if(!friction && !rewarded.has(key)) { adjust(next,a,b,4); rewarded.add(key); }
  }
  return next;
}
export function performanceRelationships(relations, performance) {
  const next={...relations};
  const members=performance.members;
  if(members.length>1 && members.reduce((n,m)=>n+m.score,0)/members.length>=6) {
    for(let i=0;i<members.length;i++) for(let j=i+1;j<members.length;j++) adjust(next,members[i].id,members[j].id,2);
  }
  return next;
}
export function choosePeerSave({voterId,candidates,relations={},pairs=[],reparto=[],enabled=true}, random=Math.random) {
  const eligible=[...new Set(candidates)].filter(id=>id!==voterId);
  if(!eligible.length) return null;
  if(!enabled) return eligible[Math.floor(random()*eligible.length)];
  const partner=pairs.find(pair=>pair.includes(voterId))?.find(id=>id!==voterId);
  if(eligible.includes(partner)) return partner;
  const strongest=ids=>ids.map(id=>({id,score:relationshipOf(relations,voterId,id)+random()*0.01})).sort((a,b)=>b.score-a.score)[0]?.id;
  const close=eligible.filter(id=>relationshipOf(relations,voterId,id)>=90);
  if(close.length) return strongest(close);
  const mates=new Set(reparto.filter(row=>row.members.includes(voterId)).flatMap(row=>row.members));
  const songmates=eligible.filter(id=>mates.has(id));
  return strongest(songmates.length ? songmates : eligible);
}

export function updatePairs(pairs, event) {
  const remaining = event.breakup ? pairs.filter(pair=>relationKey(...pair)!==relationKey(...event.breakup)) : pairs;
  return event.pair ? [...remaining,event.pair] : remaining;
}
export const isPair = (pairs,a,b) => (pairs || []).some(pair=>pair.includes(a) && pair.includes(b));
export const relationshipColor = (value, couple=false) => couple ? '#f9a8d4' : value==null ? '#f3f4f6' : value>=80 ? '#dcfce7' : value<35 ? '#fee2e2' : 'white';
