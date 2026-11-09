import { displayGala } from "../lib/seasonSchedule";
import TablePerson from "./TablePerson";
import { sortByPopularity } from "../lib/academy";
import { popularityCellStyle, popularityMarker } from "../lib/popularityStyle";

export default function PopularityTable({ contestants, summaries, repechageEnabled=true }) {
  const galas = Object.keys(summaries).map(Number).filter(Number.isFinite).sort((a,b) => a-b);
  return <div className="space-y-3"><p className="text-sm">Azul: favorito · Turquesa: top 3 · Verde: salvado por profesores · Amarillo: salvado por compañeros · Naranja: nominado final · Rojo: eliminado · º: top 3 y nominado.</p>
    <div className="overflow-x-auto"><table id="popularidad-capture" className="w-full border-collapse text-center text-sm"><thead><tr><th colSpan={2} className="border px-2 py-0">Concursante</th><th className="border px-2 py-0">Inicio</th>{galas.map(g => <th className="border px-2 py-0 whitespace-nowrap" key={g}>Gala {displayGala(g,repechageEnabled)}</th>)}</tr></thead><tbody>
      {sortByPopularity(contestants).map(c => <tr key={c.id}><TablePerson person={c} /><td className="border px-2 py-0">50</td>{galas.map(g => <td key={g} className="border px-2 py-0" style={popularityCellStyle(c, summaries[g], g)}>{summaries[g]?.popularity?.[c.id] ?? '—'}{popularityMarker(c, summaries[g])}</td>)}</tr>)}
    </tbody></table></div></div>;
}
