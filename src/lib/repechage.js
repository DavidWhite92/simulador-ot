import { returnDecision } from "./returnLabels.js";
import { suspendedNominationLabel } from "./suspendedNominations.js";
import { audiencePercentages, createPerformances } from './academy.js';
import { selectPerformanceNominees } from './juryPerformance.js';

export const repechageCandidates = contestants => contestants.filter(c => c.status === 'eliminado' && c.history?.some(h => h.gala > 0 && h.gala <= 8 && /^Eliminado/.test(h.evento)));
export function repechageRanking(ids, contestants, enabled, random=Math.random) {
  const pct=audiencePercentages(ids,contestants,random,4,enabled);
  return ids.map((id,i)=>({id,pct:pct[i]})).sort((a,b)=>b.pct-a.pct);
}
export function useRepechage({gala,gstate,setGstate,contestants,setContestants,summaries,setSummaries,setStage,setCarryNominees,songs,songsMeta,academy,manual,popularityEnabled,pickManually,nameOf,pushLog}) {
  const state=gstate.repechage;
  const save = r => setGstate(s=>({...s,repechage:r}));
  const log = text => pushLog(String(text).replace(/[&<>]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[ch])));
  function start() {
    if(gala!==8) return;
    const eligible=contestants.filter(c=>c.status==='active' && c.id!==gstate.favoritoId).map(c=>c.id);
    let falseNominees=selectPerformanceNominees(eligible,summaries[8]?.performances || {},contestants,4);
    if(manual) {
      falseNominees=[];
      for(let i=0;i<4;i++) {
        const id=pickManually(eligible.filter(id=>!falseNominees.includes(id)),false,nameOf,`Elige al falso nominado ${i+1} (todos se salvarán)`);
        if(!id) return;
        falseNominees.push(id);
      }
    }
    const saved=eligible.filter(id=>!falseNominees.includes(id)).sort(()=>Math.random()-0.5);
    const candidates=repechageCandidates(contestants).map(c=>c.id);
    const used=new Set(Object.values(summaries).flatMap(s=>Object.values(s).flatMap(v=>v?.reparto ? [...v.reparto.map(r=>r.song),v.groupSong] : [])));
    const pool=songs.filter(song=>!used.has(song));
    const available=[...(pool.length>=candidates.length ? pool : songs)];
    const reparto=candidates.map(id=>({members:[id],song:available.splice(Math.floor(Math.random()*available.length),1)[0],type:'solo'}));
    save({phase:'crossing',crossingStep:'present',feedback:summaries[8]?.performances || {},saved,falseNominees,candidates,shown:0,performances:createPerformances(contestants,reparto,songsMeta,academy.judges),performed:0,ranking:[],revealed:0,judge:academy.judges[Math.floor(Math.random()*4)]});
    setStage('repechage');
  }
  function startReturn() {
    const ids=summaries[8]?.repechage?.selected;
    if(gala!==9 || !ids?.length) return false;
    save({phase:'returnIntro',candidates:ids,ranking:repechageRanking(ids,contestants,popularityEnabled)});
    setStage('repechage');
    return true;
  }
  function advance() {
    if(!state) return;
    if(state.phase==='crossing') {
      if(state.crossingStep==='result') {
        save({...state,phase:state.shown===state.saved.length?'surprise':'crossing',crossingStep:'present'});
      } else if(state.crossingStep!=='comment') {
        const id=state.saved[state.shown], feedback=state.feedback?.[id];
        if(feedback) log(`⚖️ ${feedback.judge} a ${nameOf(id)}: ${feedback.critique}`);
        save({...state,crossingStep:'comment'});
      } else {
        const id=state.saved[state.shown];
        log(`✅ ${nameOf(id)} cruza la pasarela.`);
        save({...state,shown:state.shown+1,crossingStep:'result'});
      }
    } else if(state.phase==='surprise') {
      log(`🎄 ${state.judge}: Como es Navidad, no queremos amargaros el dulce. ¡Todos os salváis!`);
      setSummaries(s=>{
        const summary={...s[8],repechageAnnounced:true,falseNominees:state.falseNominees,juradoNominados:[],finalNominees:[],
          favoritoId:gstate.favoritoId, favoritePct:gstate.publicRank?.find(r=>r.id===gstate.favoritoId)?.pct ?? s[8]?.favoritePct ?? s[8]?.top3Pct?.[0]};
        return {...s,8:{...summary,8:{...summary[8],reparto:(summary[8]?.reparto || []).map(row=>({...row,
          valor:row.members.map(id=>suspendedNominationLabel(id,summary,contestants)).join(' | ')}))}}};
      });
      setGstate(s=>({...s,nominados:[],salvados:new Set(contestants.filter(c=>c.status==='active').map(c=>c.id)),repechage:{...state,phase:'announcement'}}));
      setCarryNominees([]);
    } else if(state.phase==='announcement') {
      log('🎤 Esta noche no hay nominaciones. ¡Se abre la repesca entre los siete expulsados de la Academia!');
      save({...state,phase:'performances'});
    } else if(state.phase==='performances') {
      if(state.performed<state.performances.length) {
        const p=state.performances[state.performed];
        log(`🎶 Repesca: ${nameOf(p.members[0].id)} — ${p.song}. ${p.members[0].detail}`);
        save({...state,performed:state.performed+1});
      } else {
        let ranking=repechageRanking(state.candidates,contestants,popularityEnabled);
        if(manual) {
          const chosen=[];
          for(let i=0;i<2;i++) { const id=pickManually(state.candidates.filter(id=>!chosen.includes(id)),false,nameOf,`Elige al candidato ${i+1} para el duelo de repesca`); if(!id)return; chosen.push(id); }
          const order=[...chosen,...ranking.map(r=>r.id).filter(id=>!chosen.includes(id))];
          ranking=ranking.map((r,i)=>({...r,id:order[i]}));
        }
        save({...state,phase:'percentages',ranking});
      }
    } else if(state.phase==='percentages') {
      if(state.revealed<state.ranking.length) {
        const row=state.ranking[state.ranking.length-1-state.revealed];
        log(`🗳️ Repesca: ${nameOf(row.id)} — ${row.pct.toFixed(2)}%.`);
        save({...state,revealed:state.revealed+1});
      } else {
        const selected=state.ranking.slice(0,2).map(r=>r.id);
        setSummaries(s=>({...s,8:{...s[8],repechage:{candidates:state.candidates,selected,ranking:state.ranking,performances:state.performances},popularity:{...s[8]?.popularity,...Object.fromEntries(contestants.filter(c=>state.candidates.includes(c.id)).map(c=>[c.id,c.popularity ?? 50]))}}}));
        log(`💗 ${selected.map(nameOf).join(' y ')} se enfrentarán en la Gala 9 para decidir quién vuelve a la Academia.`);
        setCarryNominees(selected); setStage('galaCerrada');
      }
    } else if(state.phase==='returnIntro') {
      let ranking=state.ranking;
      if(manual) { const id=pickManually(state.candidates,false,nameOf,'Elige quién vuelve a la Academia'); if(!id)return; ranking=ranking.map((r,i)=>({...r,id:i===0?id:state.candidates.find(other=>other!==id)})); }
      save({...state,ranking,phase:'returnPercentage'});
    } else if(state.phase==='returnPercentage') {
      const winner=state.ranking[0].id;
      setContestants(list=>list.map(c=>c.id===winner?{...c,status:'active',history:[...c.history,{gala:9,evento:'Repescado',detalle:'Vuelve a la Academia'}]}:c));
      setSummaries(s=>({...s,9:{...s[9],repechage:{candidates:state.candidates,winner,ranking:state.ranking},popularity:{...s[9]?.popularity,[winner]:contestants.find(c=>c.id===winner)?.popularity ?? 50}}}));
      log(`💗 ${nameOf(winner)} vuelve a la Academia con el ${state.ranking[0].pct.toFixed(2)}%.`);
      setCarryNominees([]); save({...state,phase:'returnResult'});
    } else if(state.phase==='returnResult') setStage('votoPublico');
  }
  return {state,start,startReturn,advance};
}

