import { useState } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { Button } from './ui/button';
import { StaffBadge } from './StaffSetup';
import JuryCatwalk from './JuryCatwalk';
import { publicNominationSlots } from '../lib/publicNominations';
import { useMusicCue } from '../lib/audio';

export default function PublicNominationReveal({state,jury,contestants,performances,manual,onNext}) {
  const [slot,setSlot]=useState('');
  const reduced=useReducedMotion();
  const id=state.order[state.cursor];
  const person=contestants.find(c=>c.id===id);
  const feedback=performances?.[id];
  const index=state.entries.findIndex(row=>row.id===id);
  const boundary=state.entries.length-state.dangerCount;
  const result=state.screen==='result';
  useMusicCue(result?(index>=boundary?'nominee':'victory'):null,id);
  const slots=publicNominationSlots(state).filter(i=>!state.christmas || i<boundary);
  return <section className="space-y-4 rounded-xl border bg-white p-3" aria-live="polite">
    <h3 className="text-xl font-semibold">El público decide</h3>
    <div className="grid gap-4 md:grid-cols-[minmax(150px,1fr)_minmax(0,2fr)]">
      <ol className="space-y-1 text-sm">{state.entries.map((row,i)=><li key={i} className={`rounded border px-2 py-1 ${i>=boundary?'border-red-300 bg-red-100':i===0?'border-blue-300 bg-blue-50':'bg-slate-50'}`}>
        {i===boundary && <strong className="block text-red-800">Zona de Peligro</strong>}
        <span>{i+1} · {state.revealed.includes(row.id)?contestants.find(c=>c.id===row.id)?.name:'Por revelar'}</span>
      </li>)}</ol>
      <Motion.div key={`${id}-${state.screen}`} initial={{opacity:0,y:reduced?0:10}} animate={{opacity:1,y:0}} className="flex flex-col items-center justify-center gap-3 text-center">
        <StaffBadge name={feedback?.judge || 'Jurado'} />
        <img src={person?.photo || '/ot_photos/sinfoto.gif'} alt={person?.name || ''} className="h-[62px] w-[62px] rounded object-cover" />
        <strong>{person?.name}, ponte en pie.</strong>
        {state.screen!=='call' && <p>{feedback?.critique || 'Hemos valorado tu actuación de esta noche.'}</p>}
        {['placement','result'].includes(state.screen) && <p>Pero bueno, veamos dónde te ha colocado el público esta semana…</p>}
        {result && <p className={`text-lg font-bold ${index>=boundary?'text-red-700':'text-emerald-700'}`}>Puesto {index+1}. {index>=boundary?'Estás en la Zona de Peligro.':index===0?`¡Favorit${person?.gender==='f'?'a':person?.gender==='m'?'o':'e'} del público! Cruza la pasarela.`:'¡Cruza la pasarela!'}</p>}
        {manual && state.screen==='placement' && <label>Puesto del público<select className="mt-2 block w-full border p-2" value={slot} onChange={e=>setSlot(e.target.value)}><option value="">Elige un puesto</option>{slots.map(i=><option key={i} value={i}>{i+1}{i>=boundary?' · Zona de Peligro':''}</option>)}</select></label>}
      </Motion.div>
    </div>
    <JuryCatwalk contestants={contestants} ids={state.entries.map(row=>row.id)} results={jury.evalResults || []} favoriteId={jury.favoritoId} currentId={result?null:id} />
    <Button disabled={manual && state.screen==='placement' && slot===''} onClick={()=>{onNext(slot);setSlot('');}}>{state.screen==='call'?'Escuchar valoración':state.screen==='comment'?'Consultar al público':state.screen==='placement'?'Revelar puesto':'Continuar'}</Button>
  </section>;
}
