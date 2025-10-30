import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toPng } from 'html-to-image';
import OTRosterPicker from "./components/OTRosterPicker";
import LZString from "lz-string";

// ——— helpers para (de)serializar Sets/Maps ———
const replacer = (_k, v) => {
  if (v instanceof Set) return { __type: "Set", data: [...v] };
  if (v instanceof Map) return { __type: "Map", data: [...v] };
  return v;
};
const reviver = (_k, v) => {
  if (v && v.__type === "Set") return new Set(v.data || []);
  if (v && v.__type === "Map") return new Map(v.data || []);
  return v;
};

// Empaqueta -> string compacto seguro para URL
function packState(obj) {
  const json = JSON.stringify(obj, replacer);
  return LZString.compressToEncodedURIComponent(json);
}
// Desempaqueta <- string
function unpackState(code) {
  const json = LZString.decompressFromEncodedURIComponent(code || "");
  if (!json) throw new Error("Código inválido o corrupto");
  return JSON.parse(json, reviver);
}


// Utils
const uid = () => Math.random().toString(36).slice(2);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// Público NO influye en nominaciones (0 = desactivado; 1 = igual que antes)
const PUBLIC_WEIGHT = 0;
const BASE_NOM_PROB = 0.55; // base neutra de nominación
// const fmtPct = (n) => `${n.toFixed(2)}%`;
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const pickRandom = (arr, k = 1) => { const c=[...arr],o=[]; while(k-- > 0 && c.length){ o.push(c.splice(Math.floor(Math.random()*c.length),1)[0]); } return o; };
const randomHalfStep = (min=5,max=10) => { const steps=Math.round((max-min)/0.5)+1; return +(min+Math.floor(Math.random()*steps)*0.5).toFixed(1); };
const randomPercentages = (n) => { const a=Array.from({length:n},()=>Math.pow(Math.random(),1.5)+0.05); const s=a.reduce((x,y)=>x+y,0); return a.map(v=>(v/s*100)).map(v=>+v.toFixed(2)); };

// ----- Género: 'm' (él), 'f' (ella), 'e' (elle)
const norm = s => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"");

// Genera un resultado de duelo con más variedad.
// Devuelve { high, low } con dos decimales: high entre 50 y 95 aprox.
function randomDuelPercents() {
  const r = Math.random();
  let high;
  if (r < 0.50)       high = 50  + Math.random()*5;   // 50–55  (duelo muy cerrado) ~50%
  else if (r < 0.80)  high = 55  + Math.random()*10;  // 55–65  (cerrado/medio)     ~30%
  else if (r < 0.95)  high = 65  + Math.random()*20;  // 65–85  (contundente)       ~15%
  else                high = 85  + Math.random()*10;  // 85–95  (aplastante)        ~5%

  high = +high.toFixed(2);
  const low = +(100 - high).toFixed(2);
  return { high, low };
}

function fmtPct(n){
  if (typeof n !== "number" || !isFinite(n)) return "";
  return `${n.toFixed(1)}%`;
}

  // Nominaciones acumuladas HASTA e INCLUYENDO la gala g (0-index)
  // curList: lista de ids nominados en la gala g si aún no está grabada en summaries
  function countNomsThrough(id, summaries, g, curList) {
    const nomIdOf = (it) => (typeof it === "object") ? (it.id ?? it.member ?? it[0]) : it;

    let n = 0;
    // Galas anteriores
    for (let k = 0; k < g; k++) {
      const list =
        summaries?.[k]?.juradoNominados               // << clave real que usas
        ?? summaries?.[k]?.[k]?.nominados
        ?? summaries?.[k]?.nominados
        ?? [];
      for (const it of list) if (nomIdOf(it) === id) n++;
    }
    // Gala actual (usa curList si te la pasan; si no, lee de summaries)
    const cur =
      curList
      ?? summaries?.[g]?.juradoNominados
      ?? summaries?.[g]?.[g]?.nominados
      ?? summaries?.[g]?.nominados
      ?? [];
    for (const it of cur) if (nomIdOf(it) === id) n++;

    return n;
  }


  function pickProfSaveByFewestNoms(doubtIds, summaries, galaIndex, curList) {
    const arr = Array.from(doubtIds);
    const pairs = arr.map(id => [id, countNomsThrough(id, summaries, galaIndex, curList)]);
    const minNoms = Math.min(...pairs.map(([, n]) => n));
    const tied = pairs.filter(([, n]) => n === minNoms).map(([id]) => id);
    return tied[Math.floor(Math.random() * tied.length)];
  }

  function pickProfSave(doubtIds, summaries, galaIndex, fallbackFn, curList) {
    if (galaIndex >= 0 && galaIndex <= 9) {
      return pickProfSaveByFewestNoms(doubtIds, summaries, galaIndex, curList);
    }
    return fallbackFn ? fallbackFn(doubtIds) : Array.from(doubtIds)[0];
  }

// === CANCIONES ===============================================================
// const [songs, setSongs] = useState([]);

function parseSongsText(txt) {
  return txt
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      // quita comillas / «» externas si las hubiera
      return s.replace(/^["“”«»]+|["“”«»]+$/g, "").trim();
    });
}

function getSongMetaFor(title, songsMeta){
  const t = (title || "").trim();
  if (!t || !songsMeta) return null;
  const exact = songsMeta.exact?.[t];
  if (exact) return exact;
  const tNorm = (t.toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/^["“”«»]+|["“”«»]+$/g, "")
    .replace(/\s+/g, " ")
    .trim());
  return songsMeta.norm?.[tNorm] || null;
}

// === UTILIDADES CANCIONES ====================================================
const normSong = s =>
  (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

// Canciones usadas globalmente hasta ANTES de la gala g (0..g-1)
function getUsedSongsUpTo(summaries, g) {
  const used = new Set();
  for (let k = 0; k < g; k++) {
    const rep = summaries?.[k]?.[k]?.reparto || [];
    rep.forEach(r => { if (r.song) used.add(normSong(r.song)); });
  }
  return used;
}

// Canciones SOLISTAS de un concursante entre [fromG, toG]
function getSoloSongsForIdInRange(summaries, id, fromG = 4, toG = Infinity) {
  const out = [];
  for (let g = fromG; g <= toG; g++) {
    const rep = summaries?.[g]?.[g]?.reparto || [];
    rep.forEach(r => {
      if (r.type === "solo" && r.members?.[0] === id && r.song) out.push(r.song);
    });
  }
  return out;
}

// Asigna canciones cumpliendo todas las reglas (incluida la Final G15)
function buildRepartoConCanciones({ galaNum, reparto, summaries, allSongs }) {
  const usedBefore = getUsedSongsUpTo(summaries, galaNum);
  const usedThisGala = new Set();
  const poolBase = allSongs.filter(s => !usedBefore.has(normSong(s)));
  const seenCount = new Map();

  const pickFresh = () => {
    let candidates = (poolBase.length ? poolBase : allSongs).filter(
      s => !usedThisGala.has(normSong(s))
    );
    if (!candidates.length) {
      candidates = allSongs.filter(s => !usedThisGala.has(normSong(s)));
    }
    const s = candidates[Math.floor(Math.random() * candidates.length)];
    usedThisGala.add(normSong(s));
    return s;
  };

  const pickFromPastSolos = (id) => {
    const prevSolos = getSoloSongsForIdInRange(summaries, id, 4, galaNum - 1);
    const candidates = prevSolos.filter(
      s => !usedBefore.has(normSong(s)) && !usedThisGala.has(normSong(s))
    );
    if (!candidates.length) return null;
    const s = candidates[Math.floor(Math.random() * candidates.length)];
    usedThisGala.add(normSong(s));
    return s;
  };

  return reparto.map(row => {
    const copy = { ...row };
    if (copy.type === "solo") {
      const id = copy.members[0];
      seenCount.set(id, (seenCount.get(id) || 0) + 1);

      if (galaNum === 15 && seenCount.get(id) === 2) {
        copy.song = pickFromPastSolos(id) || pickFresh();
      } else {
        copy.song = pickFresh();
      }
    } else {
      // dúos/tríos: una canción única por fila
      copy.song = pickFresh();
    }
    return copy;
  });
}

// Busca qué canción tiene asignada un concursante en la gala actual
function getSongFor(contestantId, summaries, gala){
  const rep = summaries[gala]?.[gala]?.reparto;
  if (!Array.isArray(rep)) return null;
  for (const row of rep) {
    const members = row?.members || [];
    if (members.includes(contestantId)) return row.song || null;
  }
  return null;
}

// Calcula un modificador de probabilidad de NOMINACIÓN (positivo = peor, negativo = mejor)
// stats/req en [0..15]. penaliza déficit y bonifica “sobrarse”.
function performanceModifier(stats, req){
  if (!stats || !req) return 0;
  const clamp15 = v => Math.max(0, Math.min(15, +v || 0));
  const S = {
    afinacion: clamp15(stats.afinacion ?? stats.afinación),
    baile:     clamp15(stats.baile),
    presencia: clamp15(stats.presencia ?? stats["presencia"]),
    emocion:   clamp15(stats.emocion ?? stats.emoción),
  };
  const R = {
    afinacion: clamp15(req.afinacion ?? req.afinación),
    baile:     clamp15(req.baile),
    presencia: clamp15(req.presencia ?? req["presencia"]),
    emocion:   clamp15(req.emocion ?? req.emoción),
  };

  // gap total en [-60, +60]
  const gap = (S.afinacion - R.afinacion) + (S.baile - R.baile) +
              (S.presencia - R.presencia) + (S.emocion - R.emocion);

  // Convertimos gap en delta de prob. de NOMINACIÓN (más gap => menos prob)
  // k=0.0083 hace que gap=+60 baje ~0.5 la prob, y gap=-60 la suba ~0.5
  const k = 0.0083;
  return -k * gap;   // negativo si va sobrado (reduce nominación), positivo si va justo (aumenta)
}


// === REPARTO DE TEMAS =======================================================

    function repartoPlan(g){
      if (g === 0)  return { trios:0, duos:0, solos:Infinity }; // 18 solos
      if (g === 1)  return { trios:0, duos:8,  solos:0  };
      if (g === 2)  return { trios:2, duos:4,  solos:0  };
      if (g === 3)  return { trios:1, duos:5,  solos:1  };
      if (g === 4)  return { trios:1, duos:4,  solos:1  };
      if (g === 5)  return { trios:0, duos:5,  solos:2  };
      if (g === 6)  return { trios:0, duos:4,  solos:3  };
      if (g === 7)  return { trios:0, duos:3,  solos:4  };
      if (g === 8)  return { trios:0, duos:2,  solos:5  };
      if (g === 9)  return { trios:0, duos:0,  solos:7  };
      // G10–G13 (todas en solos; ver reglas de salvación abajo)
      if (g === 10) return { trios:0, duos:0,  solos:6  };
      if (g === 11) return { trios:0, duos:0,  solos:5  };
      if (g === 12) return { trios:0, duos:0,  solos:Infinity }; // duelo 2→1 (5º finalista)
      if (g === 13) return { trios:0, duos:0,  solos:Infinity }; // final (5 finalistas)
      return { trios:0, duos:0, solos:Infinity };
    }

    const chunkRandom = (ids, k) => {
      const pool = shuffle(ids);
      const out = [];
      while (pool.length >= k) out.push(pool.splice(0, k));
      return { groups: out, rest: pool };
    };

        function buildRepartoParaGala(galaNum, activosIds, nominadosDueloIds = []){
      const filas = [];
      const nomSet = new Set(nominadosDueloIds);

      // 🔝 Nominados arriba (si aplica)
      const nominadosArriba = (galaNum >= 2)
        ? nominadosDueloIds.filter(id => activosIds.includes(id))
        : [];
      nominadosArriba.forEach(id => filas.push({ type:'solo', members:[id], song:'', valor:'' }));

      // El “resto” disponible para otras asignaciones
      let baseSet = activosIds.filter(id => !nomSet.has(id));

      // ⭐️ GALA 14: solo 4 solistas (sin dúos)
      if (galaNum === 14) {
        // Solos de los 4 finalistas
        baseSet.forEach(id => filas.push({ type:'solo', members:[id], song:'', valor:'' }));
        return filas;
      }


      // ⭐️ GALA 15: 3 solos + 3 solos (los mismos 3, segunda canción)
      if (galaNum === 15) {
        // Primera ronda (3 solos)
        baseSet.forEach(id => filas.push({ type:'solo', members:[id], song:'', valor:'' }));
        // Segunda ronda (los mismos 3 otra vez)
        baseSet.forEach(id => filas.push({ type:'solo', members:[id], song:'', valor:'' }));
        return filas;
      }

      // ⬇️ Lógica genérica (G0–G13 y G11 ya funciona con pool correcto)
      const plan = repartoPlan(galaNum);

      if (plan.trios){
        const { groups, rest } = chunkRandom(baseSet, 3);
        groups.slice(0, plan.trios).forEach(m => filas.push({ type:'trio', members:m, song:'', valor:'' }));
        baseSet = rest.concat(groups.slice(plan.trios).flat());
      }
      if (plan.duos){
        const { groups, rest } = chunkRandom(baseSet, 2);
        groups.slice(0, plan.duos).forEach(m => filas.push({ type:'duo', members:m, song:'', valor:'' }));
        baseSet = rest.concat(groups.slice(plan.duos).flat());
      }
      if (plan.solos){
        const nSolos = isFinite(plan.solos) ? Math.min(plan.solos, baseSet.length) : baseSet.length;
        const solos = shuffle(baseSet).splice(0, nSolos);
        solos.forEach(id => filas.push({ type:'solo', members:[id], song:'', valor:'' }));
        baseSet = baseSet.filter(id => !solos.includes(id));
      }

      // Cualquier sobrante, como solos
      baseSet.forEach(id => filas.push({ type:'solo', members:[id], song:'', valor:'' }));
      return filas;
    }


    function rellenarValoracionesReparto(galaNum, summaries, contestants){
      const S = summaries[galaNum];
      if (!S || !S[galaNum] || !Array.isArray(S[galaNum].reparto)) return summaries;

      const rep = S[galaNum].reparto.map(r => ({ ...r }));

      // Solo en Gala 14
        const valorPorId = galaNum === 14 ? {} : null;

        // Prioridad para unificar la valoración de G14
        const scoreValor = (txt) => {
          const v = (txt || "").toLowerCase();
          if (v.includes("finalista")) return 3; // 6º/5º/4º Finalista (o cualquier "Finalista")
          if (v.includes("duelo")) return 2;     // Duelo
          if (v.includes("salvad")) return 1;    // Salvad@ por el público
          return 0;
        };



      // Helpers
      const getC   = (id)=> contestants.find(x=>x.id===id);
      const getG   = (id)=> getC(id)?.gender ?? "e";
      const suf    = (g)=> g==="m"?"o":g==="f"?"a":"e";

      // Datos base de ESTA gala
      const jurNoms  = new Set(S.juradoNominados || []);
      const prof     = S.profesorSalvoId ?? null;        // G1–9 y también se usa en G10 (4º finalista)
      const comp     = S.salvadoCompanerosId ?? null;    // G1–9 y G10 (5º finalista)
      const finalTwo = new Set(S.finalNominees || []);   // los dos que van a duelo (G1–9)

      const favId   = S.favoritoId ?? null;
      const top3Pct = Array.isArray(S.top3Pct) ? S.top3Pct : [];
      const duelSaved = S.duelSaved || {};
      const duelNow   = S.duel || null; // {a,b,pctA,pctB,winner} si el duelo se resuelve en ESTA gala

      // ¿Debe verse como nominado en la UI en la gala actual?
      const isNominatedNow = (id) => {
        const vg = viewGala;

        // Finales (G13+): nunca hay nominados visuales
        if (vg >= 13) return false;

        // Galas 1–11: mirar nominados finales de esa misma gala
        if (vg <= 11) {
          const arr = (summaries?.[vg]?.finalNominees || []).map(String);
          return arr.includes(String(id));
        }

        // Gala 12: vienen de la G11, pero ocultar en cuanto se resuelva el duelo
        const duelResolved = !!(summaries?.[12]?.duel);
        if (duelResolved) return false;
        const arr = (summaries?.[11]?.finalNominees || []).map(String);
        return arr.includes(String(id));
      };

      // —— Etiquetador por concursante
      const valueOf = (id) => {
        const g    = getG(id);
        const sufG = suf(g);
        const parts = [];

        // G14: recordar lo que ya calculamos antes para este concursante (si existe)
        const cachedPrev = (galaNum === 14 && valorPorId) ? valorPorId[id] : undefined;

        // 0) Si el duelo se RESUELVE en esta gala, priorizar siempre ese resultado
        if (duelNow) {
          const { a, b, pctA, pctB, winner } = duelNow;
          const loser = winner === a ? b : a;

          // Perdedor del duelo → Expulsad@
          if (id === loser) {
            const pct = id === a ? pctA : pctB;
            const out = `Expulsad${sufG} por el público (${pct.toFixed(2)}%)`;
            if (galaNum === 14 && valorPorId) {
              if (!cachedPrev || scoreValor(out) >= scoreValor(cachedPrev)) {
                valorPorId[id] = out;
              } else {
                return cachedPrev; // mantenemos el anterior si era de mayor prioridad
              }
            }
            return out;
          }

          // Ganador del duelo → Salvad@
          if (id === winner) {
            const pct = id === a ? pctA : pctB;
            parts.push(`Salvad${sufG} por el público (${pct.toFixed(2)}%)`);
          }
        }

        // 1) Si viene de salvarse en el duelo ANTERIOR (arrastrado)
        if (typeof duelSaved[id] === "number" && !parts.some(p => p.startsWith("Salvad"))) {
          parts.push(`Salvad${sufG} por el público (${duelSaved[id].toFixed(2)}%)`);
        }

  // … A PARTIR DE AQUÍ SIGUE TU CÓDIGO EXISTENTE (G1–9, G10, etc.)


          // 1.5) FAVORIT@ DEL PÚBLICO (G1–G9) → Inmune, se detiene aquí
        if (galaNum <= 9 && favId && id === favId) {
          const idsTop = Array.isArray(S.top3Ids) ? S.top3Ids : [];
          const idx = idsTop.indexOf(id);
          const pct = (idx >= 0 && typeof top3Pct[idx] === "number") ? top3Pct[idx] : undefined;
          // devuelve directamente, sin añadir más partes
          return `Favorit${sufG} del público${pct != null ? ` (${pct.toFixed(2)}%)` : ""}`;
        }

        // 2) Decisión del jurado/profes/compañeros en ESTA gala (G1–9)
        if (galaNum <= 10) {
        // prefijo si ya venía de "Salvado por el público (%)" (o de esta misma gala)
        const prefix = parts.length ? parts.join(" > ") + " > " : "";

        // ⚑ PRIORIDAD MÁXIMA: si va a duelo (dos últimos) → Propuesto > Nominado
        if (finalTwo.has(id)) {
          const g = getG(id), sufG = suf(g);
          return `${prefix}Propuest${sufG} por el jurado > Nominad${sufG}`;
        }

        // Salvado por profesores / compañeros
        if (prof === id) {
          const g = getG(id), sufG = suf(g);
          return `${prefix}Propuest${sufG} por el jurado > Salvad${sufG} por los profesores`;
        }
        if (comp === id) {
          const g = getG(id), sufG = suf(g);
          return `${prefix}Propuest${sufG} por el jurado > Salvad${sufG} por los compañeros`;
        }

        // Estuvo propuesto pero NO quedó entre los dos últimos → cruzó pasarela del jurado
        if (jurNoms.has(id)) {
          const g = getG(id), sufG = suf(g);
          return `${prefix}Salvad${sufG} por el jurado`;
        }

        // No fue propuesto: salvado “normal”
        {
          const g = getG(id), sufG = suf(g);
          return `${prefix}Salvad${sufG} por el jurado`;
        }
      }

          if (galaNum === 11) {
                  // Usamos lo que dejó g11_puntuarJurado en summaries
                  const top3 = new Set(summaries?.[11]?.juradoTop3 || []);
                  const prof = summaries?.[11]?.profesorSalvoId || null;
                  const duel = new Set(summaries?.[11]?.finalNominees || []);

                  const prefix = parts.length ? parts.join(" > ") + " > " : "";
                  const g = getG(id), sufG = suf(g);

                  if (top3.has(id))               return `${prefix}Salvad${sufG} por el jurado > Finalista`;
                  if (id === prof)                return `${prefix}Propuest${sufG} por el jurado > Salvad${sufG} por los profesores > Finalista`;
                  if (duel.has(id))               return `${prefix}Propuest${sufG} por el jurado > Nominad${sufG}`;
                  return parts.join(" > "); // por si había algo previo (p.ej. finalista de G10)
                }


          else if (galaNum === 12) {
            const duelSet = new Set((summaries?.[11]?.finalNominees || []).map(String));
            const duelNow = summaries?.[12]?.duel || null;

            const g = getG(id), sufG = suf(g);

            if (!duelNow) {
              // Aún no resuelto
              return duelSet.has(String(id)) ? `Nominad${sufG}` : "Finalista";
            } else {
              // Resuelto
              const { a, b, winner, pctA, pctB } = duelNow;
              const pct = String(id) === String(a) ? pctA : String(id) === String(b) ? pctB : null;

              if (String(id) === String(winner)) {
                return `Salvad${sufG} por el público (${pct?.toFixed(2)}%) > Finalista`;
              }
              // Para los 4 finalistas que ya lo eran (y no son duelistas) → Finalista
              if (!new Set([String(a), String(b)]).has(String(id))) return "Finalista";
              // El perdedor lo pinta tu pipeline general como Eliminado.
              return "";
            }
          }

          else if (galaNum === 13) {
            const s13  = summaries?.[13] || {};
            const g    = getG(id);                  // "m" | "f" | "e"
            const suf2 = g === "m" ? "º" : "ª";
            const ord3 = g === "m" ? "3er" : "3ª";

            // formas irregulares correctas
            const ganadorWord =
              g === "m" ? "Ganador" :
              g === "f" ? "Ganadora" :
                          "Ganadore";

            // ganador / 2º / 3º
            if (String(s13?.winner?.id) === String(id)) {
              return `${ganadorWord} (${s13.winner.pct.toFixed(2)}%)`;
            }
            if (String(s13?.second?.id) === String(id)) {
              return `2${suf2} Finalista (${s13.second.pct.toFixed(2)}%)`;
            }
            if (String(s13?.third?.id) === String(id)) {
              return `${ord3} Finalista (${s13.third.pct.toFixed(2)}%)`;
            }

            // 4º / 5º en fase 1 → sienna (el color lo aplica valorBgColor)
            if (String(s13?.fourth?.id) === String(id)) {
              return `4${suf2} Finalista (${s13.fourth?.pct?.toFixed(2) ?? "--"}%)`;
            }
            if (String(s13?.fifth?.id) === String(id)) {
              return `5${suf2} Finalista (${s13.fifth?.pct?.toFixed(2) ?? "--"}%)`;
            }

            // Si ya se reveló el 4.º, los tres que quedan en Fase 1 deben verse como “Salvado”
            if (s13?.fourth && !s13?.winner) return `Salvad${suf(g)}`;

            return "Finalista";
          }







        // 4) G11–G15 se tratan en otras rutinas; si aquí no tocó nada especial, devolver lo acumulado
        const out = parts.join(" > ");
        if (galaNum === 14 && valorPorId) {
          // si ya había un valor para este concursante, comparamos prioridades
          if (!cachedPrev || scoreValor(out) >= scoreValor(cachedPrev)) {
            valorPorId[id] = out;   // pisa si el nuevo es más fuerte (Finalista/Duelo > Salvado)
          } else {
            return cachedPrev;       // mantenemos el anterior (más fuerte) para que ambas celdas coincidan
          }
        }
        return out;


      };

      // Aplicar a cada fila del reparto
      // 1) Calcula los valores "normales" con valueOf (sin trucos)
      const temp = rep.map(row => {
        const ids  = row.members;
        const vals = ids.map(id => valueOf(id));
        return { row, ids, vals };
      });

// 3) Pasa a la estructura final respetando dúos/tríos
const nuevoRep = temp.map(({ row, ids, vals }) => ({
  ...row,
  valor: ids.length === 1 ? vals[0] : vals.join(" | "),
}));


      return {
        ...summaries,
        [galaNum]: {
          ...(summaries[galaNum] || { gala: galaNum }),
          [galaNum]: { ...(summaries[galaNum]?.[galaNum] || {}), reparto: nuevoRep }
        }
      };
    }




// === GALA 0 – estado en gstate.g0 ===
// gstate.g0 = {
//   order: string[],         // orden a revelar (ids)
//   idx: number,             // índice actual
//   entered: Set<id>,        // ya "Entra" directos del jurado
//   doubt: Set<id>,          // "EN DUDA" (4)
//   profesSaved?: id,        // id salvado por profes
//   public?: { tabla: {id,pct}[], winner: id, losers: id[] }, // votación público
// }

// Baraja valoraciones con reglas:
//  - Nunca más de 2 nominados seguidos
//  - El último nominado sale en penúltima o última posición
// Baraja valoraciones con reglas fuertes para los últimos puestos:
// - Nunca más de 2 nominados seguidos
// - En las 3 primeras, máx 1 nominado
    // - Se reserva 1 NOMINADO para penúltima/última y 1 OTRO para el hueco complementario
    function buildValoracionesOrder(allIds, nomineeIds){
      const N = allIds.length;
      const nomSet = new Set(nomineeIds);
      const nom   = nomineeIds.slice();
      const otros = allIds.filter(id => !nomSet.has(id));

      // shuffle Fisher-Yates
      for (let a of [nom, otros]) for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }

      // reservar 1 nominado para penúltima/última + 1 "otro" para el otro hueco
      let slotUlt = Math.random() < 0.5 ? N-1 : N-2;
      if (nom.length === 0) slotUlt = N-1;
      const reservado      = nom.length ? nom.pop() : null;              // nominado
      const slotOther      = slotUlt === N-1 ? N-2 : N-1;
      const reservadoOtro  = (otros.length > 0) ? otros.pop() : null;    // salvado

      const order = [];
      let consecNom = 0;
      let nomInFirst3 = 0;

      for (let i = 0; i < N; i++) {
        // coloca el "otro" reservado en el hueco complementario
        if (reservadoOtro && i === slotOther) {
          order.push(reservadoOtro);
          consecNom = 0;
          continue;
        }

        // coloca el nominado reservado en penúltima/última (y evita 3 seguidos justo antes)
        if (reservado && i === slotUlt) {
          if (consecNom === 2 && otros.length) { order.push(otros.pop()); consecNom = 0; i++; }
          order.push(reservado);
          consecNom++;
          if (i < 3) nomInFirst3++;
          continue;
        }

        // reglas generales
        const earlyCap   = (i < 3 && nomInFirst3 >= 1);                   // primeras 3: máx 1 nominado
        const puedeNom   = nom.length > 0 && consecNom < 2 && !earlyCap;

        // huecos restantes sin contar los reservados que aún no han salido
        const reservedAhead = (reservado && i < slotUlt ? 1 : 0) + (reservadoOtro && i < slotOther ? 1 : 0);
        const slotsRestantes = (N - i) - reservedAhead;

        // balance: si los nominados restantes casi llenan los huecos no reservados, empuja un "otro" ahora
        const debeEquilibrar = puedeNom && nom.length >= (slotsRestantes - 1);

        // al entrar en los 3 últimos huecos, rompe rachas de 2 nominados
        if (i >= N - 3 && consecNom === 2 && otros.length) {
          order.push(otros.pop());
          consecNom = 0;
          continue;
        }

        // decisión
        let pick = null;
        if (!debeEquilibrar && (puedeNom && Math.random() < 0.5)) {
          pick = nom.pop();
          consecNom++;
          if (i < 3) nomInFirst3++;
        } else {
          pick = otros.pop();
          if (pick == null) { pick = nom.pop(); consecNom++; if (i < 3) nomInFirst3++; }
          else { consecNom = 0; }
        }
        order.push(pick);
      }

      return order;
    }