export function absentAfterElimination(c,summaries,gala) {
  const eliminated=(c.history || []).filter(h=>/^Eliminado/.test(h.evento) && h.gala<gala).map(h=>h.gala);
  if(!eliminated.length) return false;
  const last=Math.max(...eliminated);
  return !(summaries[9]?.repechage?.winner===c.id && gala>=9 && last<9);
}
export function repechageCell(c,summaries,gala) {
  const suffix=c.gender==='m'?'o':c.gender==='f'?'a':'e';
  const s=summaries[gala];
  if(gala===8 && s?.falseNominees?.includes(c.id)) return {text:`Salvad${suffix}${s.top3Ids?.includes(c.id)?'º':''}`,background:'#65a1a5'};
  if(gala===8 && s?.falseNominees && s.top3Ids?.includes(c.id) && s.favoritoId!==c.id) return {text:`Salvad${suffix}`,background:'#AFEEEE'};
  if(gala===8 && s?.repechage?.candidates?.includes(c.id)) {
    if(s.repechage.selected.includes(c.id)) {
      const split=c.history.some(h=>h.gala===8 && /^Eliminado/.test(h.evento));
      return {text:split?'Eli | Can':`Candidat${suffix}`,background:'#fff3a6',split,parts:split?[{text:'Eli',background:'red',color:'white'},{text:'Can',background:'#fff3a6'}]:undefined};
    }
    return {text:`Eliminad${suffix}`,background:'tomato',color:'white'};
  }
  if(gala===9 && s?.repechage?.candidates?.includes(c.id)) {
    if(s.repechage.winner!==c.id) return {text:`Eliminad${suffix}`,background:'tomato',color:'white'};
    const decision=returnDecision(c.id,s);
    return {text:`Repescad${suffix}`,background:'#d879d8',split:Boolean(decision),parts:decision?[{text:'Rep.',background:'#d879d8'},decision]:undefined};
  }
  return null;
}
