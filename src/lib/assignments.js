// Dúos and tríos have independent histories: a shared trio does not consume a duo.
export const groupKey = ids => JSON.stringify(ids.map(String).sort());
export function previousGroups(summaries, gala) {
  const used=new Set();
  for(const [number,summary] of Object.entries(summaries)) {
    if(Number(number)>=gala) continue;
    for(const row of summary?.[number]?.reparto || []) if([2,3].includes(row.members?.length)) used.add(groupKey(row.members));
  }
  return used;
}
export const assignmentPlanGala = (gala, repechage) => repechage && gala>=9 && gala<=11 ? gala-2 : gala;

export function freshGroups(ids, plan, used=new Set(), random=Math.random) {
  const pool=[...new Set(ids)];
  for(let i=pool.length-1;i>0;i--) {const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const n=pool.length, full=(1<<n)-1;
  const memo=new Map();
  function solve(mask,trios,duos) {
    const key=`${mask}:${trios}:${duos}`;
    if(memo.has(key)) return memo.get(key);
    const remaining=[]; for(let i=0;i<n;i++) if(mask & (1<<i)) remaining.push(i);
    if(remaining.length < trios*3+duos*2) return null;
    if(!trios && !duos) return remaining.map(i=>[pool[i]]);
    const first=remaining[0];
    function attempt(indices,t,d) {
      const group=indices.map(i=>pool[i]);
      if(used.has(groupKey(group))) return null;
      const rest=solve(indices.reduce((m,i)=>m & ~(1<<i),mask),t,d);
      return rest ? [group,...rest] : null;
    }
    if(trios) for(let a=1;a<remaining.length;a++) for(let b=a+1;b<remaining.length;b++) {
      const result=attempt([first,remaining[a],remaining[b]],trios-1,duos);
      if(result) {memo.set(key,result);return result;}
    }
    if(duos) for(let a=1;a<remaining.length;a++) {
      const result=attempt([first,remaining[a]],trios,duos-1);
      if(result) {memo.set(key,result);return result;}
    }
    if(remaining.length>trios*3+duos*2) {
      const rest=solve(mask & ~(1<<first),trios,duos);
      if(rest) {const result=[[pool[first]],...rest];memo.set(key,result);return result;}
    }
    memo.set(key,null);return null;
  }
  // Keep the requested format whenever possible; exhausted combinations become solos.
  const maxTrios=Math.min(plan.trios || 0,Math.floor(n/3));
  for(let t=maxTrios;t>=0;t--) for(let d=Math.min(plan.duos || 0,Math.floor((n-t*3)/2));d>=0;d--) {
    const result=solve(full,t,d);
    if(result) return result.sort((a,b)=>b.length-a.length).map(members=>({type:members.length===3?'trio':members.length===2?'duo':'solo',members,song:'',valor:''}));
  }
  return [];
}
