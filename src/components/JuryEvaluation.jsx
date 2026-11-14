import {secondChance} from "../lib/juryComments";
import { StaffBadge } from "./StaffSetup";
import { Button } from "./ui/button";
import { useMusicCue } from "../lib/audio";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import JuryCatwalk from './JuryCatwalk';

export default function JuryEvaluation({ jury, contestants, performances = {}, onNext, onRevealAll }) {
  const reduceMotion = useReducedMotion();
  const latest = jury.evalResults?.at(-1);
  const id = jury.currentEvaluadoId || latest?.id;
  const contestant = contestants.find(c => c.id === id);
  const result = jury.currentEvaluadoId ? null : latest?.result;
  const feedback = performances?.[id];
  useMusicCue(result ? result === "nominado" ? "nominee" : "victory" : null, id);
  const suffix = contestant?.gender === "m" ? "o" : contestant?.gender === "f" ? "a" : "e";
  return (
    <section aria-label="Valoración del jurado" aria-live="polite" className="overflow-hidden rounded-xl border bg-white p-2 sm:p-5">
      <p className="mb-3 text-sm text-gray-500">Valoraciones reveladas: {jury.evalResults?.length || 0}</p>
      <AnimatePresence mode="wait" initial={false}>
        <Motion.div key={id || "waiting"}
          initial={{ opacity: 0, x: reduceMotion ? 0 : 45, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: reduceMotion ? 0 : -45 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
          {contestant ? <>
            {feedback && <h3 className="text-lg font-bold"><StaffBadge name={feedback.judge} /></h3>}
            <img src={contestant.photo || "/ot_photos/sinfoto.gif"} alt={contestant.name} className="h-[62px] w-[62px] rounded-xl object-cover" />
            <p className="font-semibold">{contestant.name}, {feedback ? 'quiero hablar contigo. Ponte en pie.' : 'en pie.'}</p>
            {feedback && (jury.juryCommentShown || result) && <p className="max-w-2xl">{feedback.critique}</p>}
            {result === "salvado" && secondChance(id,performances) && <p>{secondChance(id,performances)}</p>}
            <p className={`font-semibold ${result === "nominado" ? "text-orange-600" : result ? "text-emerald-700" : "text-gray-500"}`}>
              {result === "nominado" ? `Nominad${suffix} por el jurado` : result ? "Cruza la pasarela" : jury.juryCommentShown ? 'Vamos a conocer la decisión.' : "El jurado está valorando tu actuación…"}
            </p>
          </> : <p>Pulsa «Siguiente» para comenzar las valoraciones.</p>}
        </Motion.div>
      </AnimatePresence>
      <JuryCatwalk contestants={contestants} ids={contestants.filter(c => c.status === 'active').map(c => c.id)}
        results={jury.evalResults || []} favoriteId={jury.favoritoId} currentId={jury.currentEvaluadoId} />
      <div className="mt-4 flex flex-wrap justify-center gap-2"><Button onClick={onNext}>Siguiente</Button><Button variant="outline" onClick={onRevealAll}>Revelar todo</Button></div>
    </section>
  );
}
