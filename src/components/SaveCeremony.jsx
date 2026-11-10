import { useMusicCue } from "../lib/audio";
import { motion as Motion, useReducedMotion } from "framer-motion";
import { Button } from "./ui/button";

export default function SaveCeremony({ ceremony, contestants, winnerId, onNext, onContinue, onRevealAll }) {
  const reduced = useReducedMotion();
  const { kind, phase, ids, votes = [], voters = [] } = ceremony;
  useMusicCue(phase === "result" ? "victory" : null, `${kind}-${winnerId}`);
  const person = id => contestants.find(c => String(c.id) === String(id));
  const photo = (id, large = false) => <img src={person(id)?.photo || "/ot_photos/sinfoto.gif"} alt={person(id)?.name || ""} className={`${large ? "h-[62px] w-[62px]" : "h-14 w-14"} rounded-xl object-cover`} />;
  const last = votes.at(-1);
  const boardVisible = phase === "board";
  const voterId = boardVisible ? last?.voterId : voters[votes.length];
  const winner = person(winnerId);
  const title = kind === "duel" ? "Llega el momento de la verdad" : kind === "teachers" ? "Los profesores han tomado una decisión…" : "Votación de los compañeros";
  const votesDone = votes.length === voters.length;
  const counts = Object.fromEntries(ids.map(id => [id, votes.filter(v => v.votedId === id).length]));
  const maxVotes = Math.max(...Object.values(counts));
  const tied = votesDone && kind === "peers" ? ids.filter(id => counts[id] === maxVotes) : [];
  const displayedCounts = phase === "result" && ceremony.tie?.counts ? ceremony.tie.counts : counts;
  const label = phase === "result" ? "Continuar" : kind === "duel"
    ? phase === "intro" ? "Escuchar al presentador" : phase === "phrase" ? "Revelar porcentaje" : "Revelar salvado"
    : kind === "teachers" ? "Revelar salvado por los profesores" : votesDone ? "Revelar salvado por los compañeros" : boardVisible ? "Revelar siguiente voto" : "Revelar pizarra";
  return (
    <section aria-live="polite" aria-label={title} className="overflow-hidden rounded-xl border bg-white p-2 sm:p-5 text-center">
      <h3 className="mb-5 text-lg font-semibold">{title}</h3>
      <div className="grid gap-2" style={{gridTemplateColumns:`repeat(${ids.length},minmax(0,1fr))`}}>
        {ids.map(id => <Motion.div key={id} initial={{ opacity: 0, y: reduced ? 0 : 25 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col items-center gap-2">
          {photo(id)}<span className="w-full break-words text-xs font-medium sm:text-sm">{person(id)?.name}</span>
          {kind === "peers" && <strong className="text-xl">{displayedCounts[id]} votos</strong>}
        </Motion.div>)}
      </div>
      <div className="my-5 flex min-h-44 flex-col items-center justify-center gap-4">
        {kind === "duel" && phase !== "intro" && <p className="italic">La audiencia ha decidido que debe proseguir su formación en la academia con un…</p>}
        {kind === "duel" && ["percentage", "result"].includes(phase) && <Motion.p key="percentage" initial={{ opacity: 0, scale: reduced ? 1 : 0.7 }} animate={{ opacity: 1, scale: 1 }} className="text-4xl font-bold">{ceremony.pct.toFixed(2)}%</Motion.p>}
        {kind === "peers" && phase !== "result" && voterId && <Motion.div key={voterId} initial={{ opacity: 0, x: reduced ? 0 : 35 }} animate={{ opacity: 1, x: 0 }} className="flex w-full flex-col items-center gap-3">
          {photo(voterId)}<p><strong>{person(voterId)?.name}</strong> salva a…</p>
          <div style={{width:90,height:60,perspective:500}}>
            <Motion.div initial={false} animate={{rotateY:boardVisible ? 180 : 0}}
              transition={{duration:reduced ? 0 : 0.65,ease:'easeInOut'}}
              style={{width:90,height:60,position:'relative',transformStyle:'preserve-3d'}}
              aria-label={boardVisible ? `Pizarra: ${person(last.votedId)?.name}` : 'Pizarra pendiente de revelar'}>
              <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center rounded border-4 border-amber-900 bg-black text-xs text-white/60 shadow-md" style={{backfaceVisibility:'hidden'}}>Por revelar</div>
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded border-4 border-amber-900 bg-black p-1 text-center text-white shadow-md" style={{backfaceVisibility:'hidden',transform:'rotateY(180deg)'}}>
                {boardVisible && <span style={{fontFamily:'"Comic Sans MS", "Segoe Print", cursive',fontSize:(person(last.votedId)?.name?.length || 0)>20 ? 9 : 12,lineHeight:1.1,overflowWrap:'anywhere'}}>{person(last.votedId)?.name}</span>}
              </div>
            </Motion.div>
          </div>
        </Motion.div>}
        {phase === "result" && winner && <Motion.div key="winner" initial={{ opacity: 0, scale: reduced ? 1 : 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3 rounded-xl bg-emerald-50 p-4">
          {photo(winnerId, true)}<p className="text-xl font-bold text-emerald-800">{winner.name}</p><p>¡Se salva!</p>
        </Motion.div>}
        {kind === "peers" && tied.length > 1 && phase !== "result" && <p className="rounded-xl bg-amber-50 p-3 font-medium text-amber-900">Empate a {maxVotes} votos entre {tied.map(id => person(id)?.name).join(", ")}. Vamos a resolver el desempate.</p>}
        {kind === "peers" && phase === "result" && ceremony.tie && <Motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-amber-50 p-3 text-amber-900">{ceremony.tie.message}</Motion.p>}
        {kind === "peers" && <p className="text-sm text-gray-500">Votos revelados: {votes.length} / {voters.length}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={phase === "result" ? onContinue : onNext}>{label}</Button>
        {kind === "peers" && <Button variant="outline" onClick={onRevealAll}>Revelar todo</Button>}
      </div>
    </section>
  );
}
