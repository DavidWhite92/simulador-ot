import { StaffBadge } from "./StaffSetup";
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { Button } from './ui/button';

export function JudgeSetup({ judges, onChange }) {
  return <section className="rounded-xl border bg-white p-2 sm:p-5 space-y-3">
    <h2 className="text-xl font-semibold">Elige los cuatro jueces</h2>
    <p className="text-sm text-gray-600">Puedes escribir sus nombres o no poner nada (Saldrá Juez como defecto).</p>
    <div className="grid gap-3 sm:grid-cols-2">{judges.map((name,i) => <label key={i} className="text-sm">Juez {i+1}
      <input maxLength={60} value={name} onChange={e => onChange(judges.map((v,j) => j === i ? e.target.value : v))}
        className="mt-1 block w-full rounded-lg border p-2" placeholder={`Juez ${i+1}`} />
    </label>)}</div>
  </section>;
}

export default function AcademyWeek({ week, reparto, groupSong, contestants, gala, onNext, onSkip, onSkipEvents }) {
  const reduced = useReducedMotion();
  const person = id => contestants.find(c => c.id === id);
  const event = week?.events?.[week.shown - 1];
  const performance = week?.performances?.[week.performed - 1];
  const performing = week?.phase === 'performances';
  const eventBlock = item => item?.kind === 'rehearsal' ? 'Ensayos de los temas' : item?.kind === 'mic' ? 'Pases de micros' : 'Convivencia';
  const block = eventBlock(event);
  const blockEvents = (week?.events || []).filter(item => eventBlock(item) === block);
  const blockShown = (week?.events || []).slice(0,week?.shown || 0).filter(item => eventBlock(item) === block).length;

  return <section className="mx-auto w-full max-w-4xl space-y-5 rounded-2xl border bg-white p-2 sm:p-6" aria-live="polite">
    <div><p className="text-sm text-gray-500">Gala {gala}</p><h2 className="text-2xl font-bold">{performing ? 'Comienzan las actuaciones' : gala === 0 ? 'Gala de entrada' : event ? `Academia 24h · ${block}` : 'Academia 24h'}</h2></div>
    {!week ? <>
      <h3 className="text-lg font-semibold">Reparto de temas</h3>
      {groupSong && <p className="font-semibold">Actuación grupal: {groupSong}</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Concursantes</th><th>Tema</th></tr></thead>
        <tbody>{reparto.map((row,i) => <tr key={i} className="border-t"><td className="p-2"><div className="flex items-center gap-1">{row.members.map(id=><img key={id} src={person(id)?.photo || '/ot_photos/sinfoto.gif'} alt={person(id)?.name || 'Concursante'} title={person(id)?.name} width={31} height={31} style={{width:31,height:31,objectFit:'cover',flexShrink:0}} />)}</div></td><td>{row.song}</td></tr>)}</tbody></table></div>
    </> : <Motion.div key={`${week.phase}-${performing ? week.performed : week.shown}`} initial={{ opacity: 0, y: reduced ? 0 : 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-60 space-y-5">
      {performing ? performance ? <>
        <p className="text-sm text-gray-500">Actuación {week.performed} de {week.performances.length}</p>
        <h3 className="text-center text-xl font-semibold">{performance.isGroup ? `Actuación grupal: ${performance.song}` : performance.song}</h3>
        {performance.isGroup ? <div className="flex flex-wrap justify-center gap-2">{performance.members.map(m=><img key={m.id} src={person(m.id)?.photo || '/ot_photos/sinfoto.gif'} alt={person(m.id)?.name} title={person(m.id)?.name} className="h-[31px] w-[31px] rounded object-cover" />)}</div> : <div className={`grid gap-4 ${performance.members.length === 3 ? 'sm:grid-cols-3' : performance.members.length === 2 ? 'sm:grid-cols-2' : ''}`}>{performance.members.map(m => <div key={m.id} className="rounded-xl border p-4 text-center space-y-2">
          <img src={person(m.id)?.photo || '/ot_photos/sinfoto.gif'} alt={person(m.id)?.name} className="mx-auto h-[62px] w-[62px] rounded-xl object-cover" />
          <p className="font-semibold">{person(m.id)?.name}</p><p className={m.delta > 0 ? 'font-semibold text-green-700' : m.delta < 0 ? 'font-semibold text-red-700' : 'font-semibold'}>Actuación {m.quality === 'desastre' ? 'desastrosa' : m.quality}</p>
          <p>{m.detail}</p>
        </div>)}</div>}
        {performance.group && <p className="rounded-xl bg-blue-50 p-4">{performance.group}</p>}
      </> : <p className="py-16 text-center">{gala === 0 ? 'Es el momento de cantar para conseguir una plaza en la Academia.' : 'La semana ha terminado. Es el momento de defender las canciones en directo.'}</p>
      : event ? <>
        <p className="text-sm text-gray-500">Momento {blockShown} de {blockEvents.length} · {event.kind === 'romance' ? '♥ Relaciones' : event.kind === 'mic' ? 'Pase de micros' : event.kind === 'rehearsal' ? 'Ensayos' : 'Convivencia'}</p>
        <div className="flex flex-wrap justify-center gap-5">{!event.isGroup && event.ids.map(id => <div key={id} className="text-center"><img src={person(id)?.photo || '/ot_photos/sinfoto.gif'} alt={person(id)?.name} className="mx-auto h-[62px] w-[62px] rounded-xl object-cover" /><p>{person(id)?.name}</p></div>)}</div>
        <p className="border-l-4 p-3 text-center text-lg" style={{borderColor:(event.positive ?? event.delta >= 0) ? "#16a34a" : "#dc2626"}}>{event.text}</p>
        {event.feedback?.map((comment,i)=><blockquote key={i} className="rounded-xl bg-slate-50 p-3"><StaffBadge name={comment.teacher} photo={comment.photo} />: «{comment.text}»</blockquote>)}
      </> : <p className="py-16 text-center">Las cámaras de Academia 24h ya están encendidas…</p>}
    </Motion.div>}
    <div className="flex flex-wrap gap-2"><Button onClick={onNext} disabled={!reparto.length}>{!week ? gala === 0 ? 'Comenzar las actuaciones' : 'Comenzar Academia 24h' : performing ? week.performed < week.performances.length ? 'Ver siguiente actuación' : 'Continuar con la gala' : week.shown < week.events.length ? event && eventBlock(week.events[week.shown]) !== block ? `Pasar a ${eventBlock(week.events[week.shown]).toLowerCase()}` : 'Ver siguiente evento' : 'Comenzar las actuaciones'}</Button>
      {performing && <Button variant="outline" onClick={onSkip}>Saltar las actuaciones</Button>}
      {week?.phase === 'events' && <Button variant="outline" onClick={onSkipEvents}>Saltar los eventos</Button>}</div>
  </section>;
}

export function AcademySummary({ week }) {
  if (!week?.done || !week.events) return null;
  return <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Resumen de Academia 24h y actuaciones</summary>
    <div className="mt-3 space-y-3">{week.events.map((event,i) => <p key={i} className="border-l-4 pl-3" style={{borderColor:(event.positive ?? event.delta >= 0) ? "#16a34a" : "#dc2626"}}>{event.text}{event.feedback?.map((comment,j)=><span key={j} className="mt-1 block"><StaffBadge name={comment.teacher} photo={comment.photo} />: «{comment.text}»</span>)}</p>)}
      {week.performances.map((p,i) => <div key={i}><p className="font-semibold">{p.isGroup?'Grupal: ':''}{p.song}</p>{!p.isGroup && p.members.map(m => <p key={m.id}>{m.detail}</p>)}{p.group && <p>{p.group}</p>}</div>)}
      {week.chatDone && week.chat && <div className="space-y-2"><h3 className="font-semibold">El Chat</h3>{week.chat.events.map((event,i) => <p key={i} className="border-l-4 pl-3" style={{borderColor:(event.positive ?? event.delta >= 0) ? "#16a34a" : "#dc2626"}}>{event.text}</p>)}</div>}
    </div></details>;
}
