import { audiencePercentages } from './academy.js';

export const classicFinalGala = 14;
export const escapeText = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function classicMerit(contestants, summaries, gala) {
  return contestants.filter(c => c.status === 'active').map(person => {
    let nominations = 0;
    const scores = [];
    for (const [number, summary] of Object.entries(summaries)) {
      if (+number > gala) continue;
      if (+number < gala && !summary.falseNominees && summary.juradoNominados?.includes(person.id)) nominations++;
      const score = summary.performances?.[person.id]?.score;
      if (Number.isFinite(score)) scores.push(score);
    }
    const average = scores.length ? scores.reduce((a,b) => a+b,0)/scores.length : 5;
    // A nomination counts heavily, while the whole singing record also matters.
    return { id:person.id, nominations, average, merit:average - nominations * 0.8 };
  }).sort((a,b) => b.merit-a.merit || a.nominations-b.nominations || b.average-a.average || String(a.id).localeCompare(String(b.id)));
}

export function classicAssessment(record) {
  const performance = record.average >= 8 ? 'Has firmado actuaciones extraordinarias y has demostrado un nivel muy alto.'
    : record.average >= 6.8 ? 'Tu trayectoria ha tenido buenas actuaciones y momentos en los que has sabido crecer.'
    : record.average >= 5.8 ? 'Has avanzado, aunque aún te ha faltado regularidad para consolidar tu propuesta.'
    : 'Tu recorrido ha sido difícil: hemos visto esfuerzo, pero también errores que necesitas seguir trabajando.';
  const nominations = record.nominations === 0 ? 'No has sido propuesto para abandonar la Academia en ninguna gala.'
    : record.nominations === 1 ? 'Solo has pasado una vez por una propuesta de nominación.'
    : `Has afrontado ${record.nominations} propuestas de nominación, y también tenemos en cuenta cómo te has recuperado de ellas.`;
  return `${performance} ${nominations} Hoy valoramos tu concurso completo.`;
}

