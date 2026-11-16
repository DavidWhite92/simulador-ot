import { favoriteRanking } from './academy.js';
import { mixedJuryOrder, manualJuryOptions } from './juryPerformance.js';
import { escapeText } from './classicSeason.js';

export const juryRescueColor = '#65a1a5';
const suffix = person => person.gender === 'f' ? 'a' : person.gender === 'm' ? 'o' : 'e';
export const rankingPosition = (person, position) => `${position}${person.gender === 'f' ? 'ª' : 'º'}`;

export function publicRevealOrder(ids, nominees, random=Math.random) {
  const mixed=mixedJuryOrder(ids,nominees,random);
  if(mixed.length<3) return mixed;
  const tail=mixed.slice(-2), head=mixed.slice(0,-2);
  const danger=new Set(nominees);
  const groups=[head.filter(id=>!danger.has(id)),head.filter(id=>danger.has(id))];
  const result=[];
  while(groups[0].length || groups[1].length) {
    let choice=random()<groups[1].length/(groups[0].length+groups[1].length)?1:0;
    if(result.length>=2 && danger.has(result.at(-1))===danger.has(result.at(-2))) {
      const opposite=danger.has(result.at(-1))?0:1;
      if(groups[opposite].length) choice=opposite;
    }
    if(!groups[choice].length) choice=1-choice;
    result.push(groups[choice].shift());
  }
  return [...result,...tail];
}

export function publicNominationSlots(state) {
  const hidden=state.entries.map((_,i)=>i).filter(i=>!state.revealed.includes(state.entries[i].id));
  const boundary=state.entries.length-state.dangerCount;
  const needed=hidden.filter(i=>i>=boundary).length;
  const allowed=manualJuryOptions(hidden.length,needed);
  return hidden.filter(i=>allowed.includes(i>=boundary?'nominado':'salvado'));
}

export function publicNominationCell(person, summary, gala) {
  const state=summary?.publicNomination;
  if(!state) return null;
  const index=state.entries.findIndex(row=>row.id===person.id);
  const suf=suffix(person);
  const duel=summary.duel;
  if(duel && [duel.a,duel.b].includes(person.id) && duel.winner!==person.id) {
    const pct=person.id===duel.a?duel.pctA:duel.pctB;
    return {text:`Eliminad${suf}`,label:`Expulsad${suf} por el Público (${pct.toFixed(2)}%)`,background:'red',color:'#fff'};
  }
  if(index<0 || !state.revealed.includes(person.id)) return null;
  const pos=`(${rankingPosition(person,index+1)})`;
  const danger=index>=state.entries.length-state.dangerCount;
  const suspended=Boolean(summary.falseNominees);
  const prefix=duel?.winner===person.id?`Salvad${suf} por el Público (${(person.id===duel.a?duel.pctA:duel.pctB).toFixed(2)}%) > `
    : summary.repechage?.winner===person.id?`Repescad${suf} por el Público (${summary.repechage.ranking.find(row=>row.id===person.id)?.pct.toFixed(2)}%) > `:'';
  let text=index===0?`Favorit${suf}`:danger&&!suspended?`Nominad${suf}`:`Salvad${suf}`;
  let background=index===0?'DodgerBlue':index<3?'#AFEEEE':danger?'orange':'#fff';
  let label=danger?`Propuest${suf} por el Público`:`Salvad${suf} por el Público`;
  if(danger && suspended) { label+=' > Nominaciones Suspendidas';background=juryRescueColor; }
  else if(summary.jurySavedId===person.id) {label+=` > Salvad${suf} por el Jurado`;background=juryRescueColor;}
  else if(summary.profesorSalvoId===person.id) {label+=` > Salvad${suf} por los Profesores`;background='yellowgreen';}
  else if(summary.salvadoCompanerosId===person.id) {label+=` > Salvad${suf} por los Compañeros`;background='khaki';}
  else if(summary.finalNominees?.includes(person.id)) label+=` > Nominad${suf}`;
  return {text:`${text} ${pos}`,label:`${prefix}${label} ${pos}`,background,color:index===0?'#fff':'#111'};
}

