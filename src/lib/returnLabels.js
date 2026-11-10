export function returnDecision(id, summary) {
  if(summary.finalNominees?.includes(id)) return {text:'Nom',background:'orange',label:'Nominado'};
  if(summary.profesorSalvoId===id) return {text:'Sal',background:'yellowgreen',label:'Profesores'};
  if(summary.salvadoCompanerosId===id) return {text:'Sal',background:'khaki',label:'Compañeros'};
  if(summary.juradoNominados?.includes(id)) return {text:'Nom',background:'#fef08a',label:'Propuesto'};
  if(Array.isArray(summary.juradoNominados)) return {text:'Sal',background:'#fff',label:'Jurado'};
  return null;
}
export function returnPerformanceLabel(id, summary, contestants, original='') {
  const result=summary?.repechage;
  if(!result?.winner || !result.candidates?.includes(id)) return original;
  const suffix=contestants.find(c=>c.id===id)?.gender==='f'?'a':contestants.find(c=>c.id===id)?.gender==='m'?'o':'e';
  const pct=result.ranking?.find(row=>row.id===id)?.pct;
  const percentage=Number.isFinite(pct)?` (${pct.toFixed(2)}%)`:'';
  if(id!==result.winner) return `Expulsad${suffix} por el Público${percentage}`;
  const prefix=`Repescad${suffix} por el Público${percentage}`;
  const decision=returnDecision(id,summary);
  let detail='';
  if(decision?.label==='Nominado') detail=`Propuest${suffix} por el Jurado > Nominad${suffix}`;
  else if(['Profesores','Compañeros'].includes(decision?.label)) detail=`Propuest${suffix} por el Jurado > Salvad${suffix} por los ${decision.label}`;
  else if(decision?.label==='Propuesto') detail=`Propuest${suffix} por el Jurado`;
  else if(decision) detail=`Salvad${suffix} por el Jurado`;
  return detail?`${prefix} > ${detail}`:prefix;
}