export function createClassicActions({gala, contestants, summaries, gstate, setGstate, setContestants, setSummaries, setStage, pushLog, manual, pickManually, nameOf, popularityEnabled}) {
  const log = text => pushLog(escapeText(text));
  function closeOpening() {
    const ids=contestants.map(c=>c.id);
    setSummaries(s=>({...s,0:{...s[0],gala0:{entraJurado:ids,eliminados:[]},0:{...s[0]?.[0],reparto:(s[0]?.[0]?.reparto || []).map(row=>({...row,valor:'Entra en la Academia'}))}}}));
    log(`${contestants.length===17 ? "Los 17 concursantes entran en la Academia. Desde ahora el público votará para salvar." : "Los 16 concursantes entran en la Academia. Desde este momento y durante la próxima gala, el público podrá votar a su favorito."} ¡Nos vemos en El Chat!`);
    setStage('galaCerrada');
  }
  function startJury() {
    const records=classicMerit(contestants,summaries,gala);
    if(records.length!==7) return;
    let finalists=records.slice(0,3).map(r=>r.id);
    if(manual) {
      finalists=[];
      for(let i=0;i<3;i++) {
        const id=pickManually(records.map(r=>r.id).filter(id=>!finalists.includes(id)),false,nameOf,`Elige al ${i+1}º finalista del jurado`);
        if(!id) return;
        finalists.push(id);
      }
    }
    // Assess everyone before announcing any finalist; roster order does not leak merit.
    const ids=contestants.filter(c=>c.status==='active').map(c=>c.id);
    setGstate(st=>({...st,classicJury:{records,ids,finalists,shown:0,revealed:0}}));
    setStage('classicJury');
  }
  function nextJury() {
    const r=gstate.classicJury;
    if(r.shown<r.ids.length) {
      const id=r.ids[r.shown];
      log(`${nameOf(id)}: ${classicAssessment(r.records.find(x=>x.id===id))}`);
      setGstate(st=>({...st,classicJury:{...r,shown:r.shown+1}}));
    } else if(r.revealed<3) {
      log(`El jurado elige a ${nameOf(r.finalists[r.revealed])} como ${r.revealed+1}º finalista. ¡Cruza la pasarela!`);
      setGstate(st=>({...st,classicJury:{...r,revealed:r.revealed+1}}));
    } else {
      const nominados=r.ids.filter(id=>!r.finalists.includes(id));
      setContestants(list=>list.map(c=>r.finalists.includes(c.id)?{...c,status:'finalista',history:[...c.history,{gala,evento:'Finalista por jurado'}]}:c));
      setGstate(st=>({...st,nominados,salvados:new Set(r.finalists)}));
      setSummaries(s=>({...s,[gala]:{...s[gala],juradoNominados:nominados,classicJury:r,
        g10:{top3:r.finalists,nominados4:nominados,restantes:nominados},
        [gala]:{...s[gala]?.[gala],reparto:(s[gala]?.[gala]?.reparto || []).map(row=>({...row,valor:r.finalists.includes(row.members[0])?'Elegido por el jurado > Finalista':'Pendiente de elección de finalistas'}))}}}));
      setStage('gala10_profes');
    }
  }
  function startFinal() {
    const ids=contestants.filter(c=>c.status==='finalista').map(c=>c.id);
    if(ids.length!==6) return;
    const pcts=audiencePercentages(ids,contestants,Math.random,4,popularityEnabled);
    const entries=ids.map((id,i)=>({id,pct:pcts[i]})).sort((a,b)=>b.pct-a.pct);
    setGstate(st=>({...st,classicFinal:{entries,visible:[],cursor:0,screen:'announce'}}));
    setStage('classicFinal');
  }
  function nextFinal(chosenId) {
    const r=gstate.classicFinal;
    if(r.screen==='revealed') {
      if(r.cursor===4) {setStage('galaCerrada');return;}
      setGstate(st=>({...st,classicFinal:{...r,cursor:r.cursor+1,screen:'announce'}}));
      return;
    }
    const index=[5,4,3,2,0][r.cursor];
    const entries=r.entries.map(row=>({...row}));
    if(manual) {
      const source=entries.findIndex(row=>row.id===chosenId);
      if(source<0 || r.visible.includes(source)) return;
      [entries[index].id,entries[source].id]=[entries[source].id,entries[index].id];
    }
    const visible=[...r.visible,index,...(index===0?[1]:[])];
    log(`${index===0?'Ganador/a':`${index+1}º puesto`}: ${nameOf(entries[index].id)} (${entries[index].pct.toFixed(2)}%).`);
    if(index===0) {
      log(`Segundo puesto: ${nameOf(entries[1].id)} (${entries[1].pct.toFixed(2)}%).`);
      setContestants(list=>list.map(c=>entries.some(row=>row.id===c.id)?{...c,status:c.id===entries[0].id?'ganador':'finalista',history:[...c.history,{gala,evento:c.id===entries[0].id?'Ganador/a':'Finalista'}]}:c));
      setSummaries(s=>({...s,[gala]:{...s[gala],classicFinal:{entries,winner:entries[0].id},
        [gala]:{...s[gala]?.[gala],reparto:(s[gala]?.[gala]?.reparto || []).map(row=>{
          const rank=entries.findIndex(entry=>entry.id===row.members[0]);
          const person=contestants.find(c=>c.id===row.members[0]);
          return {...row,valor:rank===0?`${person?.gender==='f'?'Ganadora':'Ganador'} (${entries[rank].pct.toFixed(2)}%)`:`${rank+1}${person?.gender==='f'?'ª':'º'} Finalista (${entries[rank].pct.toFixed(2)}%)`};
        })}}}));
    }
    setGstate(st=>({...st,classicFinal:{...r,entries,visible,screen:'revealed'}}));
  }
  return {closeOpening,startJury,nextJury,startFinal,nextFinal};
}
