import { displayGala } from "../lib/seasonSchedule";
import TablePerson from "./TablePerson";
import { useState } from 'react';
import { relationshipOf, relationshipColor, isPair } from '../lib/relationships';

export default function RelationshipsTable({contestants,summaries,relations,pairs=[],repechageEnabled=true}) {
  const [selected,setSelected]=useState(contestants[0]?.id || '');
  const galas=Object.keys(summaries).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  const others=contestants.filter(c=>c.id!==selected).sort((a,b)=>relationshipOf(relations,selected,b.id)-relationshipOf(relations,selected,a.id));
  const cell=(value,key,couple=false)=><td key={key} className="border px-2 py-0" title={couple ? 'Pareja sentimental' : undefined} style={{backgroundColor:relationshipColor(value,couple)}}>{value ?? '—'}</td>;
  return <div className="space-y-4">
    <label className="block text-sm font-medium">Concursante
      <select value={selected} onChange={e=>setSelected(e.target.value)} className="ml-3 rounded-lg border px-2 py-0">{contestants.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
    </label>
    <div className="overflow-x-auto"><table id="relaciones-capture" className="w-full border-collapse text-center text-sm"><caption className="bg-white text-left font-semibold">Relaciones de {contestants.find(c=>c.id===selected)?.name}</caption><thead><tr><th colSpan={2} className="border px-2 py-0">Relación con</th><th className="border px-2 py-0">Inicio</th>{galas.map(g=><th key={g} className="whitespace-nowrap border px-2 py-0">Gala {displayGala(g,repechageEnabled)}</th>)}<th className="border px-2 py-0">Final</th></tr></thead>
      <tbody>{others.map(c=><tr key={c.id}><TablePerson person={c} />{cell(50,'base')}{galas.map(g=>cell(summaries[g]?.relationships ? relationshipOf(summaries[g].relationships,selected,c.id) : null,g,isPair(summaries[g]?.pairs,selected,c.id)))}{cell(relationshipOf(relations,selected,c.id),'end',isPair(pairs,selected,c.id))}</tr>)}</tbody>
    </table></div>
  </div>;
}
