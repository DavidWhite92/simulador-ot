import { useMusicCue } from "../lib/audio";
import { motion as Motion, useReducedMotion } from "framer-motion";
import { Button } from "./ui/button";
import JuryCatwalk from './JuryCatwalk';

export default function GalaZeroReveal({ stage, reveal, state, contestants, performances = {}, onNext, onRevealAll }) {
  const reduced = useReducedMotion();
  const jury = stage === "g0_eval";
  const teachers = stage === "g0_profes";
  const person = id => contestants.find(c => String(c.id) === String(id));
  const photo = (id, small = false) => <img src={person(id)?.photo || "/ot_photos/sinfoto.gif"} alt={person(id)?.name || ""} className={`${small ? "h-14 w-14" : "h-[62px] w-[62px]"} mx-auto rounded-xl object-cover`} />;
  const event = reveal?.events?.[reveal.index];
  const feedback = performances?.[event?.id];
  const result = reveal?.phase === "result";
  useMusicCue(result ? jury && event?.doubt ? "nominee" : "victory" : null, `${stage}-${event?.id || "save"}`);
  const outcome = reveal?.pending?.gstate?.g0;
  const winner = teachers ? outcome?.profesSaved : outcome?.public?.winner;
  const publicRows = outcome?.public?.tabla || [];
  const winnerPct = publicRows.find(row => String(row.id) === String(winner))?.pct;
  const last = jury && reveal && reveal.index === reveal.events.length - 1;
  return <section aria-live="polite" aria-label="Gala 0: entrada en la Academia" className="overflow-hidden rounded-xl border bg-white p-2 sm:p-5 text-center">
    <h3 className="mb-4 text-lg font-semibold">{jury ? "Gala 0 · La decisión del jurado" : teachers ? "Los profesores han tomado una decisión…" : "La audiencia ha decidido quién entra en la Academia…"}</h3>
    {!jury && <div className="mb-5 flex flex-wrap justify-center gap-4">{Array.from(state?.doubt || []).map(id => <div key={id} className="w-24 space-y-2">{photo(id, true)}<p className="text-sm">{person(id)?.name}</p></div>)}</div>}
    <Motion.div key={jury ? `${event?.id || "intro"}-${reveal?.phase}` : reveal?.phase || "intro"}
      initial={{ opacity: 0, y: reduced ? 0 : 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.3 }}
      className="flex min-h-64 flex-col items-center justify-center gap-4">
      {jury ? event ? <>
        {feedback && <h3 className="text-lg font-bold">{feedback.judge}</h3>}
        {photo(event.id)}<p className="text-xl font-semibold">{person(event.id)?.name}, {feedback ? 'quiero hablar contigo. Ponte en pie.' : 'en pie.'}</p>
        {feedback && reveal.phase !== 'present' && <p className="max-w-2xl">{feedback.critique}</p>}
        <p className={`text-lg font-bold ${result ? event.doubt ? "text-orange-600" : "text-green-700" : "text-gray-500"}`}>
          {result ? event.doubt ? "Quedas en duda" : "¡Entras directamente en la Academia!" : reveal.phase === 'comment' ? 'Vamos a conocer la decisión.' : "El jurado está valorando tu actuación…"}
        </p>
      </> : <p>Vamos a conocer quién entra directamente y quién queda en duda.</p> : result ? <>
        {photo(winner)}<p className="text-xl font-bold text-green-700">{person(winner)?.name}</p>
        {typeof winnerPct === "number" && <p className="text-3xl font-bold">{winnerPct.toFixed(2)}%</p>}
        <p>{teachers ? "¡Los profesores te salvan! Entras en la Academia." : "¡El público te salva! Entras en la Academia."}</p>
        {!teachers && <div className="rounded-xl bg-red-50 p-3 text-red-800"><p className="font-semibold">No entran en la Academia:</p><p>{outcome.public.losers.map(id => person(id)?.name).join(" · ")}</p></div>}
      </> : <p>{teachers ? "Los profesores salvarán a uno de los concursantes en duda." : "De los tres concursantes, solo uno conseguirá la última plaza."}</p>}
    </Motion.div>
    {jury && <JuryCatwalk contestants={contestants} ids={state?.order || []}
      results={[...Array.from(state?.entered || []).map(id => ({ id, result: 'salvado' })),
        ...Array.from(state?.doubt || []).map(id => ({ id, result: 'nominado' })),
        ...(reveal?.events || []).slice(0, (reveal?.index || 0) + (result ? 1 : 0)).map(e => ({ id: e.id, result: e.doubt ? 'nominado' : 'salvado' }))]}
      currentId={!result ? event?.id : undefined} />}
    {jury && reveal && <p className="mb-3 text-sm text-gray-500">Valoraciones reveladas: {reveal.completedBefore + reveal.index + (result ? 1 : 0)} / {state.order.length}</p>}
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      <Button onClick={onNext}>{jury ? !event ? "Comenzar valoraciones" : !result ? reveal.phase === 'comment' ? "Revelar decisión" : "Revelar valoración" : last ? "Continuar con los profesores" : "Siguiente concursante" : !result ? teachers ? "Revelar salvado por los profesores" : "Revelar salvado por el público" : teachers ? "Continuar con el público" : "Ver resumen de la Gala 0"}</Button>
      {jury && <Button variant="outline" onClick={onRevealAll}>Revelar todo</Button>}
    </div>
  </section>;
}
