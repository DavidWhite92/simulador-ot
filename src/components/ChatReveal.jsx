import { motion as Motion, useReducedMotion } from 'framer-motion';
import { Button } from './ui/button';

export default function ChatReveal({ chat, contestants, gala, onNext, onSkip }) {
  const reduced = useReducedMotion();
  const event = chat.events[chat.shown - 1];
  return <section className="mx-auto max-w-4xl space-y-5 rounded-2xl border bg-white p-6" aria-live="polite">
    <p className="text-sm text-gray-500">Después de la Gala {gala}</p><h2 className="text-2xl font-bold">El Chat</h2>
    <Motion.div key={chat.shown} initial={{ opacity: 0, y: reduced ? 0 : 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-60 space-y-5 text-center">
      {event ? <><p className="text-sm text-gray-500">Momento {chat.shown} de {chat.events.length}</p>
        <div className="flex flex-wrap justify-center gap-4">{event.ids.map(id => { const c = contestants.find(p => p.id === id); return <div key={id}><img src={c?.photo || '/ot_photos/sinfoto.gif'} alt={c?.name} className="mx-auto h-[62px] w-[62px] rounded-xl object-cover" /><p>{c?.name}</p></div>; })}</div>
        <p className="border-l-4 p-3 text-lg" style={{borderColor:event.delta >= 0 ? "#16a34a" : "#dc2626"}}>{event.text}</p></> : <p className="py-16">Los concursantes vuelven a la Academia. Es hora de hablar de lo ocurrido esta noche.</p>}
    </Motion.div>
    <div className="flex flex-wrap gap-2"><Button onClick={onNext}>{!chat.events.length ? 'Comenzar El Chat' : chat.shown < chat.events.length ? 'Siguiente momento' : 'Terminar El Chat'}</Button>
      <Button variant="outline" onClick={onSkip}>Saltar los eventos</Button></div>
  </section>;
}
