import { useState } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { Button } from './ui/button';
import { StaffBadge } from './StaffSetup';
import { classicAssessment } from '../lib/classicSeason';
import { useMusicCue } from '../lib/audio';

export default function ClassicReveal({jury, final, contestants, judges, manual, onNext}) {
  const [chosen,setChosen]=useState('');
  const reduced=useReducedMotion();
  const person=id=>contestants.find(c=>c.id===id);
  const index=final ? [5,4,3,2,0][final.cursor] : null;
  const id=final ? final.screen==='revealed' ? final.entries[index].id : null : jury.revealed ? jury.finalists[jury.revealed-1] : jury.ids[jury.shown-1];
  const winner=person(id);
  const celebratory=final ? final.screen==='revealed' : jury.revealed>0;
  useMusicCue(celebratory?'victory':null,`${id}-${jury?.revealed}-${final?.cursor}`);
  const label=final ? final.screen==='revealed' ? final.cursor===4?'Terminar la temporada':'Continuar' : index===0?'Revelar ganador/a':`Revelar ${index+1}º puesto`
    : jury.shown<jury.ids.length?'Valorar siguiente concursante':jury.revealed<3?`Revelar ${jury.revealed+1}º finalista`:'Continuar con los profesores';
  return <section className="space-y-4 rounded-xl border bg-white p-4" aria-live="polite">
    <h3 className="text-xl font-semibold">{final?'La gran final':'El jurado decide los tres primeros finalistas'}</h3>
    <div className={final?'grid gap-4 sm:grid-cols-2':''}>
      {final && <ol className="space-y-2">{final.entries.map((row,i)=><li key={i} className="flex justify-between gap-2 rounded border p-2"><span>{i+1}º · {final.visible.includes(i)?person(row.id)?.name:'Por revelar'}</span><strong>{row.pct.toFixed(2)}%</strong></li>)}</ol>}
      <Motion.div key={`${id}-${jury?.shown}-${final?.screen}`} initial={{opacity:0,y:reduced?0:12}} animate={{opacity:1,y:0}} className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
        {winner ? <><img src={winner.photo || '/ot_photos/sinfoto.gif'} alt={winner.name} width={62} height={62} className="h-[62px] w-[62px] rounded object-cover" /><strong>{winner.name}</strong>
          {final?<p>{index===0?'¡Ganador/a de la edición!':`${index+1}º puesto`} · {final.entries[index].pct.toFixed(2)}%</p>:jury.revealed?<p>¡{jury.revealed}º finalista! Cruza la pasarela.</p>:<><StaffBadge name={judges[(jury.shown-1)%4]} /><p>{classicAssessment(jury.records.find(r=>r.id===id))}</p></>}
        </>:<p>{final?index===0?'La audiencia ha decidido quién gana esta edición…':`La audiencia ha decidido quién ocupa el ${index+1}º puesto…`:'Antes de decidir, vamos a valorar vuestro paso por la Academia.'}</p>}
      </Motion.div>
    </div>
    {final && manual && final.screen==='announce' && <label className="block">{index===0?'Elige al ganador/a':'Elige a quién corresponde este puesto'}<select className="mt-2 block w-full border p-2" value={chosen} onChange={e=>setChosen(e.target.value)}><option value="">Selecciona un concursante</option>{final.entries.filter((_,i)=>!final.visible.includes(i)).map(row=><option key={row.id} value={row.id}>{person(row.id)?.name}</option>)}</select></label>}
    <Button disabled={Boolean(final && manual && final.screen==='announce' && !chosen)} onClick={()=>{onNext(chosen);setChosen('');}}>{label}</Button>
  </section>;
}
