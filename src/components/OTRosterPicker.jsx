import {loadCustomLibrary,saveCustomLibrary} from "../lib/customLibrary";
// ======================= IMPORTS =======================
import React, { useEffect, useMemo, useState, useRef } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { readCustomPhoto } from "../lib/customPhoto";
import { Filter } from 'lucide-react';
import { randomRosterCandidates } from '../lib/rosterRandom';

// ======================= UTILS ========================
const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

const deriveEdition = (p) => {
  if (p.edition) return String(p.edition).toUpperCase();
  const m = String(p.photo || "").match(/\/(OT\d{4})\//i);
  return m ? m[1].toUpperCase() : "OT?";
};

const withDefaults = (p, idx) => {
  const id = String(p.id ?? p.slug ?? slugify(p.name) ?? `c${idx}`);
  return {
    id,
    name: p.name ?? `Concursante ${idx + 1}`,
    gender: p.gender ?? "n", // m/f/n
    photo: p.photo ?? "/ot_photos/sinfoto.gif",
    edition: deriveEdition(p),
    stats: {
      afinacion: 0,
      baile: 0,
      presencia: 0,
      emocion: 0,
      ...(p.stats || {}),
    },
    isCustom: Boolean(p.isCustom),
  };
};

// ======== PERSISTENCIA LOCAL (localStorage) ==========
const loadCustoms = loadCustomLibrary;
const saveCustom = async entry => saveCustomLibrary([...(await loadCustoms()),entry]);
const upsertCustom = async entry => saveCustomLibrary([...(await loadCustoms()).filter(c=>c.id!==entry.id),entry]);
const removeCustomLS = async id => saveCustomLibrary((await loadCustoms()).filter(c=>c.id!==id));

const clamp15 = (n) => Math.max(0, Math.min(15, Number(n) || 0));

// ======================= COMPONENTE ====================
export default function OTRosterPicker({
  max = 18,
  roster,
  onChange,
  onStart,
  title = "Elige concursantes de OT",
}) {
  const [pool, setPool] = useState([]); // catálogo del JSON + customs
  const sel = roster.map(p => String(p.id));
  const setSel = (update) => {
    const ids = typeof update === "function" ? update(sel) : update;
    onChange(ids.map(id => pool.find(p => String(p.id) === id) || roster.find(p => String(p.id) === id)).filter(Boolean));
  };
  const [q, setQ] = useState(""); // búsqueda
  const [showRandomFilter,setShowRandomFilter] = useState(false);
  const [excludedEditions,setExcludedEditions] = useState(()=>{
    try {const saved=JSON.parse(localStorage.getItem('ot_random_excluded_editions') || '[]');return Array.isArray(saved)?saved:[];} catch {return [];}
  });
  const [randomMessage,setRandomMessage] = useState('');
  function toggleRandomEdition(edition) {
    const next=excludedEditions.includes(edition)?excludedEditions.filter(e=>e!==edition):[...excludedEditions,edition];
    setExcludedEditions(next);setRandomMessage('');
    try {localStorage.setItem('ot_random_excluded_editions',JSON.stringify(next));} catch { /* Keep the filter for this session. */ }
  }

  // Creador custom
  const [showCreator, setShowCreator] = useState(false);
  const [form, setForm] = useState({
    name: "",
    photo: "",
    gender: "n",
    stats: { afinacion: 0, baile: 0, presencia: 0, emocion: 0 },
  });
  const [error, setError] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [customSaving,setCustomSaving]=useState(false);
  const customSaveBusy=useRef(false);
  const [editingId, setEditingId] = useState(null);


      // errores por stat (clave -> mensaje)
    const [statErrors, setStatErrors] = useState({});
    const updateStat = (k, v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return;

      if (n < 0 || n > 15) {
        // mostramos error si se intenta salir del rango
        setStatErrors((e) => ({ ...e, [k]: "El valor debe estar entre 0 y 15." }));
      } else {
        // limpiamos el error si el valor vuelve al rango
        setStatErrors((e) => ({ ...e, [k]: "" }));
      }

      // siempre guardamos el valor CLAMPED para que nunca quede fuera de 0–15
      setForm((f) => ({
        ...f,
        stats: { ...f.stats, [k]: clamp15(n) },
      }));
    };


  // Carga catálogo + customs al iniciar
  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch("/ot_contestants.json");
        const raw = await r.json();
        const customs = await loadCustoms();
        const prepared = [
          ...(raw || []).map(withDefaults),
          ...customs.map((c, i) =>
            withDefaults({ ...c, edition: "Custom", isCustom: true }, 10000 + i)
          ),
        ];
        setPool(prepared);
      } catch {
        // si falla el fetch, al menos carga los customs
        const customs = (await loadCustoms().catch(()=>[])).map((c, i) =>
          withDefaults({ ...c, edition: "Custom", isCustom: true }, i)
        );
        setPool(customs);
      }
    };
    run();
  }, []);

  // Índices útiles


  // Selección
  const toggle = (id) => {
    const key = String(id);
    setSel((s) =>
      s.includes(key) ? s.filter((x) => x !== key) : s.length < max ? [...s, key] : s
    );
  };

  const selected = roster;

  // --- Selección aleatoria ---
  const handleRandomPick = () => {
    if (sel.length >= max) return; // ya estás al tope
    const available = randomRosterCandidates(pool,sel,excludedEditions);
    if (available.length === 0) {setRandomMessage('No quedan concursantes disponibles en las temporadas activadas.');return;}
    setRandomMessage('');
    const pick = available[Math.floor(Math.random() * available.length)];
    toggle(pick.id);
  };

  // Búsqueda (coincidencias parciales y sin tildes)
  const nQ = norm(q);
  const matches = useMemo(() => {
    if (!nQ) return [];
    return pool.filter((p) => {
      const n = norm(p.name);
      if (n.includes(nQ)) return true; // coincidencia en cualquier parte
      return n.split(/\s+/).some((tok) => tok.startsWith(nQ)); // prefijo
    });
  }, [nQ, pool]);

  // Agrupar por edición (OT2001, OT2002, ..., Custom)
  const editions = useMemo(() => {
    const map = new Map();
    for (const p of pool) {
      const ed = p.isCustom ? "Custom" : p.edition || "OT?";
      if (!map.has(ed)) map.set(ed, []);
      map.get(ed).push(p);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === "Custom") return 1; // que Custom quede al final
      if (b === "Custom") return -1;
      const na = +(a.replace(/\D/g, ""));
      const nb = +(b.replace(/\D/g, ""));
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    return { keys, map };
  }, [pool]);

  // ======== CREACIÓN CUSTOM =========
  const updateForm = (patch) => {
    setError("");
    setForm((f) => ({ ...f, ...patch }));
  };
  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setPhotoLoading(true);
    try {
      const photo = await readCustomPhoto(file);
      setForm(f => ({ ...f, photo }));
    } catch (err) {
      setError(err.message);
    } finally {
      setPhotoLoading(false);
    }
  };
  const randomizeStats = () => {
    setStatErrors({});
    setForm(f => ({ ...f, stats: Object.fromEntries(
      Object.keys(f.stats).map(key => [key, Math.floor(Math.random() * 16)])
    ) }));
  };
  //const updateStat = (k, v) =>
  //  setForm((f) => ({
   //   ...f,
   //   stats: { ...f.stats, [k]: clamp15(v) },
   // }));

    const startEdit = (p) => {
    setShowCreator(true);
    setEditingId(p.id);
    setError("");
    setStatErrors({});
    setForm({
      name: p.name || "",
      photo: p.photo || "",
      gender: p.gender || "n",
      stats: {
        afinacion: p?.stats?.afinacion ?? 0,
        baile:     p?.stats?.baile ?? 0,
        presencia: p?.stats?.presencia ?? 0,
        emocion:   p?.stats?.emocion ?? 0,
      },
    });
  };

    const handleDelete = async (id) => {
    if (!confirm("¿Seguro que quieres borrar este concursante custom?")) return;
    try {await removeCustomLS(id);} catch {setError("No se pudo borrar el concursante. Se ha conservado sin cambios.");return;}
    setPool((prev) => prev.filter((x) => x.id !== id));
    setSel((s) => s.filter((x) => x !== String(id)));
    if (editingId === id) {
      setEditingId(null);
      setShowCreator(false);
    }
  };

    const validateAndSave = async () => {
      if(customSaveBusy.current)return;
      setError("");
      const name = form.name.trim();
      const photoInput = form.photo.trim();
      const photo = photoInput === "" ? "/ot_photos/sinfoto.gif" : photoInput;
      if (!name) return setError("Pon un nombre.");
      if (photoLoading) return;
      if (photoInput && !/^(https?:\/\/|\/(?!\/)|data:image\/(webp|png|jpeg);base64,)/i.test(photoInput))
        return setError("Introduce un enlace de imagen válido o sube una imagen desde tu dispositivo.");

      const base = {
        name,
        gender: form.gender || "n",
        photo,
        edition: "Custom",
        stats: {
          afinacion: clamp15(form.stats.afinacion),
          baile:     clamp15(form.stats.baile),
          presencia: clamp15(form.stats.presencia),
          emocion:   clamp15(form.stats.emocion),
        },
        isCustom: true,
      };

      let entry;
      customSaveBusy.current=true;setCustomSaving(true);
      try {
      if (editingId) {
        // EDITAR
        entry = { ...base, id: editingId };
        await upsertCustom(entry);
        onChange(roster.map(p => p.id === entry.id ? withDefaults(entry, 0) : p));
        setPool((p) =>
          p.map((c) => (c.id === editingId ? withDefaults(entry, 0) : c))
        );
      } else {
        // NUEVO
        const id = `custom-${slugify(name)}-${Date.now()}`;
        entry = { ...base, id };
        await saveCustom(entry);
        setPool((p) => [...p, withDefaults(entry, p.length + 1)]);
      }

      } catch {
        return setError("No se pudo guardar: el almacenamiento del navegador está lleno o no está disponible. Tus concursantes anteriores se conservan. Descarga una copia de tu temporada antes de cerrar.");
      } finally {customSaveBusy.current=false;setCustomSaving(false);}
      setShowCreator(false);
      setEditingId(null);
      setForm({
        name: "",
        photo: "",
        gender: "n",
        stats: { afinacion: 0, baile: 0, presencia: 0, emocion: 0 },
      });
    };


  // ======================== UI =========================
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {/* CABECERA */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm opacity-70">
            Seleccionados: <b>{sel.length}</b> / {max}
          </p>
        </div>
      </div>

    {/* BUSCADOR */}
    <div className="space-y-3">
      {/* Input + botón "Elige al azar" */}
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          id="roster-search"
          aria-label="Buscar concursantes"
          placeholder="Buscar concursantes… (ej: David, Verónica, Sandra)"
          className="min-w-0 flex-1 h-10 rounded-md border px-3 text-sm bg-white"
        />
        <Button type="button" onClick={handleRandomPick}>
          Elige al azar
        </Button>
        <Button type="button" variant="outline" aria-label="Filtrar temporadas para la selección aleatoria" title="Filtrar temporadas" aria-expanded={showRandomFilter} aria-controls="random-season-filter" onClick={()=>setShowRandomFilter(!showRandomFilter)} className={`shrink-0 px-2 ${excludedEditions.length?'bg-blue-100':''}`}><Filter size={18} /></Button>
      </div>
      {showRandomFilter && <fieldset id="random-season-filter" className="rounded-lg border bg-white p-3"><legend className="px-1 font-semibold">Temporadas para elegir al azar</legend><div className="flex flex-wrap gap-x-5 gap-y-2">{editions.keys.map(edition=><label key={edition} className="flex items-center gap-2"><input type="checkbox" checked={!excludedEditions.includes(edition)} onChange={()=>toggleRandomEdition(edition)} />{edition}</label>)}</div></fieldset>}
      {randomMessage && <p role="status" className="text-sm text-amber-800">{randomMessage}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onStart}>▶️ Iniciar</Button>
        <Button variant="outline" onClick={() => onChange([])}>Limpiar lista</Button>
        <span className="text-sm text-gray-600" aria-live="polite">{sel.length} / {max} seleccionados</span>
      </div>
      {selected.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-gray-500">Busca o abre una edición para seleccionar a tus 18 concursantes.</p>}
      {/* Seleccionados (chips con foto) */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="flex items-center gap-2 rounded-md border bg-white px-2 py-1 shadow-sm hover:shadow focus:outline-none"
              title="Quitar de la selección"
            >
              <img
                src={p.photo}
                alt={p.name}
                className="w-7 h-7 object-cover rounded"
              />
              <span className="text-sm">{p.name}</span>
              <Badge>✕</Badge>
            </button>
          ))}
        </div>
      )}

      {/* RESULTADOS DE BÚSQUEDA */}
      {nQ && (
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="mb-2 text-sm font-medium">
            {matches.length > 0 ? `Coincidencias (${matches.length})` : "Sin coincidencias"}
          </div>
          {matches.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {matches.map((p) => {
                const active = sel.includes(String(p.id));
                return (
                  <div key={p.id} className="rounded-lg border bg-white shadow-sm overflow-hidden">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(p.id)}
                      className={`w-full text-left cursor-pointer block focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        active ? "ring-2 ring-primary" : ""
                      }`}
                      title={`${p.name} (${p.isCustom ? "Custom" : p.edition})`}
                    >
                      <CardContent className="p-2 text-center">
                        <div className="flex flex-col items-center">
                          <img
                            src={p.photo}
                            alt={p.name}
                            className="w-[62px] h-[62px] object-cover rounded-md mb-1"
                          />
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          <div className="text-[11px] opacity-70">{p.isCustom ? "Custom" : p.edition}</div>
                          {active && <Badge className="mt-1">✓</Badge>}
                        </div>
                      </CardContent>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>


      {/* LISTA AGRUPADA POR EDICIÓN (acordeón simple con <details>) */}
      <div className="space-y-2">
        {editions.keys.map((ed) => (
          <details key={ed} className="border rounded-lg bg-white/70">
            <summary className="px-4 py-3 cursor-pointer select-none font-medium bg-white">{ed}</summary>
            <div className="px-3 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {editions.map.get(ed).map((p) => {
                  const active = sel.includes(String(p.id));
                  return (
                    <div key={p.id} className="rounded-lg border bg-white shadow-sm overflow-hidden">
                      {/* Botón que selecciona/deselecciona la tarjeta */}
                      <button
                        type="button"
                        aria-pressed={active}
                      onClick={() => toggle(p.id)}
                        className={`w-full text-left cursor-pointer block focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          active ? "ring-2 ring-primary" : ""
                        }`}
                        title={p.name}
                      >
                        <CardContent className="p-2 text-center">
                          <div className="flex flex-col items-center">
                            <img src={p.photo} alt={p.name} className="w-[62px] h-[62px] object-cover rounded-md mb-1" />
                            <div className="text-sm font-medium truncate">{p.name}</div>
                            {active && <Badge className="mt-1">✓</Badge>}
                          </div>
                        </CardContent>
                      </button>

                      {/* Controles fuera del <button> para evitar nesting */}
                      {p.isCustom && (
                        <div className="flex justify-center gap-2 pb-2">
                          <Button
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="destructive"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                          >
                            Borrar
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </details>
        ))}
      </div>
      <div className="border-t pt-5">
        <Button variant="secondary" onClick={() => setShowCreator(v => !v)}>
          {showCreator ? "Cerrar creador" : "Crea tu concursante de OT"}
        </Button>
        <p className="mt-2 text-sm text-gray-600">Personaliza su nombre, foto, género y estadísticas. Lo encontrarás en la categoría Custom.</p>
      </div>
      {/* PANEL DE CREACIÓN CUSTOM */}
      {showCreator && (
        <Card className="border-2">
          <CardContent className="p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Columna izquierda: campos básicos */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  placeholder="Nombre del concursante"
                />

                <label className="block text-sm font-medium">
                  Foto (opcional): enlace de imagen
                </label>
                <input
                  value={form.photo.startsWith("data:") ? "" : form.photo}
                  disabled={photoLoading}
                  onChange={(e) => updateForm({ photo: e.target.value })}
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  placeholder="https://.../mi-foto.png"
                />
                <label className="block text-sm font-medium" htmlFor="custom-photo-file">O subir desde tu dispositivo</label>
                <input id="custom-photo-file" type="file" accept="image/*" onChange={uploadPhoto}
                  disabled={photoLoading} className="block w-full text-sm" aria-describedby="custom-photo-help" />
                <p id="custom-photo-help" className="text-xs text-gray-500">
                  Máximo 5 MB. Puedes elegir cualquier formato de imagen compatible con tu navegador.
                  Se verá mejor si es cuadrada. Se guardará una versión reducida y estática en este navegador.
                </p>
                {photoLoading && <p role="status" className="text-sm">Preparando imagen…</p>}
                {form.photo && (
                  <div className="flex items-center gap-3">
                    <img src={form.photo} alt="Vista previa del concursante" className="h-[62px] w-[62px] rounded-lg object-cover" />
                    <Button variant="outline" disabled={photoLoading} onClick={() => updateForm({ photo: "" })}>Quitar foto</Button>
                  </div>
                )}

                <label className="block text-sm font-medium">Género</label>
                <select
                  value={form.gender}
                  onChange={(e) => updateForm({ gender: e.target.value })}
                  className="w-full h-10 rounded-md border px-3 text-sm bg-white"
                >
                  <option value="n">No especificado</option>
                  <option value="m">Masculino</option>
                  <option value="f">Femenino</option>
                </select>
                {error && <div className="text-red-600 text-sm">{error}</div>}
                <div className="flex gap-2">
                  <Button
                    onClick={validateAndSave}
                    disabled={
                      customSaving || photoLoading ||
                      Object.values(statErrors).some(Boolean)
                    }
                  >
                    {editingId ? "Guardar cambios" : "Guardar"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreator(false);
                      setEditingId(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>

              {/* Columna derecha: stats + preview */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">Estadísticas (0–15)</span>
                  <Button variant="outline" onClick={randomizeStats}>🎲 Random</Button>
                </div>

                {(() => {
                  const STAT_FIELDS = [
                    { key: "afinacion", label: "Afinación" },
                    { key: "baile", label: "Baile" },
                    { key: "presencia", label: "Presencia" },
                    { key: "emocion", label: "Emoción" },
                  ];

                  return STAT_FIELDS.map(({ key, label }) => (
                    <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-3">
                      <div className="text-sm">{label}</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={15}
                          value={form.stats[key]}
                          onChange={(e) => updateStat(key, e.target.value)}
                          aria-label={label}
                        />
                        <input
                          type="number"
                          min={0}
                          max={15}
                          value={form.stats[key]}
                          onChange={(e) => updateStat(key, e.target.value)}
                          className="w-16 h-9 rounded-md border px-2 text-sm"
                          aria-label={label}
                        />
                      </div>
                      {statErrors[key] && (
                        <div className="col-span-2 text-red-600 text-xs mt-1">
                          {statErrors[key]}
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
