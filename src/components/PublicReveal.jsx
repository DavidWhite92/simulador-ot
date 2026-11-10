import { useMusicCue } from "../lib/audio";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "./ui/button";

export default function PublicReveal({ reveal, contestants, manual, duelResult, onSelect, onNext }) {
  const reduced = useReducedMotion();
  const { entries, screen, kind, phase, visible, targets, cursor, selectedId } = reveal;
  const target = targets[cursor];
  const row = entries[target];
  useMusicCue(screen === "duelResult" ? "victory" : screen === "revealed" ? (kind === "duel" ? target >= entries.length-2 : phase === 1 ? target >= 3 : false) ? "nominee" : "victory" : null, `${kind}-${phase}-${cursor}-${row?.id}`);
  const person = id => contestants.find(c => String(c.id) === String(id));
  const duelists = entries.slice(-2);
  const options = screen === "duel" ? duelists : entries.filter((_, index) => !visible.includes(index));
  const choosing = manual && ["announce", "duel"].includes(screen);
  const winner = duelResult && person(duelResult.winner);
  const photo = id => <img src={person(id)?.photo || "/ot_photos/sinfoto.gif"} alt={person(id)?.name || ""} className="mx-auto h-[62px] w-[62px] rounded-xl object-cover" />;
  return <section className="space-y-4" aria-label={kind === "duel" ? "Porcentajes y duelo" : "Final"}>
    <div className="grid gap-4 md:grid-cols-[minmax(180px,1fr)_minmax(0,1.3fr)]">
      <div>
        <h3 className="mb-3 font-semibold">{kind === "final" ? `Ranking de la final${phase === 1 ? " · Fase 1" : " · Top 3"}` : "Porcentajes del público"}</h3>
        <table className="w-full text-sm"><thead><tr><th>Puesto</th><th>Concursante</th><th>%</th></tr></thead>
          <tbody>{entries.map((entry, index) => <tr key={index} className={kind === "final" && phase === 1 && index >= 3 ? "bg-red-100 text-red-900" : "bg-gray-50"}>
            <td className="p-2 text-center">{index + 1}º</td><td className="p-2">{visible.includes(index) ? person(entry.id)?.name : "Por revelar"}</td><td className="p-2 text-center font-bold">{entry.pct.toFixed(2)}%</td>
          </tr>)}</tbody>
        </table>
        {kind === "final" && phase === 1 && <p className="mt-2 text-xs text-red-700">El cuarto y el quinto no pasan a la fase 2.</p>}
      </div>
      <div aria-live="polite" className="flex min-h-80 flex-col items-center justify-center overflow-hidden rounded-xl border bg-white p-2 sm:p-5 text-center">
        <motion.div key={`${screen}-${cursor}`} initial={{ opacity: 0, y: reduced ? 0 : 20 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-4">
          {screen === "announce" && <><p>{kind === "duel" ? "Vamos a revelar el" : target === 0 ? "La audiencia ha decidido que el ganador o ganadora, con un…" : `Vamos a revelar el ${target + 1}.º puesto, con un…`}</p><p className="text-4xl font-bold">{row.pct.toFixed(2)}%</p></>}
          {screen === "revealed" && <>{photo(row.id)}<p className="text-xl font-bold">{person(row.id)?.name}</p><p className="text-3xl font-bold">{row.pct.toFixed(2)}%</p>{kind === "final" && <p>{target === 0 ? "¡Ganador/a del simulador!" : `${target + 1}.º finalista`}</p>}</>}
          {screen === "duel" && <><p className="font-semibold">Llega el duelo</p><div className="flex flex-wrap justify-center gap-4">{duelists.map(entry => <div key={entry.id}>{photo(entry.id)}<p className="mt-2 font-semibold">{person(entry.id)?.name}</p></div>)}</div></>}
          {screen === "duelResult" && winner && <>{photo(winner.id)}<p className="text-xl font-bold">{winner.name} gana el duelo</p><p className="text-4xl font-bold">{duelResult.pctWin.toFixed(2)}%</p></>}
        </motion.div>
      </div>
    </div>
    {choosing && <label className="block text-sm font-medium">{screen === "duel" ? "Elige quién gana el duelo" : "Elige a quién pertenece este porcentaje"}
      <select value={selectedId} onChange={e => onSelect(e.target.value)} className="mt-2 block w-full rounded-lg border bg-white p-2">
        <option value="">Selecciona un concursante…</option>{options.map(entry => <option key={entry.id} value={entry.id}>{person(entry.id)?.name}</option>)}
      </select>
    </label>}
    <Button disabled={choosing && !selectedId} className="disabled:opacity-40" onClick={onNext}>{screen === "announce" ? "Revelar" : screen === "duel" ? "Revelar ganador del duelo" : screen === "revealed" && cursor === targets.length - 1 ? kind === "duel" ? "Pasar al duelo" : phase === 1 ? "Pasar a la fase 2" : "Ver resumen final" : screen === "duelResult" ? "Ver resumen de la gala" : "Siguiente porcentaje"}</Button>
  </section>;
}
