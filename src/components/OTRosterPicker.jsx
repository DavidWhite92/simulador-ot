// ======================= IMPORTS =======================
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

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
    photo: p.photo ?? "/ot_photos/default.jpg",
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
const LS_KEY = "ot_custom_contestants";

const loadCustoms = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const saveCustom = (entry) => {
  const all = loadCustoms();
  all.push(entry);
  localStorage.setItem(LS_KEY, JSON.stringify(all));
};

// Helpers extra para editar o borrar customs
const saveCustoms = (arr) => localStorage.setItem(LS_KEY, JSON.stringify(arr));

const upsertCustom = (entry) => {
  const arr = loadCustoms().filter((c) => c.id !== entry.id);
  arr.push(entry);
  saveCustoms(arr);
};

const removeCustomLS = (id) => {
  const arr = loadCustoms().filter((c) => c.id !== id);
  saveCustoms(arr);
};

const clamp15 = (n) => Math.max(0, Math.min(15, Number(n) || 0));

// ======================= COMPONENTE ====================
export default function OTRosterPicker({
  max = 18,
  onImport,
  onCancel,
  title = "Elige concursantes de OT",
}) {
  const [pool, setPool] = useState([]); // catálogo del JSON + customs
  const [sel, setSel] = useState([]); // ids seleccionados
  const [q, setQ] = useState(""); // búsqueda

  // Creador custom
  const [showCreator, setShowCreator] = useState(false);
  const [form, setForm] = useState({
    name: "",
    photo: "",
    gender: "n",
    stats: { afinacion: 0, baile: 0, presencia: 0, emocion: 0 },
  });
  const [error, setError] = useState("");
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
        const customs = loadCustoms();
        const prepared = [
          ...(raw || []).map(withDefaults),
          ...customs.map((c, i) =>
            withDefaults({ ...c, edition: "Custom", isCustom: true }, 10000 + i)
          ),
        ];
        setPool(prepared);
      } catch {
        // si falla el fetch, al menos carga los customs
        const customs = loadCustoms().map((c, i) =>
          withDefaults({ ...c, edition: "Custom", isCustom: true }, i)
        );
        setPool(customs);
      }
    };
    run();
  }, []);

  // Índices útiles
  const byId = useMemo(() => new Map(pool.map((p) => [String(p.id), p])), [pool]);

  // Selección
  const toggle = (id) => {
    const key = String(id);
    setSel((s) =>
      s.includes(key) ? s.filter((x) => x !== key) : s.length < max ? [...s, key] : s
    );
  };

  const selected = useMemo(
    () => sel.map((id) => byId.get(String(id))).filter(Boolean),
    [sel, byId]
  );

  // --- Selección aleatoria ---
  const handleRandomPick = () => {
    if (sel.length >= max) return; // ya estás al tope
    const available = pool.filter((p) => !sel.includes(String(p.id)));
    if (available.length === 0) return; // no quedan libres
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
  const updateForm = (patch) => setForm((f) => ({ ...f, ...patch }));
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

    const handleDelete = (id) => {
    if (!confirm("¿Seguro que quieres borrar este concursante custom?")) return;
    removeCustomLS(id);
    setPool((prev) => prev.filter((x) => x.id !== id));
    setSel((s) => s.filter((x) => x !== String(id)));
    if (editingId === id) {
      setEditingId(null);
      setShowCreator(false);
    }
  };

    const validateAndSave = () => {
      setError("");
      const name = form.name.trim();
      const photo = form.photo.trim();
      if (!name) return setError("Pon un nombre.");
      if (!/(https?:\/\/|\/).+\.(png|gif|jpe?g)$/i.test(photo))
        return setError("La foto debe ser un enlace que acabe en .png, .jpg, .jpeg o .gif.");

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
      if (editingId) {
        // EDITAR
        entry = { ...base, id: editingId };
        upsertCustom(entry);
        setPool((p) =>
          p.map((c) => (c.id === editingId ? withDefaults(entry, 0) : c))
        );
      } else {
        // NUEVO
        const id = `custom-${slugify(name)}-${Date.now()}`;
        entry = { ...base, id };
        saveCustom(entry);
        setPool((p) => [...p, withDefaults(entry, p.length + 1)]);
      }

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
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* CABECERA */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm opacity-70">
            Seleccionados: <b>{sel.length}</b> / {max}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={onCancel}>← Volver</Button>
          <Button onClick={() => onImport?.(selected)} disabled={sel.length === 0}>
            Usar estos {sel.length}/{max}
          </Button>
          <Button variant="secondary" onClick={() => setShowCreator((v) => !v)}>
            {showCreator ? "Cerrar creador" : "Crea tu concursante de OT"}
          </Button>
        </div>
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
                  Foto (URL terminada en .png, .jpg, .jpeg o .gif)
                </label>
                <input
                  value={form.photo}
                  onChange={(e) => updateForm({ photo: e.target.value })}
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  placeholder="https://.../mi-foto.png"
                />

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
                      !!error ||
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
                <label className="block text-sm font-medium">Estadísticas (0–15)</label>

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

    {/* BUSCADOR */}
    <div className="space-y-3">
      {/* Input + botón "Elige al azar" */}
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar concursantes… (ej: David, Verónica, Sandra)"
          className="flex-1 h-10 rounded-md border px-3 text-sm bg-white"
        />
        <Button type="button" onClick={handleRandomPick}>
          Elige al azar
        </Button>
      </div>

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
                            className="w-[70px] h-[70px] object-cover rounded-md mb-1"
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
                      <button
                        type="button"
                        onClick={() => toggle(p.id)}
                        className={`w-full text-left cursor-pointer block focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          active ? "ring-2 ring-primary" : ""
                        }`}
                        title={p.name}
                      >
                        <CardContent className="p-2 text-center">
                          <div className="flex flex-col items-center">
                            <img
                              src={p.photo}
                              alt={p.name}
                              className="w-[62px] h-[62px] object-cover rounded-md mb-1"
                            />
                            <div className="text-sm font-medium truncate">{p.name}</div>
                            {active && <Badge className="mt-1">✓</Badge>}
                          </div>
                        </CardContent>

                        {/* ✅ Botones Editar / Borrar (solo visibles si es Custom) */}
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
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
