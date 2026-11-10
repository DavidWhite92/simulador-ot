import { resolveRepechage, displayGala, nextGala, visibleGalas, galaLog, lastElimination } from "./lib/seasonSchedule";
import RepechageReveal from "./components/RepechageReveal";
import { useRepechage, repechageCell, absentAfterElimination } from "./lib/repechage";
import TablePerson from "./components/TablePerson";
import { useMusicBackground } from "./lib/audio";
import RelationshipsTable from "./components/RelationshipsTable";
import { choosePeerSave } from "./lib/relationships";
import { selectPerformanceNominees, mixedJuryOrder, manualJuryOptions } from "./lib/juryPerformance";
import ChatReveal from "./components/ChatReveal";
import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SeasonSettings from "./components/SeasonSettings";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toPng } from 'html-to-image';
import OTRosterPicker from "./components/OTRosterPicker";
import LZString from "lz-string";
import JuryEvaluation from "./components/JuryEvaluation";
import FavoriteReveal from "./components/FavoriteReveal";
import SaveCeremony from "./components/SaveCeremony";
import ScoreReveal from "./components/ScoreReveal";
import PublicReveal from "./components/PublicReveal";
import AcademyWeek, { JudgeSetup, AcademySummary } from "./components/AcademyWeek";
import PopularityTable from "./components/PopularityTable";
import { useAcademySeason, emptyAcademy } from "./lib/useAcademySeason";
import { audiencePercentages, favoriteRanking, performanceNominationModifier } from "./lib/academy";
import GalaZeroReveal from "./components/GalaZeroReveal";
import { prepareGalaZeroJury } from "./lib/galaZeroReveal";
import { createPublicReveal, assignPublicPercentage } from "./lib/publicReveal";
import { captureScoreResult, alignFinalistScores, scoreEvents } from "./lib/scoreReveal";
import { runJuryReveal, blindDuelPercentages } from "./lib/juryReveal";

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
const BASE_NOM_PROB = 0.50; // base neutra de nominación
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

  // pickManually(ids, multiple=false, labelOfId, title?)
  // multiple=false -> 1 selección; multiple=true -> varias (separadas por coma)
  function pickManually(ids, multiple = false, labelOfId, title = "Elige") {
    const labels = ids.map((id, i) => `${i + 1}. ${labelOfId(id)}`).join("\n");
    const hint = multiple
      ? "Introduce los números de tus elecciones separados por coma (p.ej. 1,3,4)"
      : "Introduce el número de tu elección (p.ej. 2)";
    const ans = prompt(`${title}:\n${labels}\n\n${hint}`);
    if (!ans) return multiple ? [] : null;

    const idxs = ans
      .split(",")
      .map((s) => parseInt(s.trim(), 10) - 1)
      .filter((n) => !isNaN(n) && n >= 0 && n < ids.length);

    return multiple
      ? Array.from(new Set(idxs)).map((i) => ids[i])
      : ids[idxs[0]] ?? null;
  }

  const nameOf = (id) => contestants.find(c=>c.id===id)?.name || String(id); // ya la tienes en ambos


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
    const groupSong = summaries?.[k]?.[k]?.groupSong;
    if (groupSong) used.add(normSong(groupSong));
    const rep = summaries?.[k]?.[k]?.reparto || [];
    rep.forEach(r => { if (r.song) used.add(normSong(r.song)); });
    (summaries?.[k]?.repechage?.performances || []).forEach(p=>{if(p.song) used.add(normSong(p.song));});
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

