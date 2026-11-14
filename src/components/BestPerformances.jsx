import {bestPerformances} from '../lib/bestPerformances';
import {displayGala} from '../lib/seasonSchedule';

export default function BestPerformances({weeks,summaries,contestants,repechageEnabled}) {
  const ranking=bestPerformances(weeks,summaries);
  return <div id="actuaciones-capture" className="space-y-3 bg-white p-2">
    <p className="text-sm text-gray-600">Actuaciones increíbles, seguidas de las muy buenas. En dúos y tríos se utiliza la nota media de sus integrantes.</p>
    {!ranking.length ? <p>No hubo actuaciones increíbles ni muy buenas en esta edición.</p> : <ol className="space-y-3">{ranking.map((entry,i)=><li key={entry.key} className="rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{i+1}. {entry.song}</h3><span className="text-sm">Gala {displayGala(entry.gala,repechageEnabled)}{entry.repechage?' · Repesca':entry.duel?' · Duelo':''}</span></div>
      <div className="my-2 flex flex-wrap gap-3">{entry.members.map(member=>{const person=contestants.find(c=>c.id===member.id);return <div key={member.id} className="flex items-center gap-2"><img src={person?.photo || '/ot_photos/sinfoto.gif'} alt="" width={31} height={31} className="h-[31px] w-[31px] rounded object-cover" /><span className="text-sm">{person?.name || member.id}</span></div>;})}</div>
      <p className="font-semibold text-green-700">{entry.quality==='increíble'?'Increíble':'Muy buena'} · {entry.score.toFixed(2)} / 10</p>
      <p className="mt-1 text-sm">{entry.group || entry.members[0]?.detail}</p>
    </li>)}</ol>}
  </div>;
}
