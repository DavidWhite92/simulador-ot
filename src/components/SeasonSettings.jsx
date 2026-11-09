import { useState } from "react";
import { Settings, X } from "lucide-react";

export default function SeasonSettings({ repechageOption, setRepechageOption, manual, setManual, mode, onModeChange, started, popularityEnabled, setPopularityEnabled, relationshipsEnabled, setRelationshipsEnabled }) {
  const [open, setOpen] = useState(false);
  return (
    <aside className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <section id="season-settings" aria-label="Personalizar temporada" className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl border bg-white p-5 shadow-xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Personalizar temporada</h2>
            <button aria-label="Cerrar configuración" onClick={() => setOpen(false)}><X size={20} /></button>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            Modo manual {manual ? "ON" : "OFF"}
            <input type="checkbox" className="h-5 w-5 accent-black" checked={manual} onChange={e => setManual(e.target.checked)} />
          </label>
          <p className="mb-5 mt-2 text-xs text-gray-500">Puedes activarlo o desactivarlo durante la temporada.</p>
          <label className="mb-5 flex items-center justify-between gap-3 text-sm">
            Popularidad {popularityEnabled ? 'ON' : 'OFF'}
            <input type="checkbox" className="h-5 w-5 accent-black" checked={popularityEnabled} onChange={e => setPopularityEnabled(e.target.checked)} />
          </label>
          <label className="block text-sm font-medium">
            <span className="mb-5 flex items-center justify-between gap-3">
              Relaciones {relationshipsEnabled ? 'ON' : 'OFF'}
              <input type="checkbox" className="h-5 w-5 accent-black" checked={relationshipsEnabled} onChange={e => setRelationshipsEnabled(e.target.checked)} />
            </span>
          </label>
          <label className="block text-sm font-medium">
            Repesca
            <select value={repechageOption} disabled={started} onChange={e=>setRepechageOption(e.target.value)} className="mb-4 mt-2 w-full rounded-lg border bg-white p-2 disabled:bg-gray-100">
              <option value="off">Desactivada</option><option value="on">Activada · Gala 8</option><option value="random">Aleatoria · 50 % de probabilidad</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Formato de la temporada
            <select value={mode} disabled={started} onChange={e => onModeChange(e.target.value)} className="mt-2 w-full rounded-lg border bg-white p-2 disabled:bg-gray-100 disabled:text-gray-500">
              <option value="telecinco">Telecinco (2005–2011)</option>
              <option value="rtve">TVE (2017–2020)</option>
            </select>
          </label>
          <p className="mt-2 text-xs text-gray-500">{started ? "El formato está bloqueado durante esta temporada." : "Elige el formato antes de iniciar; no podrás cambiarlo durante la temporada."}</p>
        </section>
      )}
      <button type="button" aria-label="Personalizar temporada" aria-expanded={open} aria-controls="season-settings" title="Personalizar temporada" onClick={() => setOpen(v => !v)} className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-lg hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        <Settings size={24} />
      </button>
    </aside>
  );
}
