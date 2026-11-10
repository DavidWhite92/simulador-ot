import { motion as Motion, useReducedMotion } from 'framer-motion';
import { Button } from './ui/button';
import JuryCatwalk from './JuryCatwalk';
import { useMusicCue } from '../lib/audio';

export default function RepechageReveal({state,contestants,favoriteId,onNext}) {
  const reduced=useReducedMotion();
  const person=id=>contestants.find(c=>c.id===id);
  const {phase}=state;
  const crossing=phase==='crossing' && state.saved[state.crossingStep==='result' ? state.shown-1 : state.shown];
  const feedback=state.feedback?.[crossing];
  const performance=phase==='performances' && state.performances[state.performed-1];
  const entry=phase==='percentages' && state.ranking[state.ranking.length-state.revealed];
  const returned=phase==='returnResult' && state.ranking[0];
  useMusicCue((crossing && state.crossingStep==='result') || returned || phase==='announcement' || (entry && state.ranking.indexOf(entry)<2) ? 'victory' : null,`${phase}-${state.shown}-${state.revealed}`);
  const photo=id=><img src={person(id)?.photo || '/ot_photos/sinfoto.gif'} alt={person(id)?.name} className="mx-auto h-[62px] w-[62px] rounded object-cover" />;
  const label=phase==='crossing' ? state.crossingStep==='result' ? state.shown<state.saved.length ? 'Siguiente concursante' : 'Escuchar al jurado' : state.crossingStep==='comment' ? 'Revelar decisión' : 'Revelar valoración' : phase==='surprise' ? 'Revelar la sorpresa' : phase==='announcement' ? 'Ver actuaciones de repesca' : phase==='performances' ? state.performed<state.performances.length ? 'Ver siguiente actuación' : 'Abrir votación de repesca' : phase==='percentages' ? state.revealed<state.ranking.length ? 'Revelar siguiente porcentaje' : 'Terminar Gala 8' : phase==='returnIntro' ? 'Revelar porcentaje' : phase==='returnPercentage' ? 'Revelar quién vuelve' : 'Continuar con la gala';
  return <section className="space-y-4 rounded-xl border bg-white p-2 sm:p-5 text-center" aria-live="polite">
    <h3 className="text-xl font-bold">{phase==='crossing' || phase==='surprise' ? 'La decisión del jurado' : 'Repesca'}</h3>
    <Motion.div key={`${phase}-${state.shown}-${state.performed}-${state.revealed}`} initial={{opacity:0,y:reduced?0:15}} animate={{opacity:1,y:0}} className="space-y-3">
      {phase==='crossing' && (crossing ? <><h4 className="font-bold">{feedback?.judge}</h4>{photo(crossing)}<p><strong>{person(crossing)?.name}</strong>, en pie.</p>{state.crossingStep!=='present' && <p>{feedback?.critique || 'El jurado ha valorado tu actuación de esta noche.'}</p>}{state.crossingStep==='result' && <p className="font-bold text-green-700">¡Cruza la pasarela!</p>}</> : <p>El favorito está a salvo. Vamos a conocer quiénes cruzan la pasarela.</p>)}
      {phase==='surprise' && <><h4 className="font-bold">{state.judge}</h4><div className="flex flex-wrap justify-center gap-3">{state.falseNominees.map(id=><div key={id}>{photo(id)}<p>{person(id)?.name}</p></div>)}</div><p>Tenemos una sorpresa para vosotros…</p></>}
      {phase==='announcement' && <><p><strong>{state.judge}:</strong> Como es Navidad, no queremos amargaros el dulce. ¡Todos os salváis!</p><p>Esta noche no hay nominaciones. ¡Se activa la repesca!</p></>}
      {phase==='performances' && (performance ? <>{photo(performance.members[0].id)}<h4 className="font-bold">{person(performance.members[0].id)?.name} · {performance.song}</h4><p>{performance.members[0].detail}</p><p>Actuación {state.performed} de {state.performances.length}</p></> : <p>Los siete expulsados vuelven al escenario para luchar por una segunda oportunidad.</p>)}
      {phase==='percentages' && <><table className="mx-auto w-full max-w-md text-sm"><thead><tr><th>Puesto</th><th>Concursante</th><th>Porcentaje</th></tr></thead><tbody>{state.ranking.map((row,i)=><tr key={row.id} className={i<2?'bg-pink-200':'bg-yellow-100'}><td>{i+1}</td><td>{i>=state.ranking.length-state.revealed?person(row.id)?.name:'Por revelar'}</td><td>{i>=state.ranking.length-state.revealed?`${row.pct.toFixed(2)}%`:'—'}</td></tr>)}</tbody></table>{entry && <>{photo(entry.id)}<p className="font-bold">{person(entry.id)?.name} · {entry.pct.toFixed(2)}%</p></>}</>}
      {phase==='returnIntro' && <><p>Llega el momento de decidir quién vuelve a la Academia.</p><div className="flex justify-center gap-4">{state.candidates.map(id=><div key={id}>{photo(id)}<p>{person(id)?.name}</p></div>)}</div></>}
      {phase==='returnPercentage' && <><p>La audiencia ha decidido que debe volver a la Academia, con un…</p><p className="text-4xl font-bold">{state.ranking[0].pct.toFixed(2)}%</p></>}
      {returned && <>{photo(returned.id)}<p className="text-xl font-bold">¡{person(returned.id)?.name} vuelve a la Academia!</p></>}
    </Motion.div>
    {['crossing','surprise','announcement'].includes(phase) && <JuryCatwalk contestants={contestants} ids={contestants.filter(c=>c.status==='active').map(c=>c.id)} favoriteId={favoriteId} results={[...state.saved.slice(0,state.shown),...(phase==='announcement'?state.falseNominees:[])].map(id=>({id,result:'salvado'}))} />}
    <Button onClick={onNext}>{label}</Button>
  </section>;
}