// Asigna canciones cumpliendo todas las reglas (incluida la Final G17)
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

  const groupSong = pickFresh();
  const assigned = reparto.map(row => {
    const copy = { ...row };
    if (copy.type === "solo") {
      const id = copy.members[0];
      seenCount.set(id, (seenCount.get(id) || 0) + 1);

      if (galaNum === 17 && seenCount.get(id) === 2) {
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
  return { reparto: assigned, groupSong };
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
      if (g === 10 || g === 11) return {trios:0,duos:1,solos:Infinity};
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
      // G12–G15 (todas en solos; ver reglas de salvación abajo)
      if (g === 12) return { trios:0, duos:0,  solos:6  };
      if (g === 13) return { trios:0, duos:0,  solos:5  };
      if (g === 14) return { trios:0, duos:0,  solos:Infinity }; // duelo 2→1 (5º finalista)
      if (g === 15) return { trios:0, duos:0,  solos:Infinity }; // final (5 finalistas)
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

      // ⭐️ GALA 16: solo 4 solistas (sin dúos)
      if (galaNum === 16) {
        // Solos de los 4 finalistas
        baseSet.forEach(id => filas.push({ type:'solo', members:[id], song:'', valor:'' }));
        return filas;
      }


      // ⭐️ GALA 17: 3 solos + 3 solos (los mismos 3, segunda canción)
      if (galaNum === 17) {
        // Primera ronda (3 solos)
        baseSet.forEach(id => filas.push({ type:'solo', members:[id], song:'', valor:'' }));
        // Segunda ronda (los mismos 3 otra vez)
        baseSet.forEach(id => filas.push({ type:'solo', members:[id], song:'', valor:'' }));
        return filas;
      }

      // ⬇️ Lógica genérica (G0–G15 y G13 ya funciona con pool correcto)
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

      // Solo en Gala 16
        const valorPorId = galaNum === 16 ? {} : null;

        // Prioridad para unificar la valoración de G16
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
      const prof     = S.profesorSalvoId ?? null;        // G1–9 y también se usa en G12 (4º finalista)
      const comp     = S.salvadoCompanerosId ?? null;    // G1–9 y G12 (5º finalista)
      const finalTwo = new Set(S.finalNominees || []);   // los dos que van a duelo (G1–9)

      const favId   = S.favoritoId ?? null;
      const top3Pct = Array.isArray(S.top3Pct) ? S.top3Pct : [];
      const duelSaved = S.duelSaved || {};
      const duelNow   = S.duel || null; // {a,b,pctA,pctB,winner} si el duelo se resuelve en ESTA gala

      // ¿Debe verse como nominado en la UI en la gala actual?
      const isNominatedNow = (id) => {
        const vg = viewGala;

        // Finales (G15+): nunca hay nominados visuales
        if (vg >= 15) return false;

        // Galas 1–11: mirar nominados finales de esa misma gala
        if (vg <= 13) {
          const arr = (summaries?.[vg]?.finalNominees || []).map(String);
          return arr.includes(String(id));
        }

        // Gala 14: vienen de la G13, pero ocultar en cuanto se resuelva el duelo
        const duelResolved = !!(summaries?.[14]?.duel);
        if (duelResolved) return false;
        const arr = (summaries?.[13]?.finalNominees || []).map(String);
        return arr.includes(String(id));
      };

      // —— Etiquetador por concursante
      const valueOf = (id) => {
        const g    = getG(id);
        const sufG = suf(g);
        const parts = [];

        // G16: recordar lo que ya calculamos antes para este concursante (si existe)
        const cachedPrev = (galaNum === 16 && valorPorId) ? valorPorId[id] : undefined;

        // 0) Si el duelo se RESUELVE en esta gala, priorizar siempre ese resultado
        if (duelNow) {
          const { a, b, pctA, pctB, winner } = duelNow;
          const loser = winner === a ? b : a;

          // Perdedor del duelo → Expulsad@
          if (id === loser) {
            const pct = id === a ? pctA : pctB;
            const out = `Expulsad${sufG} por el público (${pct.toFixed(2)}%)`;
            if (galaNum === 16 && valorPorId) {
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

  // … A PARTIR DE AQUÍ SIGUE TU CÓDIGO EXISTENTE (G1–9, G12, etc.)


          // 1.5) FAVORIT@ DEL PÚBLICO (G1–G9) → Inmune, se detiene aquí
        if (galaNum <= 9 && favId && id === favId) {
          const idsTop = Array.isArray(S.top3Ids) ? S.top3Ids : [];
          const idx = idsTop.indexOf(id);
          const pct = (idx >= 0 && typeof top3Pct[idx] === "number") ? top3Pct[idx] : undefined;
          // devuelve directamente, sin añadir más partes
          return `Favorit${sufG} del público${pct != null ? ` (${pct.toFixed(2)}%)` : ""}`;
        }

        // 2) Decisión del jurado/profes/compañeros en ESTA gala (G1–9)
        if (galaNum <= 12) {
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

          if (galaNum === 13) {
                  // Usamos lo que dejó g11_puntuarJurado en summaries
                  const top3 = new Set(summaries?.[13]?.juradoTop3 || []);
                  const prof = summaries?.[13]?.profesorSalvoId || null;
                  const duel = new Set(summaries?.[13]?.finalNominees || []);

                  const prefix = parts.length ? parts.join(" > ") + " > " : "";
                  const g = getG(id), sufG = suf(g);

                  if (top3.has(id))               return `${prefix}Salvad${sufG} por el jurado > Finalista`;
                  if (id === prof)                return `${prefix}Propuest${sufG} por el jurado > Salvad${sufG} por los profesores > Finalista`;
                  if (duel.has(id))               return `${prefix}Propuest${sufG} por el jurado > Nominad${sufG}`;
                  return parts.join(" > "); // por si había algo previo (p.ej. finalista de G12)
                }


          else if (galaNum === 14) {
            const duelSet = new Set((summaries?.[13]?.finalNominees || []).map(String));
            const duelNow = summaries?.[14]?.duel || null;

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

          else if (galaNum === 15) {
            const s13  = summaries?.[15] || {};
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







        // 4) G13–G17 se tratan en otras rutinas; si aquí no tocó nada especial, devolver lo acumulado
        const out = parts.join(" > ");
        if (galaNum === 16 && valorPorId) {
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

    // Construye un orden aleatorio cumpliendo:
    // - No más de `maxConsecNom` nominados seguidos en ningún punto.
    // - Si forceMixedTail y hay de ambos tipos, los dos últimos son (N y O) en orden aleatorio.
    // - Si no hay ambos, al menos el último es N si quedan nominados.
    function buildValoracionesOrder(allIds, nomineeIds, { galaNum, maxConsecNom = 2, forceMixedTail = true } = {}) {
      const N = allIds.length;
      const isNom = new Set(nomineeIds.map(String));
      const IDsN = allIds.filter(id => isNom.has(String(id)));
      const IDSO = allIds.filter(id => !isNom.has(String(id)));

      // Barajar pools para asignación final
      const fy = (a) => { for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
      fy(IDsN); fy(IDSO);

    // --- Preparar cola (tail) ---
    let tail = [];
    let needN = IDsN.length, needO = IDSO.length;

    if (N >= 2 && forceMixedTail && needN > 0 && needO > 0 && tail.length === 0) {
      tail = Math.random() < 0.5 ? ['N','O'] : ['O','N'];
      if (tail[0] === 'N') needN--; else needO--;
      if (tail[1] === 'N') needN--; else needO--;
    } else {
      // si no se puede, al menos el último es N si queda alguno
      if (tail.length === 0) {
        if (needN > 0) { tail = ['N']; needN--; }
        else if (needO > 0) { tail = ['O']; needO--; }
      }
    }


      const L = N - tail.length; // prefijo a generar con DP

      // DP: contar formas válidas desde un estado (para muestreo uniforme)
      const memo = new Map();
      const key = (i, n, o, r) => i+'|'+n+'|'+o+'|'+r;

      function countWays(i, n, o, run) {
        const k = key(i,n,o,run);
        if (memo.has(k)) return memo.get(k);

        if (i === L) {
          // Validar que añadir tail no rompa el límite de consecutivos
          let r = run;
          for (const t of tail) {
            if (t === 'N') { r++; if (r > maxConsecNom) { memo.set(k, 0); return 0; } }
            else r = 0;
          }
          memo.set(k, 1);
          return 1;
        }

        let ways = 0;
        if (n > 0 && run < maxConsecNom) ways += countWays(i+1, n-1, o, run+1);
        if (o > 0)                         ways += countWays(i+1, n,   o-1, 0);
        memo.set(k, ways);
        return ways;
      }

      // Muestreo guiado por el conteo
      const pattern = new Array(N).fill(null);
      let n = needN, o = needO, run = 0;
      for (let i = 0; i < L; i++) {
        const wN = (n > 0 && run < maxConsecNom) ? countWays(i+1, n-1, o, run+1) : 0;
        const wO = (o > 0) ? countWays(i+1, n, o-1, 0) : 0;
        const total = wN + wO;

        let chooseN = false;
        if (total === 0) chooseN = (n > 0 && run < maxConsecNom); // salvaguarda
        else chooseN = Math.random() * total < wN;

        if (chooseN) { pattern[i] = 'N'; n--; run++; }
        else         { pattern[i] = 'O'; o--; run = 0; }
      }
      for (let j = 0; j < tail.length; j++) pattern[L + j] = tail[j];

      // 🩵 Ajuste adicional para G7–G8:
      // Evita terminar con dos nominados seguidos (NN) forzando un salvado antes del último.
      if (galaNum >= 7 && galaNum <= 8 && forceMixedTail) {
        if (pattern[pattern.length - 1] === 'N' && pattern[pattern.length - 2] === 'N') {
          pattern[pattern.length - 2] = 'O'; // fuerza un salvado antes del último nominado
        }
      }

      // Asignar IDs en orden aleatorio dentro de cada tipo
      const out = [];
      let pN = 0, pO = 0;
      for (const t of pattern) {
        out.push(t === 'N' ? IDsN[pN++] : IDSO[pO++]);
      }
      return out;
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

export default function SimuladorOT_RTVE({ repechageOption, setRepechageOption, judgeNames, setJudgeNames, mode, onModeChange, roster, setRoster, manual, setManual, popularityEnabled = true, setPopularityEnabled, relationshipsEnabled = true, setRelationshipsEnabled, loadedSeason, onLoadSeason, onLoadedSeason }) {
  const [namesInput, setNamesInput] = useState(roster.map(p => `${p.name} - ${p.gender === "m" ? "él" : p.gender === "f" ? "ella" : "elle"}`).join("\n"));
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
  const updateRoster = (picked) => {
    setRoster(picked);
    setNamesInput(picked.map(p => `${p.name} - ${p.gender === "m" ? "él" : p.gender === "f" ? "ella" : "elle"}`).join("\n"));
  };
  const closeEdition = () => setStage("edicionCerrada");


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

      // Finales (G15+): nunca hay nominados visuales
      if (vg >= 15) return false;

      // Galas 1–11: mirar nominados finales de esa misma gala
      if (vg <= 13) {
        const arr = (summaries?.[vg]?.finalNominees || []).map(String);
        return arr.includes(String(id));
      }

      // Gala 14: vienen de G13, pero ocultar en cuanto se resuelve el duelo
      const duelResolved = !!(summaries?.[14]?.duel);
      if (duelResolved) return false;
      const arr = (summaries?.[13]?.finalNominees || []).map(String);
      return arr.includes(String(id));
    };

    function badgeFromCurrentGala(c, gala, stage, summaries) {
      if (stage === "galaCerrada") return null;
      const suf = genderSuf(c.gender);
      const s = summaries[gala] || {};

       // No mostrar "Nominad@" a partir de la G14 (solo mientras el duelo no se ha resuelto)
      if (gala >= 14) {
        if (gala === 14 && !summaries?.[14]?.duel) {
          const arr = (summaries?.[13]?.finalNominees || []).map(String);
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
  const [songsMetaReady, setSongsMetaReady] = useState(false);
  const [songsMeta, setSongsMeta] = useState({}); // { title -> {afinacion, baile, presencia, emocion} }

    const { academy, setAcademy, week: academyWeek, reparto: academyReparto, blocked: academyBlocked, next: advanceAcademy, skipPerformances, chat: academyChat, chatGala, nextChat, skipEvents, skipChat } = useAcademySeason({ contestants, setContestants, summaries, setSummaries, gala, songsMeta, stage, mode });
  const repechageEnabled = academy.repechageEnabled !== false;
  const shownGala = n => displayGala(n,repechageEnabled);
  useMusicBackground(!contestants.length ? mode : !academyWeek || academyWeek.phase === "events" ? mode : !academyWeek.done || stage === "galaCerrada" || (stage === "repechage" && gstate.repechage?.phase === "performances") ? null : "tension", `${mode}-${gala}`);
  const [showPopularity, setShowPopularity] = useState(false);
  const [showRelationships, setShowRelationships] = useState(false);
  const seasonFinished = stage === "galaCerrada" && Boolean(summaries[17]?.g15?.winner || summaries[15]?.winner);

  const SAVE_VERSION = 1;

      function buildSavePayload() {
      // ojo con Maps/Sets: el 'replacer' de arriba los convierte
      return {
        v: SAVE_VERSION,
      popularityEnabled,
      relationshipsEnabled,
      repechageOption,
      academy,
        mode,            // "telecinco" | "rtve"
        contestants,     // [{ id, name, gender, photo, stats, status, ... }]
        gala,
        viewGala,
        stage,
        gstate,          // lleva Sets, lo maneja 'replacer'
        summaries,       // árbol con reparto, favoritos, nominados, etc.
        namesInput,      // por si quieres reimprimir la lista inicial
        songsReady,      // opcional
        manual,
        carryNominees,
        galaLogs,
        songs,
        songsMeta,
      };
    }

    function applyLoadedState(payload) {
      if (!payload || payload.v !== SAVE_VERSION) throw new Error("Versión de guardado incompatible");

      // Restaura en este orden para que la UI no parpadee raro:
      setContestants((payload.contestants || []).map(c => ({ ...c, popularity: c.popularity ?? 50 })));
      setAcademy(payload.academy || { ...emptyAcademy(), judges: ["Juez 1", "Juez 2", "Juez 3", "Juez 4"], weeks: { [payload.gala ?? 1]: { done: true } } });
      setShowPopularity(false);
      setShowRelationships(false);
      setPopularityEnabled(payload.popularityEnabled !== false);
      setRelationshipsEnabled(payload.relationshipsEnabled !== false);
      setRepechageOption(payload.repechageOption || (payload.academy?.repechageEnabled === false ? "off" : "on"));
      if (payload.academy?.judges) setJudgeNames(payload.academy.judges);
      setSummaries(payload.summaries || {});    // tabla de recorrido y galas
      setGstate(payload.gstate || {});          // lleva Sets: ya vienen revividos
      setNamesInput(payload.namesInput || "");  // si quieres mostrar la lista original
      setGala(payload.gala ?? 1);
      setViewGala(payload.viewGala ?? payload.gala ?? 1);
      setStage(payload.stage || "inicio");
      if (typeof payload.manual === "boolean") setManual(payload.manual);
        // 👇 Nuevo: restaurar duelistas arrastrados.
        // Si la partida antigua no lo trae, intenta inferirlos de la gala anterior.
        try {
        const g = payload.gala ?? 1;
          const inferred =
            (g >= 2 && g <= 13)
              ? (payload.summaries?.[g - 1]?.finalNominees || [])
              : [];
          setCarryNominees(
            Array.isArray(payload.carryNominees) && payload.carryNominees.length
            ? payload.carryNominees
              : inferred
          );
        } catch {
          setCarryNominees([]);
        }

       // 📝 Historial por gala (Gala X)
       setGalaLogs(payload.galaLogs || {});   // ← mantiene los logs mostrados en la pestaña “historial”

       // 🎵 Catálogo/metadatos de canciones (opcional, para continuar partidas coherentemente)
       if (Array.isArray(payload.songs)) setSongs(payload.songs);
       if (payload.songsMeta && typeof payload.songsMeta === "object") setSongsMeta(payload.songsMeta);
       if (typeof payload.songsReady === "boolean") setSongsReady(payload.songsReady);

       // ⚔️ Duelistas arrastrados (G2–G13 y salto G13→G14)
       try {
         const g = payload.gala ?? 1;
         const inferred =
           (g >= 2 && g <= 13)
             ? (payload.summaries?.[g - 1]?.finalNominees || [])
             : (g === 14 ? (payload.summaries?.[13]?.finalNominees || []) : []);
         setCarryNominees(
           Array.isArray(payload.carryNominees) && payload.carryNominees.length
             ? payload.carryNominees
             : inferred
         );
       } catch {
         setCarryNominees([]);
       }

    }

      useEffect(() => {
        if (loadedSeason) {
          applyLoadedState(loadedSeason);
          onLoadedSeason();
        }
        // Loaded saves are applied once, including when their format changes the simulator.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [loadedSeason]);

      useEffect(() => {
    try {
      const hash = window.location.hash || "";
      const m = hash.match(/(?:^#|&)sim=([^&]+)/);
      const code = m ? decodeURIComponent(m[1]) : null;
      if (code) {
        const payload = unpackState(code);
        onLoadSeason(payload);
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
            setSongsMetaReady(true);
            console.log("[SongsMeta] cargado:", Object.keys(exact).length);
          })
          .catch(err => {
            console.warn("No pude cargar songs_meta.json", err);
            setSongsMeta({});
            setSongsMetaReady(true);
          });
      }, []);




  useEffect(()=>{ setTestResults(runSelfTests()); },[]);

  const active     = useMemo(()=>contestants.filter(c=>c.status==="active"),[contestants]);
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
    // 🔴 PRIORIDAD GLOBAL: si hay duelo pendiente (G2–G13), resolverlo primero
    if (carryNominees.length === 2 && num >= 2 && num <= 13) {
      return "dueloPendiente";
    }

    // Flujo normal por gala
    if (num === 0)  return "g0_eval";
    if (num < 12)   return "votoPublico";
    if (num === 12) return "juradoEvaluando";
    if (num === 13) return "gala11_publico";      // tras resolver duelo del 10 aquí
    if (num === 14) return "g12_14_publico";
    if (num === 15) return "g13_fase1";  // 👈 empieza la final en Fase 1
    return "g13_final";
  };


    const repechage = useRepechage({gala,gstate,setGstate,contestants,setContestants,summaries,setSummaries,setStage,setCarryNominees,songs,songsMeta,academy,manual,popularityEnabled,pickManually,nameOf,pushLog});

      function prepararNuevaGala(num, list = contestants) {
        // 👇 NUEVO: elegir correctamente quiénes “juegan” en cada gala
        const pool = (list || contestants);
        let vivos;

        if (num <= 12) {
          // Hasta la G12: siguen “activos” (no finalistas aún)
          vivos = pool.filter(c => c.status === "active");
        } else if (num === 13) {
          // G13: 5 finalistas + 2 nominados arrastrados (que siguen “active”)
          vivos = pool.filter(c => c.status === "finalista" || c.status === "active");
        } else if (num === 14) {
          // G14: 4 finalistas (de G13) + 2 nominados que vienen del jurado (G13)
          const duelIds = (summaries?.[13]?.finalNominees || []).map(String);
          const isDuel  = new Set(duelIds);
          vivos = pool.filter(c =>
            c.status === "finalista" || c.status === "ganador" || isDuel.has(String(c.id))
          );
        } else {
          // G15–G17: solo finalistas/ganador
          vivos = pool.filter(c => c.status === "finalista" || c.status === "ganador");
        }

        setGstate({
          publicRank: [], top3: [], top3Pct: undefined, favoritoId: undefined, top3Shown: false,
          evaluacionOrden: [], evalResults: [], salvados: new Set(),
          nominados: [], profesorSalvoId: undefined, votosCompaneros: [], salvadoCompanerosId: undefined,
          currentEvaluadoId: undefined, currentEvaluadoLogIndex: undefined, g12: undefined, g15: undefined
        });

        const activosIds = [...new Set([...vivos.map(c => c.id), ...(num === 9 ? summaries[8]?.repechage?.selected || [] : [])])];

        // nominados que vienen de la gala anterior (G2–G12) o de G13→G14
        const nominadosDuelo =
          num === 14
            ? (summaries?.[13]?.finalNominees || [])
            : (num >= 2 && num <= 13 ? [...carryNominees] : []);

        // Reparto base
        let repartoBase = buildRepartoParaGala(num, activosIds, nominadosDuelo);

        // 👉 G13: sube ARRIBA a los dos duelistas arrastrados desde G12 (carryNominees)
        if (num === 13 && Array.isArray(carryNominees) && carryNominees.length) {
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

        // 👉 G14: sube ARRIBA las filas que contengan a los dos duelistas
        if (num === 14) {
          const duelSet = new Set((summaries?.[13]?.finalNominees || []).map(String));
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

        if (num === 15) {
        // Limpia estado temporal de la final
        setGstate(st => ({ ...(st || {}), g13: null }));

        // Asegura stage inicial correcto (si no lo hace ya tu goNext)
        setStage(nextStageFor(15));   // con tu nextStageFor ya devuelve "g13_fase1"
        setGala(15);
        if (typeof setViewGala === "function") setViewGala(15);
      }


        // Reparto final con canciones
        const { reparto, groupSong } = buildRepartoConCanciones({
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
              [num]: { ...(s[num]?.[num] || {}), reparto, groupSong }
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
    if (!songsReady || !songsMetaReady || !songs.length) { alert("Espera a que se carguen las canciones antes de empezar."); return; }
    if (roster.length !== 18) {
      alert(`Hay ${roster.length} concursantes seleccionados. Deben ser exactamente 18.`);
      return;
    }
    const inits = roster.map(p => ({
      ...p, id: uid(), status: "active", history: [], popularity: 50, stats: { ...p.stats },
    }));


    try {
      setAcademy(a => ({ ...a, repechageEnabled: resolveRepechage(repechageOption), judges: judgeNames.map((n,i) => n.trim() || `Juez ${i+1}`), weeks: {}, pairs: [], relationships: {} }));
      setShowPopularity(false);
      setShowRelationships(false);
      setContestants(inits);
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


      // ✅ G13 (formato nuevo) — ¡usa v, no t! y devuelve {bg,fg}
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
    setAcademy(emptyAcademy());
    setShowPopularity(false);
      setShowRelationships(false);
    setContestants([]);
    setGala(0);
    setViewGala(0);
    setGalaLogs({});
    setCarryNominees([]);
    setStage("inicio");
    setGstate({});
    setSummaries({});
    window.scrollTo({top:0,behavior:"instant"});
  }

    const onDownloadRecorrido = async () => {
      const node = document.getElementById(showRelationships ? "relaciones-capture" : showPopularity ? "popularidad-capture" : "recorrido-capture");
      if (!node) {
        alert("No se encontró la tabla activa 😕");
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
        link.download = `${showRelationships ? "relaciones" : showPopularity ? "popularidad" : "recorrido"}.png`;
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


    function g0_snapshot() {
      return { gstate: { ...gstate, g0Reveal: undefined }, contestants, summaries, galaLogs, stage };
    }
    function g0_applyResult(pending) {
      setGstate(pending.gstate);
      setContestants(pending.contestants);
      setSummaries(pending.summaries);
      setGalaLogs(pending.galaLogs);
      setStage(pending.stage);
      setViewGala(0);
    }
    function g0_revealNext(revealAll = false) {
      if (stage !== "g0_eval") return;
      let reveal = gstate.g0Reveal;
      if (!reveal) {
        reveal = prepareGalaZeroJury(calculateG0Jury, g0_snapshot());
        if (!reveal) return;
        if (revealAll || !reveal.events.length) { g0_applyResult(reveal.pending); return; }
      } else if (revealAll || (reveal.phase === "result" && reveal.index === reveal.events.length - 1)) {
        g0_applyResult(reveal.pending);
        return;
      } else {
        reveal = reveal.phase === "present" && summaries[0]?.performances?.[reveal.events[reveal.index].id] ? { ...reveal, phase: "comment" }
          : reveal.phase === "present" || reveal.phase === "comment" ? { ...reveal, phase: "result" }
          : { ...reveal, index: reveal.index + 1, phase: "present" };
      }
      setGstate(st => ({ ...st, g0Reveal: reveal }));
      setViewGala(0);
    }
    function g0_revealSave(calculate) {
      if (gstate.g0Reveal?.phase === "result") {
        g0_applyResult(gstate.g0Reveal.pending);
        return;
      }
      const pending = captureScoreResult(calculate, g0_snapshot(), 0);
      if (pending.stage === stage) return; // A cancelled manual choice stays on the same screen.
      setGstate(st => ({ ...st, g0Reveal: { phase: "result", pending } }));
      setViewGala(0);
    }
    function g0_profesSalvan() { g0_revealSave(calculateG0Teachers); }
    function g0_publicoVota() { g0_revealSave(calculateG0Public); }

    function g0_setup(list) {
      // (opcional) si quieres asegurar que hay canciones cargadas
      if (!songsReady) { setStage("cargandoCanciones"); return; }
      if (!songs.length) { alert("No se han cargado canciones. Revisa /public/canciones.txt"); return; }

      const order = shuffle(list.map(c => c.id));

      // 1) Reparto base (solos) y asignación de canciones
      const reparto0base = buildRepartoParaGala(0, list.map(c => c.id), []);
      const { reparto: reparto0, groupSong } = buildRepartoConCanciones({
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
          0: { ...(s[0]?.[0] || {}), reparto: reparto0, groupSong },
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

  function calculateG0Jury({ gstate, contestants, summaries, setGstate, setContestants, setStage, pushLog }) {
    let st = gstate?.g0;
    if (!st) { pushLog("⚠️ Prepara primero la Gala 0.", 0); return; }

    // ====== MODO MANUAL: elegir directamente los 4 "en duda" ======
    if (manual) {
      const vivos = contestants.filter(c => (c.status ?? "active") !== "eliminado" && (c.status ?? "active") !== "expulsado");
      const ids   = vivos.map(c => c.id);

      // Si ya hay 4 en duda, pasa a profes
      if (new Set(st.doubt || []).size === 4) {
        pushLog(`ℹ️ Ya hay 4 en duda: ${Array.from(st.doubt).map(nameOf).join(" · ")}.`, 0);
        setStage("g0_profes");
        return;
      }

      // (opcional) puedes quitar este log si ya no lo quieres
      pushLog("🔎 Elige los 4 concursantes ‘en duda’.", 0);

      // ⬇️ CAMBIO: añade el título al prompt
      const elegidos = pickManually(ids, true, nameOf, "Elige 4 en duda")?.slice(0, 4);

      if (!elegidos || elegidos.length !== 4) { alert("Debes elegir exactamente 4."); return; }

      const doubt   = new Set(elegidos);
      const entered = new Set(ids.filter(id => !doubt.has(id)));

      pushLog(`🟧 En duda (G0): ${elegidos.map(nameOf).join(" · ")}.`, 0);

      // Guarda estado G0 (reemplaza el flujo iterativo)
      setGstate(prev => ({
        ...prev,
        g0: {
          ...(prev?.g0 || {}),
          order: ids,              // opcional
          idx: ids.length,         // marca como “completado”
          entered,
          doubt,
          profesSaved: null,
          public: null
        }
      }));

      // Pasa a Profes
      setStage("g0_profes");
      return;
    }

    // ====== MODO AUTOMÁTICO (tu flujo tal cual) ======
    if (summaries[0]?.performances && !st.performanceNominees) {
        st = { ...st, performanceNominees: [...st.doubt, ...selectPerformanceNominees(st.order.slice(st.idx), summaries[0].performances, contestants, 4 - new Set(st.doubt).size)] };
      }
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

    if (summaries[0]?.performances?.[id]) pDoubt = Math.max(0.05, Math.min(0.9, BASE_G0_DOUBT + performanceNominationModifier(summaries[0].performances[id])));
    let decision;
    if (st.performanceNominees) decision = st.performanceNominees.includes(id) ? "duda" : "entra";
      else if (needDoubt <= 0)               decision = "entra";
    else if (remaining === needDoubt) decision = "duda";
    else                              decision = (Math.random() < pDoubt) ? "duda" : "entra";

    if (decision === "duda") doubt.add(id);
    else entered.add(id);

    const nextIdx = idx + 1;
    setGstate(prev => ({ ...prev, g0: { ...st, entered, doubt, idx: nextIdx } }));

    if (decision === "duda") pushLog(`⚠️ ${nameOf(id)} queda <em>EN DUDA</em>.`, 0);
    else                     pushLog(`🎤 ${nameOf(id)} entra directamente a la Academia.`, 0);

    if (nextIdx >= order.length) {
      pushLog(`❓ En duda: ${Array.from(doubt).map(nameOf).join(", ")}.`, 0);
      setStage("g0_profes");
    }
  }


    function calculateG0Teachers({ gstate, contestants, summaries, setGstate, setContestants, setStage, pushLog }) {
      const st = gstate?.g0;
      if (!st) return;

      const candidatos = Array.from(st.doubt || []);

      // ====== MODO MANUAL: profes eligen 1 de los (4 o 3) en duda ======
      if (manual) {
        if (candidatos.length !== 4 && candidatos.length !== 3) {
          pushLog("⚠️ Deben estar 4 concursantes en duda para que decidan los profesores.", 0);
          return;
        }

        const elegido = pickManually(candidatos, false, nameOf, "Elige a quién salvan los profesores");
        if (!elegido) return;

        pushLog(`🎓 Profesores salvan a <strong>${nameOf(elegido)}</strong> (entra).`, 0);

        setGstate(stAll => {
          const entered = new Set(st.entered); entered.add(elegido);
          const doubt   = new Set(st.doubt);   doubt.delete(elegido);
          return { ...stAll, g0:{ ...st, entered, doubt, profesSaved: elegido } };
        });

        setStage(candidatos.length === 4 ? "g0_publico" : "g0_cerrar");
        return;
      }

      // ====== AUTOMÁTICO (tal cual lo tenías) ======
      if (candidatos.length !== 4 && candidatos.length !== 3) {
        pushLog("⚠️ Deben estar 4 concursantes en duda para que decidan los profesores.", 0);
        return;
      }

      const elegido = pickProfSave(
        candidatos,
        summaries,
        0,
        (ids) => ids[Math.floor(Math.random() * ids.length)],
        candidatos
      );

      const debugData = candidatos.map(id => ({
        id,
        nombre: nameOf(id),
        nominaciones: countNomsThrough
          ? countNomsThrough(id, summaries, 0, candidatos)
          : countNomsUpTo(id, summaries, 1)
      }));
      console.debug("[G0 DEBUG] Profesores deciden entre:", debugData);
      console.debug("[G0 DEBUG] => Salvan a:", { id: elegido, nombre: nameOf(elegido) });

      pushLog(`🎓 Profesores salvan a <strong>${nameOf(elegido)}</strong> (entra).`, 0);

      setGstate(stAll => {
        const entered = new Set(st.entered); entered.add(elegido);
        const doubt   = new Set(st.doubt);   doubt.delete(elegido);
        return { ...stAll, g0:{ ...st, entered, doubt, profesSaved: elegido } };
      });

      setStage(candidatos.length === 4 ? "g0_publico" : "g0_cerrar");
    }

    function calculateG0Public({ gstate, contestants, summaries, setGstate, setContestants, setStage, pushLog }) {
      const st = gstate?.g0; 
      if (!st) return;
      const candidatos = Array.from(st.doubt || []);
      if (candidatos.length !== 3) { pushLog("⚠️ Deben quedar 3 en duda para la votación del público.", 0); return; }

      // ====== MODO MANUAL: público salva 1 (sin porcentajes) ======
      if (manual) {
        const winner = pickManually(candidatos, false, nameOf, "Elige a quién salva el público");
        if (!winner) return;

        const losers = candidatos.filter(id => String(id) !== String(winner));

        pushLog(`🗳️ Público salva (G0) a <strong>${nameOf(winner)}</strong>.`, 0);
        pushLog(`⛔ Eliminados en Gala 0: ${losers.map(nameOf).join(" · ")}.`, 0);

        // Marcar eliminados y salvado
        setContestants(prev => prev.map(c => {
          if (losers.some(id => String(id) === String(c.id))) {
            return {
              ...c,
              status: "eliminado",
              history: [...(c.history || []), { gala: 0, evento: "Eliminado (Gala 0)" }]
            };
          }
          return c;
        }));

        setGstate(stAll => {
          const entered = new Set(st.entered); entered.add(winner);
          const doubt   = new Set(st.doubt);   candidatos.forEach(id => doubt.delete(id));
          return { ...stAll, g0: { ...st, entered, doubt, public: { tabla: [], winner, losers } } };
        });

        setStage("g0_cerrar");
        return;
      }

      // ====== AUTOMÁTICO (tu versión con % aleatorios) ======
      const pcts = audiencePercentages(candidatos, contestants, Math.random, 4, popularityEnabled);
      const tabla = candidatos.map((id,i)=>({ id, name: nameOf(id), pct: pcts[i] }))
                              .sort((a,b)=>b.pct-a.pct);
      const winner = tabla[0].id;
      const losers = [tabla[1].id, tabla[2].id];

      pushLog(`🗳️ Público: ${tabla.map(t=>`${t.name} ${fmtPct(t.pct)}`).join(" · ")}.`, 0);
      pushLog(`✅ Se salva <strong>${nameOf(winner)}</strong>. ❌ Quedan fuera ${tabla.slice(1).map(t=>t.name).join(" y ")}.`, 0);

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
         const { reparto: reparto1, groupSong } = buildRepartoConCanciones({
           galaNum: 1,
           reparto: reparto1base,
           summaries,
           allSongs: songs,
         });
        setSummaries(s => ({
          ...s,
          1: { ...(s[1] || { gala: 1 }), 1: { ...(s[1]?.[1] || {}), reparto: reparto1, groupSong } }
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
        setStage("votoPublico"); // ← aquí aparece “🎤 Presentar favoritos”

        pushLog("🏁 Gala 0 cerrada. Entran 16 concursantes. Comienza la Gala 1.");
    }


   const goNext = ()=>{ const next=nextGala(gala,repechageEnabled); setGala(next); prepararNuevaGala(next); };


    function startCeremony(kind, ids, source, voters = []) {
      setGstate(st => ({ ...st, ceremony: { kind, ids: [...ids], source, voters, votes: [], phase: "intro" } }));
      setViewGala(gala);
      setStage("ceremony");
    }
    function finishCeremony(nextStage) {
      if (!gstate.ceremony) { setStage(nextStage); return; }
      setGstate(st => ({ ...st, ceremony: { ...st.ceremony, phase: "result", nextStage } }));
      setStage("ceremony");
    }
    function continueCeremony() {
      const next = gstate.ceremony.nextStage;
      setGstate(st => ({ ...st, ceremony: undefined }));
      setStage(next);
    }
    function advanceCeremony() {
      const c = gstate.ceremony;
      if (!c || c.phase === "result") return;
      if (c.kind === "duel" && c.phase !== "percentage") {
        const phase = c.phase === "intro" ? "phrase" : "percentage";
        if (phase === "phrase") pushLog("🗣️ La audiencia ha decidido que debe proseguir su formación en la academia con un…");
        else pushLog(`📊 ${c.pct.toFixed(2)}%`);
        setGstate(st => ({ ...st, ceremony: { ...c, phase } }));
        return;
      }
      if (c.kind === "peers" && c.votes.length < c.voters.length) {
        if (c.phase === "board") {
          setGstate(st => ({ ...st, ceremony: { ...c, phase: "announceVote" } }));
          return;
        }
        const voterId = c.voters[c.votes.length];
        const votedId = manual ? pickManually(c.ids, false, nameOf, `${nameOf(voterId)} salva a…`) : choosePeerSave({ voterId, candidates: c.ids, relations: academy.relationships, pairs: academy.pairs, reparto: summaries[gala]?.[gala]?.reparto, enabled: relationshipsEnabled }, Math.random);
        if (!votedId) return;
        setGstate(st => ({ ...st, ceremony: { ...c, phase: "board", votes: [...c.votes, { voterId, votedId }] } }));
        return;
      }
      const resolve = { duel: dueloRevelar, teachers: profesoresSalvanUno, peers: companerosVotan, specialTeachers: g11_profesoresSalvan, finalDuel: g12_duel };
      resolve[c.source]?.();
    }

    function revealAllPeerVotes() {
      const c = gstate.ceremony;
      if (!c || c.kind !== "peers") return;
      if (c.phase === "result") { continueCeremony(); return; }
      const votes = [...c.votes];
      for (const voterId of c.voters.slice(votes.length)) {
        const votedId = manual ? pickManually(c.ids, false, nameOf, `${nameOf(voterId)} salva a…`) : choosePeerSave({ voterId, candidates: c.ids, relations: academy.relationships, pairs: academy.pairs, reparto: summaries[gala]?.[gala]?.reparto, enabled: relationshipsEnabled }, Math.random);
        if (!votedId) {
          setGstate(st => ({ ...st, ceremony: { ...c, votes, phase: "announceVote" } }));
          return;
        }
        votes.push({ voterId, votedId });
      }
      const completed = { ...gstate, ceremony: { ...c, votes } };
      companerosVotan(completed, true);
      setViewGala(gala);
    }

    function iniciarDueloCiego() {
      if (gala === 9 && summaries[8]?.repechage?.selected?.length) { repechage.startReturn(); return; }
      if (carryNominees.length !== 2) { setStage(nextStageFor(gala)); return; }
      const [a, b] = carryNominees;

      const [pctA, pctB] = audiencePercentages([a, b], contestants, Math.random, 4, popularityEnabled);

      // Guardamos el paquete del duelo en gstate
      setGstate(st => ({
        ...st,
        ceremony: { kind: "duel", source: "duel", ids: [a, b], pct: Math.max(pctA, pctB), phase: "intro" },
        duelStep: {
          a, b, pctA, pctB,
          winner: pctA > pctB ? a : b,
          loser:  pctA > pctB ? b : a
        }
      }));

      // Paso 1: porcentajes ciegos
      pushLog("Llega el momento de la verdad");
      setStage("ceremony");
      setViewGala(gala);
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
      const { a, b } = pkg;
      let { pctA, pctB } = pkg;

      // ======= 💡 MODO MANUAL: decides quién es expulsado/a =======
      if (manual) {
        // Elige al expulsado entre los dos nominados del duelo
        const expulsado = pickManually([a, b], false, nameOf, "Elige el eliminado de esta gala");
        if (!expulsado) return;

        const winner = expulsado === a ? b : a;
        const loser  = expulsado;
        const high = Math.max(pctA, pctB), low = Math.min(pctA, pctB);
        [pctA, pctB] = winner === a ? [high, low] : [low, high];

        // Aplicar eliminación al concursante perdedor
        setContestants(prev => prev.map(c => {
          if (c.id === loser) {
            return {
              ...c,
              status: "eliminado",
              history: [
                ...(c.history || []),
                {
                  gala,
                  evento: "Eliminado",
                  // El salvado recibe el porcentaje anunciado por el presentador.
                  detalle: `${fmtPct(c.id===a?pctA:pctB)} vs ${fmtPct(c.id===b?pctB:pctA)}`
                }
              ]
            };
          }
          return c;
        }));

        pushLog(`🗳️ <strong>${nameOf(winner)}</strong>. ${nameOf(loser)} es eliminado/a. (manual)`);

        // Guardado de duelo + “salvado por público”
        setSummaries(s => ({
          ...s,
          [gala]: {
            ...(s[gala] || { gala }),
            duel: { a, b, pctA, pctB, winner },
            duelSaved: { ...(s[gala]?.duelSaved || {}), [winner]: (winner === a ? pctA : pctB) }
          }
        }));

        // Actualiza etiquetas del reparto (igual que en tu código)
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

        // Limpieza + transición
        setCarryNominees([]);
        setGstate(st => ({ ...st, duelStep: undefined }));

        if (gala <= 9)      finishCeremony("votoPublico");
        else if (gala === 12) finishCeremony("juradoEvaluando");
        else if (gala === 13) finishCeremony("g11_jurado");
        else                 finishCeremony(nextStageFor(gala));

        return; // ⛔ no sigas a la rama automática
      }
      // ===== FIN MODO MANUAL =====

      // ======= 💻 MODO AUTOMÁTICO (tu código tal cual) =======
      const { winner, loser } = pkg;

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

      setSummaries(s => ({
        ...s,
        [gala]: {
          ...(s[gala] || { gala }),
          duel: { a, b, pctA, pctB, winner },
          duelSaved: { ...(s[gala]?.duelSaved || {}), [winner]: (winner === a ? pctA : pctB) }
        }
      }));

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

      if (gala <= 9)      finishCeremony("votoPublico");
      else if (gala === 12) finishCeremony("juradoEvaluando");
      else if (gala === 13) finishCeremony("g11_jurado");
      else                 finishCeremony(nextStageFor(gala));
    }



  // Galas 1–10
    function resolverDueloPendiente(){
      if (carryNominees.length !== 2) { setStage(nextStageFor(gala)); return; }
      const [a, b] = carryNominees;

      const [pctA, pctB] = audiencePercentages([a, b], contestants, Math.random, 4, popularityEnabled);

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



    function iniciarVotoPublico() {
      if (!gstate || gstate.top3Shown) return;
      const vivos = contestants.filter(c => c.status === "active");
      const ban = new Set([...(summaries[gala - 1]?.finalNominees || []), ...(summaries[gala - 1]?.repechage?.selected || [])]);
      const ranked = favoriteRanking(vivos, popularityEnabled, Math.random);
      let top3 = ranked.filter(r => !ban.has(r.id)).slice(0, 3).map(r => r.id);
      if (manual) {
        const selected = pickManually(vivos.filter(c => !ban.has(c.id)).map(c => c.id), true, nameOf, "Elige a los 3 más votados");
        if (!selected) return;
        if (selected.length !== 3 || new Set(selected).size !== 3) { alert("Debes elegir 3 concursantes distintos."); return; }
        top3 = selected;
      }
      if (top3.length !== 3) return;
      // Fisher–Yates: revelation order is independent of the ranking.
      const order = [...top3];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      setGstate(prev => ({ ...prev, publicRank: ranked, top3,
        top3Pct: [], favoritoId: undefined, top3Shown: true,
        top3RandomOrder: order, top3RevealCount: 0, top3NamesRevealed: false,
        favoriteRevealed: false, top3Ban: ban,
      }));
      setViewGala(gala);
      pushLog("🎤 La Audiencia ha decidido que los 3 concursantes más votados esta semana para ser el Favorito son…");
    }

    function revelarTop3YFavorito() {
      if (!gstate?.top3?.length || gstate.favoriteRevealed) return;
      const count = gstate.top3RevealCount ?? (gstate.top3NamesRevealed ? 3 : 0);
      const order = gstate.top3RandomOrder || gstate.top3;
      setViewGala(gala);
      if (count < 3) {
        const nextCount = count + 1;
        pushLog(`⭐ Entre los 3 más votados: <strong>${nameOf(order[count])}</strong>.`);
        setGstate(st => ({ ...st, top3RandomOrder: order, top3RevealCount: nextCount, top3NamesRevealed: nextCount === 3 }));
        if (nextCount === 3) {
          setSummaries(s => ({ ...s, [gala]: { ...(s[gala] || { gala }), top3Ids: gstate.top3 } }));
          pushLog(`🎖️ Los 3 favoritos (orden aleatorio): ${order.map(nameOf).join(" · ")}`);
        }
        return;
      }
      const top3Rank = gstate.top3.map(id => gstate.publicRank.find(r => r.id === id)).filter(Boolean).sort((a, b) => b.pct - a.pct);
      const favoritoId = manual
        ? pickManually(gstate.top3, false, nameOf, "Elige al Favorito/a")
        : top3Rank[0]?.id;
      if (!favoritoId) return;
      const salvados = new Set(gstate.salvados);
      salvados.add(favoritoId);
      const top3Pct = manual ? [] : top3Rank.map(r => r.pct);
      setGstate(st => ({ ...st, favoritoId, salvados, top3Pct, favoriteRevealed: true, finalTwoPlan: undefined }));
      setSummaries(s => ({ ...s, [gala]: { ...(s[gala] || { gala }), top3Ids: gstate.top3, top3Pct, favoritoId } }));
      pushLog(`🌟 <strong>Favorito/a: ${nameOf(favoritoId)}</strong>. ` + (manual
        ? `Top-3: ${order.map(nameOf).join(" · ")}`
        : `Porcentajes Top3: ${top3Rank.map(t => `${nameOf(t.id)} ${fmtPct(t.pct)}`).join(" · ")}`));
      // Keep the winner visible until the user explicitly continues.
    }

    function evaluarSiguientePorJurado(revealAll = false) {
      if (stage !== "juradoEvaluando") return;
      if (gala === 8 && repechageEnabled) { repechage.start(); return; }
      if (!revealAll && gstate.currentEvaluadoId && !gstate.juryCommentShown && summaries[gala]?.performances?.[gstate.currentEvaluadoId]) {
        setGstate(st => ({ ...st, juryCommentShown: true }));
        return;
      }
      const next = runJuryReveal(evaluarPasoJurado, { gstate, galaLogs, summaries, stage }, gala, revealAll);
      setGstate(next.gstate);
      setGalaLogs(next.galaLogs);
      setSummaries(next.summaries);
      setStage(next.stage);
      setViewGala(gala);
    }

    function evaluarPasoJurado({ gstate, galaLogs, summaries, setGstate, setGalaLogs, setSummaries, setStage, pushLog }){
      if (!gstate) return;
      if (!manual && summaries[gala]?.performances && !gstate.performanceNominees) {
        const eligible = contestants.filter(c => c.status === "active" && c.id !== gstate.favoritoId && !gstate.evalResults.some(r => r.id === c.id)).map(c => c.id);
        gstate = { ...gstate, performanceNominees: [...gstate.nominados, ...selectPerformanceNominees(eligible.filter(id => !gstate.nominados.includes(id)), summaries[gala].performances, contestants, 4 - gstate.nominados.length)] };
      }


      if (!manual && gstate.performanceNominees && !gstate.juryOrderReady) {
        const remainingIds = contestants.filter(c => c.status === "active" && c.id !== gstate.favoritoId && !gstate.evalResults.some(r => r.id === c.id)).map(c => c.id);
        const current = gstate.currentEvaluadoId;
        const order = mixedJuryOrder(remainingIds.filter(id => id !== current), gstate.performanceNominees, Math.random);
        gstate = { ...gstate, evaluacionOrden: current ? [current, ...order] : order, juryOrderReady: true };
      }

      const sufOfId = (id) => {
      const g = contestants.find(x => x.id === id)?.gender || "e";
      return g === "m" ? "o" : g === "f" ? "a" : "e";
    };
    const NOM = (id) => `NOMINAD${sufOfId(id).toUpperCase()}`;   // para logs en MAYÚSCULAS
    // (si lo prefieres en capitalización normal, usa: `Nominad${sufOfId(id)}`)


      // 1) Construir orden al entrar al jurado
      if ((!gstate.evaluacionOrden || gstate.evaluacionOrden.length === 0) && !gstate.evalResults?.length) {
        const vivosIds   = contestants.filter(c => c.status === "active").map(c => c.id);
        const favId      = gstate.favoritoId || null;
        const vivosSinFav = favId ? vivosIds.filter(id => id !== favId) : vivosIds;
        const nomineeIds = []; // no “marcamos” N/O por adelantado
      // --- Construir orden según reglas por gala ---
      const maxConsec = gala <= 8 ? 1 : 2;

      const ordenValoraciones = buildValoracionesOrder(vivosSinFav, nomineeIds, {
        galaNum: gala,         // <- usar la variable correcta
        maxConsecNom: maxConsec,
        forceMixedTail: true
      });


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
      const yaEvaluados = new Set(gstate.evalResults.map(r => r.id));
      const pend = gstate.evaluacionOrden
        .filter(id =>
          vivos.includes(id) &&
          !gstate.nominados.includes(id) &&
          id !== gstate.favoritoId &&           // inmune: no se evalúa
          !yaEvaluados.has(id)                  // evita repetir
        );

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
        const idx = (galaLogs[gala]?.length || 0) + (summaries[gala]?.performances?.[actualId] ? 1 : 0);
        setGalaLogs(prev => {
          const arr = [ ...(prev[gala] || []) ];
          const feedback = summaries[gala]?.performances?.[actualId];
          const safe = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
          if (feedback) arr.push(`⚖️ ${safe(feedback.judge)} a <strong>${safe(nameOf(actualId))}</strong>: ${safe(feedback.critique)}`);
          arr.push(`⚖️ Jurado evalúa a <strong>${nameOf(actualId)}</strong> → …`);
          return { ...prev, [gala]: arr };
        });
        setGstate({ ...gstate, currentEvaluadoId: actualId, currentEvaluadoLogIndex: idx, juryCommentShown: false });
        return;
      }

      // 3) Decidir acción sobre el evaluado actual
      const id = gstate.currentEvaluadoId;
      const logIdx = gstate.currentEvaluadoLogIndex ?? (galaLogs[gala]?.length || 1) - 1;

      if (!manual && gstate.performanceNominees) {
        const nominated = gstate.performanceNominees.includes(id);
        const salvados = new Set(gstate.salvados);
        if (!nominated) salvados.add(id);
        writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → ${nominated ? `<strong>${NOM(id)}</strong>` : "cruza la pasarela"}.`);
        setGstate({ ...gstate, currentEvaluadoId: undefined, currentEvaluadoLogIndex: undefined,
          nominados: nominated ? [...gstate.nominados, id] : gstate.nominados, salvados,
          evalResults: [...gstate.evalResults, { id, result: nominated ? "nominado" : "salvado" }],
          evaluacionOrden: gstate.evaluacionOrden.filter(x => x !== id) });
        return;
      }

      // reconstruir pendientes (id primero)
      const yaEvaluados = new Set(gstate.evalResults.map(r => r.id));
      let pend = gstate.evaluacionOrden
        .filter(x =>
          vivos.includes(x) &&
          !gstate.nominados.includes(x) &&
          x !== gstate.favoritoId &&
          !yaEvaluados.has(x)
        );
      if (pend[0] !== id) pend = [ id, ...pend.filter(x => x !== id) ];

      const remaining = pend.length;
      const needed = 4 - gstate.nominados.length;
      let plan = gstate.finalTwoPlan;

      // --- GUARDARRAÍLES DE FORMATO ---
      const maxConsec = gala <= 8 ? 1 : 2;
      // Traducimos tus resultados reales ("nominado"/"salvado") a 'N'/'O'
      const hechos = gstate.evalResults.map(r => r.result === "nominado" ? "N" : "O");

      let consecN = 0;
      for (let i = hechos.length - 1; i >= 0 && hechos[i] === "N"; i--) consecN++;

      let fuerzaO = false;
      // 1) Nunca más de maxConsec 'N' seguidos
      if (consecN >= maxConsec) fuerzaO = true;
      // 2) En los dos últimos debe haber al menos un 'O'
      if (remaining === 2 && hechos[hechos.length - 1] === "N") fuerzaO = true;

      // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
      // MODO MANUAL: decidir “salvado” o “nominado” para el evaluado actual
      if (manual) {
        // (opcional) evitar que sea imposible llegar a 4 nominados

        const choice = pickManually(
          manualJuryOptions(remaining, needed), // reserva un salvado y un nominado para el final
          false,
          x => x
        );
        if (!choice) return;

        if (choice === "nominado" && gstate.nominados.length < 4) {
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
        return; // <<< evita toda la rama automática
      }
      // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<


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

      // (b-bis) G1–8: Quedan 4 por evaluar y faltan ≥3 → forzar NOMINADO ahora
      if (gala <= 8 && remaining === 4 && needed >= 3) {
          // si ya llevamos el máximo de N seguidas y AÚN HAY MARGEN, no fuerces N aquí
        const maxConsec = (gala <= 6 ? 1 : 2);
        const hechos = gstate.evalResults.map(r => r.result === "nominado" ? "N" : "O");
        let consecN = 0; for (let i = hechos.length - 1; i >= 0 && hechos[i] === "N"; i--) consecN++;
        const hayMargen = needed < remaining;
        if (consecN >= maxConsec && hayMargen) {
          writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → cruza la pasarela.`);
          const salvados = new Set(gstate.salvados); salvados.add(id);
          setGstate({ ...gstate, currentEvaluadoId: undefined, currentEvaluadoLogIndex: undefined,
            salvados, evalResults: [ ...gstate.evalResults, { id, result: "salvado" } ],
            finalTwoPlan: undefined, evaluacionOrden: gstate.evaluacionOrden.filter(x => x !== id)
          });
          return;
        }
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

      // 3B) DOS ÚLTIMAS
      if (remaining === 2) {
        const last = gstate.evalResults.slice(-1)[0]?.result; // "nominado" | "salvado"
      if (needed >= 2) {
        // Faltan 2 nominados y quedan 2 personas → N,N
        plan = ["nominado", "nominado"];
      } else if (needed <= 0) {
        plan = ["salvado", "salvado"];
      } else {
        // En Galas 1–8 evita repetir con la anterior
        if (gala <= 8 && last === "nominado") plan = ["salvado", "nominado"];
        else plan = Math.random() < Math.max(0.1, Math.min(0.9, 0.5 + performanceNominationModifier(summaries[gala]?.performances?.[pend[0]]) - performanceNominationModifier(summaries[gala]?.performances?.[pend[1]]))) ? ["nominado","salvado"] : ["salvado","nominado"];
      }
        setGstate({ ...gstate, finalTwoPlan: plan });
      }

      // 3A-guard ALL: evita llegar a las dos últimas necesitando 2 nominados
      if (remaining > 2 && (remaining - needed) <= 1) {
        // Forzar NOMINADO ya para no pedir N,N en las dos últimas
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

      // 3C) Decisión “normal” (con ventanas y performance)
      const last2 = gstate.evalResults.slice(-2).map(r => r.result);
      let decision;

      if (remaining === needed) {
        decision = "nominado";
      }
      else if (remaining === 2 && plan) {
        decision = plan[0];
      }
      // Solo aplica a partir de la G9; en G1–G8 no capamos las 3 primeras
      else if (gala >= 9 && evIndex < 3 && gstate.nominados.length >= 1) {
        decision = "salvado";
      }
      else {
        const last3 = gstate.evalResults.slice(-3).map(r => r.result);
        const nomsInLast3 = last3.filter(x => x === "nominado").length;
        if (nomsInLast3 >= 2 && needed < remaining) {
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
            const perfMod = summaries[gala]?.performances?.[id] ? performanceNominationModifier(summaries[gala].performances[id]) : performanceModifier(stats, req);
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

          decision = (Math.random() < prob) ? "nominado" : "salvado";
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

    // —— Límite de racha de SALVADOS en Galas 1–8: no más de 5 seguidos
    if (gala <= 4 && remaining > 2 && needed > 0) {
      let salvadosRun = 0;
      for (let i = gstate.evalResults.length - 1; i >= 0; i--) {
        if (gstate.evalResults[i]?.result === "salvado") salvadosRun++;
        else break;
      }
      if (salvadosRun >= 5 && decision === "salvado") {
        // Solo forzamos si sigue siendo posible llegar a 4 nominados
        const nomIfForce  = gstate.nominados.length + 1;
        const remIfForce  = remaining - 1;
        const needIfForce = 4 - nomIfForce;
        if (needIfForce <= remIfForce) {
          decision = "nominado";
        }
      }
    }

    // —— Asegurar “mixto” en los dos últimos (G1–G8):
    // si quedan 3 por evaluar y todavía faltan 2 nominados,
    // forzamos que ESTE sea nominado para que los dos últimos queden mezclados.
    if (gala <= 8 && remaining === 3 && needed === 2) {
      decision = "nominado";
    }


    // —— Freno "no 2 seguidos" para Galas 1–8 (excepto si lo hace imposible llegar a 4)
    const last = gstate.evalResults.slice(-1)[0]?.result;
    if (gala <= 8 && remaining > 2 && decision === "nominado" && last === "nominado") {
      // ¿Podemos cambiar a salvado y seguir pudiendo llegar a 4?
      const nomIfFlip = gstate.nominados.length;      // si salvamos ahora no sumamos nom
      const remIfFlip = remaining - 1;
      const needIfFlip = 4 - nomIfFlip;
      if (needIfFlip <= remIfFlip) {
        decision = "salvado"; // Evita dos seguidos
      }
    }  
    
    if (fuerzaO && needed < remaining) decision = "salvado";

    // 🔚 Chequeo final: debe seguir siendo posible llegar a 4 nominados
    {
      const nomAfter  = gstate.nominados.length + (decision === "nominado" ? 1 : 0);
      const remAfter  = remaining - 1;
      const needAfter = 4 - nomAfter;
      if (needAfter > remAfter) decision = "nominado";
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

      // ======= MODO MANUAL =======
      if (manual) {
        const salvado = pickManually(cand, false, nameOf, "Los profesores salvan a");
        if (!salvado) return;

        const nominados = cand.filter(id => id !== salvado);
        const salvados  = new Set(gstate.salvados); salvados.add(salvado);

        pushLog(`🎓 Profesores salvan (manual) a <strong>${nameOf(salvado)}</strong>.`);

        setGstate({ ...gstate, profesorSalvoId: salvado, nominados, salvados });

        // Usa la misma actualización "completa" de summaries + relleno
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

        finishCeremony("companerosVotan");
        return; // no continuar con la rama automática
      }
      // ===== FIN MODO MANUAL =====

      // -------- Rama automática (tu código) --------
      // En G12: contar nominaciones solo hasta la Gala 9 (sin incluir la actual)
      const countUntil = (gala === 12) ? 11 : gala;
      const curList    = (gala === 12) ? undefined : cand;

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

      const etiqueta = (gala === 12)
        ? `[G12 DEBUG] Profesores (criterio: menos nominaciones hasta G9)`
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

      finishCeremony("companerosVotan");
    }





  
    function companerosVotan(votingState = gstate, skipAnimation = false) {
      // 🔐 Defensas tempranas
      if (!votingState) { pushLog("⚠️ Estado no inicializado."); return; }

      // Asegura colecciones válidas
      const salvadosSet = votingState.salvados instanceof Set ? votingState.salvados : new Set();
      const candidatos = Array.isArray(votingState.nominados) ? votingState.nominados.slice() : [];

      // Necesitamos exactamente 3 nominados para esta fase
      if (candidatos.length !== 3) {
        pushLog(`⚠️ La votación de compañeros requiere 3 nominados, hay ${candidatos.length || 0}. Se omite.`);
        return;
      }

      // ======= 💡 MODO MANUAL =======

      // ===== FIN MODO MANUAL =====

      // ======= 💻 MODO AUTOMÁTICO (tu código original) =======

      // Electores: salvados hasta ahora
      const electores = Array.from(salvadosSet);
      if (electores.length === 0) {
        pushLog("⚠️ No hay ningún salvado que pueda votar. Se omite.");
        return;
      }

      // Emitir votos
      const votos = votingState.ceremony?.votes || [];
      if (votos.length !== electores.length) return;

      // Recuento robusto
      const recuento = Object.fromEntries(candidatos.map(c => [c, 0]));
      votos.forEach(v => {
        if (v && v.votedId in recuento)
          recuento[v.votedId] = (recuento[v.votedId] || 0) + 1;
      });

      // Empate y voto doble del favorito (solo para desempate)
      const votoDe = {};
      votos.forEach(v => { votoDe[v.voterId] = v.votedId; });

      let max = Math.max(...Object.values(recuento));
      let empatados = Object.entries(recuento)
        .filter(([, n]) => n === max)
        .map(([id]) => id);

      const tiedInitially = [...empatados];
      let desempateMsg = null;
      if (empatados.length > 1) {
        const favId = votingState.favoritoId ?? null;
        if (favId) {
          const votoFav = votoDe[favId];
          if (votoFav && empatados.includes(votoFav)) {
            empatados = [votoFav];
            desempateMsg = `⭐ Desempate: el voto del favorito (${nameOf(favId)}) decide a favor de ${nameOf(votoFav)}.`;
          }
        }
      }

      const ganador = (empatados.length ? pickRandom(empatados, 1)[0] : pickRandom(candidatos, 1)[0]);
      if (!ganador) {
        pushLog("⚠️ No se pudo determinar ganador en la votación de compañeros. Se omite.");
        return;
      }

      if (tiedInitially.length > 1 && !desempateMsg) {
        desempateMsg = `🎲 Empate entre ${tiedInitially.map(nameOf).join(", ")}. Al no resolverlo el voto del favorito, el sorteo salva a ${nameOf(ganador)}.`;
      }
      const peerTie = tiedInitially.length > 1 ? { ids: tiedInitially, message: desempateMsg, counts: recuento } : null;

      const votosList = votos.map(v => `<li>${nameOf(v.voterId)} → ${nameOf(v.votedId)}</li>`).join("");
      pushLog(`🧑‍🤝‍🧑 Votación de compañeros:<ul style="margin:4px 0 0 16px;">${votosList}</ul>${votingState.favoritoId ? "<div class=\"text-xs\">* El voto del favorito vale doble en caso de empate</div>" : ""}`);

      const contadorHTML = candidatos.map(id => `<strong>${nameOf(id)}</strong> ${recuento[id] ?? 0}`).join(" · ");
      pushLog(`📊 Recuento de votos (compañeros): ${contadorHTML}`);

      if (desempateMsg) pushLog(desempateMsg);
      pushLog(`✅ Más votado por compañeros: <strong>${nameOf(ganador)}</strong> (se salva).`);

      const nominadosRestantes = candidatos.filter(id => id !== ganador);
      const nuevosSalvados = new Set(salvadosSet); nuevosSalvados.add(ganador);

      setGstate({
        ...votingState,
        peerTie,
        votosCompaneros: votos,
        salvadoCompanerosId: ganador,
        nominados: nominadosRestantes,
        salvados: nuevosSalvados
      });

      setSummaries(s => ({
        ...s,
        [gala]: { ...(s[gala] || { gala }), salvadoCompanerosId: ganador, votosCompaneros: votos, finalNominees: nominadosRestantes }
      }));

      pushLog(`🟥 Nominados para la próxima gala: <strong>${nameOf(nominadosRestantes[0])}</strong> vs <strong>${nameOf(nominadosRestantes[1])}</strong>.`);
      setCarryNominees(nominadosRestantes);

      setSummaries(s => {
        const seguro = {
          ...s,
          [gala]: {
            ...(s[gala] || { gala }),
            juradoNominados: s[gala]?.juradoNominados || [],
            profesorSalvoId: votingState.profesorSalvoId ?? s[gala]?.profesorSalvoId,
            salvadoCompanerosId: ganador,
            finalNominees: nominadosRestantes,
            favoritoId: votingState.favoritoId ?? s[gala]?.favoritoId,
            top3Pct: votingState.top3Pct ?? s[gala]?.top3Pct,
            top3Ids: s[gala]?.top3Ids || [],
            duelSaved: s[gala]?.duelSaved,
            [gala]: s[gala]?.[gala] || {}
          }
        };
        const res = rellenarValoracionesReparto(gala, seguro, contestants);
        return res;
      });

      setSummaries(s => ({ ...s, [gala]: { ...(s[gala] || { gala }), duelSaved: {} } }));
      if (skipAnimation) setStage("galaCerrada");
      else finishCeremony("galaCerrada");

      const goNext = () => {
        const next = nextGala(gala,repechageEnabled);
        setGala(next);
        prepararNuevaGala(next, contestants);
      };
    }


    // ===============================================================
    //  Gala 13  →  6 concursantes
    //  - 4 jueces puntúan (6.0–10.0 en pasos de 0.5, con sesgo leve)
    //  - 3 más puntuados → Finalistas por jurado
    //  - Profesores salvan 1 (menos nominaciones hasta Gala 12)
    //  - Quedan 2 nominados → duelo público en Gala 14
    // ===============================================================
    // 🧮 GALA 13 — Fase 1: jurado (Top-3 = menos nominaciones) + recorrido con medias
    function applyScoreResults(pending) {
      setGstate(pending.gstate);
      setContestants(pending.contestants);
      setSummaries(pending.summaries);
      setGalaLogs(pending.galaLogs);
      setStage(pending.stage);
      setViewGala(gala);
    }
    function g11_puntuarJurado(skipAnimation = false) {
      const pending = captureScoreResult(calculateScoreResults, { gstate, contestants, summaries, galaLogs, stage }, gala);
      if (pending.stage === stage) return; // Cancelled manual selection or invalid roster.
      if (skipAnimation) { applyScoreResults(pending); return; }
      const scores = pending.summaries[13].juradoNotas;
      const ids = Object.keys(scores);
      const finalists = pending.summaries[13].juradoTop3;
      setGstate(st => ({ ...st, scoreReveal: { ids, scores, finalists,
        events: scoreEvents(ids, scores), shown: 0, revealedFinalists: 0, pending } }));
      setViewGala(gala);
      setStage("scoreReveal");
    }
    function advanceScoreReveal() {
      const r = gstate.scoreReveal;
      if (r.shown < r.events.length) {
        setGstate(st => ({ ...st, scoreReveal: { ...r, shown: r.shown + 1 } }));
      } else if (r.revealedFinalists < 3) {
        setGstate(st => ({ ...st, scoreReveal: { ...r, revealedFinalists: r.revealedFinalists + 1 } }));
      } else applyScoreResults(r.pending);
    }

    function calculateScoreResults({ gstate, contestants, summaries, setGstate, setContestants, setSummaries, setStage, pushLog }) {
      const toHalf = x => Math.round(x * 2) / 2;
      const clamp  = (x, a, b) => Math.max(a, Math.min(b, x));

      const rows   = (summaries?.[13]?.[13]?.reparto || []);
      const idsRaw = rows.flatMap(r => r.members);
      const ids    = Array.from(new Set(idsRaw)).filter(id => {
        const c = contestants.find(x => x.id === id);
        return c && c.status !== "eliminado" && c.status !== "expulsado";
      });

      if (!ids.length) {
        pushLog("⚠️ No hay concursantes en el reparto de la Gala 13.");
        return;
      }

      if (ids.length !== 6) {
        pushLog(`⚠️ Aviso: el jurado debería puntuar a 6 concursantes y ahora mismo hay ${ids.length}.`, 13);
      }

      // ======= 💡 MODO MANUAL: eliges tú el Top-3 =======
      let top3Ids;
      if (manual) {
        const elegidos = pickManually(ids, true, nameOf, "Elige el Top 3 del jurado")?.slice(0,3);
        if (!elegidos || elegidos.length !== 3) {
          alert("Debes elegir 3 concursantes para el Top-3 del jurado.");
          return;
        }
        top3Ids = elegidos;
        pushLog(`🏁 Top-3 del jurado (manual): ${top3Ids.map(nameOf).join(", ")}.`);
      } else {
        // 🔁 Automático como antes (por menos nominaciones)
        const withNoms = ids.map(id => ({
          id,
          noms: countNomsThrough(id, summaries, 12, undefined)
        }));
        const ordered = withNoms.sort((a,b) => (a.noms + performanceNominationModifier(summaries[gala]?.performances?.[a.id]) * 8) - (b.noms + performanceNominationModifier(summaries[gala]?.performances?.[b.id]) * 8));
        top3Ids = ordered.slice(0,3).map(x=>x.id);
      }
      // ======= FIN MODO MANUAL =======

      // Calculamos el resto normalmente
      const withNoms = ids.map(id => ({
        id,
        noms: countNomsThrough(id, summaries, 12, undefined)
      }));

      const bottom3 = ids.filter(id => !top3Ids.includes(id));

      // Generar notas (Top-3 medias más altas; el resto depende de nominaciones)
      const notas = {};
      ids.forEach(id => {
        const item = withNoms.find(x=>x.id===id);
        const baseMean = top3Ids.includes(id) ? 8.8 : 8.6 - 0.30 * (item?.noms ?? 0);
        const arr = [];
        for (let j=0;j<4;j++) {
          const noise = (Math.random()-0.5) * 1.0; // ±0.5
          arr.push(clamp(toHalf(baseMean + noise - performanceNominationModifier(summaries[gala]?.performances?.[id]) * 4), 5, 10));
        }
        notas[id] = arr;
      });

      alignFinalistScores(notas, top3Ids.map(String));

      // Ranking y desglose
      const ranking = ids.map(id => {
        const media = +(notas[id].reduce((a,b)=>a+b,0) / 4).toFixed(2);
        return { id, media, notas: notas[id] };
      }).sort((A,B)=>B.media-A.media);

      const desglose = ids.map(id => {
        const [j1,j2,j3,j4] = notas[id];
        const total = +(j1+j2+j3+j4).toFixed(2);
        return { id, j1, j2, j3, j4, total };
      }).sort((a,b)=>b.total-a.total);

      top3Ids = ranking.filter(r => top3Ids.includes(r.id)).map(r => r.id);

      // 🟦 Colores y guardado (idéntico)
      const top3Ranking = ranking.filter(r => top3Ids.includes(r.id)).sort((a,b)=>b.media-a.media);
      const bestId = top3Ranking[0]?.id;

      if (typeof setRecorrido === "function") {
        setRecorrido(prev => {
          const next = { ...prev };
          if (!next[13]) next[13] = {};
          ranking.forEach(r => {
            let color = "orange";
            if (top3Ids.includes(r.id)) color = (r.id === bestId) ? "DodgerBlue" : "white";
            next[13][r.id] = `Nota: ${r.media.toFixed(2)}|${color}`;
          });
          return next;
        });
      }

      const recorridoG11 = ranking.map(r => ({
        id: r.id,
        valor: `Nota: ${r.media.toFixed(2)}`,
        color: top3Ids.includes(r.id) ? (r.id === bestId ? "DodgerBlue" : "white") : "orange",
      }));

      // Guardar resumen
      setSummaries(s => ({
        ...s,
        13: {
          ...(s[13] || { gala: 13 }),
          juradoNotas: notas,
          juradoRanking: ranking,
          juradoDesglose: desglose,
          juradoTop3: top3Ids,
          juradoBottom3: bottom3,
          recorrido: recorridoG11,
          [13]: { ...(s[13]?.[13] || {}), reparto: (s[13]?.[13]?.reparto || []) }
        }
      }));

      // Marcar finalistas Top-3
      setContestants(prev => prev.map(c => (
        top3Ids.includes(c.id)
          ? { ...c, status: "finalista", history: [...(c.history||[]), { gala: 13, evento: "Finalista" }] }
          : c
      )));

      const listaMedia = ranking.map(t=>`${nameOf(t.id)} ${t.media}`).join(" · ");
      pushLog(`📊 Media del jurado (G13): ${listaMedia}.`);
      pushLog(`🏁 Finalistas por jurado (Top-3): ${top3Ids.map(nameOf).join(", ")}.`);
      pushLog(`⏭️ Falta decisión de profes entre: ${bottom3.map(nameOf).join(", ")}.`);

      setSummaries(s => rellenarValoracionesReparto(13, s, contestants));
      setStage("g11_profes");
    }



    
    // 🎓 GALA 13 — Fase 2: profesores salvan 1 del Bottom-3 → 4º finalista; otros 2 al duelo (G14)
    function g11_profesoresSalvan() {
      const bottom3 = summaries?.[13]?.juradoBottom3 || [];
      if (!bottom3.length) {
        pushLog("⚠️ No hay Bottom-3 guardado. Pulsa antes 'Puntuar jurado (G13)'.");
        return;
      }

      // ======= 💡 MODO MANUAL =======
      if (manual) {
        const profSaveId = pickManually(bottom3, false, nameOf, "Elige al 4º Finalista");
        if (!profSaveId) return;

        const duelIds = bottom3.filter(x => x !== profSaveId);

        // Guardar resultados y recolorear
        setSummaries(prev => {
          const updated = { ...prev };
          const S11 = { ...(updated[13] || { gala: 13 }) };
          const rec = Array.isArray(S11.recorrido)
            ? S11.recorrido.map(r =>
                r.id === profSaveId
                  ? { ...r, color: "yellowgreen" }
                  : r
              )
            : S11.recorrido;

          updated[13] = {
            ...S11,
            profesorSalvoId: profSaveId,
            juradoNominados: duelIds,
            finalNominees: duelIds,
            recorrido: rec
          };
          return updated;
        });

        // Marcar 4.º finalista
        setContestants(prev => prev.map(c => (
          c.id === profSaveId
            ? { ...c, status: "finalista", history: [...(c.history || []), { gala: 13, evento: "Finalista" }] }
            : c
        )));

        if (typeof setRecorrido === "function") {
          setRecorrido(prev => {
            const n = { ...prev };
            if (!n[13]) n[13] = {};
            const duelSet = new Set(duelIds.map(String));
            const profStr = String(profSaveId);

            Object.keys(n[13]).forEach(k => {
              const raw = String(n[13][k]);
              const [texto] = raw.includes("|") ? raw.split("|") : [raw];
              if (k === profStr) n[13][k] = `${texto}|yellowgreen`;
              if (duelSet.has(k)) n[13][k] = `${texto}|orange`;
            });
            return n;
          });
        }

        pushLog(`🎓 Profesores (manual) salvan a <strong>${nameOf(profSaveId)}</strong> (4.º finalista).`);
        setSummaries(s => rellenarValoracionesReparto(13, s, contestants));
        finishCeremony("g11_cerrar");
        return; // no seguir rama automática
      }
      // ===== FIN MODO MANUAL =====

      // ======= 💻 MODO AUTOMÁTICO (tu código actual) =======
      const profSaveId = pickProfSaveByFewestNoms(new Set(bottom3), summaries, 13);
      const duelIds = bottom3.filter(x => x !== profSaveId);

      setSummaries(prev => {
        const updated = { ...prev };
        const S11 = { ...(updated[13] || { gala: 13 }) };
        const rec = Array.isArray(S11.recorrido)
          ? S11.recorrido.map(r =>
              r.id === profSaveId
                ? { ...r, color: "yellowgreen" }
                : r
            )
          : S11.recorrido;

        updated[13] = {
          ...S11,
          profesorSalvoId: profSaveId,
          juradoNominados: duelIds,
          finalNominees: duelIds,
          recorrido: rec
        };
        return updated;
      });

      setContestants(prev => prev.map(c => {
        if (c.id === profSaveId) {
          return {
            ...c,
            status: "finalista",
            history: [...(c.history || []), { gala: 13, evento: "Finalista" }]
          };
        }
        return c;
      }));

      if (typeof setRecorrido === "function") {
        setRecorrido(prev => {
          const n = { ...prev };
          if (!n[13]) n[13] = {};
          const duelSet = new Set(duelIds.map(String));
          const profStr = String(profSaveId);

          Object.keys(n[13]).forEach(k => {
            const raw = String(n[13][k]);
            const [texto] = raw.includes("|") ? raw.split("|") : [raw];
            if (k === profStr) n[13][k] = `${texto}|yellowgreen`;
            if (duelSet.has(k)) n[13][k] = `${texto}|orange`;
          });
          return n;
        });
      }

      pushLog(`🎓 Profesores salvan a <strong>${nameOf(profSaveId)}</strong> (4.º finalista).`);
      setSummaries(s => rellenarValoracionesReparto(13, s, contestants));
      finishCeremony("g11_cerrar");
    }




    // ✅ Cerrar Gala 13 → preparar Gala 14 (4 finalistas + 2 nominados) y pasar al flujo de público
    function g11_cerrar() {
      const s11 = summaries?.[13] || {};
      const top3    = (s11.juradoTop3 || []).map(String);               // finalistas por jurado (3)
      const profStr = s11.profesorSalvoId != null ? String(s11.profesorSalvoId) : null; // 4º finalista
      const bottom3 = (s11.juradoBottom3 || []).map(String);            // los 3 menos votados por jurado

      // Duelistas que se arrastran a G14
      let duelIds = (s11.finalNominees || []).map(String);
      if (duelIds.length !== 2) duelIds = bottom3.filter(id => id !== profStr).slice(0, 2);

      if (duelIds.length !== 2) {
        pushLog("⚠️ No hay 2 nominados arrastrados desde G13. Revisa la votación del jurado.", 13);
      }

      const finalistasG11 = [...top3, profStr].filter(Boolean);
      if (finalistasG11.length) {
        pushLog(`🏁 Finalistas tras G13: <strong>${finalistasG11.map(nameOf).join(", ")}</strong>.`, 13);
        pushLog(`⚔️ Duelistas que pasan a G14: <strong>${duelIds.map(nameOf).join(" y ")}</strong>.`, 13);
      }

      // Guarda duelistas en summaries[13]
      setSummaries(s => ({ ...s, 13: { ...(s[13] || { gala: 13 }), finalNominees: duelIds }}));

      // (opcional) carry
      if (typeof setCarryNominees === "function") setCarryNominees(duelIds);

      // Prepara reparto de G14 (4 finalistas + 2 nominados)
      if (typeof prepararNuevaGala === "function") prepararNuevaGala(14);
      setSummaries(s => rellenarValoracionesReparto(14, s, contestants));

      // Limpia estado temporal g12
      setGstate(st => ({ ...(st || {}), g12: null }));

      // Cambia a G14 y muestra botones de público
      setGala(14);
      if (typeof setViewGala === "function") setViewGala(14);
      setStage("g12_14_publico");
    }


    // 📊 G14 — paso 1: generar porcentajes ciegos (duelo entre los 2 nominados de G13)
    function g12_setup() {
      const duelIds = (summaries?.[13]?.finalNominees || []).map(String);
      if (duelIds.length !== 2) { pushLog("⚠️ En G14 debe haber 2 duelistas (arrastrados desde G13).", 14); return; }
      const [a, b] = duelIds;

      const [pctA, pctB] = audiencePercentages([a, b], contestants, Math.random, 4, popularityEnabled);

      setGstate(s => ({
        ...(s || {}),
        ceremony: { kind: "duel", source: "finalDuel", ids: [a,b], pct: Math.max(pctA,pctB), phase: "intro" },
        g12: {
          duel: { a, b, pctA, pctB, winner: null },
          revealQueue: [{ pct: pctA, id: null }, { pct: pctB, id: null }],
          revealed: [],
          duelDone: false,
          phraseShown: false
        }
      }));

      pushLog("Llega el momento de la verdad", 14);
      setViewGala(gala);
      setStage("ceremony");

      // Reparto: 4 Finalista + 2 Nominado hasta resolver
      setSummaries(s => rellenarValoracionesReparto(14, s, contestants));
    }


    // 🔊 G14 — paso 2: SOLO mostrar la frase del presentador (sin mapear % a nombres)
    function g12_revealPhrase() {
      const g = gstate?.g12;
      if (!g || g.phraseShown) return;

      // El % ganador: el mayor de los dos porcentajes ciegos
      const high = Math.max(g.duel.pctA, g.duel.pctB);

      pushLog(
        `🗣️ <em>La audiencia ha decidido que el concursante que debe convertirse en el último finalista con un (${high.toFixed(2)}%) sea…</em>`,
        14
      );

      // Marcamos que ya se mostró la frase
      setGstate(s => ({ ...(s || {}), g12: { ...g, phraseShown: true } }));
    }


    // ⚔️ G14 — resolver duelo (decide 5º finalista) + logs claros
    function g12_duel() {
      const g = gstate?.g12;
      if (!g || g.duelDone) return;

      const { a, b } = g.duel;

      // ======= 💡 MODO MANUAL: eliges quién es el expulsado =======
      if (manual) {
        const expulsado = pickManually([a, b], false, nameOf, "Elige al último eliminado/a");
        if (!expulsado) return;
        const winner = (String(expulsado) === String(a)) ? b : a;

        // Mantén los % que ya generaste (o los revelados)
        const map  = new Map((g.revealed || []).map(r => [String(r.id), r.pct]));
        const high = Math.max(g.duel.pctA, g.duel.pctB);
        const low = Math.min(g.duel.pctA, g.duel.pctB);
        const [pctA, pctB] = String(winner) === String(a) ? [high, low] : [low, high];

        // Guarda estado y summaries igual que el automático
        setGstate(s => ({ ...(s || {}), g12: { ...g, duel: { ...g.duel, winner, pctA, pctB }, duelDone: true }}));
        setSummaries(s => ({ ...s, 14: { ...(s[14] || { gala: 14 }), duel: { a, b, winner, pctA, pctB }}}));

        // Actualiza concursantes
        setContestants(prev => prev.map(c => {
          if (String(c.id) === String(winner) && c.status !== "finalista") {
            return { ...c, status: "finalista", history: [...(c.history||[]), { gala: 14, evento: "Finalista" }] };
          }
          if (String(c.id) === String(expulsado)) {
            return { ...c, status: "eliminado", history: [...(c.history||[]), { gala: 14, evento: "Eliminado" }] };
          }
          return c;
        }));

        // Logs
        pushLog(`🗳️ <strong>${nameOf(winner)}</strong>. ${nameOf(expulsado)} es eliminado/a. (manual)`, 14);

        setSummaries(s => rellenarValoracionesReparto(14, s, contestants));

        const finalistas = contestants
          .map(c => ({...c}))
          .filter(c => c.status === "finalista" || String(c.id) === String(winner))
          .map(c => nameOf(c.id));
        pushLog(`🏁 Finalistas: ${finalistas.join(", ")}.`, 14);

        finishCeremony("galaCerrada");
        return; // ⛔ no seguir a la rama automática
      }
      // ===== FIN MODO MANUAL =====

      // ======= 💻 MODO AUTOMÁTICO (tu código tal cual debajo) =======
      const { a: A, b: B } = g.duel;

      const map  = new Map((g.revealed || []).map(r => [String(r.id), r.pct]));
      const pctA = map.has(String(A)) ? map.get(String(A)) : g.duel.pctA;
      const pctB = map.has(String(B)) ? map.get(String(B)) : g.duel.pctB;

      const winner = pctA > pctB ? A : B;
      const loser  = winner === A ? B : A;

      setGstate(s => ({ ...(s || {}), g12: { ...g, duel: { ...g.duel, winner, pctA, pctB }, duelDone: true }}));
      setSummaries(s => ({ ...s, 14: { ...(s[14] || { gala: 14 }), duel: { a: A, b: B, winner, pctA, pctB }}}));

      setContestants(prev => prev.map(c => {
        if (String(c.id) === String(winner) && c.status !== "finalista") {
          return { ...c, status: "finalista", history: [...(c.history||[]), { gala: 14, evento: "Finalista" }] };
        }
        if (String(c.id) === String(loser)) {
          return { ...c, status: "eliminado", history: [...(c.history||[]), { gala: 14, evento: "Eliminado" }] };
        }
        return c;
      }));

      pushLog(`🗳️ <strong>${nameOf(winner)}</strong>. ${nameOf(loser)} es eliminado/a.`, 14);
      setSummaries(s => rellenarValoracionesReparto(14, s, contestants));

      const finalistas = contestants
        .map(c => ({...c}))
        .filter(c => c.status === "finalista" || String(c.id) === String(winner))
        .map(c => nameOf(c.id));
      pushLog(`🏁 Finalistas: ${finalistas.join(", ")}.`, 14);

      finishCeremony("galaCerrada");
    }


    // ======================================================
// 🏁  GALA 15 – GRAN FINAL  (Fase 1: Top5 → Fase 2: Top3 → Ganador)
// ======================================================

// 📊 Inicializa Fase 1 con porcentajes ciegos
// =============== GALA 15 – GRAN FINAL ==================
// Fase 1: Top5  -> (revelar 5º) -> (revelar 4º) -> Fase 2
// Fase 2: Top3  -> (revelar 3º) -> frase ganador -> ganador

// 📊 Inicializa Fase 1 con porcentajes ciegos (solo una vez)
  // ========= GALA 15 – FINAL =========

// % ciegos Top5 (una sola vez)
  function selectPublicIdentity(id) {
    setGstate(st => ({ ...st, publicReveal: { ...st.publicReveal, selectedId: id } }));
  }
  function advancePublicReveal() {
    const r = gstate.publicReveal;
    if (!r) return;
    if (r.screen === "announce") {
      const target = r.targets[r.cursor];
      const chosen = manual ? r.selectedId : r.entries[target].id;
      if (!chosen) return;
      const next = assignPublicPercentage(r, chosen);
      if (!next) return;
      const prepared = { ...gstate, g13: { ...gstate.g13, porcentajes: next.entries } };
      if (r.phase === 1) {
        if (target === 4) g13_reveal5th(prepared, true);
        else g13_reveal4th(prepared, true);
      } else if (target === 2) g13_reveal3rd(prepared, true);
      else g13_revealWinner(prepared, true);
      // The fourth-place handler intentionally resets percentages before phase 2.
      if (!(r.phase === 1 && target === 3)) {
        setGstate(st => ({ ...st, g13: { ...st.g13, porcentajes: next.entries } }));
      }
      setGstate(st => ({ ...st, publicReveal: next }));
      setStage("publicReveal");
      return;
    }
    if (r.screen === "revealed") {
      if (r.cursor + 1 < r.targets.length) {
        setGstate(st => ({ ...st, publicReveal: { ...r, cursor: r.cursor + 1, screen: "announce", selectedId: "" } }));
      } else {
        if (r.phase === 1) g13_setupFase2();
        else {
          setGstate(st => ({ ...st, publicReveal: undefined }));
          setStage("galaCerrada");
        }
      }
      return;
    }

    setGstate(st => ({ ...st, publicReveal: undefined }));
    setStage("galaCerrada");
  }

  function g13_setupFase1() {
    const g = gstate?.g13;
    if (g?.fase === 1 && Array.isArray(g?.porcentajes) && g.porcentajes.length === 5) return;

    const vivos = (summaries?.[15]?.[15]?.reparto || [])
      .flatMap(r => r.members)
      .filter((id,i,arr) => arr.indexOf(id)===i)
      .filter(id => contestants.find(x=>x.id===id && x.status!=="eliminado"));

    if (vivos.length !== 5) pushLog(`⚠️ La final debe empezar con 5 finalistas, y ahora hay ${vivos.length}.`, 15);

    const votes = audiencePercentages(vivos, contestants, Math.random, 4, popularityEnabled);
    const raw = vivos.map((id, i) => ({ id, pct: votes[i] }));
    const total = raw.reduce((a,b)=>a+b.pct,0);
    const porcentajes = raw.map(p=>({ id:p.id, pct:+(p.pct*100/total).toFixed(2) }));

    setGstate(s => ({ ...(s||{}), g13:{ fase:1, revealed:[], porcentajes, phraseShown:false }}));
    pushLog(
      `📊 Porcentajes ciegos (Top 5): ${
        [...porcentajes].sort((a,b)=>b.pct-a.pct).map(p=>`${p.pct.toFixed(2)}%`).join(" · ")
      }.`,
      15
    );
    setGstate(st => ({ ...st, publicReveal: createPublicReveal(porcentajes, "final", 1) }));
    setViewGala(gala);
    setStage("publicReveal");

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

   // =========================
  // 🔧 HELPER SOLO PARA G15
  // Quita "(xx.xx%)" de la columna "Valoración" en el reparto de la Final
  // (se aplica únicamente cuando 'manual' es true)
  // =========================
  function stripPercentsRepartoG13() {
    if (!manual) return; // solo en modo manual
    setSummaries(s => {
      const S = s[15];
      const rep = S?.[15]?.reparto;
      if (!S || !rep) return s;

      const strip = (txt = "") =>
        txt
          .replace(/\s*\(\d+(?:\.\d+)?%\)\s*/g, "")  // borra "(n%)" o "(n.nn%)"
          .replace(/^Duelo\s*$/i, "Duelo");         // normaliza "Duelo"

      const nuevo = rep.map(r => ({ ...r, valor: strip(r.valor || "") }));

      return {
        ...s,
        15: {
          ...(S || { gala: 15 }),
          [15]: { ...(S?.[15] || {}), reparto: nuevo }
        }
      };
    });
  }

  // =========================
  // 🏁 GALA 15 – FINAL (con ramas MANUAL que usan el helper)
  // =========================

  function g13_reveal5th(currentState = gstate, automatic = false) {
    const g = currentState?.g13;
    if (!g || g.fase !== 1 || g.revealed.includes("5th")) return;

    // ======= 💡 MANUAL =======
    if (manual && !automatic) {
      const ids = g.porcentajes.map(p => p.id);
      const elegido = pickManually(ids, false, nameOf, "Revela al 5º/ª Finalista");
      if (!elegido) return;

      const pct = (g.porcentajes.find(p => String(p.id) === String(elegido))?.pct) ?? 0;

      pushLog(`🔎 <strong>${nameOf(elegido)}</strong> se convierte en 5${ordSuf(elegido)} Finalista.`, 15);

      setGstate(s => ({ ...s, g13: { ...g, revealed: [...g.revealed, "5th"], fifth: { id: elegido, pct } }}));
      setSummaries(s => ({ ...s, 15: { ...(s[15] || { gala: 15 }), fifth: { id: elegido, pct } }}));
      setSummaries(s => rellenarValoracionesReparto(15, s, contestants));

      // 🧽 Quitar % del reparto en MANUAL
      stripPercentsRepartoG13();
      return;
    }
    // ===== FIN MANUAL =====

    // Automático
    const sorted = [...g.porcentajes].sort((a, b) => b.pct - a.pct);
    const fifth = sorted[4];
    pushLog(`🔎 <strong>${nameOf(fifth.id)}</strong> se convierte en 5${ordSuf(fifth.id)} Finalista (${fifth.pct.toFixed(2)}%).`, 15);
    setGstate(s => ({ ...s, g13: { ...g, revealed: [...g.revealed, "5th"], fifth }}));
    setSummaries(s => ({ ...s, 15: { ...(s[15] || { gala: 15 }), fifth }}));
    setSummaries(s => rellenarValoracionesReparto(15, s, contestants));
  }

  function g13_reveal4th(currentState = gstate, automatic = false) {
    const g = currentState?.g13;
    if (!g || g.fase!==1 || g.revealed.includes("4th")) return;

    // ======= 💡 MANUAL =======
    if (manual && !automatic) {
      const fifthId = g.fifth?.id || null;
      const yaFuera = new Set([String(fifthId)].filter(Boolean));
      const idsDisponibles = g.porcentajes.map(p => p.id).filter(id => !yaFuera.has(String(id)));

      const elegido = pickManually(idsDisponibles, false, nameOf, "Revela al 4º/ª Finalista");
      if (!elegido) return;

      const pct = (g.porcentajes.find(p => String(p.id) === String(elegido))?.pct) ?? 0;

      // Top3 = todos menos 5º y 4º
      const excluded = new Set([String(fifthId), String(elegido)].filter(Boolean));
      const top3Ids = g.porcentajes.map(x=>x.id).filter(id=>!excluded.has(String(id)));

      pushLog(`🔎 <strong>${nameOf(elegido)}</strong> se convierte en 4${ordSuf(elegido)} Finalista.`, 15);

      setGstate(s=>({
        ...s,
        g13:{ ...g, revealed:[...g.revealed,"4th"], fourth: { id: elegido, pct }, fase:2, top3Ids, porcentajes:[], phraseShown:false }
      }));
      setSummaries(s=>({ ...s, 15:{ ...(s[15]||{gala:15}), fourth: { id: elegido, pct } }}));
      setSummaries(s=>rellenarValoracionesReparto(15,s,contestants));

      // 🧽 Quitar % del reparto en MANUAL
      stripPercentsRepartoG13();

      pushLog("⏭️ Pasa a la fase final (Top 3).", 15);
      setStage("g13_fase2");
      return;
    }
    // ===== FIN MANUAL =====

    // Automático
    const sorted = [...g.porcentajes].sort((a,b)=>b.pct-a.pct);
    const fourth = sorted[3];
    const excluded = new Set([String(g.fifth.id), String(fourth.id)]);
    const top3Ids = g.porcentajes.map(x=>x.id).filter(id=>!excluded.has(String(id)));

    pushLog(`🔎 <strong>${nameOf(fourth.id)}</strong> se convierte en 4${ordSuf(fourth.id)} Finalista (${fourth.pct.toFixed(2)}%).`, 15);

    setGstate(s=>({
      ...s,
      g13:{ ...g, revealed:[...g.revealed,"4th"], fourth, fase:2, top3Ids, porcentajes:[], phraseShown:false }
    }));
    setSummaries(s=>({ ...s, 15:{ ...(s[15]||{gala:15}), fourth }}));
    setSummaries(s=>rellenarValoracionesReparto(15,s,contestants));
    pushLog("⏭️ Pasa a la fase final (Top 3).", 15);
    setStage("g13_fase2");
  }

  function g13_setupFase2() {
    const g = gstate?.g13;
    if (!g || g.fase!==2) return;
    if (Array.isArray(g.porcentajes) && g.porcentajes.length===3) return;

    const top3 = Array.isArray(g.top3Ids) ? g.top3Ids.slice() : [];
    if (top3.length!==3) { pushLog("⚠️ No hay 3 finalistas para la fase 2.", 15); return; }

    const votes = audiencePercentages(top3, contestants, Math.random, 4, popularityEnabled);
    const raw = top3.map((id, i) => ({ id, pct: votes[i] }));
    const total = raw.reduce((a,b)=>a+b.pct,0);
    const porcentajes = raw.map(p=>({ id:p.id, pct:+(p.pct*100/total).toFixed(2) }));

    setGstate(s=>({ ...(s||{}), g13:{ ...g, porcentajes, revealed:[], phraseShown:false }}));
    pushLog(
      `📊 Porcentajes ciegos (Top 3): ${
        [...porcentajes].sort((a,b)=>b.pct-a.pct).map(p=>`${p.pct.toFixed(2)}%`).join(" · ")
      }.`,
      15
    );
    setGstate(st => ({ ...st, publicReveal: createPublicReveal(porcentajes, "final", 2) }));
    setViewGala(gala);
    setStage("publicReveal");

  }

  function g13_reveal3rd(currentState = gstate, automatic = false) {
    const g = currentState?.g13;
    if (!g || g.fase!==2 || g.revealed.includes("3rd")) return;

    // ======= 💡 MANUAL =======
    if (manual && !automatic) {
      const top3 = Array.isArray(g.top3Ids) ? g.top3Ids.slice() : [];
      if (top3.length !== 3) { pushLog("⚠️ No hay 3 finalistas para la fase 2.", 15); return; }

      const elegido = pickManually(top3, false, nameOf, "Revela al 3er/ª Finalista");
      if (!elegido) return;

      const pct = (g.porcentajes.find(p => String(p.id) === String(elegido))?.pct) ?? 0;
      const ord3 = sufOf(elegido) === "a" ? "3ª" : sufOf(elegido) === "e" ? "3e" : "3er";

      pushLog(`🥉 <strong>${nameOf(elegido)}</strong> queda ${ord3} Finalista.`, 15);

      setGstate(s=>({ ...s, g13:{ ...g, revealed:[...g.revealed,"3rd"], third: { id: elegido, pct } }}));
      setSummaries(s=>({ ...s, 15:{ ...(s[15]||{gala:15}), third: { id: elegido, pct } }}));
      setSummaries(s=>rellenarValoracionesReparto(15,s,contestants));

      // 🧽 Quitar % del reparto en MANUAL
      stripPercentsRepartoG13();
      return;
    }
    // ===== FIN MANUAL =====

    // Automático
    const sorted = [...g.porcentajes].sort((a,b)=>b.pct-a.pct);
    const third = sorted[2];
    const ord3 = sufOf(third.id) === "a" ? "3ª" : sufOf(third.id) === "e" ? "3e" : "3er";
    pushLog(`🥉 <strong>${nameOf(third.id)}</strong> queda ${ord3} Finalista (${third.pct.toFixed(2)}%).`, 15);
    setGstate(s=>({ ...s, g13:{ ...g, revealed:[...g.revealed,"3rd"], third }}));
    setSummaries(s=>({ ...s, 15:{ ...(s[15]||{gala:15}), third }}));
    setSummaries(s=>rellenarValoracionesReparto(15,s,contestants));
  }

  function g13_phraseWinner() {
    const g = gstate?.g13;
    if (!g || g.fase!==2 || g.phraseShown) return;
    const sorted = [...g.porcentajes].sort((a,b)=>b.pct-a.pct);
    pushLog(`🗣️ La audiencia ha decidido que el ganador/a de este simulador con un (${sorted[0].pct}%) sea...`, 15);
    setGstate(s=>({ ...s, g13:{ ...g, phraseShown:true }}));
  }

  function g13_revealWinner(currentState = gstate, automatic = false) {
    const g = currentState?.g13;
    if (!g || g.fase !== 2 || g.revealed?.includes("winner")) return;

    // ======= 💡 MANUAL =======
    if (manual && !automatic) {
      const top3 = Array.isArray(g.top3Ids) ? g.top3Ids.slice() : [];
      const thirdId = g.third?.id;
      const rem = top3.filter(id => String(id) !== String(thirdId));
      if (rem.length !== 2) { pushLog("⚠️ No hay 2 finalistas restantes.", 15); return; }

      const ganadorId = pickManually(rem, false, nameOf, "Revela al Ganador/a");
      if (!ganadorId) return;
      const segundoId = rem.find(id => String(id) !== String(ganadorId));

      const pWinner = (g.porcentajes.find(p => String(p.id) === String(ganadorId))?.pct) ?? 0;
      const pSecond = (g.porcentajes.find(p => String(p.id) === String(segundoId))?.pct) ?? 0;

      pushLog(`🥇 <strong>${nameOf(ganadorId)}</strong> es ${palabraGanador(ganadorId)}.`, 15);
      pushLog(`🥈 <strong>${nameOf(segundoId)}</strong> queda 2${ordSuf(segundoId)} Finalista.`, 15);

      setSummaries(s => ({ ...s, 15: { ...(s[15] || { gala: 15 }), winner: { id: ganadorId, pct: pWinner }, second: { id: segundoId, pct: pSecond } } }));
      setSummaries(s => rellenarValoracionesReparto(15, s, contestants));

      // 🧽 Quitar % del reparto en MANUAL
      stripPercentsRepartoG13();

      // Estados finales
      setContestants(prev => prev.map(c => {
        if (String(c.id) === String(ganadorId)) {
          return { ...c, status: "ganador", history: [ ...(c.history || []), { gala: 15, evento: "Ganador" } ] };
        }
        if (String(c.id) === String(segundoId) || String(c.id) === String((currentState?.g13?.third || {}).id)) {
          return { ...c, status: "finalista", history: [ ...(c.history || []), { gala: 15, evento: "Finalista" } ] };
        }
        return c;
      }));

      setStage("galaCerrada");
      return; // no seguir a la rama automática
    }
    // ===== FIN MANUAL =====

    // Automático
    const sorted = [...g.porcentajes].sort((a, b) => b.pct - a.pct);
    const winner = sorted[0];
    const second = sorted[1];

    pushLog(`🥇 <strong>${nameOf(winner.id)}</strong> es ${palabraGanador(winner.id)} (${winner.pct.toFixed(2)}%).`, 15);
    pushLog(`🥈 <strong>${nameOf(second.id)}</strong> queda 2${ordSuf(second.id)} Finalista (${second.pct.toFixed(2)}%).`, 15);

    setSummaries(s => ({ ...s, 15: { ...(s[15] || { gala: 15 }), winner, second } }));
    setSummaries(s => rellenarValoracionesReparto(15, s, contestants));
    setContestants(prev => prev.map(c => {
      if (String(c.id) === String(winner.id)) {
        return { ...c, status: "ganador", history: [ ...(c.history || []), { gala: 15, evento: "Ganador" } ] };
      }
      if (String(c.id) === String(second.id) || String(c.id) === String((currentState?.g13?.third || {}).id)) {
        return { ...c, status: "finalista", history: [ ...(c.history || []), { gala: 15, evento: "Finalista" } ] };
      }
      return c;
    }));
    setStage("galaCerrada");
  }



 
  return (
    <div className="min-w-0 px-1 py-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <img
          src="/LogoOT2017_Negro.png"
          alt="Simulador Web de Operación Triunfo"
          className="h-auto max-h-16 sm:max-h-20 md:max-h-[6.75rem] w-auto object-contain shrink-0 cursor-pointer hover:opacity-80 transition"
          onClick={reiniciar}
          role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter" || e.key===" "){e.preventDefault();reiniciar();}}}
        />
        <div className="flex gap-2 w-full sm:w-auto">
          {contestants.length === 0 && (
            <Button onClick={() => document.getElementById("roster-search")?.focus()}>
              👥 Elegir concursantes OT
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


    {contestants.length === 0 && (
        <Card>
          <JudgeSetup judges={judgeNames} onChange={setJudgeNames} />
          <OTRosterPicker roster={roster} onChange={updateRoster} onStart={iniciar} />
        </Card>
      )}
      <SeasonSettings repechageOption={repechageOption} setRepechageOption={setRepechageOption} relationshipsEnabled={relationshipsEnabled} setRelationshipsEnabled={setRelationshipsEnabled} popularityEnabled={popularityEnabled} setPopularityEnabled={setPopularityEnabled} manual={manual} setManual={setManual} mode={mode}
        onModeChange={onModeChange} started={contestants.length > 0} />

      {contestants.length > 0 && (
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
      )}

    <Button
      variant="outline"
      onClick={() => {
        const code = prompt("Introduce el código de tu simulación (4 cifras):");
        if (!code) return;
        try {
          const packed = localStorage.getItem("ot_save_" + code.trim());
          if (!packed) throw new Error("No existe ese código en este navegador.");
          const payload = unpackState(packed);
          onLoadSeason(payload);
          alert("Simulación cargada correctamente.");
        } catch (e) {
          alert("Error al cargar: " + e.message);
        }
      }}
    >
      ⬇️ Cargar
    </Button>

      <center><p className="text-xs text-muted-foreground"><strong>Simulador OT (2025)</strong> - Para cualquier duda o sugerencia escríbenos a otsimulador@gmail.com</p></center>




      {academyBlocked && academyChat && <ChatReveal chat={academyChat} contestants={contestants} gala={shownGala(chatGala)} onNext={nextChat} onSkip={skipChat} />}
      {academyBlocked && !academyChat && <AcademyWeek week={academyWeek} reparto={academyReparto} groupSong={summaries[gala]?.[gala]?.groupSong}
        contestants={contestants} gala={shownGala(gala)} onNext={advanceAcademy} onSkip={skipPerformances} onSkipEvents={skipEvents} />}
      {!academyBlocked && contestants.length > 0 && <AcademySummary week={academy.weeks[viewGala]} contestants={contestants} />}
      {contestants.length>0 && !academyBlocked && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
          <Card className="lg:col-span-2">
            <CardContent className="min-w-0 p-2 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Gala</div>
                  <div className="text-2xl font-semibold">{gala}</div>
                </div>
                <Badge variant="outline">Etapa: {stage}</Badge>
              </div>

              {gala <= 12 && (
  <>
            {/* === Controles específicos de la GALA 0 === */}
            {gala === 0 && (
              <div className="flex flex-wrap gap-2">
                {stage === "g0_cerrar" && (
                  <Button onClick={g0_cerrar}>✅ Cerrar Gala 0 y pasar a Gala 1</Button>
                )}
              </div>
            )}

            {/* === Controles existentes para Galas 1–9 (deja aquí tu bloque actual) === */}
            <div className="flex flex-wrap gap-2">
              <div className="flex flex-wrap gap-2">
            {stage === "dueloPendiente" && (
              <Button onClick={iniciarDueloCiego}>Llega el momento de la verdad</Button>
            )}
            {stage === "duelo_ciegos" && (
              <Button onClick={dueloMostrarFrase}>🗣️ Mostrar frase del presentador</Button>
            )}
            {stage === "duelo_revelar" && (
              <Button onClick={dueloRevelar}>⚔️ Revelar salvado y eliminado</Button>
            )}

            {stage === "votoPublico" && gala <= 9 && !gstate?.top3Shown && (
              <Button onClick={iniciarVotoPublico} disabled={gstate?.top3Shown}>
                🎤 Presentar favoritos
              </Button>
            )}
            {gala <= 9 && gstate.top3?.length > 0 && stage === "votoPublico" && (
                gstate.favoriteRevealed ? (
                <></>
              ) : (
                <Button onClick={revelarTop3YFavorito}>
                  {(gstate.top3RevealCount ?? (gstate.top3NamesRevealed ? 3 : 0)) < 3 ? "⭐ Revelar siguiente favorito" : "🌟 Revelar al favorito de la semana"}
                </Button>
              )
              )}

            {/* 👇 FALTA ESTE: valoración del jurado */}


            {/* ▶️ GALA 13: botón para puntuar al jurado */}
            {stage === "g11_jurado" && (
              <><Button onClick={() => g11_puntuarJurado(false)}>🧮 Puntuar jurado (G{shownGala(13)})</Button><Button variant="outline" onClick={() => g11_puntuarJurado(true)}>Revelar todo</Button></>
            )}

            {/* ▶️ GALA 13: cierre de gala tras las notas del jurado */}
            {stage === "g11_cerrar" && (
              <Button onClick={g11_cerrar}>✅ Cerrar Gala {shownGala(13)}</Button>
            )}


            {/* Y estos dos para cerrar la nominación como siempre */}
            {stage === "profesSalvan" && (
              <Button onClick={() => startCeremony("teachers", gstate.nominados, "teachers")}>🎓 Profesores salvan</Button>
            )}
            {stage === "companerosVotan" && (
              <Button onClick={() => startCeremony("peers", gstate.nominados, "peers", Array.from(gstate.salvados))}>🧑‍🤝‍🧑 Compañeros votan</Button>
            )}
            {stage === "galaCerrada" && (
            <Button onClick={goNext}>
              {`✅ Cerrar Gala ${shownGala(gala)} y pasar a Gala ${shownGala(nextGala(gala,repechageEnabled))}`}
            </Button>
           )}
              </div>
            </div>
          </>
        )}

            {gala === 13 && (
              <div className="flex flex-wrap gap-2">
                {/* duelo arrastrado */}
                {stage === "dueloPendiente" && (
                  <Button onClick={iniciarDueloCiego}>Llega el momento de la verdad</Button>
                )}
                {stage === "duelo_ciegos" && (
                  <Button onClick={dueloMostrarFrase}>🗣️ Mostrar frase del presentador</Button>
                )}
                {stage === "duelo_revelar" && (
                  <Button onClick={dueloRevelar}>🏆 Revelar resultado del duelo</Button>
                )}

                {/* G13 – jurado y profes */}
                {stage === "g11_jurado" && (
                  <><Button onClick={() => g11_puntuarJurado(false)}>🧮 Puntuar jurado (G{shownGala(13)})</Button><Button variant="outline" onClick={() => g11_puntuarJurado(true)}>Revelar todo</Button></>
                )}
                {stage === "g11_profes" && (
                  <Button onClick={() => startCeremony("teachers", summaries[13]?.juradoBottom3 || [], "specialTeachers")}>🎓 Profesores salvan (G{shownGala(13)})</Button>
                )}
                {stage === "g11_cerrar" && (
                  <Button onClick={g11_cerrar}>✅ Cerrar Gala {shownGala(13)}</Button>
                )}
              </div>
            )}


              {gala >= 14 && gala <= 15 && (
                <div className="flex flex-wrap gap-2">
                  {stage === "g12_14_publico" && !gstate?.g12 && (
                    <Button onClick={g12_setup}>Llega el momento de la verdad</Button>
                  )}

                  {stage === "g12_14_publico" && gstate?.g12 && !gstate.g12.phraseShown && (
                    <Button onClick={g12_revealPhrase}>🗣️ Mostrar frase del presentador</Button>
                  )}

                  {stage === "g12_14_publico" && gstate?.g12 && gstate.g12.phraseShown && !gstate.g12.duelDone && (
                    <Button onClick={() => g12_duel()}>⚔️ Resolver duelo</Button>
                  )}

                  {/* Gala 14: cerrar y pasar a la final (13) */}
                  {stage === "galaCerrada" && gala < 15 && (
                    <Button onClick={goNext}>⏭️ Cerrar gala y pasar a la siguiente</Button>
                  )}

                  {/* Gala 15 (FINAL): cerrar edición */}
                  {stage === "galaCerrada" && gala === 15 && (
                    <Button onClick={closeEdition}>🏁 Cerrar Edición</Button>
                  )}
                </div>
              )}

              {/* FASE 1 */}
              {stage === "g13_fase1" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={g13_setupFase1}>📊 Porcentajes ciegos (Top 5)</Button>
                  {gstate?.g13?.porcentajes?.length === 5 && !gstate?.g13?.revealed?.includes("5th") && (
                    <Button onClick={() => g13_reveal5th()}>🔎 Revelar 5º finalista</Button>
                  )}
                  {gstate?.g13?.porcentajes?.length === 5 && gstate?.g13?.revealed?.includes("5th") && !gstate?.g13?.revealed?.includes("4th") && (
                    <Button onClick={() => g13_reveal4th()}>🔎 Revelar 4º finalista y pasar a Top 3</Button>
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
                    <Button onClick={() => g13_reveal3rd()}>🥉 Revelar 3º finalista</Button>
                  )}
                  {gstate?.g13?.porcentajes?.length === 3 && gstate?.g13?.revealed?.includes("3rd") && !gstate?.g13?.phraseShown && (
                    <Button onClick={g13_phraseWinner}>🗣️ Frase del presentador</Button>
                  )}
                  {gstate?.g13?.porcentajes?.length === 3 && gstate?.g13?.phraseShown && !gstate?.g13?.revealed?.includes("winner") && (
                    <Button onClick={() => g13_revealWinner()}>🥇 Revelar ganador/a</Button>
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
                    {visibleGalas(gala,repechageEnabled).map(g => (
                        <Button key={g} size="sm" variant={g===viewGala?"default":"outline"} onClick={()=>setViewGala(g)}>
                          Gala {shownGala(g)}
                        </Button>
                      ))}
                  </div>
                  {gala === 0 && viewGala === 0 && ["g0_eval", "g0_profes", "g0_publico"].includes(stage) ? (
                    <GalaZeroReveal performances={summaries[0]?.performances} stage={stage} reveal={gstate.g0Reveal} state={gstate.g0} contestants={contestants}
                      onNext={stage === "g0_eval" ? () => g0_revealNext(false) : stage === "g0_profes" ? g0_profesSalvan : g0_publicoVota}
                      onRevealAll={() => g0_revealNext(true)} />
                  ) : stage === "repechage" && repechage.state && viewGala === gala ? (
                    <RepechageReveal state={repechage.state} contestants={contestants} favoriteId={gstate.favoritoId} onNext={repechage.advance} />
                  ) : stage === "publicReveal" && gstate.publicReveal && viewGala === gala ? (
                    <PublicReveal reveal={gstate.publicReveal} contestants={contestants} manual={manual}
                      duelResult={summaries[gala]?.g12_14?.duel} onSelect={selectPublicIdentity} onNext={advancePublicReveal} />
                  ) : stage === "scoreReveal" && gstate.scoreReveal && viewGala === gala ? (
                    <ScoreReveal judges={academy.judges} reveal={gstate.scoreReveal} contestants={contestants}
                      onNext={advanceScoreReveal} onRevealAll={() => applyScoreResults(gstate.scoreReveal.pending)} />
                  ) : stage === "ceremony" && gstate.ceremony && viewGala === gala ? (
                    <SaveCeremony ceremony={{ ...gstate.ceremony, tie: gstate.peerTie }} contestants={contestants}
                      winnerId={gstate.ceremony.kind === "duel" ? summaries[gala]?.duel?.winner
                        : gstate.ceremony.kind === "teachers" ? summaries[gala]?.profesorSalvoId : gstate.salvadoCompanerosId}
                      onNext={advanceCeremony} onContinue={continueCeremony} onRevealAll={revealAllPeerVotes} />
                  ) : stage === "votoPublico" && gstate.top3Shown && viewGala === gala ? (
                    <FavoriteReveal state={gstate} contestants={contestants} onContinue={() => {setStage("juradoEvaluando");setViewGala(gala);}} />
                  ) : stage === "juradoEvaluando" && viewGala === gala ? (
                    <JuryEvaluation jury={gstate} contestants={contestants} performances={summaries[gala]?.performances} onNext={() => evaluarSiguientePorJurado(false)} onRevealAll={() => evaluarSiguientePorJurado(true)} />
                  ) : (
                  <details key={viewGala} className="prose max-w-none"><summary className="cursor-pointer font-semibold">Resumen de la gala</summary>
                    {(galaLogs[viewGala]||[]).length===0? (
                      <p className="text-sm text-muted-foreground">Sin eventos en esta gala.</p>
                    ) : (
                      <ul className="list-disc pl-5 space-y-2">
                        {(galaLogs[viewGala]||[]).map((l,i)=>(<li key={i} dangerouslySetInnerHTML={{__html:galaLog(l,repechageEnabled)}} />))}
                      </ul>
                    )}
                  </details>
                  )}

                      {/* 🧾 DESGLOSE JURADO (G13) */}
                      {viewGala === 13
                        && ["g11_jurado","g11_profes","g11_cerrar","galaCerrada"].includes(stage)
                        && summaries?.[13]?.juradoDesglose && (
                        <div className="mt-2">
                        <p>• <b>Desglose jurado (G{shownGala(13)}):</b></p>
                        <table className="min-w-[520px] border-collapse text-sm">
                          <thead>
                            <tr>
                              <th className="border px-2 py-1 text-left">Concursante</th>
                              <th className="border px-2 py-1">{academy.judges[0]}</th>
                              <th className="border px-2 py-1">{academy.judges[1]}</th>
                              <th className="border px-2 py-1">{academy.judges[2]}</th>
                              <th className="border px-2 py-1">{academy.judges[3]}</th>
                              <th className="border px-2 py-1">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaries[13].juradoDesglose.map(r => (
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
        { !academyBlocked && summaries[viewGala]?.[viewGala]?.reparto && (
          <Card className="mt-6">
            <CardContent className="min-w-0 p-2 sm:p-6 space-y-4">
              <h3 className="text-lg font-semibold">Reparto de temas — Gala {shownGala(viewGala)}</h3>
              {summaries[viewGala][viewGala].groupSong && (
                <p className="rounded-lg bg-gray-100 px-4 py-3 text-sm">
                  <strong>Actuación grupal:</strong> {summaries[viewGala][viewGala].groupSong}
                </p>
              )}
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

                        // (opcional, si quieres mantener la normalización de Gala 13)
                        // En G13, no normalizar si ya viene un "Salvad@ por el público (%) > Finalista"
                        if (viewGala === 13
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



      {!academyBlocked && Object.keys(summaries).length>0 && (
        <Card>
          <CardContent className="min-w-0 p-2 sm:p-6 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">{showRelationships ? "Tabla de Relaciones" : showPopularity ? "Tabla de Popularidad" : "Recorrido del concurso"}</h2>
              {seasonFinished && <label className="w-full text-sm sm:hidden">Tabla
                <select aria-label="Elegir tabla" className="mt-1 w-full rounded-lg border p-2" value={showRelationships?'relationships':showPopularity?'popularity':'journey'} onChange={e=>{setShowRelationships(e.target.value==='relationships');setShowPopularity(e.target.value==='popularity');}}>
                  <option value="journey">Recorrido</option><option value="popularity">Popularidad</option><option value="relationships">Relaciones</option>
                </select>
              </label>}
              {seasonFinished && <Button className="hidden sm:inline-flex" variant="outline" onClick={() => { setShowRelationships(false); setShowPopularity(v => !v); }}>{showPopularity ? "Ver recorrido" : "Tabla de Popularidad"}</Button>}
              {seasonFinished && <Button className="hidden sm:inline-flex" variant="outline" onClick={() => { setShowPopularity(false); setShowRelationships(v => !v); }}>{showRelationships ? "Ver recorrido" : "Tabla de Relaciones"}</Button>}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={onDownloadRecorrido}>
                  ⬇️ Descargar tabla
                </Button>
              </div>
            </div>
            {showRelationships && seasonFinished ? <RelationshipsTable repechageEnabled={repechageEnabled} contestants={contestants} summaries={summaries} relations={academy.relationships} pairs={academy.pairs} /> : showPopularity && seasonFinished ? <PopularityTable repechageEnabled={repechageEnabled} contestants={contestants} summaries={summaries} /> : <RecorridoTable repechageEnabled={repechageEnabled} contestants={contestants} summaries={summaries} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RecorridoTable({ contestants, summaries, repechageEnabled=true }){

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
    ...visibleGalas(14,repechageEnabled).slice(1).map(g=>`Gala ${displayGala(g,repechageEnabled)}`),
    "Gala Final", // (G15 Fase 1)
    ""            // (G16 Fase 2) — celda “vacía” para fusionar visualmente
  ];

  const cellStyle=(bg,color="#000")=>({ background:bg, color, padding:"0px 6px", border:"1px solid #ddd", fontSize:12, textAlign:"center", whiteSpace:"nowrap" });

  // 🔎 Lookup rápido con lo que guardan g11_puntuarJurado/g11_profesoresSalvan
  const recG11Map = new Map(
    (summaries?.[13]?.recorrido || []).map(r => [String(r.id), r])
  );
  const g15 = summaries[17]?.g15, winnerId=g15?.winner, thirdId=g15?.third, secondId=g15 ? [...g15.tabla].sort((a,b)=>b.pct-a.pct)[1]?.id : undefined;
  const eliminatedOnly = contestants
    .filter(c => c.status === "eliminado")
    .sort((a,b) => {
      const ga = lastElimination(a);
      const gb = lastElimination(b);
      return gb - ga; // 👈 se mantiene “como siempre”
    });
    const aliveOnly = contestants
      .filter(c => c.status !== "eliminado")
      .sort((a,b) => normName(a.name).localeCompare(normName(b.name)));

    let sorted;

    // 🏁 Si ya existen resultados de la final (G15 → ganador, etc.), ordenar así:
    const s13 = summaries[15];
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
        const ga = lastElimination(a);
        const gb = lastElimination(b);
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
    const cells=[{text:<TablePerson person={c} />, style:{...cellStyle("#fff","#111"),padding:0} }];
    const eliminationGalas = c.history.filter(h => h.evento?.startsWith?.("Eliminado")).map(h=>h.gala);

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


    for(const g of visibleGalas(16,repechageEnabled).slice(1)){
      let text="—", style=cellStyle("#eee","#555");
      const elimGala = eliminationGalas.includes(g) ? g : null;
      const special = repechageCell(c,summaries,g);
      if (special) { cells.push({text:special.split ? <span style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}><span style={{color:"white"}}>Eli.</span><span>Can.</span></span> : special.text,style:{...cellStyle(special.background,special.color || '#111'),...(special.split ? {background:'linear-gradient(to right, red 0%, red 50%, #fff3a6 50%, #fff3a6 100%)'} : {})}}); continue; }
      if (absentAfterElimination(c,summaries,g)) { cells.push({ text: "—", style: cellStyle("#ccc", "#666") }); continue; }
      // ❗️Caso: esta es la gala en la que quedó fuera
      if (elimGala !== null && g === elimGala) {
        if (g === 15 || g === 16) {
          // Final: NO marcar aquí ni hacer continue; deja que pinten g=13/g=14.
          // (No hacemos nada y seguimos para que los bloques de la final empujen su celda)
        } else {
          const gnd = getGender(c.id);
          cells.push({ text: lbl.eliminado(gnd), style: cellStyle("red", "#fff") });
          continue;
        }
      }



      const s = summaries[g];
      // Para Fase 2 (columna 14) la info está en summaries[15]; no cortar ahí.
      if (!s && g !== 16) { cells.push({ text, style }); continue; }

      if (g <= 12) {
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

      else if (g === 13) {
        // 🗺️ Columna "Gala 13" se pinta desde summaries[13].recorrido
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


      // 🟦 GALA 14 — especial (último finalista)
      else if (g === 14) {
        const duel = summaries?.[14]?.duel;
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
    else if (g === 15) {
      const s13 = summaries?.[15];
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

    // 🟣 GALA FINAL — Fase 2 (columna 14): Ganador / 2º / 3º (¡lee de summaries[15]!)
    else if (g === 16) {
      const s13 = summaries?.[15];
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
                      colSpan={i === 0 ? 2 : h === "Gala Final" && headers[i + 1] === "" ? 2 : 1}
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
                  {cells.map((c, ci) => ci===0 ? <TablePerson key={ci} person={sorted[ri]} /> : (
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
