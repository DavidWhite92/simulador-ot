import {performanceLevels} from './performanceText.js';

export function bestPerformances(weeks={}, summaries={}) {
  const entries=[];
  function add(performances, gala, repechage=false, duel=false) {
    for(const [index,performance] of (performances || []).entries()) {
      const members=performance.members || [];
      if(!members.length || members.some(m=>!Number.isFinite(m.score))) continue;
      const score=members.reduce((sum,m)=>sum+m.score,0)/members.length;
      const quality=performanceLevels.find(level=>score>=level.min)?.quality;
      if(!['increíble','muy buena'].includes(quality)) continue;
      entries.push({...performance,gala:Number(gala),repechage,duel,score,quality,key:`${gala}-${repechage}-${duel}-${index}`});
    }
  }
  for(const [gala,week] of Object.entries(weeks)) add(week.performances,gala);
  for(const [gala,summary] of Object.entries(summaries)) {add(summary.repechage?.performances,gala,true);add(summary.duelPerformances,gala,false,true);}
  return entries.sort((a,b)=>b.score-a.score || a.gala-b.gala || a.key.localeCompare(b.key)).slice(0,10);
}