export function createPublicNominationActions({contestants,gala,gstate,setGstate,summaries,setSummaries,setStage,pushLog,manual,pickManually,nameOf,popularityEnabled,repechageEnabled,onRepechage}) {
  const log=text=>pushLog(escapeText(text));
  const save=state=>setGstate(old=>({...old,publicNomination:state}));
  function start() {
    const people=contestants.filter(c=>c.status==='active');
    const entries=favoriteRanking(people,popularityEnabled);
    const dangerCount=people.length===8?4:5;
    const danger=entries.slice(-dangerCount).map(row=>row.id);
    const christmas=gala===8 && repechageEnabled;
    const normal=publicRevealOrder(entries.map(row=>row.id),danger);
    const order=christmas?normal.filter(id=>!danger.includes(id)):normal;
    const state={entries,dangerCount,order,revealed:[],cursor:0,screen:'call',christmas};
    save(state);
    setStage('publicNomination');
    setSummaries(s=>({...s,[gala]:{...s[gala],publicNomination:state}}));
  }
  function next(slot) {
    const r=gstate.publicNomination;
    if(!r) return;
    if(r.screen==='call') {save({...r,screen:'comment'});return;}
    if(r.screen==='comment') {save({...r,screen:'placement'});return;}
    if(r.screen==='placement') {
      const id=r.order[r.cursor];
      const entries=r.entries.map(row=>({...row}));
      const original=entries.findIndex(row=>row.id===id);
      if(manual) {
        const available=publicNominationSlots(r).filter(i=>!r.christmas || i<entries.length-r.dangerCount);
        if(!available.includes(Number(slot)) || slot==='' || slot==null) return;
        [entries[original].id,entries[Number(slot)].id]=[entries[Number(slot)].id,entries[original].id];
      }
      const position=entries.findIndex(row=>row.id===id);
      const nominated=position>=entries.length-r.dangerCount;
      const revealed=[...r.revealed,id];
      const pending=entries.map(row=>row.id).filter(id=>!revealed.includes(id));
      const nextOrder=manual?publicRevealOrder(pending,entries.slice(-r.dangerCount).map(row=>row.id)):r.order.slice(r.cursor+1);
      const order=manual?[...r.order.slice(0,r.cursor+1),...(r.christmas?nextOrder.filter(id=>entries.findIndex(row=>row.id===id)<entries.length-r.dangerCount):nextOrder)]:r.order;
      const updated={...r,entries,revealed,order,screen:'result'};
      const feedback=summaries[gala]?.performances?.[id];
      if(feedback) log(`${feedback.judge} a ${nameOf(id)}: ${feedback.critique}`);
      log(`${nameOf(id)}: el público te ha situado en el puesto ${position+1}. ${nominated?'Estás en la Zona de Peligro.':'¡Cruza la pasarela!'}`);
      setGstate(st=>({...st,publicNomination:updated,
        favoritoId:revealed.includes(entries[0].id)?entries[0].id:undefined,
        evalResults:[...(st.evalResults || []),{id,result:nominated?'nominado':'salvado'}],
        salvados:new Set([...(st.salvados || []),...(!nominated?[id]:[])])}));
      setSummaries(s=>({...s,[gala]:{...s[gala],publicNomination:updated,
        favoritoId:revealed.includes(entries[0].id)?entries[0].id:undefined,
        top3Ids:entries.slice(0,3).map(row=>row.id).filter(id=>revealed.includes(id))}}));
      return;
    }
    if(r.cursor+1<r.order.length) {save({...r,cursor:r.cursor+1,screen:'call'});return;}
    const danger=r.entries.slice(-r.dangerCount).map(row=>row.id);
    if(r.christmas) {onRepechage(danger);return;}
    setGstate(st=>({...st,nominados:danger}));
    setSummaries(s=>({...s,[gala]:{...s[gala],publicNominees:danger,juradoNominados:danger}}));
    setStage(r.dangerCount===5?'publicJurySave':'profesSalvan');
  }
  function saveJury() {
    const ids=gstate.nominados || [];
    if(ids.length!==5) return;
    const chosen=manual?pickManually(ids,false,nameOf,'El jurado salva de la Zona de Peligro a…')
      : [...ids].sort((a,b)=>(summaries[gala]?.performances?.[b]?.score ?? 6)-(summaries[gala]?.performances?.[a]?.score ?? 6))[0];
    if(!chosen) return;
    log(`El jurado salva a ${nameOf(chosen)} de la Zona de Peligro.`);
    setSummaries(s=>({...s,[gala]:{...s[gala],jurySavedId:chosen}}));
    setGstate(st=>({...st,nominados:ids.filter(id=>id!==chosen),salvados:new Set([...st.salvados,chosen]),
      ceremony:{...st.ceremony,phase:'result',nextStage:'profesSalvan'}}));
    setStage('ceremony');
  }
  return {start,next,saveJury};
}
