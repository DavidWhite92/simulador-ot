import { StaffBadge } from "./StaffSetup";
import { useMusicCue } from "../lib/audio";
import { motion as Motion, useReducedMotion } from "framer-motion";
import { Button } from "./ui/button";
import { liveScoreRanking } from "../lib/scoreReveal";

export default function ScoreReveal({ reveal, contestants, judges = [], onNext, onRevealAll }) {
  const reduced = useReducedMotion();
  const person = id => contestants.find(c => String(c.id) === String(id));
  const event = reveal.events[reveal.shown - 1];
  const finalist = reveal.finalists[reveal.revealedFinalists - 1];
  useMusicCue(finalist ? "victory" : null, finalist);
  const ranking = liveScoreRanking(reveal);
  const complete = reveal.shown === reveal.events.length;
  return <section className="space-y-4" aria-label="Notas del jurado">
    <div className="grid gap-4 md:grid-cols-[minmax(180px,1fr)_minmax(0,1.3fr)]">
      <div>
        <h3 className="mb-2 font-semibold">Clasificación en directo</h3>
        <table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Concursante</th><th>Suma</th></tr></thead>
          <tbody>{ranking.map((row, i) => <Motion.tr layout={!reduced} key={row.id} className={reveal.shown === 0 ? "bg-gray-50" : i < 3 ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}>
            <td className="p-2">{i + 1}. {person(row.id)?.name}</td><td className="p-2 text-center font-bold">{row.total.toFixed(1)}</td>
          </Motion.tr>)}</tbody>
        </table>
        <p className="mt-2 text-xs text-gray-500">{complete ? "Puntuaciones completas" : "Clasificación provisional"}. Verde: tres primeros. Rojo: resto de concursantes.</p>
      </div>
      <div aria-live="polite" className="flex min-h-80 flex-col items-center justify-center overflow-hidden rounded-xl border bg-white p-2 sm:p-5 text-center">
        {finalist ? <Motion.div key={`finalist-${finalist}`} initial={{ opacity: 0, x: reduced ? 0 : 50 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <p className="text-lg font-semibold text-green-700">{reveal.revealedFinalists}.º finalista por el jurado</p>
          <img src={person(finalist)?.photo || "/ot_photos/sinfoto.gif"} alt={person(finalist)?.name} className="mx-auto h-[62px] w-[62px] rounded-xl object-cover" />
          <p className="text-xl font-bold">{person(finalist)?.name}</p><p>¡Cruza la pasarela!</p>
        </Motion.div> : event ? <Motion.div key={reveal.shown} initial={{ opacity: 0, y: reduced ? 0 : 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <h3 className="text-xl font-semibold"><StaffBadge name={judges[event.judge] || `Juez ${event.judge + 1}`} /></h3>
          <img src={person(event.id)?.photo || "/ot_photos/sinfoto.gif"} alt={person(event.id)?.name} className="mx-auto h-[62px] w-[62px] rounded-xl object-cover" />
          <p className="font-semibold">{person(event.id)?.name}</p><p className="text-5xl font-bold">{event.score.toFixed(1)}</p>
        </Motion.div> : <p>El jurado va a dar sus notas.</p>}
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button onClick={onNext}>{!complete ? "Revelar siguiente nota" : reveal.revealedFinalists < 3 ? "Revelar siguiente finalista" : "Continuar al resumen"}</Button>
      <Button variant="outline" onClick={onRevealAll}>Revelar todo</Button>
    </div>
  </section>;
}