function detectGender(token){
  const t = norm(token.trim());
  if (t==="el" || t==="él" || t==="m" ) return "m";
  if (t==="ella" || t==="f") return "f";
  if (t==="elle" || t==="x" || t==="nb") return "e";
  return null;
}
function parseNameLine(line){
  // acepta formatos: "Nombre - ella", "Nombre (él)", "Nombre | elle"
  const m = line.match(/(?:[-(|\s]\s*)(él|el|ella|elle|m|f|x|nb)\s*\)?\s*$/i);
  const g = m ? detectGender(m[1]) : null;
  const name = m ? line.replace(m[0], "").trim() : line.trim();
  return { name, gender: g ?? "e" }; // por defecto 'e' (elle)
}
// sufijos por género
const suf = g => g==="m"?"o":g==="f"?"a":"e";


// Lightweight self-tests to prevent regressions
function runSelfTests(){
  const results = [];
  try{
    // regex split should handle both \n and \r\n
    const sample = "A\nB\r\nC";
    const split = sample.split(/\r?\n/);
    results.push(split.length===3?"split CRLF ok":"split CRLF FAIL");

    // default 16 names join -> 16 lines
    const def = Array.from({length:16},(_,i)=>`N${i+1}`).join("\n");
    const lines = def.split(/\r?\n/);
    results.push(lines.length===16?"split 16 ok":"split 16 FAIL");

    // percentages sum ~ 100
    const p = randomPercentages(5); const sum = p.reduce((a,b)=>a+b,0);
    results.push(Math.abs(sum-100)<0.6?"percent sum ok":"percent sum FAIL");

    // half-steps at .5 increments
    const r = randomHalfStep();
    results.push(r>=5 && r<=10 && Math.abs(r*2-Math.round(r*2))<1e-9?"halfstep ok":"halfstep FAIL");

    // bottom-two reveal order (galas 12–14): bottom two must be last
    const ids=["a","b","c","d","e"], testPcts=[30,25,20,15,10];
    const tabla=ids.map((id,i)=>({id,name:id,pct:testPcts[i]})).sort((A,B)=>B.pct-A.pct);
    const bottom2=[...tabla].slice(-2).sort((A,B)=>A.pct-B.pct);
    const reveal=[...tabla.slice(0,tabla.length-2).map(t=>t.id), bottom2[1].id, bottom2[0].id];
    results.push(reveal[reveal.length-2]===bottom2[1].id && reveal[reveal.length-1]===bottom2[0].id?"reveal order ok":"reveal order FAIL");

    // g11 duel split sums to 100 and high>=50
    const { high, low } = randomDuelPercents();
    results.push(Math.abs(high + low - 100) < 1e-9 && high >= 50 && low <= 50 ? "g11 split ok" : "g11 split FAIL");

  }catch(e){ results.push("tests threw: "+String(e)); }
  return results;
}

