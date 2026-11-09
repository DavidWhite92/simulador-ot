import { useId } from 'react';
import { LayoutGroup, motion as Motion, useReducedMotion } from 'framer-motion';
import { catwalkGroups } from '../lib/catwalk';

export default function JuryCatwalk({ contestants, ids, results, favoriteId, currentId }) {
  const reduced = useReducedMotion();
  const groupId = useId();
  const { saved, nominated } = catwalkGroups(ids, results, favoriteId);
  function portrait(id, across) {
    const person = contestants.find(c => c.id === id);
    const isNominee = nominated.includes(id);
    const label = `${person?.name || id}: ${across ? id === favoriteId ? 'favorito' : 'ha cruzado la pasarela' : isNominee ? 'nominado' : id === currentId ? 'en pie' : 'pendiente de valoración'}`;
    return <Motion.div key={id} layoutId={`photo-${id}`} layout="position"
      transition={{ layout: { duration: reduced ? 0 : 1.6, ease: 'easeInOut' } }}
      className="relative z-10 flex h-12 w-10 flex-none flex-col items-center justify-center" title={label} aria-label={label}>
      <Motion.img src={person?.photo || '/ot_photos/sinfoto.gif'} alt={person?.name || ''} width={31} height={31}
        animate={{ y: !across && id === currentId && !reduced ? -6 : 0 }} transition={{ duration: reduced ? 0 : 0.2 }}
        style={{ width: 31, height: 31 }}
        className={`rounded object-cover ring-2 ${across ? id === favoriteId ? 'ring-blue-500' : 'ring-emerald-500' : isNominee ? 'ring-orange-500' : 'ring-slate-300'}`} />
      
    </Motion.div>;
  }
  return <section aria-label="Pasarela de concursantes" className="mt-5 border-t pt-4">
    <LayoutGroup id={groupId}>
      <div className="grid grid-cols-1 items-stretch gap-1 text-center sm:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)]">
        <div className="rounded-xl bg-slate-100 p-2">
          <div className="flex min-h-16 flex-wrap justify-center gap-1">{ids.filter(id => id !== favoriteId).map(id => <div key={id} className="relative h-12 w-10 flex-none">{!saved.includes(id) && portrait(id, false)}<span aria-hidden="true" className="absolute bottom-0 left-0.5 h-2 w-9 rounded-b border-b-4 border-l-2 border-r-2 border-slate-400" /></div>)}</div>
        </div>
        <div className="flex flex-col items-center justify-center" aria-hidden="true"><div className="flex h-10 w-9 items-center justify-center border-x-2 sm:h-9 sm:w-full sm:border-x-0 sm:border-y-2 border-blue-300 bg-gradient-to-r from-slate-200 via-blue-100 to-emerald-100 text-lg text-blue-500"><span className="sm:hidden">↓</span><span className="hidden sm:inline">→</span></div></div>
        <div className="rounded-xl bg-emerald-50 p-2">
          <div className="flex min-h-16 flex-wrap content-start justify-start gap-1">{saved.map(id => portrait(id, true))}</div>
        </div>
      </div>
    </LayoutGroup>
  </section>;
}