export default function SimuladorOT_RTVE({ mode, onModeChange }) {
  const [namesInput, setNamesInput] = useState("");
  const [contestants, setContestants] = useState([]);
  const [gala, setGala] = useState(1);
  const [viewGala, setViewGala] = useState(1);
  const [galaLogs, setGalaLogs] = useState({});
  const [carryNominees, setCarryNominees] = useState([]);
  const [stage, setStage] = useState("inicio");
  const [gstate, setGstate] = useState({});
  const [summaries, setSummaries] = useState({});
  const [testResults, setTestResults] = useState([]);
  const [photoByName, setPhotoByName] = useState(new Map());
  const [route, setRoute] = useState("home");           // "home" | "selector"
  const [pendingRealRoster, setPendingRealRoster] = useState(null); // guarda objetos seleccionados
  const closeEdition = () => setStage("edicionCerrada");
  const clearTypedList = () => {
    setNamesInput("");           // vacía el textarea
    setPendingRealRoster(null);  // opcional: limpia plantillas importadas
  };

  const logs = Array.isArray(gstate?.logs) ? gstate.logs : [];

    const genderSuf = (g) => (g === "m" ? "o" : g === "f" ? "a" : "e");
    const wordGanador = (g) =>
      g === "m" ? "Ganador" : g === "f" ? "Ganadora" : "Ganadore";

    function badgeFromStatus(c) {
      switch (c.status) {
        case "ganador":
          return { text: wordGanador(c.gender), bg: "gold", fg: "#111" };
        case "finalista":
          return { text: "Finalista", bg: "lightblue", fg: "#111" };
        case "eliminado":
          return { text: "Eliminad" + genderSuf(c.gender), bg: "red", fg: "#fff" };
        default:
          return null;
      }
    }

    // ¿Se debe ver como NOMINADO en la gala que estoy visualizando?
    const isNominatedNow = (id) => {
      const vg = viewGala;

      // Finales (G13+): nunca hay nominados visuales
      if (vg >= 13) return false;

      // Galas 1–11: mirar nominados finales de esa misma gala
      if (vg <= 11) {
        const arr = (summaries?.[vg]?.finalNominees || []).map(String);
        return arr.includes(String(id));
      }

      // Gala 12: vienen de G11, pero ocultar en cuanto se resuelve el duelo
      const duelResolved = !!(summaries?.[12]?.duel);
      if (duelResolved) return false;
      const arr = (summaries?.[11]?.finalNominees || []).map(String);
      return arr.includes(String(id));
    };

    function badgeFromCurrentGala(c, gala, stage, summaries) {
      if (stage === "galaCerrada") return null;
      const suf = genderSuf(c.gender);
      const s = summaries[gala] || {};

       // No mostrar "Nominad@" a partir de la G12 (solo mientras el duelo no se ha resuelto)
      if (gala >= 12) {
        if (gala === 12 && !summaries?.[12]?.duel) {
          const arr = (summaries?.[11]?.finalNominees || []).map(String);
          if (arr.includes(String(c.id))) return { text: `Nominad${suf}`, bg: "orange", fg: "#111" };
        }
        return null;
      }


      if (s?.favoritoId === c.id)
        return { text: `Favorit${suf}`, bg: "DodgerBlue", fg: "#fff" };
      if ((s?.finalNominees || []).includes(c.id))
        return { text: `Nominad${suf}`, bg: "orange", fg: "#111" };
      if (s?.profesorSalvoId === c.id)
        return { text: `Salvad${suf}`, bg: "yellowgreen", fg: "#111" };
      if (s?.salvadoCompanerosId === c.id)
        return { text: `Salvad${suf}`, bg: "khaki", fg: "#111" };
      return null;
    }

  // 🆕 Nuevo estado para las canciones
  const [songs, setSongs] = useState([]);
  const [songsReady, setSongsReady] = useState(false);
  const [songsMeta, setSongsMeta] = useState({}); // { title -> {afinacion, baile, presencia, emocion} }

    const SAVE_VERSION = 1;

      function buildSavePayload() {
      // ojo con Maps/Sets: el 'replacer' de arriba los convierte
      return {
        v: SAVE_VERSION,
        mode,            // "telecinco" | "rtve"
        contestants,     // [{ id, name, gender, photo, stats, status, ... }]
        gala,
        viewGala,
        stage,
        gstate,          // lleva Sets, lo maneja 'replacer'
        summaries,       // árbol con reparto, favoritos, nominados, etc.
        namesInput,      // por si quieres reimprimir la lista inicial
        songsReady,      // opcional
      };
    }

    function applyLoadedState(payload) {
      if (!payload || payload.v !== SAVE_VERSION) throw new Error("Versión de guardado incompatible");

      // Restaura en este orden para que la UI no parpadee raro:
      setContestants(payload.contestants || []);
      setSummaries(payload.summaries || {});    // tabla de recorrido y galas
      setGstate(payload.gstate || {});          // lleva Sets: ya vienen revividos
      setNamesInput(payload.namesInput || "");  // si quieres mostrar la lista original
      setGala(payload.gala ?? 1);
      setViewGala(payload.viewGala ?? payload.gala ?? 1);
      setStage(payload.stage || "inicio");
    }

      useEffect(() => {
    try {
      const hash = window.location.hash || "";
      const m = hash.match(/(?:^#|&)sim=([^&]+)/);
      const code = m ? decodeURIComponent(m[1]) : null;
      if (code) {
        const payload = unpackState(code);
        applyLoadedState(payload);
        onModeChange?.(payload.mode || mode);
      }
    } catch (e) {
      console.warn("No se pudo autocargar el código de la URL:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


      useEffect(() => {
      const LS_KEY = "ot_custom_contestants";

      const loadCustoms = () => {
        try {
          const raw = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
          return Array.isArray(raw) ? raw : [];
        } catch {
          return [];
        }
      };

      const build = async () => {
        try {
          const res = await fetch("/ot_contestants.json");
          const official = await res.json(); // [{name, photo,...}]
          const customs = loadCustoms();     // [{name, photo,...}]

          const map = new Map();
          // oficiales
          for (const p of official || []) {
            if (p?.name && p?.photo) map.set(norm(p.name), p.photo);
          }
          // customs
          for (const p of customs || []) {
            if (p?.name && p?.photo) map.set(norm(p.name), p.photo);
          }

          setPhotoByName(map);
        } catch {
          // si falla el fetch, al menos cargar customs
          const map = new Map();
          for (const p of loadCustoms() || []) {
            if (p?.name && p?.photo) map.set(norm(p.name), p.photo);
          }
          setPhotoByName(map);
        }
      };

      build();
    }, []);


    useEffect(() => {
      const url = "canciones.txt"; // relativo a /public
      fetch(url)
        .then(r => r.text())
        .then(t => {
          const lines = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          setSongs(lines);
          setSongsReady(true);
          console.log("[Canciones] cargadas:", lines.length);
        })
        .catch(err => {
          console.warn("No pude cargar canciones.txt", err);
          setSongs([]);
          setSongsReady(true);
        });
    }, []);

        // debajo del useEffect que carga canciones.txt
      useEffect(() => {
        fetch("/songs_meta.json")
          .then(r => r.json())
          .then(list => {
            const normalize = s => (s || "")
              .toLowerCase()
              .normalize("NFD").replace(/\p{Diacritic}/gu, "")     // quita tildes
              .replace(/^["“”«»]+|["“”«»]+$/g, "")                // quita comillas exteriores
              .replace(/\s+/g, " ")                                // colapsa espacios
              .trim();

            const exact = {};
            const norm  = {};
            (list || []).forEach(x => {
              if (!x?.title) return;
              const tExact = x.title.trim();
              const tNorm  = normalize(x.title);
              exact[tExact] = x;
              norm[tNorm]   = x;
            });

            setSongsMeta({ exact, norm });
            console.log("[SongsMeta] cargado:", Object.keys(exact).length);
          })
          .catch(err => {
            console.warn("No pude cargar songs_meta.json", err);
            setSongsMeta({});
          });
      }, []);




  useEffect(()=>{ setTestResults(runSelfTests()); },[]);

  const active     = useMemo(()=>contestants.filter(c=>c.status==="active"),[contestants]);
  const canPickRoster = contestants.length === 0 && stage === "inicio";
  const finalists = useMemo(
  () => contestants.filter(c => c.status === "finalista" || c.status === "ganador"),
  [contestants]
);

  const eliminated = useMemo(()=>contestants.filter(c=>c.status==="eliminado"),[contestants]);

    // 👇 Añádelo aquí
    // Mostrar favorit@ solo cuando esté en summaries (fase 2 ya revelada)
    const favId = summaries?.[viewGala]?.favoritoId ?? null;


  const pushLog = (entry, galaNum=gala)=> setGalaLogs(logs=>({...logs,[galaNum]:[...(logs[galaNum]||[]), entry]}));
  const nameOf = (id)=> contestants.find(x=>x.id===id)?.name ?? "?";
  const nextStageFor = (num) => {
    // 🔴 PRIORIDAD GLOBAL: si hay duelo pendiente (G2–G11), resolverlo primero
    if (carryNominees.length === 2 && num >= 2 && num <= 11) {
      return "dueloPendiente";
    }

    // Flujo normal por gala
    if (num === 0)  return "g0_eval";
    if (num < 10)   return "votoPublico";
    if (num === 10) return "juradoEvaluando";
    if (num === 11) return "gala11_publico";      // tras resolver duelo del 10 aquí
    if (num === 12) return "g12_14_publico";
    if (num === 13) return "g13_fase1";  // 👈 empieza la final en Fase 1
    return "g13_final";
  };


      function prepararNuevaGala(num, list = contestants) {
        // 👇 NUEVO: elegir correctamente quiénes “juegan” en cada gala
        const pool = (list || contestants);
        let vivos;

        if (num <= 10) {
          // Hasta la G10: siguen “activos” (no finalistas aún)
          vivos = pool.filter(c => c.status === "active");
        } else if (num === 11) {
          // G11: 5 finalistas + 2 nominados arrastrados (que siguen “active”)
          vivos = pool.filter(c => c.status === "finalista" || c.status === "active");
        } else if (num === 12) {
          // G12: 4 finalistas (de G11) + 2 nominados que vienen del jurado (G11)
          const duelIds = (summaries?.[11]?.finalNominees || []).map(String);
          const isDuel  = new Set(duelIds);
          vivos = pool.filter(c =>
            c.status === "finalista" || c.status === "ganador" || isDuel.has(String(c.id))
          );
        } else {
          // G13–G15: solo finalistas/ganador
          vivos = pool.filter(c => c.status === "finalista" || c.status === "ganador");
        }

        setGstate({
          publicRank: [], top3: [], top3Pct: undefined, favoritoId: undefined, top3Shown: false,
          evaluacionOrden: shuffle(vivos.map(v => v.id)), evalResults: [], salvados: new Set(),
          nominados: [], profesorSalvoId: undefined, votosCompaneros: [], salvadoCompanerosId: undefined,
          currentEvaluadoId: undefined, currentEvaluadoLogIndex: undefined, g12: undefined, g15: undefined
        });

        const activosIds = vivos.map(c => c.id);

        // nominados que vienen de la gala anterior (G2–G10) o de G11→G12
        const nominadosDuelo =
          num === 12
            ? (summaries?.[11]?.finalNominees || [])
            : (num >= 2 && num <= 11 ? [...carryNominees] : []);

        // Reparto base
        let repartoBase = buildRepartoParaGala(num, activosIds, nominadosDuelo);

        // 👉 G11: sube ARRIBA a los dos duelistas arrastrados desde G10 (carryNominees)
        if (num === 11 && Array.isArray(carryNominees) && carryNominees.length) {
          const carrySet = new Set(carryNominees.map(String));
          repartoBase = repartoBase
            .map((r, idx) => ({
              ...r,
              _prio: (r.members || []).some(id => carrySet.has(String(id))) ? 0 : 1,
              _idx: idx, // por si no tienes r.n
            }))
            .sort((a, b) =>
              a._prio - b._prio || (a.n ?? a._idx ?? 0) - (b.n ?? b._idx ?? 0)
            )
            .map(({ _prio, _idx, ...r }) => r);
        }

        // 👉 G12: sube ARRIBA las filas que contengan a los dos duelistas
        if (num === 12) {
          const duelSet = new Set((summaries?.[11]?.finalNominees || []).map(String));
          repartoBase = repartoBase
            .map((r, idx) => ({
              ...r,
              _prio: (r.members || []).some(id => duelSet.has(String(id))) ? 0 : 1,
              _idx: idx, // por si no tienes r.n, preserva orden original
            }))
            .sort((a, b) =>
              a._prio - b._prio || (a.n ?? a._idx ?? 0) - (b.n ?? b._idx ?? 0)
            )
            .map(({ _prio, _idx, ...r }) => r);
        }

        if (num === 13) {
        // Limpia estado temporal de la final
        setGstate(st => ({ ...(st || {}), g13: null }));

        // Asegura stage inicial correcto (si no lo hace ya tu goNext)
        setStage(nextStageFor(13));   // con tu nextStageFor ya devuelve "g13_fase1"
        setGala(13);
        if (typeof setViewGala === "function") setViewGala(13);
      }


        // Reparto final con canciones
        const reparto = buildRepartoConCanciones({
          galaNum: num,
          reparto: repartoBase,
          summaries,
          allSongs: songs,
        });
      // ✅ Guardado de la nueva gala: arrastra solo duelSaved de la anterior
        setSummaries(s => {
          const prev = s[num - 1];
          const duelSaved = prev?.duelSaved || {};

          return {
            ...s,
            [num]: {
              ...(s[num] || { gala: num }),
              favoritoId: null,      // 👈 añade esto
              top3Ids: [],           // 👈 y estos campos
              top3Pct: [],
              duelSaved,
              [num]: { ...(s[num]?.[num] || {}), reparto }
            }
          };
        });



        setViewGala(num);
        setGalaLogs(p => ({ ...p, [num]: p[num] || [] }));

        // ⬅️ importante: usa nextStageFor para que en G≥2 salga primero “⚔️ Resolver duelo” si procede
        if (num === 0) setStage("g0_eval");
        else setStage(nextStageFor(num));
      }



  function iniciar() {
    const lines = namesInput
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (lines.length !== 18) {
      alert(`Hay ${lines.length} nombres. Deben ser exactamente 18, uno por línea (sin líneas vacías).`);
      return;
    }

    // mapa por nombre para cruzar con pendingRealRoster
    const dbByName = Object.fromEntries(
      (pendingRealRoster || []).map(p => [p.name.toLowerCase(), p])
    );

    // al crear cada concursante:
    const inits = lines.map(line => {
      const { name, gender } = parseNameLine(line);
      const base = { id: uid(), name, gender, status: "active", history: [] };
      const real = dbByName[name.toLowerCase()];
      return real ? { ...base, photo: real.photo, stats: real.stats } : base;
    });


    try {
      setContestants(inits);
      setPendingRealRoster(null); // limpia la plantilla para la siguiente vez
      setGala(0);
      setViewGala(0); // 👈 asegura que ves la Gala 0 en el historial
      setStage("gala0");
      pushLog("🎬 Comienza la Gala 0 con 18 concursantes.", 0); // 👈 log explícito en gala 0
      g0_setup(inits);
    }catch(e){ console.error(e); alert("Ha ocurrido un error iniciando el simulador. Revisa la consola."); }
  }

  // Color de fondo + color de texto para la celda "Valoración" del Reparto
    function valorBgColor(valor, galaNum) {
      const v = (valor || "").toLowerCase();
      const has = (s) => v.includes(s.toLowerCase());

      // Gala 0
      if (galaNum === 0) {
        if (has("eliminad") && has("no entra")) return { bg: "tomato", fg: "#fff" };
        if (has("salvad") && has("por los profesores") && has("entra")) return { bg: "yellowgreen", fg: "#111" };
        if (has("salvad") && has("por el público") && has("entra")) return { bg: "orange", fg: "#111" };
        if (has("salvad") && has("por el jurado") && has("entra")) return { bg: "#fff", fg: "#111" };
      }

      // Propuestos/Nominados sin ser finalistas
      if (has("propuest") && has("nominad") && !has("finalista"))
        return { bg: "orange", fg: "#111" };

      // Propuesto + salvado
      if (has("propuest") && has("por el jurado") && has("profesores")) return { bg: "yellowgreen", fg: "#111" };
      if (has("propuest") && has("por el jurado") && has("compañeros")) return { bg: "khaki", fg: "#111" };
      if (has("propuest") && has("nominad"))                              return { bg: "#fef08a", fg: "#111" };

      // 2º / 3º Finalista
      if (/\b2(º|ª)?\b/.test(v) && has("finalista")) return { bg: "silver", fg: "#111" };
      if (/\b3(º|ª|er)?\b/.test(v) && has("finalista")) return { bg: "#cd7f32", fg: "#fff" };

      // 4º / 5º Finalista → sienna
    if (/\b(4|5)(º|ª)?\s*finalista\b/.test(v)) {
      return { bg: "sienna", fg: "#fff" };
    }


      // ✅ G11 (formato nuevo) — ¡usa v, no t! y devuelve {bg,fg}
      if (has("salvad") && has("por el jurado") && has("finalista"))
        return { bg: "lightblue", fg: "#111" };        // lightblue
      if (has("propuest") && has("por el jurado") && has("salvad") && has("profes"))
        return { bg: "yellowgreen", fg: "#111" };      // yellowgreen
      if (has("propuest") && has("por el jurado") && has("nominad"))
        return { bg: "orange", fg: "#111" };           // orange

      // Finalista genérico
      if (has("finalista")) return { bg: "lightblue", fg: "#111" };

      // Favorito/a
      if (has("favorit")) return { bg: "DodgerBlue", fg: "#fff" };

      // Resto
      if (has("expulsad")) return { bg: "red", fg: "#fff" };
      if (has("duelo"))     return { bg: "orange", fg: "#111" };
      if (has("ganador"))   return { bg: "gold", fg: "#111" };
      if (has("salvad") && has("por el jurado")) return { bg: "#fff", fg: "#111" };
      return { bg: "", fg: "" };
    }


  function reiniciar(){ 
    setContestants([]); 
    setGala(1); 
    setViewGala(1); 
    setGalaLogs({}); 
    setCarryNominees([]); 
    setStage("inicio"); 
    setGstate(null); 
    setSummaries({}); 
  }

      if (route === "selector") {
        return (
          <OTRosterPicker
            max={18}
            onCancel={() => setRoute("home")}
            onImport={(picked) => {
              if (!picked?.length) return;

              // (a) Mezclar con lo que ya hayas escrito a mano:
              const typed = namesInput.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
              const pickedLines = picked.map(
                p => `${p.name} - ${p.gender === "m" ? "él" : p.gender === "f" ? "ella" : "elle"}`
              );
              const combined = [...typed, ...pickedLines].slice(0, 18);
              setNamesInput(combined.join("\n"));

              // (b) Guardar roster real para inyectar foto+stats al iniciar()
              setPendingRealRoster([ ...(pendingRealRoster || []), ...picked ]);

              // (c) Volver a la app
              setRoute("home");
            }}
          />
        );
      }


    const onDownloadRecorrido = async () => {
      const node = document.getElementById("recorrido-capture");
      if (!node) {
        alert("No se encontró la tabla del recorrido 😕");
        return;
      }

      // Guardamos estilos para restaurar luego
      const prev = {
        overflow: node.style.overflow,
        margin: node.style.margin,
        padding: node.style.padding,
        transform: node.style.transform,
        background: node.style.background,
        display: node.style.display,
      };

      // Desactivar sticky en cabeceras para la captura
      const ths = Array.from(node.querySelectorAll("th"));
      const prevPos = ths.map((th) => th.style.position);
      ths.forEach((th) => (th.style.position = "static"));

      // El nodo de captura debe estar "limpio"
      node.style.overflow = "visible";
      node.style.margin = "0";
      node.style.padding = "0";
      node.style.transform = "none";
      node.style.background = "#fff";
      node.style.display = "inline-block"; // evita añadir ancho/alto extra

      // Tamaño exacto de contenido (aunque haya scroll en el wrapper)
      const width = Math.ceil(node.scrollWidth);
      const height = Math.ceil(node.scrollHeight);

      try {
        const dataUrl = await toPng(node, {
          width,
          height,
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: "#fff",
          style: { margin: 0, padding: 0, transform: "none" },
        });

        const link = document.createElement("a");
        link.download = "recorrido.png";
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error("Error generando imagen del recorrido:", err);
        alert("No se pudo generar la imagen 😔");
      } finally {
        // Restaurar estilos
        Object.assign(node.style, prev);
        ths.forEach((th, i) => (th.style.position = prevPos[i] || ""));
      }
    };


    function g0_setup(list) {
      // (opcional) si quieres asegurar que hay canciones cargadas
      if (!songsReady) { setStage("cargandoCanciones"); return; }
      if (!songs.length) { alert("No se han cargado canciones. Revisa /public/canciones.txt"); return; }

      const order = shuffle(list.map(c => c.id));

      // 1) Reparto base (solos) y asignación de canciones
      const reparto0base = buildRepartoParaGala(0, list.map(c => c.id), []);
      const reparto0 = buildRepartoConCanciones({
        galaNum: 0,
        reparto: reparto0base,
        summaries,
        allSongs: songs,
      });

      // 2) Guardar reparto con canciones en summaries[0][0]
      setSummaries(s => ({
        ...s,
        0: {
          ...(s[0] || { gala: 0 }),
          0: { ...(s[0]?.[0] || {}), reparto: reparto0 },
        },
      }));

      // 3) Inicializar estado de la Gala 0 (¡esto es lo que te faltaba!)
      setGstate(prev => ({
        ...(prev || {}),
        g0: { order, idx: 0, entered: new Set(), doubt: new Set() },
      }));

      // 4) Vista y etapa
      setViewGala(0);
      setGalaLogs(p => ({ ...p, 0: p[0] || [] }));
      setStage("g0_eval");

      // (opcional) log
      pushLog("🎬 El jurado decide quién entra y quién queda en duda.", 0);
    }

    function g0_revealNext() {
      const st = gstate?.g0;
      if (!st) { pushLog("⚠️ Prepara primero la Gala 0.", 0); return; }

      const { order, idx } = st;
      if (!order || order.length === 0) { pushLog("⚠️ No hay orden de evaluación para la Gala 0.", 0); return; }
      if (idx >= order.length) {
        pushLog("ℹ️ Ya se valoró a todo el mundo.", 0);
        setStage("g0_profes");
        setGstate(prev => ({ ...prev, g0: { ...st, idx: order.length } }));
        return;
      }

      const id        = order[idx];
      const entered   = new Set(st.entered);
      const doubt     = new Set(st.doubt);
      const remaining = order.length - idx;
      const needDoubt = 4 - doubt.size;

      // ---- PROBABILIDAD EN DUDA BASADA EN CANCIÓN/ESTADÍSTICAS ----
      const BASE_G0_DOUBT = 0.20;
      let pDoubt = BASE_G0_DOUBT;

      try {
        const songTitle = getSongFor(id, summaries, 0);
        const req = getSongMetaFor(songTitle, songsMeta);
        const stats = contestants.find(c => c.id === id)?.stats;

        if (stats && req) {
          const delta = performanceModifier(stats, req);
          const jitter = (Math.random() * 0.08) - 0.04;
          pDoubt = Math.max(0.05, Math.min(0.90, BASE_G0_DOUBT + delta + jitter));
        }
      } catch {
        pDoubt = BASE_G0_DOUBT;
      }

      // --- DEBUG solo consola ---
      console.debug(
        `[G0 DEBUG] ${nameOf(id)} | pDoubt=${(pDoubt * 100).toFixed(1)}% | ` +
        `needDoubt=${needDoubt} | remaining=${remaining}`
      );

      // --- Decisión ---
      let decision;
      if (needDoubt <= 0)               decision = "entra";
      else if (remaining === needDoubt) decision = "duda";
      else                              decision = (Math.random() < pDoubt) ? "duda" : "entra";

      if (decision === "duda") doubt.add(id);
      else entered.add(id);

      const nextIdx = idx + 1;

      // --- Actualiza estado ---
      setGstate(prev => ({
        ...prev,
        g0: { ...st, entered, doubt, idx: nextIdx }
      }));

      // --- Log visible (solo resultado) ---
      if (decision === "duda") {
        pushLog(`⚠️ ${nameOf(id)} queda <em>EN DUDA</em>.`, 0);
      } else {
        pushLog(`🎤 ${nameOf(id)} entra directamente a la Academia.`, 0);
      }

      if (nextIdx >= order.length) {
        pushLog(`❓ En duda: ${Array.from(doubt).map(nameOf).join(", ")}.`, 0);
        setStage("g0_profes");
      }
    }


    function g0_profesSalvan(){
      const st = gstate?.g0; 
      if (!st) return;

      const candidatos = Array.from(st.doubt);

      if (candidatos.length !== 4 && candidatos.length !== 3) {
        pushLog("⚠️ Deben estar 4 concursantes en duda para que decidan los profesores.", 0);
        return;
      }
      // --- ELECCIÓN SEGÚN NOMINACIONES ---
      // Pasamos la lista actual de candidatos como argumento extra (para contar esta gala)
      const elegido = pickProfSave(
        candidatos,
        summaries,
        0,
        (ids) => ids[Math.floor(Math.random() * ids.length)],
        candidatos // 👈 nuevo parámetro: lista actual de en duda
      );

      // --- DEBUG solo consola ---
      const debugData = candidatos.map(id => ({
        id,
        nombre: nameOf(id),
        nominaciones: countNomsThrough
          ? countNomsThrough(id, summaries, 0, candidatos) // 👈 también pasa la lista aquí
          : countNomsUpTo(id, summaries, 1)
      }));


      console.debug("[G0 DEBUG] Profesores deciden entre:", debugData);
      console.debug("[G0 DEBUG] => Salvan a:", { id: elegido, nombre: nameOf(elegido) });

      // --- LOG público ---
      pushLog(`🎓 Profesores salvan a <strong>${nameOf(elegido)}</strong> (entra).`, 0);

      // --- Actualiza estado ---
      setGstate(stAll => {
        const entered = new Set(st.entered); entered.add(elegido);
        const doubt   = new Set(st.doubt);   doubt.delete(elegido);
        return { ...stAll, g0:{ ...st, entered, doubt, profesSaved: elegido } };
      });

      // --- Siguiente etapa ---
      setStage(candidatos.length === 4 ? "g0_publico" : "g0_cerrar");
    }


    function g0_publicoVota(){
      const st = gstate?.g0; if(!st) return;
      const candidatos = Array.from(st.doubt);
      if (candidatos.length !== 3) { pushLog("⚠️ Deben quedar 3 en duda para la votación del público."); return; }

      const pcts = randomPercentages(3);
      const tabla = candidatos.map((id,i)=>({ id, name: nameOf(id), pct: pcts[i] }))
                              .sort((a,b)=>b.pct-a.pct);
      const winner = tabla[0].id;
      const losers = [tabla[1].id, tabla[2].id];

      pushLog(`🗳️ Público: ${tabla.map(t=>`${t.name} ${fmtPct(t.pct)}`).join(" · ")}.`);
      pushLog(`✅ Se salva <strong>${nameOf(winner)}</strong>. ❌ Quedan fuera ${tabla.slice(1).map(t=>t.name).join(" y ")}.`);

      setGstate(stAll => {
        const entered = new Set(st.entered); entered.add(winner);
        const doubt   = new Set(st.doubt);   candidatos.forEach(id=>doubt.delete(id));
        return { ...stAll, g0:{ ...st, entered, doubt, public:{ tabla, winner, losers } } };
      });

      setStage("g0_cerrar");
    }

    function g0_cerrar(){
      const st = gstate?.g0; if(!st){ pushLog("⚠️ Nada que cerrar."); return; }
      const { entered, profesSaved, public:pub } = st;
      const publicoWinner = pub?.winner;
      const eliminadosIds = pub?.losers || [];

      // 1) Actualiza contestants con historia G0 y estados
      setContestants(prev => prev.map(c => {
        if (entered.has(c.id)) {
          const evento = (c.id===profesSaved) ? "Entra (profes)" :
                        (c.id===publicoWinner) ? "Entra (público)" :
                                                  "Entra (jurado)";
          return { ...c, history:[ ...c.history, { gala:0, evento } ] };
        }
        if (eliminadosIds.includes(c.id)) {
          return { ...c, status:"eliminado", history:[ ...c.history, { gala:0, evento:"Eliminado" } ] };
        }
        return c;
      }));

      // 🔁 Completar valoraciones en la tabla de reparto (Gala 0)
      setSummaries(s => {
        const S0 = s[0] || { gala: 0 };
        const rep0 = S0?.[0]?.reparto || [];

        const rep0Filled = rep0.map(row => {
          const id = row.members[0]; // En G0 todos son solos
          const g  = contestants.find(c=>c.id===id)?.gender ?? "e";
          const suf = g==="m"?"o":g==="f"?"a":"e";

          let valor = "";
          if (eliminadosIds.includes(id))       valor = `Eliminad${suf} por el público > No entra en la Academia`;
          else if (id === publicoWinner)        valor = `Salvad${suf} por el público > Entra en la Academia`;
          else if (id === profesSaved)          valor = `Salvad${suf} por los profesores > Entra en la Academia`;
          else if (entered.has(id))             valor = `Salvad${suf} por el jurado > Entra en la Academia`;

          return { ...row, valor };
        });

        return {
          ...s,
          0: {
            ...S0,                                // ✅ preserva lo existente (incl. reparto)
            0: { ...(S0[0] || {}), reparto: rep0Filled },
            gala0: {
              entraJurado: Array.from(entered).filter(id => id!==profesSaved && id!==publicoWinner),
              salvoProfes: profesSaved,
              salvoPublico: publicoWinner,
              eliminados: eliminadosIds
            }
          }
        };
      });

      // 3) Pasar a Gala 1 con 16 dentro
        const inside = new Set([
          ...Array.from(entered),
          profesSaved,
          publicoWinner
        ].filter(Boolean));

        // Construimos la lista de activos para G1 (objetos completos)
        const activos = contestants.filter(c => inside.has(c.id));
        const activosIds = activos.map(c => c.id);

        // ✅ Generar y GUARDAR el reparto de G1 (duetos)
         const reparto1base = buildRepartoParaGala(1, activosIds, []);
         const reparto1 = buildRepartoConCanciones({
           galaNum: 1,
           reparto: reparto1base,
           summaries,
           allSongs: songs,
         });
        setSummaries(s => ({
          ...s,
          1: { ...(s[1] || { gala: 1 }), 1: { ...(s[1]?.[1] || {}), reparto: reparto1 } }
        }));

        // ✅ Sembrar el estado base de G1 (para que aparezca el botón de favoritos)
        setGstate({
          publicRank: [], top3: [], top3Pct: undefined, favoritoId: undefined, top3Shown: false,
          evaluacionOrden: shuffle(activosIds), evalResults: [], salvados: new Set(),
          nominados: [], profesorSalvoId: undefined, votosCompaneros: [], salvadoCompanerosId: undefined,
          currentEvaluadoId: undefined, currentEvaluadoLogIndex: undefined, g12: undefined, g15: undefined
        });

        // ✅ Cambiar de gala, pestaña y etapa visible
        setGala(1);
        setViewGala(1);
        setStage("votoPublico"); // ← aquí aparece “🧪 Mostrar 3 más votados”

        pushLog("🏁 Gala 0 cerrada. Entran 16 concursantes. Comienza la Gala 1.");
    }


   const goNext = ()=>{ const next=gala+1; setGala(next); prepararNuevaGala(next); };


    function iniciarDueloCiego() {
      if (carryNominees.length !== 2) { setStage(nextStageFor(gala)); return; }
      const [a, b] = carryNominees;

      const { high, low } = randomDuelPercents();
      const giveToA = Math.random() < 0.5;
      const pctA = giveToA ? high : low;
      const pctB = giveToA ? low  : high;

      // Guardamos el paquete del duelo en gstate
      setGstate(st => ({
        ...st,
        duelStep: {
          a, b, pctA, pctB,
          winner: pctA > pctB ? a : b,
          loser:  pctA > pctB ? b : a
        }
      }));

      // Paso 1: porcentajes ciegos
      pushLog(`📊 Porcentajes ciegos (duelo): ${fmtPct(pctA)} · ${fmtPct(pctB)}.`);
      setStage("duelo_ciegos");
    }

    function dueloMostrarFrase() {
      const pkg = gstate?.duelStep;
      if (!pkg) { pushLog("⚠️ Primero muestra los porcentajes ciegos."); return; }
      const savedPct = Math.max(pkg.pctA, pkg.pctB);

      // Paso 2: frase del presentador (con el % del salvado)
      pushLog(`🗣️ <em>La audiencia ha decidido qué debe proseguir su formación en la academia con un (${savedPct.toFixed(1)}%)…</em>`);
      setStage("duelo_revelar");
    }

    function dueloRevelar() {
      const pkg = gstate?.duelStep;
      if (!pkg) { pushLog("⚠️ No hay duelo preparado."); return; }
      const { a, b, pctA, pctB, winner, loser } = pkg;

      // Paso 3: revelación y efectos (idéntico a tu flujo actual)
      setContestants(prev => prev.map(c => {
        if (c.id === loser) {
          return {
            ...c,
            status: "eliminado",
            history: [...(c.history || []), { gala, evento: "Eliminado", detalle: `${fmtPct(c.id===a?pctA:pctB)} vs ${fmtPct(c.id===b?pctB:pctA)}` }]
          };
        }
        return c;
      }));

      pushLog(`🗳️ <strong>${nameOf(winner)}</strong>. ${nameOf(loser)} es eliminado/a.`);

      // Guardado de duel + “salvado por público” en summaries (igual que hacías)
      setSummaries(s => ({
        ...s,
        [gala]: {
          ...(s[gala] || { gala }),
          duel: { a, b, pctA, pctB, winner },
          duelSaved: { ...(s[gala]?.duelSaved || {}), [winner]: (winner === a ? pctA : pctB) }
        }
      }));

      // Etiquetado del reparto (idéntico a tu post-proceso actual)
      setSummaries(s => {
        if (!s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;
        const jurNoms = new Set(s[gala]?.juradoNominados || []);
        const pctMap  = { [a]: pctA, [b]: pctB };

        const sufOf = (id) => {
          const g = contestants.find(x => x.id === id)?.gender ?? "e";
          return g === "m" ? "o" : g === "f" ? "a" : "e";
        };

        const rep = s[gala][gala].reparto.map(row => {
          const labels = row.members.map((id) => {
            if (!id) return "";

            if (id === loser) {
              const pct = pctMap[id];
              return `Expulsad${sufOf(id)} por el público (${typeof pct === "number" ? pct.toFixed(2) : "?"}%)`;
            }

            if (id === winner) {
              const pct = pctMap[id];
              const baseJurado = jurNoms.has(id)
                ? `Propuest${sufOf(id)} por el jurado`
                : `Salvad${sufOf(id)} por el jurado`;
              return `Salvad${sufOf(id)} por el público (${typeof pct === "number" ? pct.toFixed(2) : "?"}%) > ${baseJurado}`;
            }

            return "";
          });

          const nonEmpty = labels.filter(Boolean);
          if (!nonEmpty.length) return row;

          const uniq = [...new Set(nonEmpty)];
          const valor = (uniq.length === 1)
            ? uniq[0]
            : labels.map((v,i)=> (v?`(${i+1}) ${v}`:"")).filter(Boolean).join(" · ");

          return { ...row, valor };
        });

        return {
          ...s,
          [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } }
        };
      });

      setCarryNominees([]);
      setGstate(st => ({ ...st, duelStep: undefined }));
      // 🔁 Transición automática según la gala actual
      if (gala <= 9) {
        setStage("votoPublico");
      } else if (gala === 10) {
        setStage("juradoEvaluando");      // G10
      } else if (gala === 11) {
        setStage("g11_jurado");           // ▶️ NUEVO: pasar a votación de jueces en G11
      } else {
        setStage(nextStageFor(gala));
      }

    } 


  // Galas 1–10
    function resolverDueloPendiente(){
      if (carryNominees.length !== 2) { setStage(nextStageFor(gala)); return; }
      const [a, b] = carryNominees;

      const { high, low } = randomDuelPercents();
      const giveToA = Math.random() < 0.5;
      const pctA = giveToA ? high : low;
      const pctB = giveToA ? low  : high;

      const winner = pctA > pctB ? a : b;
      const loser  = winner === a ? b : a;

      // ✅ Actualiza el estado REAL de los concursantes
      setContestants(prev => prev.map(c => {
        if (c.id === loser) {
          return {
            ...c,
            status: "eliminado",
            history: [...(c.history || []), { gala, evento: "Eliminado", detalle: `${fmtPct(c.id===a?pctA:pctB)} vs ${fmtPct(c.id===b?pctB:pctA)}` }]
          };
        }
        return c;
      }));

      pushLog(`🗳️ Resultado nominados: ${nameOf(a)} ${fmtPct(pctA)} · ${nameOf(b)} ${fmtPct(pctB)} — se salva <strong>${nameOf(winner)}</strong>.`);

      // Guarda el duelo + “marcador de salvado por público” en ESTA gala
      setSummaries(s => ({
        ...s,
        [gala]: {
          ...(s[gala] || { gala }),
          duel: { a, b, pctA, pctB, winner },
          duelSaved: { ...(s[gala]?.duelSaved || {}), [winner]: (winner === a ? pctA : pctB) }
        }
      }));

      // Etiqueta la tabla de reparto DE ESTA GALA
      setSummaries(s => {
        if (!s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;
        const jurNoms = new Set(s[gala]?.juradoNominados || []);
        const pctMap  = { [a]: pctA, [b]: pctB };

        const sufOf = (id) => {
          const g = contestants.find(x => x.id === id)?.gender ?? "e";
          return g === "m" ? "o" : g === "f" ? "a" : "e";
        };

        const rep = s[gala][gala].reparto.map(row => {
          const labels = row.members.map((id, i) => {
            if (!id) return "";

            if (id === loser) {
              const pct = pctMap[id];
              return `Expulsad${sufOf(id)} por el público (${typeof pct === "number" ? pct.toFixed(2) : "?"}%)`;
            }

            if (id === winner) {
              const pct = pctMap[id];
              const baseJurado = jurNoms.has(id)
                ? `Propuest${sufOf(id)} por el jurado`
                : `Salvad${sufOf(id)} por el jurado`;
              return `Salvad${sufOf(id)} por el público (${typeof pct === "number" ? pct.toFixed(2) : "?"}%) > ${baseJurado}`;
            }

            return "";
          });

          const nonEmpty = labels.filter(Boolean);
          if (!nonEmpty.length) return row;

          const uniq = [...new Set(nonEmpty)];
          const valor = (uniq.length === 1)
            ? uniq[0]
            : labels.map((v,i)=> (v?`(${i+1}) ${v}`:"")).filter(Boolean).join(" · ");

          return { ...row, valor };
        });

        return {
          ...s,
          [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } }
        };
      });

      setCarryNominees([]);
      setStage(nextStageFor(gala));
    }



    function iniciarVotoPublico(){
      if (!gstate || gstate.top3Shown) return;

      const vivos = contestants.filter(c => c.status === "active");
      if (!vivos.length) return;

      // 🚫 Mantiene el veto al salvado del duelo de ESTA gala (ya estaba implementado)
      const winnerThisGala = summaries[gala]?.duel?.winner || null;
      const ban = new Set([
        ...(gstate?.top3Ban ? Array.from(gstate.top3Ban) : []),
        ...(winnerThisGala ? [winnerThisGala] : [])
      ]);

      const rands = randomPercentages(vivos.length);
      const ranked = vivos
        .map((c, i) => ({ id: c.id, pct: rands[i] }))
        .sort((a, b) => b.pct - a.pct);

      const top3Rows = ranked.filter(r => !ban.has(r.id)).slice(0, 3);
      const top3Ids  = top3Rows.map(r => r.id);
      const top3Pct  = top3Rows.map(r => r.pct);

      const favoritoId = top3Ids[0] ?? null;

      // 👇 NO logueamos porcentajes aquí para no spoilear
      // Preparamos orden aleatorio para la primera revelación
      const randomTop3Order = shuffle(top3Ids);

      setGstate(prev => ({
        ...prev,
        publicRank: ranked,
        top3: top3Ids,
        top3Pct,
        favoritoId,               // solo almacenado, aún no "revelado"
        top3Shown: true,
        top3RandomOrder: randomTop3Order,
        top3NamesRevealed: false, // 🆕 flag de fase 1
        top3Ban: new Set([...(prev.top3Ban || []), ...(winnerThisGala ? [winnerThisGala] : [])])
      }));

      setSummaries(s => ({
        ...s,
        [gala]: {
          ...(s[gala] || { gala }),
          duelSaved: s[gala]?.duelSaved,
          [gala]: { ...(s[gala]?.[gala] || {}) }
        }
      }));

      // Log neutro para guiar la UI
      pushLog(`🧪 Top 3 preparado. Pulsa “Revelar 3 favoritos” para mostrarlos sin porcentajes.`);
    }


    function revelarTop3YFavorito(){
      if (!gstate || gstate.top3.length === 0) return;
      if (gala >= 10) {
        pushLog(`ℹ️ Desde la Gala 10 no hay favorito. Continúa con la evaluación del jurado.`);
        setStage("juradoEvaluando");
        return;
      }

      // ——— FASE 1: solo nombres, orden aleatorio, sin % ———
      if (!gstate.top3NamesRevealed) {
        const orden = (gstate.top3RandomOrder?.length
          ? gstate.top3RandomOrder
          : shuffle(gstate.top3));
        const lista = orden.map(nameOf).join(" · ");
        pushLog(`🎖️ Los 3 favoritos (orden aleatorio): ${lista}`);
        setGstate({ ...gstate, top3NamesRevealed: true });

          setSummaries(s => ({
          ...s,
          [gala]: {
            ...(s[gala] || { gala }),
            top3Ids: gstate.top3,          // 👈 solo nombres Top-3
            [gala]: { ...(s[gala]?.[gala] || {}) }
          }
        }));

        // 👆 No fijamos favorit@ todavía, ni cambiamos de etapa
        return;
      }

      // ——— FASE 2: revelación completa (como siempre) ———
      const top3 = gstate.top3
        .map(id => gstate.publicRank.find(r => r.id === id))
        .filter(Boolean)
        .sort((a, b) => b.pct - a.pct);

      const favorito = top3[0];
      const top3Pct  = top3.map(t => t.pct);

      const salvados = new Set(gstate.salvados);
      salvados.add(favorito.id);

      pushLog(
        `🌟 <strong>Favorito/a: ${nameOf(favorito.id)}</strong>. ` +
        `Porcentajes Top3: ${top3.map(t => `${nameOf(t.id)} ${fmtPct(t.pct)}`).join(" · ")}`
      );

      setGstate({
        ...gstate,
        favoritoId: favorito.id,
        salvados,
        top3Pct,
        finalTwoPlan: undefined
      });

      setSummaries(s => ({
        ...s,
        [gala]: { ...(s[gala] || { gala }), top3Pct, favoritoId: favorito.id }
      }));

      setStage("juradoEvaluando");
    }

    function evaluarSiguientePorJurado(){
      if (!gstate) return;

      const sufOfId = (id) => {
      const g = contestants.find(x => x.id === id)?.gender || "e";
      return g === "m" ? "o" : g === "f" ? "a" : "e";
    };
    const NOM = (id) => `NOMINAD${sufOfId(id).toUpperCase()}`;   // para logs en MAYÚSCULAS
    // (si lo prefieres en capitalización normal, usa: `Nominad${sufOfId(id)}`)


      // 1) Construir orden al entrar al jurado
      if (!gstate.evaluacionOrden || gstate.evaluacionOrden.length === 0) {
        const vivosIds   = contestants.filter(c => c.status === "active").map(c => c.id);
        const favId      = gstate.favoritoId || null;
        const nomineeIds = favId ? vivosIds.filter(id => id !== favId) : [...vivosIds];
        const ordenValoraciones = buildValoracionesOrder(vivosIds, nomineeIds);

        setGstate(st => ({
          ...st,
          evaluacionOrden: ordenValoraciones,
          currentEvaluadoIndex: 0,
          currentEvaluadoId: null,
        }));
        setSummaries(s => ({
          ...s,
          [gala]: { ...(s[gala] || { gala }), ordenValoraciones }
        }));
        return;
      }
      const DEBUG_PROBS = true; // ponlo en false para silenciar
      const vivos = contestants.filter(c => c.status === "active").map(c => c.id);
      const writeAt = (idx, html) =>
        setGalaLogs(prev => {
          const arr = [ ...(prev[gala] || []) ];
          arr[idx] = html;
          return { ...prev, [gala]: arr };
        });

      // 2) Abrir “ficha” si no hay evaluado actual
      if (!gstate.currentEvaluadoId) {
        const pend = gstate.evaluacionOrden
          .filter(id => vivos.includes(id) && !gstate.salvados.has(id) && !gstate.nominados.includes(id));

        if (!pend.length) {
          let nominados = [ ...gstate.nominados ];
          const rest = gstate.evaluacionOrden.filter(id => !gstate.salvados.has(id) && !nominados.includes(id));
          while (nominados.length < 4 && rest.length) nominados.push(rest.shift());

          setGstate({ ...gstate, nominados, currentEvaluadoId: undefined, currentEvaluadoLogIndex: undefined });
          pushLog(`🚨 <strong>Propuestos por el jurado (4)</strong>: ${nominados.map(nameOf).join(", ")}.`);
          setSummaries(s => ({ ...s, [gala]: { ...(s[gala] || { gala }), juradoNominados: nominados } }));
          setStage("profesSalvan");
          return;
        }

        const actualId = pend[0];
        const idx = (galaLogs[gala]?.length || 0);
        setGalaLogs(prev => {
          const arr = [ ...(prev[gala] || []) ];
          arr.push(`⚖️ Jurado evalúa a <strong>${nameOf(actualId)}</strong> → …`);
          return { ...prev, [gala]: arr };
        });
        setGstate({ ...gstate, currentEvaluadoId: actualId, currentEvaluadoLogIndex: idx });
        return;
      }

      // 3) Decidir acción sobre el evaluado actual
      const id = gstate.currentEvaluadoId;
      const logIdx = gstate.currentEvaluadoLogIndex ?? (galaLogs[gala]?.length || 1) - 1;

      // reconstruir pendientes (id primero)
      let pend = gstate.evaluacionOrden
        .filter(x => vivos.includes(x) && !gstate.salvados.has(x) && !gstate.nominados.includes(x));
      if (pend[0] !== id) pend = [ id, ...pend.filter(x => x !== id) ];

      const remaining = pend.length;
      const needed = 4 - gstate.nominados.length;
      let plan = gstate.finalTwoPlan;

      // —— Reglas específicas para GALA 9 ——
      // (a) 3ª valoración y aún 0 nominados → forzar NOMINADO
      const evIndex = gstate.evalResults.length; // 0,1,2... (2 == tercera)
      if (gala === 9 && evIndex === 2 && gstate.nominados.length === 0) {
        writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → <strong>${NOM(id)}</strong>.`);
        setGstate({
          ...gstate,
          currentEvaluadoId: undefined,
          currentEvaluadoLogIndex: undefined,
          nominados: [ ...gstate.nominados, id ],
          evalResults: [ ...gstate.evalResults, { id, result: "nominado" } ],
          evaluacionOrden: gstate.evaluacionOrden.filter(x => x !== id),
          finalTwoPlan: undefined,
        });
        return;
      }

      // (b) Quedan 4 por evaluar y faltan ≥3 nominados → forzar NOMINADO ahora
      if (gala === 9 && remaining === 4 && needed >= 3) {
        writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → <strong>${NOM(id)}</strong>.`);
        setGstate({
          ...gstate,
          currentEvaluadoId: undefined,
          currentEvaluadoLogIndex: undefined,
          nominados: [ ...gstate.nominados, id ],
          evalResults: [ ...gstate.evalResults, { id, result: "nominado" } ],
          evaluacionOrden: gstate.evaluacionOrden.filter(x => x !== id),
          finalTwoPlan: undefined,
        });
        return;
      }
      // —— Fin reglas G9 ——

      // 3A-bis) Si quedan 3 y faltan ≥2 → nomina YA (evita pedir 2 en las dos últimas)
      if (remaining === 3 && needed >= 2) {
        writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → <strong>${NOM(id)}</strong>.`);
        setGstate({
          ...gstate,
          currentEvaluadoId: undefined,
          currentEvaluadoLogIndex: undefined,
          nominados: [ ...gstate.nominados, id ],
          evalResults: [ ...gstate.evalResults, { id, result: "nominado" } ],
          evaluacionOrden: gstate.evaluacionOrden.filter(x => x !== id),
          finalTwoPlan: undefined,
        });
        return;
      }

      // 3A) Si ya hay 3 nominados y quedan >2 → este va salvado
      if (gstate.nominados.length >= 3 && remaining > 2) {
        writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → cruza la pasarela.`);
        const salvados = new Set(gstate.salvados); salvados.add(id);
        setGstate({
          ...gstate,
          currentEvaluadoId: undefined,
          currentEvaluadoLogIndex: undefined,
          salvados,
          evalResults: [ ...gstate.evalResults, { id, result: "salvado" } ],
          evaluacionOrden: gstate.evaluacionOrden.filter(x => x !== id)
        });
        return;
      }

      // 3B) DOS ÚLTIMAS: SIEMPRE 1 NOMINADO y 1 SALVADO (orden aleatorio)
      if (remaining === 2) {
        plan = (needed <= 0)
          ? ["salvado", "salvado"]
          : (Math.random() < 0.5 ? ["nominado", "salvado"] : ["salvado", "nominado"]);
        setGstate({ ...gstate, finalTwoPlan: plan });
      }

      // 3C) Decisión “normal” (con ventanas y performance)
      const last2 = gstate.evalResults.slice(-2).map(r => r.result);
      let decision;

      if (remaining === needed) {
        decision = "nominado";
      }
      else if (remaining === 2 && plan) {
        decision = plan[0];
      }
      else if (evIndex < 3 && gstate.nominados.length >= 1) {
        decision = "salvado"; // primeras 3: máx 1 nominado
      }
      else {
        const last3 = gstate.evalResults.slice(-3).map(r => r.result);
        const nomsInLast3 = last3.filter(x => x === "nominado").length;
        if (nomsInLast3 >= 2) {
          decision = "salvado";
        } else {
          const votePct  = gstate.publicRank.find(r => r.id === id)?.pct ?? 50;
          const probBase = clamp(BASE_NOM_PROB - PUBLIC_WEIGHT * ((votePct - 50) / 150), 0.25, 0.8);
          let prob = clamp(probBase /* + sesgos */ , 0.05, 0.85);

          try {
            const songTitle = getSongFor(id, summaries, gala);
            const normalize = s => (s || "").toLowerCase()
              .normalize("NFD").replace(/\p{Diacritic}/gu, "")
              .replace(/^["“”«»]+|["“”«»]+$/g, "")
              .replace(/\s+/g, " ")
              .trim();
            const req =
              songTitle
                ? (songsMeta.exact?.[songTitle.trim()] ??
                  songsMeta.norm?.[normalize(songTitle)] ?? null)
                : null;

            const stats = contestants.find(c => c.id === id)?.stats;
            const perfMod = performanceModifier(stats, req);
            prob = clamp(prob + perfMod, 0.02, 0.90);

            // 🔎 DEBUG: imprime cálculo de probabilidades para este concursante
            if (DEBUG_PROBS) {
              console.log(`[DEBUG G${gala}]`, {
                name: nameOf(id),
                songTitle,
                votePct,
                probBase,
                perfMod,
                probFinal: prob,
                last2: gstate.evalResults.slice(-2).map(r => r.result),
              });
            }
          } catch (e) {
            // opcional: también puedes ver errores del ajuste de canción
            if (DEBUG_PROBS) console.warn("DEBUG perfMod error:", e);
          }

          decision = (prob >= 0.5) ? "nominado" : "salvado";
        }
      }

      // seguridad: nunca 3 nominados seguidos (fuera de las dos últimas)
      const inLastTwo = (remaining <= 2);
      if (!inLastTwo && decision === "nominado" && last2[0] === "nominado" && last2[1] === "nominado") {
        decision = "salvado";
      }

      // Postcondición: debe seguir siendo posible llegar a 4 nominados
      let nomAfter  = gstate.nominados.length + (decision === "nominado" ? 1 : 0);
      let remAfter  = remaining - 1;
      let needAfter = 4 - nomAfter;
      if (needAfter > remAfter) {
        decision = "nominado";
        nomAfter  = gstate.nominados.length + 1;
        remAfter  = remaining - 1;
      }

      // 3D) Aplicar
      if (decision === "nominado" && gstate.nominados.length < 4) {
        writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → <strong>${NOM(id)}</strong>.`);
        setGstate({
          ...gstate,
          currentEvaluadoId: undefined,
          currentEvaluadoLogIndex: undefined,
          nominados: [ ...gstate.nominados, id ],
          evalResults: [ ...gstate.evalResults, { id, result: "nominado" } ],
          finalTwoPlan: plan ? plan.slice(1) : undefined,
          evaluacionOrden: gstate.evaluacionOrden.filter(x => x !== id)
        });
      } else {
        writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → cruza la pasarela.`);
        const salvados = new Set(gstate.salvados); salvados.add(id);
        setGstate({
          ...gstate,
          currentEvaluadoId: undefined,
          currentEvaluadoLogIndex: undefined,
          salvados,
          evalResults: [ ...gstate.evalResults, { id, result: "salvado" } ],
          finalTwoPlan: plan ? plan.slice(1) : undefined,
          evaluacionOrden: gstate.evaluacionOrden.filter(x => x !== id)
        });
      }
    }



    function profesoresSalvanUno() {
      if (!gstate || (gstate.nominados || []).length !== 4) return;

      const cand = [...gstate.nominados];

      // En G10: contar nominaciones solo hasta la Gala 9 (sin incluir la actual)
      const countUntil = (gala === 10) ? 9 : gala;
      const curList    = (gala === 10) ? undefined : cand;

      const salvado = pickProfSave(
        cand,
        summaries,
        countUntil,
        (ids) => ids[Math.floor(Math.random() * ids.length)],
        curList
      );

      // --- DEBUG visible siempre ---
      const debugData = cand.map(id => ({
        id,
        nombre: nameOf(id),
        nominaciones: countNomsThrough(id, summaries, countUntil, curList)
      }));

      const etiqueta = (gala === 10)
        ? `[G10 DEBUG] Profesores (criterio: menos nominaciones hasta G9)`
        : `[G${gala} DEBUG] Profesores deciden entre:`;

      console.group(etiqueta);
      console.table(debugData);
      console.log(`=> Salvan a:`, { id: salvado, nombre: nameOf(salvado) });
      console.groupEnd();

      // Log normal en simulador
      pushLog(`🎓 Profesores salvan a <strong>${nameOf(salvado)}</strong>.`);

      const nominados = cand.filter(id => id !== salvado);
      const salvados  = new Set(gstate.salvados); salvados.add(salvado);

      setGstate({ ...gstate, profesorSalvoId: salvado, nominados, salvados });

      setSummaries(s => ({
        ...s,
        [gala]: { ...(s[gala] || { gala }), profesorSalvoId: salvado, juradoNominados: s[gala]?.juradoNominados || cand }
      }));

      setSummaries(s => {
        const Sact = {
          ...s,
          [gala]: {
            ...(s[gala] || { gala }),
            profesorSalvoId: salvado,
            juradoNominados: s[gala]?.juradoNominados || cand,
            top3Ids: s[gala]?.top3Ids || [],
            top3Pct: s[gala]?.top3Pct || [],
            duelSaved: s[gala]?.duelSaved,
            [gala]: s[gala]?.[gala] || {}
          }
        };
        return rellenarValoracionesReparto(gala, Sact, contestants);
      });

      setStage("companerosVotan");
    }




  
  function companerosVotan(){
      // 🔐 Defensas tempranas
      if (!gstate) { pushLog("⚠️ Estado no inicializado."); return; }

      // Asegura colecciones válidas
      const salvadosSet = gstate.salvados instanceof Set ? gstate.salvados : new Set();
      const candidatos = Array.isArray(gstate.nominados) ? gstate.nominados.slice() : [];

      // Necesitamos exactamente 3 nominados para esta fase
      if (candidatos.length !== 3) {
        pushLog(`⚠️ La votación de compañeros requiere 3 nominados, hay ${candidatos.length || 0}. Se omite.`);
        return;
      }

      // Electores: salvados hasta ahora
      const electores = Array.from(salvadosSet);
      if (electores.length === 0) {
        pushLog("⚠️ No hay ningún salvado que pueda votar. Se omite.");
        return;
      }

      // Emitir votos
      const votos = [];
      electores.forEach(v => {
        const elegido = pickRandom(candidatos, 1)[0];
        // Si por lo que sea no hay elegido, salimos con seguridad
        if (!elegido) return;
        votos.push({ voterId: v, votedId: elegido });
      });

      // Recuento robusto
      const recuento = Object.fromEntries(candidatos.map(c => [c, 0]));
      votos.forEach(v => {
        if (v && v.votedId in recuento) recuento[v.votedId] = (recuento[v.votedId] || 0) + 1;
      });

    // === Empate y voto doble del favorito (solo para desempate) ===

    // construimos mapa de voto por votante (para saber a quién votó el favorito)
    const votoDe = {};
    votos.forEach(v => { votoDe[v.voterId] = v.votedId; });

    // determinamos el recuento máximo y los empatados
    let max = Math.max(...Object.values(recuento));
    let empatados = Object.entries(recuento)
      .filter(([, n]) => n === max)
      .map(([id]) => id);

    // === Empate y voto doble del favorito (solo para desempate) ===
    let desempateMsg = null;
    if (empatados.length > 1) {
      const favId = gstate.favoritoId ?? null;
      if (favId) {
        const votoFav = votoDe[favId];
        if (votoFav && empatados.includes(votoFav)) {
          empatados = [votoFav];
          desempateMsg = `⭐ Desempate: el voto del favorito (${nameOf(favId)}) decide a favor de ${nameOf(votoFav)}.`;
        }
      }
    }


      // Elegir ganador con tolerancia si por algún motivo sigue vacío
      const ganador = (empatados.length ? pickRandom(empatados, 1)[0] : pickRandom(candidatos, 1)[0]);
      if (!ganador) {
        pushLog("⚠️ No se pudo determinar ganador en la votación de compañeros. Se omite.");
        return;
      }

      // Logs bonitos
      const votosList = votos.map(v => `<li>${nameOf(v.voterId)} → ${nameOf(v.votedId)}</li>`).join("");
      pushLog(`🧑‍🤝‍🧑 Votación de compañeros:<ul style="margin:4px 0 0 16px;">${votosList}</ul>${gstate.favoritoId ? "<div class=\"text-xs\">* El voto del favorito vale doble en caso de empate</div>" : ""}`);


      // 📊 Mostrar recuento
      const contadorHTML = candidatos.map(id => `<strong>${nameOf(id)}</strong> ${recuento[id] ?? 0}`).join(" · ");
      pushLog(`📊 Recuento de votos (compañeros): ${contadorHTML}`);

      // ⭐ Mostrar mensaje de desempate (si lo hubo)
      if (desempateMsg) pushLog(desempateMsg);

      pushLog(`✅ Más votado por compañeros: <strong>${nameOf(ganador)}</strong> (se salva).`);

      // Avance de estado
      const nominadosRestantes = candidatos.filter(id => id !== ganador);
      const nuevosSalvados = new Set(salvadosSet); nuevosSalvados.add(ganador);

      setGstate({
        ...gstate,
        votosCompaneros: votos,
        salvadoCompanerosId: ganador,
        nominados: nominadosRestantes,
        salvados: nuevosSalvados
      });

      // Guardado mínimo (no dependemos de estructuras profundas aún)
      setSummaries(s => ({
        ...s,
        [gala]: { ...(s[gala] || { gala }), salvadoCompanerosId: ganador, finalNominees: nominadosRestantes }
      }));

      pushLog(`🟥 Nominados para la próxima gala: <strong>${nameOf(nominadosRestantes[0])}</strong> vs <strong>${nameOf(nominadosRestantes[1])}</strong>.`);
      setCarryNominees(nominadosRestantes);

      // 💾 Completar valoraciones en la tabla de reparto SOLO si existe el reparto
      setSummaries(s => {
        const seguro = {
          ...s,
          [gala]: {
            ...(s[gala] || { gala }),
            // ✅ Mantenemos la lista original de propuestos del jurado
            juradoNominados: s[gala]?.juradoNominados || [],

            // ✅ Quien salvó el jurado o profes
            profesorSalvoId: gstate.profesorSalvoId ?? s[gala]?.profesorSalvoId,

            // ✅ Ganador de los compañeros
            salvadoCompanerosId: ganador,

            // ✅ Nominados finales que van a duelo
            finalNominees: nominadosRestantes,

            // ✅ Info del público (favorito y %)
            favoritoId: gstate.favoritoId ?? s[gala]?.favoritoId,
            top3Pct: gstate.top3Pct ?? s[gala]?.top3Pct,
            top3Ids: s[gala]?.top3Ids || [],   // 👈 PRESERVA EL TOP-3 DE ESA GALA

            // ✅ Si alguien venía salvado del público, no perderlo
            duelSaved: s[gala]?.duelSaved,

            [gala]: s[gala]?.[gala] || {}
          }
        };

        // 👉 Recalcula la tabla de reparto con las nuevas etiquetas
        const res = rellenarValoracionesReparto(gala, seguro, contestants);

        // Devuelve el nuevo objeto de summaries actualizado
        return res;
      });
      // 🧹 Consumir duelSaved: que NO se arrastre a la siguiente gala
        setSummaries(s => ({
          ...s,
          [gala]: { ...(s[gala] || { gala }), duelSaved: {} }
        }));


      // 👉 Una vez actualizados los summaries, cierra la gala
      setStage("galaCerrada");

        // === AVANZAR A LA SIGUIENTE GALA ===
        const goNext = () => {
          const next = gala + 1;
          setGala(next);
          prepararNuevaGala(next, contestants);
        };
  }

    // ===============================================================
    //  Gala 11  →  6 concursantes
    //  - 4 jueces puntúan (6.0–10.0 en pasos de 0.5, con sesgo leve)
    //  - 3 más puntuados → Finalistas por jurado
    //  - Profesores salvan 1 (menos nominaciones hasta Gala 10)
    //  - Quedan 2 nominados → duelo público en Gala 12
    // ===============================================================
    // 🧮 GALA 11 — Fase 1: jurado (Top-3 = menos nominaciones) + recorrido con medias
    function g11_puntuarJurado() {
      const toHalf = x => Math.round(x * 2) / 2;
      const clamp  = (x, a, b) => Math.max(a, Math.min(b, x));

      // === SOLO 6 concursantes "vivos" (excluye al eliminado del duelo) ===
      const rows   = (summaries?.[11]?.[11]?.reparto || []);
      const idsRaw = rows.flatMap(r => r.members);
      const ids    = Array.from(new Set(idsRaw)).filter(id => {
        const c = contestants.find(x => x.id === id);
        return c && c.status !== "eliminado" && c.status !== "expulsado";
      });

      if (!ids.length) {
        pushLog("⚠️ No hay concursantes en el reparto de la Gala 11.");
        return;
      }
      if (ids.length !== 6) {
        pushLog(`⚠️ Aviso: el jurado debería puntuar a 6 concursantes y ahora mismo hay ${ids.length}.`, 11);
      }

      // Nominaciones acumuladas G1–G10
      const withNoms = ids.map(id => ({
        id,
        noms: countNomsThrough(id, summaries, 10, undefined)
      }));

      // Ordenar por menos nominaciones y fijar Top-3 por norma
      const ordered    = withNoms.sort((a,b)=>a.noms-b.noms);
      const forcedTop3 = new Set(ordered.slice(0,3).map(x=>x.id));
      const bottom3    = ordered.slice(-3).map(x=>x.id); // se decidirán luego con profes

      // Generar notas (Top-3 medias más altas; el resto depende de sus nominaciones)
      const notas = {};
      ids.forEach(id => {
        const item = withNoms.find(x=>x.id===id);
        const baseMean = forcedTop3.has(id) ? 8.8 : 8.6 - 0.30 * (item?.noms ?? 0);
        const arr = [];
        for (let j=0;j<4;j++) {
          const noise = (Math.random()-0.5) * 1.0; // ±0.5
          arr.push(clamp(toHalf(baseMean + noise), 5, 10));
        }
        notas[id] = arr;
      });

      // Ranking por media y desglose por juez
      const ranking = ids.map(id => {
        const media = +(notas[id].reduce((a,b)=>a+b,0) / 4).toFixed(2);
        return { id, media, notas: notas[id] };
      }).sort((A,B)=>B.media-A.media);

      const desglose = ids.map(id => {
        const [j1,j2,j3,j4] = notas[id];
        const total = +(j1+j2+j3+j4).toFixed(2);
        return { id, j1, j2, j3, j4, total };
      }).sort((a,b)=>b.total-a.total);

      // Top-3 garantizado por menos nominaciones
      const top3Ids = Array.from(forcedTop3);

      // 🗺️ RECORRIDO (G11): “Nota: x.xx” + color
      // - DodgerBlue: mayor media del Top-3
      // - Blanco: los otros 2 del Top-3
      // - Orange: el resto (temporal; luego profes pasa 1 a YellowGreen)
      const top3Ranking = ranking.filter(r => top3Ids.includes(r.id)).sort((a,b)=>b.media-a.media);
      const bestId = top3Ranking[0]?.id;

      if (typeof setRecorrido === "function") {
        setRecorrido(prev => {
          const next = { ...prev };
          if (!next[11]) next[11] = {};
          ranking.forEach(r => {
            let color = "orange";
            if (top3Ids.includes(r.id)) color = (r.id === bestId) ? "DodgerBlue" : "white";
            next[11][r.id] = `Nota: ${r.media.toFixed(2)}|${color}`;
          });
          return next;
        });
      }

      const recorridoG11 = ranking.map(r => ({
        id: r.id,
        valor: `Nota: ${r.media.toFixed(2)}`,
        color: top3Ids.includes(r.id) ? (r.id === bestId ? "DodgerBlue" : "white") : "orange",
      }));

      // Persistir TODO de la Fase 1 en un solo setSummaries
      setSummaries(s => ({
        ...s,
        11: {
          ...(s[11] || { gala: 11 }),
          juradoNotas: notas,
          juradoRanking: ranking,
          juradoDesglose: desglose,
          juradoTop3: top3Ids,
          juradoBottom3: bottom3,
          recorrido: recorridoG11,
          [11]: { ...(s[11]?.[11] || {}), reparto: (s[11]?.[11]?.reparto || []) }
        }
      }));

      // Marcar finalistas (Top-3)
      setContestants(prev => prev.map(c => (
        top3Ids.includes(c.id)
          ? { ...c, status: "finalista", history: [...(c.history||[]), { gala: 11, evento: "Finalista" }] }
          : c
      )));

      // Logs
      const listaMedia = ranking.map(t=>`${nameOf(t.id)} ${t.media}`).join(" · ");
      pushLog(`📊 Media del jurado (G11): ${listaMedia}.`);
      pushLog(`🏁 Finalistas por jurado (Top 3): ${top3Ids.map(nameOf).join(", ")}.`);
      pushLog(`⏭️ Falta decisión de profes entre: ${bottom3.map(nameOf).join(", ")}.`);

      // Pintar reparto (Top-3 Finalista) y pasar a profesores
      setSummaries(s => rellenarValoracionesReparto(11, s, contestants));
      setStage("g11_profes");
    }


    
    // 🎓 GALA 11 — Fase 2: profesores salvan 1 del Bottom-3 → 4º finalista; otros 2 al duelo (G12)
    function g11_profesoresSalvan() {
      const bottom3 = summaries?.[11]?.juradoBottom3 || [];
      if (!bottom3.length) {
        pushLog("⚠️ No hay Bottom-3 guardado. Pulsa antes 'Puntuar jurado (G11)'.");
        return;
      }

      // Criterio: menos nominaciones acumuladas (G1–G11)
      const profSaveId = pickProfSaveByFewestNoms(new Set(bottom3), summaries, 11);
      const duelIds = bottom3.filter(x => x !== profSaveId);

      // 1) Persistir resultados finales de G11 + recolorear 'recorrido' en summaries
      setSummaries(prev => {
        const updated = { ...prev };
        const S11 = { ...(updated[11] || { gala: 11 }) };

        // Recolorear recorrido si existe (mantiene DodgerBlue/white del top3; pone yellowgreen al salvado)
        const rec = Array.isArray(S11.recorrido)
          ? S11.recorrido.map(r =>
              r.id === profSaveId
                ? { ...r, color: "yellowgreen" }
                : r // los dos duelistas ya están en orange desde la fase 1
            )
          : S11.recorrido;

        updated[11] = {
          ...S11,
          profesorSalvoId: profSaveId,
          juradoNominados: duelIds,
          finalNominees: duelIds,   // para arrastrar a G12
          recorrido: rec
        };
        return updated;
      });

      // 2) Marcar 4º finalista en contestants
      setContestants(prev => prev.map(c => {
        if (c.id === profSaveId) {
          return {
            ...c,
            status: "finalista",
            history: [...(c.history || []), { gala: 11, evento: "Finalista" }]
          };
        }
        return c;
      }));

    // 3) (Opcional) si tu tabla de recorrido también lee de setRecorrido (formato "Texto|color"), sincroniza:
    if (typeof setRecorrido === "function") {
      setRecorrido(prev => {
        const n = { ...prev };
        if (!n[11]) n[11] = {};
        const duelSet = new Set(duelIds.map(String));
        const profStr = String(profSaveId);

        Object.keys(n[11]).forEach(k => {
          const raw = String(n[11][k]);
          const [texto] = raw.includes("|") ? raw.split("|") : [raw];
          if (k === profStr) n[11][k] = `${texto}|yellowgreen`;
          if (duelSet.has(k)) n[11][k] = `${texto}|orange`; // garantizamos orange en duelistas
        });
        return n;
      });
    }

      // 4) Logs
      pushLog(`🎓 Profesores salvan a <strong>${nameOf(profSaveId)}</strong> (4º finalista).`);

      // 5) Repintar la columna "Valoración" del reparto de la G11 y pasar a cierre
      setSummaries(s => rellenarValoracionesReparto(11, s, contestants));  // pinta profe + duelistas
      setStage("g11_cerrar");
    }



    // ✅ Cerrar Gala 11 → preparar Gala 12 (4 finalistas + 2 nominados) y pasar al flujo de público
    function g11_cerrar() {
      const s11 = summaries?.[11] || {};
      const top3    = (s11.juradoTop3 || []).map(String);               // finalistas por jurado (3)
      const profStr = s11.profesorSalvoId != null ? String(s11.profesorSalvoId) : null; // 4º finalista
      const bottom3 = (s11.juradoBottom3 || []).map(String);            // los 3 menos votados por jurado

      // Duelistas que se arrastran a G12
      let duelIds = (s11.finalNominees || []).map(String);
      if (duelIds.length !== 2) duelIds = bottom3.filter(id => id !== profStr).slice(0, 2);

      if (duelIds.length !== 2) {
        pushLog("⚠️ No hay 2 nominados arrastrados desde G11. Revisa la votación del jurado.", 11);
      }

      const finalistasG11 = [...top3, profStr].filter(Boolean);
      if (finalistasG11.length) {
        pushLog(`🏁 Finalistas tras G11: <strong>${finalistasG11.map(nameOf).join(", ")}</strong>.`, 11);
        pushLog(`⚔️ Duelistas que pasan a G12: <strong>${duelIds.map(nameOf).join(" y ")}</strong>.`, 11);
      }

      // Guarda duelistas en summaries[11]
      setSummaries(s => ({ ...s, 11: { ...(s[11] || { gala: 11 }), finalNominees: duelIds }}));

      // (opcional) carry
      if (typeof setCarryNominees === "function") setCarryNominees(duelIds);

      // Prepara reparto de G12 (4 finalistas + 2 nominados)
      if (typeof prepararNuevaGala === "function") prepararNuevaGala(12);
      setSummaries(s => rellenarValoracionesReparto(12, s, contestants));

      // Limpia estado temporal g12
      setGstate(st => ({ ...(st || {}), g12: null }));

      // Cambia a G12 y muestra botones de público
      setGala(12);
      if (typeof setViewGala === "function") setViewGala(12);
      setStage("g12_14_publico");
    }


    // 📊 G12 — paso 1: generar porcentajes ciegos (duelo entre los 2 nominados de G11)
    function g12_setup() {
      const duelIds = (summaries?.[11]?.finalNominees || []).map(String);
      if (duelIds.length !== 2) { pushLog("⚠️ En G12 debe haber 2 duelistas (arrastrados desde G11).", 12); return; }
      const [a, b] = duelIds;

      const pctA = +(52 + Math.random() * 26).toFixed(2); // 52–78
      const pctB = +(100 - pctA).toFixed(2);

      setGstate(s => ({
        ...(s || {}),
        g12: {
          duel: { a, b, pctA, pctB, winner: null },
          revealQueue: [{ pct: pctA, id: null }, { pct: pctB, id: null }],
          revealed: [],
          duelDone: false,
          phraseShown: false
        }
      }));

      pushLog(`📊 Porcentajes ciegos: ${pctA.toFixed(2)}% · ${pctB.toFixed(2)}%`, 12);

      // Reparto: 4 Finalista + 2 Nominado hasta resolver
      setSummaries(s => rellenarValoracionesReparto(12, s, contestants));
    }


    // 🔊 G12 — paso 2: SOLO mostrar la frase del presentador (sin mapear % a nombres)
    function g12_revealPhrase() {
      const g = gstate?.g12;
      if (!g || g.phraseShown) return;

      // El % ganador: el mayor de los dos porcentajes ciegos
      const high = Math.max(g.duel.pctA, g.duel.pctB);

      pushLog(
        `🗣️ <em>La audiencia ha decidido que el concursante que debe convertirse en el último finalista con un (${high.toFixed(2)}%) sea…</em>`,
        12
      );

      // Marcamos que ya se mostró la frase
      setGstate(s => ({ ...(s || {}), g12: { ...g, phraseShown: true } }));
    }


    // ⚔️ G12 — resolver duelo (decide 5º finalista) + logs claros
    function g12_duel() {
      const g = gstate?.g12;
      if (!g || g.duelDone) return;

      const { a, b } = g.duel;

      // ganador por mayor %
      const map  = new Map((g.revealed || []).map(r => [String(r.id), r.pct]));
      const pctA = map.has(String(a)) ? map.get(String(a)) : g.duel.pctA;
      const pctB = map.has(String(b)) ? map.get(String(b)) : g.duel.pctB;

      const winner = pctA > pctB ? a : b;
      const loser  = winner === a ? b : a;

      // Guarda en gstate y summaries
      setGstate(s => ({ ...(s || {}), g12: { ...g, duel: { ...g.duel, winner, pctA, pctB }, duelDone: true }}));
      setSummaries(s => ({ ...s, 12: { ...(s[12] || { gala: 12 }), duel: { a, b, winner, pctA, pctB }}}));

      // Actualiza concursantes
      setContestants(prev => prev.map(c => {
        if (String(c.id) === String(winner) && c.status !== "finalista") {
          return { ...c, status: "finalista", history: [...(c.history||[]), { gala: 12, evento: "Finalista" }] };
        }
        if (String(c.id) === String(loser)) {
          return { ...c, status: "eliminado", history: [...(c.history||[]), { gala: 12, evento: "Eliminado" }] };
        }
        return c;
      }));

      // 📝 Logs en el orden pedido:
      // (la frase del presentador ya sale en g12_revealPhrase)
      pushLog(`🗳️ <strong>${nameOf(winner)}</strong>. ${nameOf(loser)} es eliminado/a.`, 12);

      // Reparto (G12): ganador → "Salvad@ por el público (%) > Finalista" ; resto → Finalista
      setSummaries(s => rellenarValoracionesReparto(12, s, contestants));

      // Log con el listado final de finalistas (5)
      const finalistas = contestants
        .map(c => ({...c}))
        .filter(c => c.status === "finalista" || String(c.id) === String(winner))
        .map(c => nameOf(c.id));
      pushLog(`🏁 Finalistas: ${finalistas.join(", ")}.`, 12);

      setStage("galaCerrada");
    }

    // ======================================================
// 🏁  GALA 13 – GRAN FINAL  (Fase 1: Top5 → Fase 2: Top3 → Ganador)
// ======================================================

// 📊 Inicializa Fase 1 con porcentajes ciegos
// =============== GALA 13 – GRAN FINAL ==================
// Fase 1: Top5  -> (revelar 5º) -> (revelar 4º) -> Fase 2
// Fase 2: Top3  -> (revelar 3º) -> frase ganador -> ganador

// 📊 Inicializa Fase 1 con porcentajes ciegos (solo una vez)
  // ========= GALA 13 – FINAL =========

// % ciegos Top5 (una sola vez)
  function g13_setupFase1() {
    const g = gstate?.g13;
    if (g?.fase === 1 && Array.isArray(g?.porcentajes) && g.porcentajes.length === 5) return;

    const vivos = (summaries?.[13]?.[13]?.reparto || [])
      .flatMap(r => r.members)
      .filter((id,i,arr) => arr.indexOf(id)===i)
      .filter(id => contestants.find(x=>x.id===id && x.status!=="eliminado"));

    if (vivos.length !== 5) pushLog(`⚠️ La final debe empezar con 5 finalistas, y ahora hay ${vivos.length}.`, 13);

    const raw = vivos.map(id => ({ id, pct: +(Math.random()*40+10).toFixed(2) }));
    const total = raw.reduce((a,b)=>a+b.pct,0);
    const porcentajes = raw.map(p=>({ id:p.id, pct:+(p.pct*100/total).toFixed(2) }));

    setGstate(s => ({ ...(s||{}), g13:{ fase:1, revealed:[], porcentajes, phraseShown:false }}));
    pushLog(
      `📊 Porcentajes ciegos (Top 5): ${
        [...porcentajes].sort((a,b)=>b.pct-a.pct).map(p=>`${p.pct.toFixed(2)}%`).join(" · ")
      }.`,
      13
    );
    setStage("g13_fase1");
  }

  // Helpers de género para la Final (visibles desde los reveal)
  const sufOf = (id) => {
    const g = contestants.find(x => String(x.id) === String(id))?.gender ?? "e";
    return g === "m" ? "o" : g === "f" ? "a" : "e";
  };

  const ordSuf = (id) => {
    const s = sufOf(id);
    return s === "a" ? "ª" : s === "e" ? "e" : "º";
  };

  const palabraGanador = (id) => {
    const s = sufOf(id);
    return s === "a" ? "Ganadora" : s === "e" ? "Ganadore" : "Ganador";
  };

  function g13_reveal5th() {
    const g = gstate?.g13;
    if (!g || g.fase !== 1 || g.revealed.includes("5th")) return;

    const sorted = [...g.porcentajes].sort((a, b) => a.pct - b.pct);
    const fifth = sorted[0];

    pushLog(
  `🔎 <strong>${nameOf(fifth.id)}</strong> se convierte en 5${ordSuf(fifth.id)} Finalista (${fifth.pct.toFixed(2)}%).`,
    13
  );

    setGstate(s => ({ ...s, g13: { ...g, revealed: [...g.revealed, "5th"], fifth }}));
    setSummaries(s => ({ ...s, 13: { ...(s[13] || { gala: 13 }), fifth }}));
    setSummaries(s => rellenarValoracionesReparto(13, s, contestants));
  }

  function g13_reveal4th() {
    const g = gstate?.g13;
    if (!g || g.fase!==1 || g.revealed.includes("4th")) return;
    const sorted = [...g.porcentajes].sort((a,b)=>a.pct-b.pct);
    const fourth = sorted[1];

    // Top3 = todos menos 5º y 4º
    const excluded = new Set([String(sorted[0].id), String(sorted[1].id)]);
    const top3Ids = g.porcentajes.map(x=>x.id).filter(id=>!excluded.has(String(id)));

    pushLog(
  `🔎 <strong>${nameOf(fourth.id)}</strong> se convierte en 4${ordSuf(fourth.id)} Finalista (${fourth.pct.toFixed(2)}%).`,
    13
  );

    setGstate(s=>({
      ...s,
      g13:{ ...g, revealed:[...g.revealed,"4th"], fourth, fase:2, top3Ids, porcentajes:[], phraseShown:false }
    }));
    setSummaries(s=>({ ...s, 13:{ ...(s[13]||{gala:13}), fourth }}));
    setSummaries(s=>rellenarValoracionesReparto(13,s,contestants));
    pushLog("⏭️ Pasa a la fase final (Top 3).", 13);
    setStage("g13_fase2");  // 👈 cambia a la etapa de Fase 2 (Top 3)
  }

  // % ciegos Top3 (solo si no existen)
  function g13_setupFase2() {
    const g = gstate?.g13;
    if (!g || g.fase!==2) return;
    if (Array.isArray(g.porcentajes) && g.porcentajes.length===3) return;

    const top3 = Array.isArray(g.top3Ids) ? g.top3Ids.slice() : [];
    if (top3.length!==3) { pushLog("⚠️ No hay 3 finalistas para la fase 2.", 13); return; }

    const raw = top3.map(id => ({ id, pct: +(Math.random()*40+10).toFixed(2) }));
    const total = raw.reduce((a,b)=>a+b.pct,0);
    const porcentajes = raw.map(p=>({ id:p.id, pct:+(p.pct*100/total).toFixed(2) }));

    setGstate(s=>({ ...(s||{}), g13:{ ...g, porcentajes, revealed:[], phraseShown:false }}));
    pushLog(
    `📊 Porcentajes ciegos (Top 3): ${
        [...porcentajes].sort((a,b)=>b.pct-a.pct).map(p=>`${p.pct.toFixed(2)}%`).join(" · ")
      }.`,
      13
    );
  }

  function g13_reveal3rd() {
    const g = gstate?.g13;
    if (!g || g.fase!==2 || g.revealed.includes("3rd")) return;
    const sorted = [...g.porcentajes].sort((a,b)=>a.pct-b.pct);
    const third = sorted[0];
    const ord3 = sufOf(third.id) === "a" ? "3ª" : sufOf(third.id) === "e" ? "3e" : "3er";
    pushLog(`🥉 <strong>${nameOf(third.id)}</strong> queda ${ord3} Finalista (${third.pct.toFixed(2)}%).`, 13);
    setGstate(s=>({ ...s, g13:{ ...g, revealed:[...g.revealed,"3rd"], third }}));
    setSummaries(s=>({ ...s, 13:{ ...(s[13]||{gala:13}), third }}));
    setSummaries(s=>rellenarValoracionesReparto(13,s,contestants));
  }

  function g13_phraseWinner() {
    const g = gstate?.g13;
    if (!g || g.fase!==2 || g.phraseShown) return;
    const sorted = [...g.porcentajes].sort((a,b)=>b.pct-a.pct);
    pushLog(`🗣️ La audiencia ha decidido que el ganador/a de este simulador con un (${sorted[0].pct}%) sea...`, 13);
    setGstate(s=>({ ...s, g13:{ ...g, phraseShown:true }}));
  }

  function g13_revealWinner() {
    const g = gstate?.g13;
    if (!g || g.fase !== 2 || g.revealed?.includes("winner")) return;

    const sorted = [...g.porcentajes].sort((a, b) => b.pct - a.pct);
    const winner = sorted[0];
    const second = sorted[1];

    pushLog(`🥇 <strong>${nameOf(winner.id)}</strong> es ${palabraGanador(winner.id)} (${winner.pct.toFixed(2)}%).`, 13);
    pushLog(`🥈 <strong>${nameOf(second.id)}</strong> queda 2${ordSuf(second.id)} Finalista (${second.pct.toFixed(2)}%).`, 13);

    // 1) Guardar en summaries (conserva el 'third' previamente guardado en g13_reveal3rd)
    setSummaries(s => ({ ...s, 13: { ...(s[13] || { gala: 13 }), winner, second } }));

    // 2) Reetiquetar reparto (para que el “Valoración” quede coherente también)
    setSummaries(s => rellenarValoracionesReparto(13, s, contestants));

    // 3) Actualizar estados de concursantes
    setContestants(prev => prev.map(c => {
      if (String(c.id) === String(winner.id)) {
        return { ...c, status: "ganador", history: [ ...(c.history || []), { gala: 13, evento: "Ganador" } ] };
      }
      if (String(c.id) === String(second.id) || String(c.id) === String((gstate?.g13?.third || {}).id)) {
        return { ...c, status: "finalista", history: [ ...(c.history || []), { gala: 13, evento: "Finalista" } ] };
      }
      return c;
    }));

    // 4) Cerrar la gala final → ahora sí, se mostrará "Cerrar edición"
    setStage("galaCerrada");
  }


 
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <img
          src="/LogoOT2017_Negro.png"
          alt="Simulador Web de Operación Triunfo"
          className="h-auto max-h-16 sm:max-h-20 md:max-h-[6.75rem] w-auto object-contain shrink-0"
        />
        <div className="flex gap-2 w-full sm:w-auto">
          {canPickRoster && (
            <Button
              onClick={() => setRoute("selector")}
              className="flex-1 sm:flex-none px-3 py-2 text-sm sm:px-4 sm:py-2 sm:text-base"
            >
              {/* etiqueta corta en móvil, larga en ≥sm */}
              <span className="sm:hidden">Elegir concursantes</span>
              <span className="hidden sm:inline">👥 Elegir Concursantes OT</span>
            </Button>
          )}
          <Button
            onClick={reiniciar}
            className="flex-1 sm:flex-none px-3 py-2 text-sm sm:px-4 sm:py-2 sm:text-base"
          >
            🔁 Reiniciar
          </Button>
        </div>
      </div>


      {contestants.length===0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sb text-muted-foreground">Haz click en el Botón <strong>Elegir Concursantes OT</strong> y selecciona a 18 concursantes. (¡Si tenías ya nombres aquí asegúrate de dejar espacio en esta lista antes!)</p>
            <p className="text-sb text-muted-foreground">Puedes también <strong>crear</strong> a tu propio concursante con sus estadísticas propias. Al guardar lo podrás utilizar en este navegador cuando quieras. Si escribes el nombre directamente en esta lista no tendrá estadísticas y podría ser más propenso a la nominación.</p>
            <p className="text-xs text-muted-foreground">El género se escribe para que la Tabla de Recorrido trate a cada concursante por el género que le corresponda. Si no se selecciona un género este </p>
            <Textarea rows={12} value={namesInput} onChange={e=>setNamesInput(e.target.value)} />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button onClick={iniciar}>▶️ Iniciar</Button>
                  <Button variant="outline" onClick={clearTypedList}>Limpiar lista</Button>
                </div>

                <div className="ml-auto">
                  <select
                    className="border rounded-md px-2 py-1 text-sm bg-white"
                    value={mode}
                    onChange={(e) => onModeChange?.(e.target.value)}
                  >
                    <option value="telecinco">OT (Telecinco, 2001–2006)</option>
                    <option value="rtve">OT (RTVE, 2017–2020)</option>
                  </select>
                </div>
              </div>
          </CardContent>
        </Card>
      )}

    <Button
      onClick={() => {
        try {
          const payload = buildSavePayload();
          const code = Math.floor(1000 + Math.random() * 9000).toString(); // 4 cifras
          const packed = packState(payload);
          localStorage.setItem("ot_save_" + code, packed);

          navigator.clipboard?.writeText(code);
          alert("Código guardado y copiado: " + code + "\n\n⚠️ Solo funciona en este dispositivo/navegador.");
        } catch (e) {
          alert("Error al guardar: " + e.message);
        }
      }}
    >
      💾 Guardar
    </Button>

    <Button
      variant="outline"
      onClick={() => {
        const code = prompt("Introduce el código de tu simulación (4 cifras):");
        if (!code) return;
        try {
          const packed = localStorage.getItem("ot_save_" + code.trim());
          if (!packed) throw new Error("No existe ese código en este navegador.");
          const payload = unpackState(packed);
          applyLoadedState(payload);
          onModeChange?.(payload.mode || mode);
          alert("Simulación cargada correctamente.");
        } catch (e) {
          alert("Error al cargar: " + e.message);
        }
      }}
    >
      ⬇️ Cargar
    </Button>

      <center><p className="text-xs text-muted-foreground"><strong>Simulador OT (2025)</strong> - Para cualquier duda o sugerencia escríbenos a otsimulador@gmail.com</p></center>




      {contestants.length>0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Gala</div>
                  <div className="text-2xl font-semibold">{gala}</div>
                </div>
                <Badge variant="outline">Etapa: {stage}</Badge>
              </div>

              {gala <= 10 && (
  <>
            {/* === Controles específicos de la GALA 0 === */}
            {gala === 0 && (
              <div className="flex flex-wrap gap-2">
                {stage === "g0_eval" && (
                  <Button onClick={g0_revealNext}>🔎 Revelar siguiente (Gala 0)</Button>
                )}
                {stage === "g0_profes" && (
                  <Button onClick={g0_profesSalvan}>🎓 Profesores salvan</Button>
                )}
                {stage === "g0_publico" && (
                  <Button onClick={g0_publicoVota}>🗳️ Votación del público</Button>
                )}
                {stage === "g0_cerrar" && (
                  <Button onClick={g0_cerrar}>✅ Cerrar Gala 0 y pasar a Gala 1</Button>
                )}
              </div>
            )}

            {/* === Controles existentes para Galas 1–9 (deja aquí tu bloque actual) === */}
            <div className="flex flex-wrap gap-2">
              <div className="flex flex-wrap gap-2">
            {stage === "dueloPendiente" && (
              <Button onClick={iniciarDueloCiego}>📊 Porcentajes ciegos (duelo)</Button>
            )}
            {stage === "duelo_ciegos" && (
              <Button onClick={dueloMostrarFrase}>🗣️ Mostrar frase del presentador</Button>
            )}
            {stage === "duelo_revelar" && (
              <Button onClick={dueloRevelar}>⚔️ Revelar salvado y eliminado</Button>
            )}

            {stage === "votoPublico" && gala <= 9 && (
              <Button onClick={iniciarVotoPublico} disabled={gstate?.top3Shown}>
                🧪 Mostrar 3 más votados
              </Button>
            )}
            {gala <= 9 && gstate.top3?.length > 0 && stage === "votoPublico" && (
                <Button onClick={revelarTop3YFavorito}>✅ Revelar favorito y porcentajes Top3</Button>
              )}

            {/* 👇 FALTA ESTE: valoración del jurado */}
            {stage === "juradoEvaluando" && (
              <Button onClick={evaluarSiguientePorJurado}>⚖️ Evaluar siguiente concursante</Button>
            )}

            {/* ▶️ GALA 11: botón para puntuar al jurado */}
            {stage === "g11_jurado" && (
              <Button onClick={g11_puntuarJurado}>🧮 Puntuar jurado (G11)</Button>
            )}

            {/* ▶️ GALA 11: cierre de gala tras las notas del jurado */}
            {stage === "g11_cerrar" && (
              <Button onClick={g11_cerrar}>✅ Cerrar Gala 11</Button>
            )}


            {/* Y estos dos para cerrar la nominación como siempre */}
            {stage === "profesSalvan" && (
              <Button onClick={profesoresSalvanUno}>🎓 Profesores salvan</Button>
            )}
            {stage === "companerosVotan" && (
              <Button onClick={companerosVotan}>🧑‍🤝‍🧑 Compañeros votan</Button>
            )}
            {stage === "galaCerrada" && (
            <Button onClick={goNext}>
              {`✅ Cerrar Gala ${gala} y pasar a Gala ${gala + 1}`}
            </Button>
           )}
              </div>
            </div>
          </>
        )}

            {gala === 11 && (
              <div className="flex flex-wrap gap-2">
                {/* duelo arrastrado */}
                {stage === "dueloPendiente" && (
                  <Button onClick={iniciarDueloCiego}>📊 Porcentajes ciegos (duelo G10)</Button>
                )}
                {stage === "duelo_ciegos" && (
                  <Button onClick={dueloMostrarFrase}>🗣️ Mostrar frase del presentador</Button>
                )}
                {stage === "duelo_revelar" && (
                  <Button onClick={dueloRevelar}>🏆 Revelar resultado del duelo</Button>
                )}

                {/* G11 – jurado y profes */}
                {stage === "g11_jurado" && (
                  <Button onClick={g11_puntuarJurado}>🧮 Puntuar jurado (G11)</Button>
                )}
                {stage === "g11_profes" && (
                  <Button onClick={g11_profesoresSalvan}>🎓 Profesores salvan (G11)</Button>
                )}
                {stage === "g11_cerrar" && (
                  <Button onClick={g11_cerrar}>✅ Cerrar Gala 11</Button>
                )}
              </div>
            )}


              {gala >= 12 && gala <= 13 && (
                <div className="flex flex-wrap gap-2">
                  {stage === "g12_14_publico" && !gstate?.g12 && (
                    <Button onClick={g12_setup}>📊 Mostrar porcentajes ciegos</Button>
                  )}

                  {stage === "g12_14_publico" && gstate?.g12 && !gstate.g12.phraseShown && (
                    <Button onClick={g12_revealPhrase}>🗣️ Mostrar frase del presentador</Button>
                  )}

                  {stage === "g12_14_publico" && gstate?.g12 && gstate.g12.phraseShown && !gstate.g12.duelDone && (
                    <Button onClick={g12_duel}>⚔️ Resolver duelo</Button>
                  )}

                  {/* Gala 12: cerrar y pasar a la final (13) */}
                  {stage === "galaCerrada" && gala < 13 && (
                    <Button onClick={goNext}>⏭️ Cerrar gala y pasar a la siguiente</Button>
                  )}

                  {/* Gala 13 (FINAL): cerrar edición */}
                  {stage === "galaCerrada" && gala === 13 && (
                    <Button onClick={closeEdition}>🏁 Cerrar Edición</Button>
                  )}
                </div>
              )}

              {/* FASE 1 */}
              {stage === "g13_fase1" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={g13_setupFase1}>📊 Porcentajes ciegos (Top 5)</Button>
                  {gstate?.g13?.porcentajes?.length === 5 && !gstate?.g13?.revealed?.includes("5th") && (
                    <Button onClick={g13_reveal5th}>🔎 Revelar 5º finalista</Button>
                  )}
                  {gstate?.g13?.porcentajes?.length === 5 && gstate?.g13?.revealed?.includes("5th") && !gstate?.g13?.revealed?.includes("4th") && (
                    <Button onClick={g13_reveal4th}>🔎 Revelar 4º finalista y pasar a Top 3</Button>
                  )}
                </div>
              )}

              {/* FASE 2 */}
              {stage === "g13_fase2" && (
                <div className="flex flex-wrap items-center gap-2">
                  {!gstate?.g13?.porcentajes?.length && (
                    <Button onClick={g13_setupFase2}>📊 Porcentajes ciegos (Top 3)</Button>
                  )}
                  {gstate?.g13?.porcentajes?.length === 3 && !gstate?.g13?.revealed?.includes("3rd") && (
                    <Button onClick={g13_reveal3rd}>🥉 Revelar 3º finalista</Button>
                  )}
                  {gstate?.g13?.porcentajes?.length === 3 && gstate?.g13?.revealed?.includes("3rd") && !gstate?.g13?.phraseShown && (
                    <Button onClick={g13_phraseWinner}>🗣️ Frase del presentador</Button>
                  )}
                  {gstate?.g13?.porcentajes?.length === 3 && gstate?.g13?.phraseShown && !gstate?.g13?.revealed?.includes("winner") && (
                    <Button onClick={g13_revealWinner}>🥇 Revelar ganador/a</Button>
                  )}
                </div>
              )}


              <Tabs defaultValue="historial">
                <TabsList>
                  <TabsTrigger value="plantilla">👥 Concursantes</TabsTrigger>
                  <TabsTrigger value="historial">🎤 Galas</TabsTrigger>
                </TabsList>
                  <TabsContent value="plantilla" className="mt-4">
                    <div className="grid grid-cols-2 min-[380px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {contestants.map((c) => (
                        <div
                          key={c.id}
                          className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/80 shadow-sm"
                        >
                          <img
                            src={
                              (c.photo && c.photo.trim()) ||
                              photoByName.get(norm(c.name)) ||
                              "/ot_photos/sinfoto.gif"
                            }
                            alt={c.name}
                            className={`w-[62px] h-[62px] object-cover rounded-lg border ${
                              c.status === "eliminado" ? "grayscale opacity-80" : ""
                            }`}
                          />
                          <div className="text-xs font-medium text-center leading-tight">
                            {c.name}
                          </div>

                          {/* === Etiqueta de estado con Nominad@ incluido === */}
                          {(() => {
                            const isNom = isNominatedNow(c.id);
                            const isFav = c.id === favId;
                            const s = suf(c.gender || "e"); // ← o/a/e

                            const labelText =
                              isFav ? `Favorit${s}` :
                              isNom ? `Nominad${s}` :
                              c.status === "active" ? `Salvad${s}` :
                              c.status === "finalista" ? "Finalista" :
                              c.status === "ganador"
                                ? (c.gender === "f" ? "Ganadora" : c.gender === "e" ? "Ganadore" : "Ganador")
                                : `Eliminad${s}`;

                            const labelClass = isFav
                            ? "bg-blue-500 text-white font-bold"   // 💙 Favorito: azul, texto blanco y negrita
                            : isNom
                            ? "bg-orange-500 text-white"
                            : c.status === "active"
                            ? "bg-white text-black border border-gray-300"
                            : c.status === "eliminado"
                            ? "bg-red-600 text-white"
                            : c.status === "finalista"
                            ? "bg-sky-200 text-black"
                            : c.status === "ganador"
                            ? "bg-yellow-300 text-black font-bold" // 💛 Ganador: amarillo, texto negro y negrita
                            : "bg-gray-200 text-black";

                            return (
                              <span className={`px-2 py-0.5 rounded-full text-[11px] ${labelClass}`}>
                                {labelText}
                              </span>
                            );
                          })()}

                        </div>
                      ))}
                    </div>
                  </TabsContent>

                <TabsContent value="historial" className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {Array.from({length:gala+1},(_,i)=>i).map(g => (
                        <Button key={g} size="sm" variant={g===viewGala?"default":"outline"} onClick={()=>setViewGala(g)}>
                          Gala {g}
                        </Button>
                      ))}
                  </div>
                  <div className="prose max-w-none">
                    {(galaLogs[viewGala]||[]).length===0? (
                      <p className="text-sm text-muted-foreground">Sin eventos en esta gala.</p>
                    ) : (
                      <ul className="list-disc pl-5 space-y-2">
                        {(galaLogs[viewGala]||[]).map((l,i)=>(<li key={i} dangerouslySetInnerHTML={{__html:l}} />))}
                      </ul>
                    )}
                  </div>

                      {/* 🧾 DESGLOSE JURADO (G11) */}
                      {viewGala === 11
                        && ["g11_jurado","g11_profes","g11_cerrar","galaCerrada"].includes(stage)
                        && summaries?.[11]?.juradoDesglose && (
                        <div className="mt-2">
                        <p>• <b>Desglose jurado (G11):</b></p>
                        <table className="min-w-[520px] border-collapse text-sm">
                          <thead>
                            <tr>
                              <th className="border px-2 py-1 text-left">Concursante</th>
                              <th className="border px-2 py-1">Juez 1</th>
                              <th className="border px-2 py-1">Juez 2</th>
                              <th className="border px-2 py-1">Juez 3</th>
                              <th className="border px-2 py-1">Juez 4</th>
                              <th className="border px-2 py-1">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaries[11].juradoDesglose.map(r => (
                              <tr key={r.id}>
                                <td className="border px-2 py-1">{nameOf(r.id)}</td>
                                <td className="border px-2 py-1">{r.j1.toFixed(1)}</td>
                                <td className="border px-2 py-1">{r.j2.toFixed(1)}</td>
                                <td className="border px-2 py-1">{r.j3.toFixed(1)}</td>
                                <td className="border px-2 py-1">{r.j4.toFixed(1)}</td>
                                <td className="border px-2 py-1 font-bold">{r.total.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}


                    <div className="mt-4">
                      {logs.map((entry, i) => (
                        <p key={i} dangerouslySetInnerHTML={{ __html: entry }} />
                      ))}
                    </div>

                  {/* Ocultamos resultados de test (siguen ejecutándose internamente) */}
                    {false && testResults.length>0 && (
                      <div className="text-xs text-muted-foreground">
                        Tests: {testResults.join(" · ")}
                      </div>
                    )}

                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Mosaico de fotos en "Estado" */}
          <div className="self-start mt-4 bg-white/80 rounded-xl shadow-sm p-3">
            <h3 className="text-sm font-semibold text-center mb-2">
              Concursantes
            </h3>
            <div className="grid grid-cols-6 gap-2 justify-items-center">
              {contestants.map((c) => (
                <img
                  key={c.id}
                  src={
                    (c.photo && c.photo.trim()) ||
                    photoByName.get(norm(c.name)) ||
                    "/ot_photos/sinfoto.gif"
                  }
                  alt={c.name}
                  title={c.name}
                  className={`
                    w-14 h-14 object-cover rounded-lg border-4 transition-all
                    ${
                      c.status === "ganador"
                        ? "border-yellow-300" // 🟡 Ganador/a
                        : isNominatedNow(c.id)
                        ? "border-orange-500" // 🔶 Nominad@
                        : c.id === favId
                        ? "border-blue-500" // 💙 Favorit@
                        : "border-transparent"
                    }
                    ${c.status === "eliminado" ? "grayscale opacity-80" : ""}
                  `}
                />
              ))}
            </div>
          </div>
        </div>
      )}

        {/* === Reparto de temas de la gala visible === */}
        { summaries[viewGala]?.[viewGala]?.reparto && (
          <Card className="mt-6">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">Reparto de temas — Gala {viewGala}</h3>
              <div className="overflow-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="border px-2 py-1 text-left">N.º</th>
                      <th className="border px-2 py-1 text-left">Canción</th>
                      <th className="border px-2 py-1 text-left">Concursante</th>
                      <th className="border px-2 py-1 text-left">Valoración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaries[viewGala][viewGala].reparto.flatMap((row, i) => {
                      const members = row.members || [];
                      const nombres = members.map(id => contestants.find(c => c.id === id)?.name || "?");
                      // En dúos/tríos, rellenar por-miembro; si viene "A | B | C", cada uno a su fila
                      const valores = String(row.valor || "").split(" | ");

                      return members.map((id, idx) => {
                        const valor = valores[idx] || valores[0] || "";
                        const { bg, fg } = valorBgColor(valor, viewGala);

                        // 🔵 --- Bloque del Paso A ---
                        // Normalización del texto mostrado
                        let displayValor = valor;

                        // Favorito del público: forzar etiqueta estándar y conservar porcentaje si vien

                        // (opcional, si quieres mantener la normalización de Gala 11)
                        // En G11, no normalizar si ya viene un "Salvad@ por el público (%) > Finalista"
                        if (viewGala === 11 
                            && /(finalista|favorit|nómada)/i.test(valor) 
                            && !/salvad/i.test(valor)) {
                          displayValor = "Finalista";
                        }

                        // 🔵 --- fin del bloque añadido ---

                        return (
                          <tr key={`${i}-${id}`}>
                            {idx === 0 && (
                              <td className="border px-2 py-1" rowSpan={members.length}>
                                {i + 1}
                              </td>
                            )}
                            {idx === 0 && (
                              <td className="border px-2 py-1" rowSpan={members.length}>
                                {row.song || ""}
                              </td>
                            )}
                            <td className="border px-2 py-1">
                              {nombres[idx]}
                            </td>
                            <td
                              className="border px-2 py-1"
                              style={{ backgroundColor: bg, color: fg }}
                            >
                              {displayValor}
                            </td>
                          </tr>
                        );
                      });

                    })}
                  </tbody>

                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                La columna “Valoración” se completa automáticamente al finalizar la gala.
              </p>
            </CardContent>
          </Card>
        )}



      {Object.keys(summaries).length>0 && (
        <Card>
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recorrido del concurso</h2>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={onDownloadRecorrido}>
                  ⬇️ Descargar tabla
                </Button>
              </div>
            </div>
            <RecorridoTable contestants={contestants} summaries={summaries} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RecorridoTable({ contestants, summaries }){

  // --- Helpers de género (compactos y sin repeticiones) ---
  const sufLocal = g => (g==="m"?"o":g==="f"?"a":"e");               // sufijo por género
  const byGender = (g, forms) => (g==="f" ? forms.f : g==="e" ? forms.e : forms.m);
  const normName = (s) =>
    (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");


  // Ordinales según género: m → 2º / 3er ; f/e → 2ª / 3ª
  const ord2 = (g) => (g === "m" ? "2º"  : "2ª");
  const ord3 = (g) => (g === "m" ? "3er" : "3ª");

  // Generador para etiquetas "regulares" (solo cambian sufijo final)
  const makeLabel = (base) => (g) => base + sufLocal(g);

  // Etiquetas resultantes
  const lbl = {
    // regulares (añaden sufijo o/a/e)
    salvado:   makeLabel("Salvad"),    // Salvado/Salvada/Salvade
    nominado:  makeLabel("Nominad"),   // Nominado/Nominada/Nominade
    eliminado: makeLabel("Eliminad"),  // Eliminado/Eliminada/Eliminade

    // irregulares (formas completas específicas)
    favorito:  (g) => byGender(g, { m:"Favorito",  f:"Favorita",  e:"Favorite"  }),
    ganador:   (g) => byGender(g, { m: "Ganador",   f: "Ganadora",  e: "Ganadore" }), // ✅ correcto
  };

  // Acceso al género de un concursante por id
  const getGender = (id) => contestants.find(c => c.id === id)?.gender ?? "e";

  const headers = [
    "Concursante",
    "Gala 0",
    ...Array.from({ length: 12 }, (_, i) => `Gala ${i + 1}`),
    "Gala Final", // (G13 Fase 1)
    ""            // (G14 Fase 2) — celda “vacía” para fusionar visualmente
  ];

  const cellStyle=(bg,color="#000")=>({ background:bg, color, padding:"4px 6px", border:"1px solid #ddd", fontSize:12, textAlign:"center", whiteSpace:"nowrap" });

  // 🔎 Lookup rápido con lo que guardan g11_puntuarJurado/g11_profesoresSalvan
  const recG11Map = new Map(
    (summaries?.[11]?.recorrido || []).map(r => [String(r.id), r])
  );
  const g15 = summaries[15]?.g15, winnerId=g15?.winner, thirdId=g15?.third, secondId=g15 ? [...g15.tabla].sort((a,b)=>b.pct-a.pct)[1]?.id : undefined;
  const eliminatedOnly = contestants
    .filter(c => c.status === "eliminado")
    .sort((a,b) => {
      const ga = a.history.find(h => h.evento?.startsWith?.("Eliminado"))?.gala ?? 0;
      const gb = b.history.find(h => h.evento?.startsWith?.("Eliminado"))?.gala ?? 0;
      return gb - ga; // 👈 se mantiene “como siempre”
    });
    const aliveOnly = contestants
      .filter(c => c.status !== "eliminado")
      .sort((a,b) => normName(a.name).localeCompare(normName(b.name)));

    let sorted;

    // 🏁 Si ya existen resultados de la final (G13 → ganador, etc.), ordenar así:
    const s13 = summaries[13];
    if (s13?.winner?.id) {
      const idsOrder = [
        s13.winner?.id,
        s13.second?.id,
        s13.third?.id,
        s13.fourth?.id,
        s13.fifth?.id,
      ].filter(Boolean).map(String);

      const rank = new Map(idsOrder.map((id, i) => [id, i]));
      const alive = contestants.filter(c => c.status !== "eliminado");
      const dead  = contestants.filter(c => c.status === "eliminado");

      const aliveSorted = [...alive].sort((a, b) => {
        const ra = rank.has(String(a.id)) ? rank.get(String(a.id)) : 999;
        const rb = rank.has(String(b.id)) ? rank.get(String(b.id)) : 999;
        if (ra !== rb) return ra - rb;
        return normName(a.name).localeCompare(normName(b.name));
      });

      const deadSorted = [...dead].sort((a,b) => {
        const ga = a.history.find(h => h.evento?.startsWith?.("Eliminado"))?.gala ?? 0;
        const gb = b.history.find(h => h.evento?.startsWith?.("Eliminado"))?.gala ?? 0;
        return gb - ga;
      });

      sorted = [...aliveSorted, ...deadSorted];
    }

    // 🧩 Si todavía no hay ganador (galas previas)
    else {
      sorted = [
        ...aliveOnly,
        ...eliminatedOnly
      ];
    }


  const rows = sorted.map(c=>{
    const cells=[{text:c.name, style:cellStyle("#fff","#111") }];
    const elimGala = c.history.find(h => h.evento?.startsWith?.("Eliminado"))?.gala ?? null;

    // 🎬 Gala 0
    const g0 = summaries[0]?.gala0;
    if (g0) {
      const gnd = getGender(c.id);
      if (g0.entraJurado.includes(c.id)) {
        cells.push({ text: "Entra", style: cellStyle("orchid", "#fff") });
      } else if (g0.salvoProfes === c.id) {
        cells.push({ text: "Entra", style: cellStyle("yellowgreen", "#111") });
      } else if (g0.salvoPublico === c.id) {
        cells.push({ text: "Entra", style: cellStyle("orange", "#111") });
      } else if (g0.eliminados.includes(c.id)) {
        cells.push({ text: lbl.eliminado(gnd), style: cellStyle("tomato", "#fff") });
      } else {
        cells.push({ text: "—", style: cellStyle("#eee", "#555") });
      }
    } else {
      // 👈 Mientras la Gala 0 aún no está cerrada, pinta neutro
      cells.push({ text: "—", style: cellStyle("#eee", "#555") });
    }


    for(let g=1; g<=14; g++){
      let text="—", style=cellStyle("#eee","#555");
      if (elimGala !== null && g > elimGala) { cells.push({ text: "—", style: cellStyle("#ccc", "#666") }); continue; }
      // ❗️Caso: esta es la gala en la que quedó fuera
      if (elimGala !== null && g === elimGala) {
        if (g === 13 || g === 14) {
          // Final: NO marcar aquí ni hacer continue; deja que pinten g=13/g=14.
          // (No hacemos nada y seguimos para que los bloques de la final empujen su celda)
        } else {
          const gnd = getGender(c.id);
          cells.push({ text: lbl.eliminado(gnd), style: cellStyle("red", "#fff") });
          continue;
        }
      }



      const s = summaries[g];
      // Para Fase 2 (columna 14) la info está en summaries[13]; no cortar ahí.
      if (!s && g !== 14) { cells.push({ text, style }); continue; }

      if (g <= 10) {
        // ✅ Lee Top-3 desde summaries
        const top3Ids  = s.top3Ids || [];
        const inTop3   = top3Ids.includes(c.id);
        const favorito = s.favoritoId;

        const juradoNom = s.juradoNominados || [];
        const prof      = s.profesorSalvoId;
        const comp      = s.salvadoCompanerosId;
        const finales   = s.finalNominees || [];

        const gnd = getGender(c.id);

        const wasProposed      = juradoNom.includes(c.id);
        const isNominatedFinal = finales.includes(c.id);
        const savedByProf      = prof === c.id;    // (verde)
        const savedByComp      = comp === c.id;    // (khaki)
        const savedThisGala    = !isNominatedFinal;

        // 👉 el símbolo º aparece si fue Top-3 y terminó "nombrado" por algún cuerpo:
        //    finalistas (duelo) o decisión de profes/compas
        const mark = (inTop3 && (isNominatedFinal || savedByProf || savedByComp)) ? "º" : "";

        // 🎯 Prioridades de pintado:
        // 1) Favorito (azul)
        if (favorito === c.id) {
          text  = lbl.favorito(gnd);
          style = cellStyle("DodgerBlue", "#fff");
        }
        // 2) Nominado final (naranja) — añade º si era Top-3
        else if (isNominatedFinal) {
          text  = lbl.nominado(gnd) + mark;
          style = cellStyle("orange", "#111");
        }
        // 3) Salvado por profesores (verde) — añade º si era Top-3
        else if (savedByProf) {
          text  = lbl.nominado(gnd) + mark;
          style = cellStyle("yellowgreen", "#111");
        }
        // 4) Salvado por compañeros (khaki) — añade º si era Top-3
        else if (savedByComp) {
          text  = lbl.nominado(gnd) + mark;
          style = cellStyle("khaki", "#111");
        }
        // 5) Top-3 y salvado por jurado (PaleTurquoise)
        else if (inTop3 && savedThisGala) {
          text  = lbl.salvado(gnd);
          style = cellStyle("#AFEEEE", "#111"); // PaleTurquoise
        }
        // 6) Fue propuesto pero NO acabó nominado (salvado por jurado)
        else if (wasProposed) {
          text  = lbl.salvado(gnd);
          style = cellStyle("#fff", "#111");
        }
        // 7) Salvado “normal”
        else {
          text  = lbl.salvado(gnd);
          style = cellStyle("#fff", "#111");
        }
      }

      else if (g === 11) {
        // 🗺️ Columna "Gala 11" se pinta desde summaries[11].recorrido
        const rec = recG11Map.get(String(c.id));
        if (rec) {
          // Texto tipo "Nota: 8.75" y colores:
          // DodgerBlue = mejor media del Top-3 (texto blanco)
          // white = otros dos del Top-3
          // yellowgreen = salvado por profes
          // orange = dos nominados
          const fg = rec.color === "DodgerBlue" ? "#fff" : "#111";
          text  = rec.valor;
          style = cellStyle(rec.color, fg);
        } else {
          // Si aún no hay datos (antes de puntuar), pinta neutro
          text  = "—";
          style = cellStyle("#eee", "#555");
        }
      }


      // 🟦 GALA 12 — especial (último finalista)
      else if (g === 12) {
        const duel = summaries?.[12]?.duel;
        const gnd  = getGender(c.id);

        if (duel) {
          const loser = duel.winner === duel.a ? duel.b : duel.a;
          if (c.id === loser) {
            text  = lbl.eliminado(gnd);
            style = cellStyle("red", "#fff");
          } else {
            text  = "Finalista";
            style = cellStyle("lightblue", "#111");
          }
        } else {
            text  = "Finalista";
            style = cellStyle("lightblue", "#111");
        }
      }

    // 🟤 GALA FINAL — Fase 1 (columna 13): 4º y 5º
    else if (g === 13) {
      const s13 = summaries?.[13];
      const gnd = getGender(c.id);
      const is5 = String(s13?.fifth?.id)  === String(c.id);
      const is4 = String(s13?.fourth?.id) === String(c.id);

      if (is5 || is4) {
        const n   = is5 ? "5" : "4";
        const suf = gnd === "m" ? "º" : "ª";
        text  = `${n}${suf} Finalista`;
        style = cellStyle("sienna", "#fff");
      } else {
        // El Top3 se pinta en la Fase 2
        text  = "Top 3";
        style = cellStyle("#fff", "#000");
      }
    }

    // 🟣 GALA FINAL — Fase 2 (columna 14): Ganador / 2º / 3º (¡lee de summaries[13]!)
    else if (g === 14) {
      const s13 = summaries?.[13];
      const gnd = getGender(c.id);

      if (s13?.winner?.id) {
        const isW = String(s13.winner.id) === String(c.id);
        const is2 = String(s13.second?.id) === String(c.id);
        const is3 = String(s13.third?.id)  === String(c.id);

        if (isW) { text = `${lbl.ganador(gnd)}`; style = cellStyle("gold",  "#111"); }
        else if (is2) { text = `${ord2(gnd)} Finalista`; style = cellStyle("silver", "#111"); }
        else if (is3) { text = `${ord3(gnd)} Finalista`; style = cellStyle("#cd7f32", "#fff"); }
        else          { text = "—"; style = cellStyle("#ccc", "#555"); }
      } else {
        // Aún sin revelar winner/2º/3º
        text  = "—";
        style = cellStyle("#eee", "#555");
      }
    }



      cells.push({text,style});
    }
    return cells;
  });

    return (
      // Contenedor con scroll para la UI (NO se captura)
      <div className="overflow-auto">
        {/* Este es el nodo que vamos a capturar */}
        <div id="recorrido-capture" style={{ background: "#fff" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {headers.map((h, i) => {
                  if (h === "") return null; // <- NO pintes la vacía

                  return (
                    <th
                      key={`${h}-${i}`}
                      colSpan={h === "Gala Final" && headers[i + 1] === "" ? 2 : 1}
                      style={{
                        position: "sticky",
                        top: 0,
                        background: "#fafafa",
                        padding: 6,
                        fontSize: 12,
                        textAlign: "center",
                        border: "1px solid #ddd", // <- bordes uniformes
                      }}
                    >
                      {h}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, ri) => (
                <tr key={ri}>
                  {cells.map((c, ci) => (
                    <td key={ci} style={c.style}>
                      {c.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );

}
