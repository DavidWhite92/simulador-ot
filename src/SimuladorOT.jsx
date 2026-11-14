import {prepareFinalistDuel} from "./lib/finalistDuels";
import {applyPopularity} from "./lib/academy";
import {secondChance,favoriteComment} from "./lib/juryComments";
import StaffSetup from "./components/StaffSetup";
import BestPerformances from "./components/BestPerformances";
import SongDistribution from "./components/SongDistribution";
import AddSong from "./components/AddSong";
import { customSongs } from "./lib/songEditor";
import { contestantFlags } from "./lib/contestantStatus";
import { currentGalaLabel } from "./lib/currentGalaLabel";
import SplitJourneyCell from "./components/SplitJourneyCell";
import { returnPerformanceLabel } from "./lib/returnLabels";
import { suspendedNominationLabel } from "./lib/suspendedNominations";
import { freshGroups, previousGroups, assignmentPlanGala } from "./lib/assignments";
import { repechageColumnsVisible, resolveRepechage, displayGala, nextGala, visibleGalas, galaLog, lastElimination } from "./lib/seasonSchedule";
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
import AcademyWeek, { AcademySummary } from "./components/AcademyWeek";
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

  // Devuelve ids seleccionados por el usuario usando prompt() (rápido de integrar).
  // multiple=false -> 1 selección; multiple=true -> varias (separadas por coma)
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
      if (summaries?.[k]?.falseNominees) continue;
      const list =
        summaries?.[k]?.juradoNominados               // << clave real que usas
        ?? summaries?.[k]?.[k]?.nominados
        ?? summaries?.[k]?.nominados
        ?? [];
      if (list.some(it => String(nomIdOf(it)) === String(id))) n++;
    }
    // Gala actual (usa curList si te la pasan; si no, lee de summaries)
    const cur =
      curList
      ?? summaries?.[g]?.juradoNominados
      ?? summaries?.[g]?.[g]?.nominados
      ?? summaries?.[g]?.nominados
      ?? [];
    if (!summaries?.[g]?.falseNominees && cur.some(it => String(nomIdOf(it)) === String(id))) n++;

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
    if (galaIndex >= 0) {
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
      if (g === 0)  return { trios:0, duos:0, solos:Infinity }; // 18 solos
      if (g === 1)  return { trios:0, duos:8,  solos:0  };
      if (g === 2)  return { trios:2, duos:5,  solos:0  };
      if (g === 3)  return { trios:1, duos:5,  solos:0  };
      if (g === 4)  return { trios:1, duos:4,  solos:1  };
      if (g === 5)  return { trios:1, duos:3,  solos:2  };
      if (g === 6)  return { trios:0, duos:4,  solos:2  };
      if (g === 7)  return { trios:0, duos:3,  solos:3  };
      if (g === 8)  return { trios:0, duos:2,  solos:4  };
      if (g === 9)  return { trios:0, duos:1,  solos:5  };
      if (g === 12) return { trios:0, duos:0,  solos:6  };
      if (g === 13) return { trios:0, duos:0,  solos:5  };
      if (g === 14 || g === 15) return { trios:0, duos:0, solos:Infinity };
      if (g === 16) return { trios:0, duos:2,  solos:Infinity };
      if (g === 17) return { trios:0, duos:0,  solos:Infinity };
      return { trios:0, duos:0, solos:Infinity };
    }

        function buildRepartoParaGala(galaNum, activosIds, nominadosDueloIds = [], summaries = {}){
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
      const plan = repartoPlan(assignmentPlanGala(galaNum,Boolean(summaries[8]?.repechage)));
      filas.push(...freshGroups(baseSet,plan,previousGroups(summaries,galaNum)));
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
      const duelNow   = S.duel || null; // {a,b,pctA,pctB,winner} si el duelo se resuelve en ESTA gala

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


  // … A PARTIR DE AQUÍ SIGUE TU CÓDIGO EXISTENTE (G1–9, G12, etc.)


          // 1.5) FAVORIT@ DEL PÚBLICO (G1–G9) → Inmune, se detiene aquí
        if (galaNum <= 11 && favId && id === favId) {
          const pct = S.favoritePct ?? (top3Pct.length ? Math.max(...top3Pct) : undefined);
          // devuelve directamente, sin añadir más partes
          return `Favorit${sufG} del público${pct != null ? ` (${pct.toFixed(2)}%)` : ""}`;
        }

        // 2) Decisión del jurado/profes/compañeros en ESTA gala (G1–9)
        if (galaNum <= 11) {
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

      // 3) Reglas específicas de la GALA 12
      if (galaNum === 12) {
      const g10 = S.g10 || {};
      const top3 = new Set(g10.top3 || []);
      const cuarto = S.profesorSalvoId || g10.cuarto || null;
      const quinto = S.salvadoCompanerosId || g10.quinto || null;
      const finalists = new Set([ ...top3, cuarto, quinto ].filter(Boolean));
      const j4 = new Set(S.juradoNominados || []);
      const nominadosG11 = new Set([...j4].filter(x => !finalists.has(x)));

      // 1) Si es finalista ...
      if (finalists.has(id)) {
        const g = getG(id), sufG = suf(g);
        const prefix = parts.length ? parts.join(" > ") + " > " : "";

        if (id === cuarto) {
          return `${prefix}Propuest${sufG} por el jurado > Salvad${sufG} por los profesores > Finalista`;
        }

        if (id === quinto) {
          return `${prefix}Propuest${sufG} por el jurado > Salvad${sufG} por los compañeros > Finalista`;
        }

        // top3 del jurado
        return `${prefix}Salvad${sufG} por el jurado > Finalista`;
      }

      // 2) Si NO es finalista pero está entre los nominados que pasan a G13
      if (nominadosG11.has(id)) {
        const g = getG(id), sufG = suf(g);
        const prefix = parts.length ? parts.join(" > ") + " > " : "";
        return `${prefix}Propuest${sufG} por el jurado > Nominad${sufG}`;
      }
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

    // 1) Calcula los valores "normales" con valueOf (inyectando G17 si procede)
    const temp = rep.map(row => {
      const ids  = row.members;
      const vals = ids.map(id => {
        // Si estamos en G17 y tenemos etiqueta fija para este id, úsala.
        if (galaNum === 17 && g15LabelFor) {
          const fixed = g15LabelFor(id);
          if (fixed) return fixed;
        }
        // Si no, el flujo normal
        return valueOf(id);
      });
      return { row, ids, vals };
    });

// 2) En Gala 16: cada persona repite su PRIMER valor en todas sus filas
if (galaNum === 16) {
  const firstById = {}; // id -> primer valor visto para ese id
  temp.forEach(({ ids, vals }) => {
    ids.forEach((id, idx) => {
      if (firstById[id] === undefined) {
        firstById[id] = vals[idx];      // guarda su primera celda tal cual salió
      } else {
        vals[idx] = firstById[id];       // repite esa misma celda en esta fila
      }
    });
  });
}

// --- GALA 17: fija Ganador / 2º / 3º en todas las filas (sin heurísticas) ---
if (galaNum === 17) {
  const g15 = summaries?.[galaNum]?.g15 || {};
  const getId = (x) => (x && typeof x === "object" && "id" in x) ? x.id : x;

  const winnerId = getId(g15.winner);
  const secondId = getId(g15.second);
  const thirdId  = getId(g15.third);

  const labelFor = (id) => {
    const eq = (a, b) => String(a) === String(b);
    const g  = contestants.find(x => eq(x.id, id))?.gender ?? "e";
    const winTxt = g === "m" ? "Ganador" : g === "f" ? "Ganadora" : "Ganadore";
    const ord2  = g === "m" ? "2º" : g === "f" ? "2ª" : "2º/ª";
    const ord3  = g === "m" ? "3er" : g === "f" ? "3ª" : "3º/ª";

    if (eq(id, winnerId)) return winTxt;
    if (eq(id, secondId)) return `${ord2} Finalista`;
    if (eq(id, thirdId))  return `${ord3} Finalista`;
    return null;
  };

  // Sobrescribe las celdas con la etiqueta fija correspondiente
  temp.forEach(({ ids, vals }) => {
    ids.forEach((id, i) => {
      const fixed = labelFor(id);
      if (fixed) vals[i] = fixed;
    });
  });
}


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

export default function SimuladorOT({ staff, setStaff, repechageOption, setRepechageOption, judgeNames, setJudgeNames, mode, onModeChange, roster, setRoster, manual, setManual, popularityEnabled = true, setPopularityEnabled, relationshipsEnabled = true, setRelationshipsEnabled, loadedSeason, onLoadSeason, onLoadedSeason }) {
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



  // 🆕 Nuevo estado para las canciones
  const [songs, setSongs] = useState([]);
  const [songsReady, setSongsReady] = useState(false);
  const [songsMetaReady, setSongsMetaReady] = useState(false);
  const [songsMeta, setSongsMeta] = useState({}); // { title -> {afinacion, baile, presencia, emocion} }


  const { academy, setAcademy, week: academyWeek, reparto: academyReparto, blocked: academyBlocked, next: advanceAcademy, skipPerformances, chat: academyChat, chatGala, nextChat, skipEvents, skipChat } = useAcademySeason({ contestants, setContestants, summaries, setSummaries, gala, songsMeta, stage, mode });
  const repechageEnabled = academy.repechageEnabled !== false;
  const tableRepechageEnabled = repechageColumnsVisible(repechageOption,repechageEnabled,summaries[8]);
  const shownGala = n => displayGala(n,repechageEnabled);
  useMusicBackground(!contestants.length ? mode : !academyWeek || academyWeek.phase === "events" ? mode : !academyWeek.done || stage === "galaCerrada" || (stage === "repechage" && gstate.repechage?.phase === "performances") ? null : "tension", `${mode}-${gala}`);
  const [showPopularity, setShowPopularity] = useState(false);
  const [showRelationships, setShowRelationships] = useState(false);
  const [showBestPerformances,setShowBestPerformances] = useState(false);
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
      setShowRelationships(false); setShowBestPerformances(false);
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
          setSongs([...new Set([...lines,...customSongs().map(s=>s.title)])]);
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
            [...(list || []),...customSongs()].forEach(x => {
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



  const pushLog = (entry, galaNum=gala)=> setGalaLogs(logs=>({...logs,[galaNum]:[...(logs[galaNum]||[]), entry]}));
  const nameOf = (id)=> contestants.find(x=>x.id===id)?.name ?? "?";
  const nextStageFor = (num) =>
    num <= 11   ? (carryNominees.length === 2 ? "dueloPendiente" : "votoPublico")
  : num === 12 ? (carryNominees.length === 2 ? "dueloPendiente" : "gala10_jueces")  // ✅ vuelve a permitir duelo
  : num === 13 ? "gala11_publico"
  : num <= 16 ? "g12_14_publico"
              : "g15_final";

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
        } else {
          // G14–G17: solo finalistas (y en G17 también valdrá “ganador” si ya lo marcas)
          vivos = pool.filter(c => c.status === "finalista" || c.status === "ganador");
        }

        setGstate({
          publicRank: [], top3: [], top3Pct: undefined, favoritoId: undefined, top3Shown: false,
          evaluacionOrden: shuffle(vivos.map(v => v.id)), evalResults: [], salvados: new Set(),
          nominados: [], profesorSalvoId: undefined, votosCompaneros: [], salvadoCompanerosId: undefined,
          currentEvaluadoId: undefined, currentEvaluadoLogIndex: undefined, g12: undefined, g15: undefined
        });

        const activosIds = [...new Set([...vivos.map(c => c.id), ...(num === 9 ? summaries[8]?.repechage?.selected || [] : [])])];
        const nominadosDuelo = (num >= 2 && num <= 12) ? [...carryNominees] : [];
        const repartoBase = buildRepartoParaGala(num, activosIds, nominadosDuelo, summaries);
        const { reparto, groupSong } = buildRepartoConCanciones({
            galaNum: num,
            reparto: repartoBase,
            summaries,
            allSongs: songs,
          });
      // ✅ Guardado de la nueva gala: arrastra solo duelSaved de la anterior
      setSummaries(s => {
        // Los porcentajes pertenecen solo a esta gala.                      // gala anterior
        const duelSaved = {};      // traer el "salvado por el público (%)"

        return {
          ...s,
          [num]: {
            ...(s[num] || { gala: num }),
            duelSaved,                                // pasar a la nueva gala

            // aquí se guarda también el reparto (temas de la gala nueva)
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
      setAcademy(a => ({ ...a, staff, repechageEnabled: resolveRepechage(repechageOption), judges: judgeNames.map((n,i) => n.trim() || `Juez ${i+1}`), weeks: {}, pairs: [], relationships: {} }));
      setShowPopularity(false);
      setShowRelationships(false); setShowBestPerformances(false);
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

      // G14–G16: 6º/5º/4º Finalista
      if ((galaNum === 14 || galaNum === 15 || galaNum === 16) &&
          /\b(6|5|4)(º|ª)?\b/.test(v) && has("finalista")) {
        return { bg: "sienna", fg: "#fff" };
      }

      // ——— G12 finales específicos ———
      if (galaNum === 12 && has("finalista") && has("por los profesores"))
        return { bg: "yellowgreen", fg: "#111" };
      if (galaNum === 12 && has("finalista") && has("por los compañeros"))
        return { bg: "khaki", fg: "#111" };

      // Propuestos/Nominados sin ser finalistas (evita pisar los finalistas)
      if (has("propuest") && has("nominad") && !has("finalista"))
        return { bg: "orange", fg: "#111" };

      // Colores de propuesta con salvado (aplican también si no es G12-finalista)
      if (has("propuest") && has("por el jurado") && has("profesores")) return { bg: "yellowgreen", fg: "#111" };
      if (has("propuest") && has("por el jurado") && has("compañeros")) return { bg: "khaki", fg: "#111" };
      if (has("propuest") && has("nominad"))                              return { bg: "#fef08a", fg: "#111" };

      // 2º / 3º Finalista
      if (/\b2(º|ª)?\b/.test(v) && has("finalista")) return { bg: "silver", fg: "#111" };
      if (/\b3(º|ª|er)?\b/.test(v) && has("finalista")) return { bg: "#cd7f32", fg: "#fff" };

      // Finalista genérico
      if (has("finalista")) return { bg: "lightblue", fg: "#111" };

      // Favorito/a
      if (has("favorit") || has("nómada")) return { bg: "DodgerBlue", fg: "#fff" };

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
      setShowRelationships(false); setShowBestPerformances(false);
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
      const node = document.getElementById(showBestPerformances ? "actuaciones-capture" : showRelationships ? "relaciones-capture" : showPopularity ? "popularidad-capture" : "recorrido-capture");
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
        link.download = `${showBestPerformances ? "mejores-actuaciones" : showRelationships ? "relaciones" : showPopularity ? "popularidad" : "recorrido"}.png`;
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

        const elegido = pickManually(candidatos, false, nameOf,  "Elige a quién salvan los profesores");
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
      const resolve = { duel: dueloRevelar, teachers: profesoresSalvanUno, peers: companerosVotan, specialTeachers: gala10Profes, specialPeers: gala10Compas, finalDuel: g11_revelar };
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
      (c.source === "specialPeers" ? gala10Compas : companerosVotan)(completed, true);
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
      const { a, b, winner, loser } = pkg;
      let { pctA, pctB } = pkg;

      // ======= 💡 MODO MANUAL: decides quién es expulsado/a =======
      if (manual) {
        const expulsado = pickManually([a, b], false, nameOf, "Elige el eliminado de esta gala");
        if (!expulsado) return;

        const win = expulsado === a ? b : a;
        const lose = expulsado;
        const high = Math.max(pctA, pctB);
        const low = Math.min(pctA, pctB);
        [pctA, pctB] = win === a ? [high, low] : [low, high];

        // Paso 3: revelación y efectos (mismo post-proceso que automático)
        setContestants(prev => prev.map(c => {
          if (c.id === lose) {
            return {
              ...c,
              status: "eliminado",
              history: [
                ...(c.history || []),
                {
                  gala,
                  evento: "Eliminado",
                  detalle: `${fmtPct(c.id===a?pctA:pctB)} vs ${fmtPct(c.id===b?pctB:pctA)}`
                }
              ]
            };
          }
          return c;
        }));

        pushLog(`🗳️ <strong>${nameOf(win)}</strong>. ${nameOf(lose)} es eliminado/a. (manual)`);

        // Guardado de duelo + “salvado por público”
        setSummaries(s => ({
          ...s,
          [gala]: {
            ...(s[gala] || { gala }),
            duel: { a, b, pctA, pctB, winner: win },
            duelSaved: { ...(s[gala]?.duelSaved || {}), [win]: (win === a ? pctA : pctB) }
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

              if (id === lose) {
                const pct = pctMap[id];
                return `Expulsad${sufOf(id)} por el público (${typeof pct === "number" ? pct.toFixed(2) : "?"}%)`;
              }

              if (id === win) {
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

        if (gala === 12) {
          finishCeremony("gala10_jueces");   // Telecinco G12
        } else if (gala <= 11) {
          finishCeremony("votoPublico");     // G1–G9
        } else {
          finishCeremony(nextStageFor(gala)); // resto igual
        }
        return; // ⛔ no sigas a la rama automática
      }
      // ===== FIN MODO MANUAL =====

      // ======= 💻 MODO AUTOMÁTICO (tu flujo actual) =======
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

      if (gala === 12) {
        finishCeremony("gala10_jueces");
      } else if (gala <= 11) {
        finishCeremony("votoPublico");
      } else {
        finishCeremony(nextStageFor(gala));
      }
    }



  // Galas 1–9
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
      pushLog(favoriteComment(summaries[gala]?.performances?.[favoritoId]));
      setGstate(st => ({ ...st, favoritoId, salvados, top3Pct, favoriteRevealed: true, finalTwoPlan: undefined }));
      setSummaries(s => ({ ...s, [gala]: { ...(s[gala] || { gala }), top3Ids: gstate.top3, top3Pct, favoritoId, favoritePct: top3Rank.find(r=>r.id===favoritoId)?.pct } }));
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
          const encouragement=html.includes('cruza la pasarela') ? secondChance(gstate.currentEvaluadoId,summaries[gala]?.performances) : '';
          arr[idx] = encouragement ? `${html} ${encouragement}` : html;
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

        const choice = remaining <= needed ? "nominado" : needed <= 0 ? "salvado" : pickManually(
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

        // Usa la actualización "completa" de summaries para ser coherente con el modo automático
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
        return; // <- NO sigas por la rama automática
      }
      // ===== FIN MODO MANUAL =====

      // -------- Rama automática (tu código tal cual) --------
      const countUntil = (gala === 12) ? 11 : gala;
      const curList    = (gala === 12) ? undefined : cand;

      const salvado = pickProfSave(
        cand,
        summaries,
        countUntil,
        (ids) => ids[Math.floor(Math.random() * ids.length)],
        curList
      );

      // DEBUG
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





  
    function companerosVotan(votingState = gstate, skipAnimation = false){
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

      // ======= 💻 MODO AUTOMÁTICO (tu código) =======

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
        if (v && v.votedId in recuento) recuento[v.votedId] = (recuento[v.votedId] || 0) + 1;
      });

      // === Empate y voto doble del favorito (solo para desempate) ===
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

      // Elegir ganador
      const ganador = (empatados.length ? pickRandom(empatados, 1)[0] : pickRandom(candidatos, 1)[0]);
      if (!ganador) {
        pushLog("⚠️ No se pudo determinar ganador en la votación de compañeros. Se omite.");
        return;
      }

      if (tiedInitially.length > 1 && !desempateMsg) {
        desempateMsg = `🎲 Empate entre ${tiedInitially.map(nameOf).join(", ")}. Al no resolverlo el voto del favorito, el sorteo salva a ${nameOf(ganador)}.`;
      }
      const peerTie = tiedInitially.length > 1 ? { ids: tiedInitially, message: desempateMsg, counts: recuento } : null;

      // Logs bonitos
      const votosList = votos.map(v => `<li>${nameOf(v.voterId)} → ${nameOf(v.votedId)}</li>`).join("");
      pushLog(`🧑‍🤝‍🧑 Votación de compañeros:<ul style="margin:4px 0 0 16px;">${votosList}</ul>${votingState.favoritoId ? "<div class=\"text-xs\">* El voto del favorito vale doble en caso de empate</div>" : ""}`);

      // 📊 Mostrar recuento
      const contadorHTML = candidatos.map(id => `<strong>${nameOf(id)}</strong> ${recuento[id] ?? 0}`).join(" · ");
      pushLog(`📊 Recuento de votos (compañeros): ${contadorHTML}`);

      // ⭐ Mensaje de desempate (si lo hubo)
      if (desempateMsg) pushLog(desempateMsg);

      pushLog(`✅ Más votado por compañeros: <strong>${nameOf(ganador)}</strong> (se salva).`);

      // Avance de estado
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

      // Guardado mínimo
      setSummaries(s => ({
        ...s,
        [gala]: { ...(s[gala] || { gala }), salvadoCompanerosId: ganador, votosCompaneros: votos, finalNominees: nominadosRestantes }
      }));

      pushLog(`🟥 Nominados para la próxima gala: <strong>${nameOf(nominadosRestantes[0])}</strong> vs <strong>${nameOf(nominadosRestantes[1])}</strong>.`);
      setCarryNominees(nominadosRestantes);

      // 💾 Completar valoraciones en la tabla de reparto
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
        return rellenarValoracionesReparto(gala, seguro, contestants);
      });

      // 🧹 Consumir duelSaved
      setSummaries(s => ({
        ...s,
        [gala]: { ...(s[gala] || { gala }), duelSaved: {} }
      }));

      // 👉 Cerrar gala
      if (skipAnimation) setStage("galaCerrada");
      else finishCeremony("galaCerrada");

      // === AVANZAR A LA SIGUIENTE GALA ===
      const goNext = () => {
        const next = nextGala(gala,repechageEnabled);
        setGala(next);
        prepararNuevaGala(next, contestants);
      };
    }


  // Gala 12
    function applyScoreResults(pending) {
      setGstate(pending.gstate);
      setContestants(pending.contestants);
      setSummaries(pending.summaries);
      setGalaLogs(pending.galaLogs);
      setStage(pending.stage);
      setViewGala(gala);
    }
    function gala10PuntuarJueces(skipAnimation = false) {
      const pending = captureScoreResult(calculateScoreResults, { gstate, contestants, summaries, galaLogs, stage }, gala);
      if (pending.stage === stage) return; // Cancelled manual selection or invalid roster.
      if (skipAnimation) { applyScoreResults(pending); return; }
      const scores = pending.gstate.g10_scores;
      const ids = Object.keys(scores);
      const finalists = pending.summaries[gala].g10.top3;
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

    function calculateScoreResults({ gstate, contestants, summaries, setGstate, setContestants, setSummaries, setStage, pushLog }){
      // Activos deben ser 7
      const vivos = contestants.filter(c => c.status === "active");
      if (vivos.length !== 7) { pushLog("⚠️ Para la Gala 12 deben quedar exactamente 7 activos."); return; }

      // ---- 1) Contar nominaciones por concursante en Galas 1–9
      const countNominaciones = (id) => {
        let n = 0;
        for (let g = 1; g <= 11; g++) {
          const s = summaries[g];
          if (!s) continue;
          if ((s.juradoNominados || []).includes(id)) n++;
        }
        return n;
      };

      const nomCounts = Object.fromEntries(vivos.map(c => [c.id, countNominaciones(c.id)]));
      const maxNoms   = Math.max(0, ...Object.values(nomCounts)); // 0 si todos 0
      const DEBUG_G10 = false;
      const SHOW_G10_SUMMARY = false;
      if (DEBUG_G10) {
        pushLog(`📊 G12 bias debug: ${vivos.map(c => `${nameOf(c.id)} → ${nomCounts[c.id] || 0} nominaciones`).join(" · ")}`);
      }

      const toHalf = (x) => Math.round(x * 2) / 2;
      const jitterSigned = (range) => (Math.random()*2 - 1) * range; // uniforme [-range, +range]

      // ---- 2) Parámetros de notas (como tenías)
      const MU_MIN = 6.50, MU_MAX = 9.50, DEV = 0.60, ALPHA = 0.75;

      // ======= 💡 MODO MANUAL: eliges tú el Top-3 del jurado =======
      let chosenTop3 = null;
      if (manual) {
        const idsVivos = vivos.map(c => c.id);
        const elegidos = pickManually(idsVivos, true, nameOf, "Elige el Top 3 del jurado")?.slice(0,3);
        if (!elegidos || elegidos.length !== 3) { alert("Debes elegir 3 concursantes para el Top-3 del jurado."); return; }
        chosenTop3 = elegidos.map(String);
        pushLog(`👑 Finalistas por jurado (G12, manual): <strong>${chosenTop3.map(id=>nameOf(id)).join(", ")}</strong>.`);
      }
      // ======= FIN MODO MANUAL =======

      // ---- 3) Puntuar
      const vivosOrdenNomsAsc = [...vivos].sort((a,b) => (nomCounts[a.id]||0) - (nomCounts[b.id]||0));
      const scores = {};  // id -> [n1,n2,n3,n4]
      const sumas  = {};  // id -> suma

      vivos.forEach(c => {
        // percentil por pocas nominaciones: 0 = más nominaciones, 1 = menos nominaciones
        const pos  = vivosOrdenNomsAsc.findIndex(x => x.id === c.id);      // 0..len-1 (0 = menos nominaciones)
        const perc = (pos + 0.5) / vivosOrdenNomsAsc.length;               // 0..1
        const favor = 1 - perc;                                            // 1 = menos noms

        // media objetivo: menos nominaciones → más cerca de MU_MAX
        let muTarget = MU_MIN + favor * (MU_MAX - MU_MIN);

        // 👉 Si es Top-3 manual, dale un empujón suave para que su suma quede arriba
        if (chosenTop3 && chosenTop3.includes(String(c.id))) {
          muTarget = Math.min(9.7, muTarget + 0.5);
        }

        // 4 jueces
        const notas = [0,0,0,0].map(() => {
          const base   = randomHalfStep(5,10);
          const mix    = base*(1-ALPHA) + muTarget*ALPHA;
          const noisy  = mix + jitterSigned(DEV) - performanceNominationModifier(summaries[gala]?.performances?.[c.id]) * 4;
          return toHalf(clamp(noisy, 5, 10));
        });

        scores[c.id] = notas;
        sumas[c.id]  = +(notas.reduce((a,b)=>a+b,0)).toFixed(2);
      });

      if (chosenTop3) {
        alignFinalistScores(scores, chosenTop3);
        vivos.forEach(c => { sumas[c.id] = scores[c.id].reduce((a, b) => a + b, 0); });
      }

      // ---- 4) Orden, Top-3 y Bottom-4
      let orden = [...vivos].sort((a,b)=> sumas[b.id] - sumas[a.id]);

      if (chosenTop3) {
        // Fuerza que el Top-3 sea exactamente el elegido (respetando la suma para ordenar dentro de cada grupo)
        const top3Objs    = vivos.filter(c => chosenTop3.includes(String(c.id))).sort((a,b)=> sumas[b.id] - sumas[a.id]);
        const restoObjs   = vivos.filter(c => !chosenTop3.includes(String(c.id))).sort((a,b)=> sumas[b.id] - sumas[a.id]);
        orden = [...top3Objs, ...restoObjs];
      }

      const top3    = orden.slice(0,3);
      const bottom4 = orden.slice(3);

      // ---- 5) Tabla/logs como tenías
      const safeJudgeName = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      const judgeHeaders = (summaries[gala]?.judges || ["Juez 1", "Juez 2", "Juez 3", "Juez 4"]).map(name => `<th>${safeJudgeName(name)}</th>`).join("");
      const th = `<tr><th>Concursante</th>${judgeHeaders}<th>Total</th></tr>`;
      const rows = orden.map(c=>{
        const n = scores[c.id];
        return `<tr><td>${c.name}</td><td>${n[0].toFixed(1)}</td><td>${n[1].toFixed(1)}</td><td>${n[2].toFixed(1)}</td><td>${n[3].toFixed(1)}</td><td><strong>${sumas[c.id].toFixed(2)}</strong></td></tr>`;
      }).join("");
      pushLog(`📋 Desglose jurado (G12):<div style="overflow:auto;"><table style="border-collapse:collapse;"><thead>${th}</thead><tbody>${rows}</tbody></table></div>`);

      // Marca finalistas Top-3
      setContestants(prev => prev.map(c => 
        top3.some(t=>t.id===c.id)
          ? { ...c, status:"finalista", history:[...c.history,{gala,evento:"Finalista por jurado (G12)"}] }
          : c
      ));

      if (SHOW_G10_SUMMARY) {
        pushLog(`📊 <strong>Gala 12</strong> – Sumas del jurado: ${orden.map((x,i)=>`${i+1}. ${x.name} (${sumas[x.id].toFixed(2)})`).join(" · ")}.`);
      }

      if (!chosenTop3) {
        pushLog(`👑 Finalistas por jurado (G12): <strong>${top3.map(t=>t.name).join(", ")}</strong>. Nominados (4): ${bottom4.map(t=>t.name).join(", ")}.`);
      } else {
        pushLog(`Nominados (4): ${bottom4.map(t=>t.name).join(", ")}.`);
      }

      // Estado G12
      setGstate(prev => ({ 
        ...prev,
        g10_scores: scores,
        g10_sumas:  sumas,
        nominados:  bottom4.map(b=>b.id)
      }));

      // Etiquetado adicional para reparto de la G12 (solo Top-3 → Finalista)
      setSummaries(s => {
        if (!s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;
        const top3Ids = top3.map(t => t.id);
        const rep = s[gala][gala].reparto.map(row => {
          return {
            ...row,
            valor: row.members.map(id => {
              if (top3Ids.includes(id)) {
                const g = contestants.find(c=>c.id===id)?.gender ?? "e";
                const suf = g==="m"?"o":g==="f"?"a":"e";
                return `Salvad${suf} por el jurado > Finalista`;
              }
              return row.valor || "";
            }).reduce((acc, v, i) => acc || v, row.valor)
          };
        });

        return { ...s, [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } } };
      });

      // Foto de G12 en summaries
      setSummaries(s => ({
        ...s,
        [gala]: { 
          ...(s[gala] || { gala }),
          juradoNominados: bottom4.map(t => t.id),
          g10: {
            ...(s[gala]?.g10 || {}),
            sumas,
            top3: top3.map(t=>t.id),          // ← queda el Top-3 real (manual o auto)
            nominados4: bottom4.map(t=>t.id),
            cuarto: "",
            quinto: "",
            restantes: []
          }
        }
      }));

      setStage("gala10_profes");
    }


function gala10Profes() {
  if (!gstate || !gstate.nominados || gstate.nominados.length !== 4) return;

  const cand = [...gstate.nominados];

  // === 🧠 MODO MANUAL ===
  if (manual) {
    const salvado = pickManually(cand, false, nameOf, "Elige al 4º Finalista");
    if (!salvado) return;

    // marcar estado y logs
    setContestants(prev =>
      prev.map(c =>
        c.id === salvado
          ? { ...c, status: "finalista", history: [...c.history, { gala, evento: "4º finalista (profes, G12)" }] }
          : c
      )
    );

    pushLog(`🎓 Profesores (modo manual) eligen 4º finalista: <strong>${nameOf(salvado)}</strong>.`);

    const restantes = cand.filter(id => id !== salvado);
    setGstate({ ...gstate, nominados: restantes, profesorSalvoId: salvado });

    setSummaries(s => ({
      ...s,
      [gala]: {
        ...(s[gala] || { gala }),
        g10: { ...(s[gala]?.g10 || {}), cuarto: salvado, restantes }
      }
    }));

    finishCeremony("gala10_compas");
    return; // 🔚 no sigas con la rama automática
  }
  // === FIN MODO MANUAL ===

  // 👉 MODO AUTOMÁTICO (sin cambios)
  const countUntil = gala - 1;
  const curList = undefined;

  const salvado = pickProfSave(
    cand,
    summaries,
    countUntil,
    (ids) => ids[Math.floor(Math.random() * ids.length)],
    curList
  );

  const debugData = cand.map(id => ({
    id,
    nombre: nameOf(id),
    nominaciones: countNomsThrough(id, summaries, countUntil, curList)
  }));
  console.group("[G12 DEBUG] Profesores (menos nominaciones hasta G9)");
  console.table(debugData);
  console.log("=> 4º finalista (profes):", { id: salvado, nombre: nameOf(salvado) });
  console.groupEnd();

  setContestants(prev =>
    prev.map(c =>
      c.id === salvado
        ? { ...c, status: "finalista", history: [...c.history, { gala, evento: "4º finalista (profes, G12)" }] }
        : c
    )
  );

  pushLog(`🎓 Profesores eligen 4º finalista (G12): <strong>${nameOf(salvado)}</strong>.`);

  const restantes = cand.filter(id => id !== salvado);
  setGstate({ ...gstate, nominados: restantes, profesorSalvoId: salvado });

  setSummaries(s => ({
    ...s,
    [gala]: {
      ...(s[gala] || { gala }),
      g10: { ...(s[gala]?.g10 || {}), cuarto: salvado, restantes }
    }
  }));

  finishCeremony("gala10_compas");
}


    function gala10Compas(votingState = gstate, skipAnimation = false) {
      if (!votingState) return;

      const electores = contestants.filter(c => c.status === "finalista").map(c => c.id);
      const candidatos = votingState.nominados;
      if (!Array.isArray(candidatos) || candidatos.length !== 3) {
        pushLog("⚠️ No hay 3 nominados para la votación de compañeros (G12).");
        return;
      }

      // === 🧠 MODO MANUAL ===

      // === FIN MODO MANUAL ===

      // 👉 MODO AUTOMÁTICO (sin cambios)
      const votos = votingState.ceremony?.votes || [];
      if (votos.length !== electores.length) return;

      const votosList = votos.map(v => `<li>${nameOf(v.voterId)} → ${nameOf(v.votedId)}</li>`).join("");
      pushLog(`🧑‍🤝‍🧑 Votación de compañeros (G12):<ul style="margin:4px 0 0 16px;">${votosList}</ul>`);

      const recuento = { [candidatos[0]]:0, [candidatos[1]]:0, [candidatos[2]]:0 };
      votos.forEach(v => recuento[v.votedId]++);
      pushLog(`📊 Recuento de votos (compañeros, G12): ${
        candidatos.map(id => `<strong>${nameOf(id)}</strong> ${recuento[id]}`).join(" · ")
      }`);

      let max = Math.max(...candidatos.map(id => recuento[id]));
      let empatados = candidatos.filter(id => recuento[id] === max);
      const tiedInitially = [...empatados];
      let tieReason = "";
      const huboEmpateInicial = (empatados.length > 1);

      if (huboEmpateInicial) {
        const sumas = (summaries?.[gala]?.g10?.sumas) ?? votingState?.g10_sumas ?? null;
        if (sumas) {
          const electorPrivilegiado = [...electores].sort((a,b) => {
            const sa = typeof sumas[a] === "number" ? sumas[a] : -Infinity;
            const sb = typeof sumas[b] === "number" ? sumas[b] : -Infinity;
            return sb - sa;
          })[0];

          const suVoto = votos.find(v => v.voterId === electorPrivilegiado)?.votedId;
          if (suVoto && empatados.includes(suVoto)) {
            recuento[suVoto] += 1;
            tieReason = `La mejor nota del jurado (${nameOf(electorPrivilegiado)}) añade un voto a ${nameOf(suVoto)}.`;
            pushLog(`🏅 Desempate: mejor nota del jurado (${nameOf(electorPrivilegiado)}) otorga +1 a <strong>${nameOf(suVoto)}</strong>.`);
          }
          max = Math.max(...candidatos.map(id => recuento[id]));
          empatados = candidatos.filter(id => recuento[id] === max);
        }
      }

      const ganador = (empatados.length > 1) ? pickRandom(empatados, 1)[0] : empatados[0];
      if (!ganador) { pushLog("⚠️ No se pudo determinar el 5º finalista por compañeros."); return; }

      if (empatados.length > 1) tieReason += ` El empate se resuelve por sorteo a favor de ${nameOf(ganador)}.`;
      const peerTie = huboEmpateInicial ? { ids: tiedInitially, message: `Empate entre ${tiedInitially.map(nameOf).join(", ")}. ${tieReason}`, counts: recuento } : null;
      if (peerTie) pushLog(peerTie.message);

      setContestants(prev => prev.map(c => c.id === ganador ? {
        ...c,
        status: "finalista",
        history: [...(c.history || []), { gala, evento: "5º finalista (compañeros, G12)" }]
      } : c));

      pushLog(`✅ Más votado por compañeros: <strong>${nameOf(ganador)}</strong> (5º finalista).`);

      setSummaries(s => ({
        ...s,
        [12]: { ...(s[12] || { gala: 12 }), salvadoCompanerosId: ganador }
      }));

      const nominadosRestantes = candidatos.filter(id => id !== ganador);
      const salvadosSet = new Set(votingState.salvados); salvadosSet.add(ganador);

      setGstate({
        ...votingState,
        peerTie,
        votosCompaneros: votos,
        salvadoCompanerosId: ganador,
        nominados: nominadosRestantes,
        salvados: salvadosSet
      });

      setSummaries(s => ({
        ...s,
        [gala]: { ...(s[gala] || { gala }), salvadoCompanerosId: ganador, votosCompaneros: votos, finalNominees: nominadosRestantes }
      }));
      setSummaries(s => ({
        ...s,
        [gala]: {
          ...(s[gala] || { gala }),
          g10: {
            ...(s[gala]?.g10 || {}),
            quinto: ganador,
            restantes: candidatos.filter(id => id !== ganador)
          }
        }
      }));

      pushLog(`🟥 Nominados para la próxima gala: <strong>${nameOf(nominadosRestantes[0])}</strong> vs <strong>${nameOf(nominadosRestantes[1])}</strong>.`);
      setCarryNominees(nominadosRestantes);
      setSummaries(prev => rellenarValoracionesReparto(12, prev, contestants));
      if (skipAnimation) setStage("galaCerrada");
      else finishCeremony("galaCerrada");
    }




    function g11_iniciarCiegos(){
      if(carryNominees.length!==2){ pushLog("⚠️ En Gala 13 deben quedar 2 no-finalistas."); return; }
      const [a,b]=carryNominees;
      const [pctA, pctB] = audiencePercentages([a, b], contestants, Math.random, 4, popularityEnabled);
      const winner = pctA>pctB ? a : b;
      const loser  = winner===a ? b : a;

      setGstate(st=>({...st, g11:{ a,b,pctA,pctB,winner,loser, sentence:false, done:false }, ceremony: { kind: "duel", source: "finalDuel", ids: [a,b], pct: Math.max(pctA,pctB), phase: "intro" }}));
      pushLog("Llega el momento de la verdad");
      setViewGala(gala);
      setStage("ceremony");
    }

    function g11_mostrarFrase(){
      const P = gstate?.g11; if(!P){ pushLog("⚠️ Primero muestra los porcentajes ciegos."); return; }
      const savedPct = Math.max(P.pctA, P.pctB);
      pushLog(`🗣️ <em>La audiencia ha decidido qué debe proseguir su formación en la academia con un (${savedPct.toFixed(1)}%)… y convertirse en el último/a finalista...</em>`);
      setGstate(st=>({...st, g11:{ ...st.g11, sentence:true }}));
    }

    function g11_revelar() {
      const P = gstate?.g11;
      if (!P) { pushLog("⚠️ No hay paquete preparado."); return; }
      const { a, b, winner, loser } = P;
      let { pctA, pctB } = P;

      const eq = (x,y) => String(x) === String(y);
      const nameOfSafe = (id) => {
        const c = contestants.find(x => String(x.id) === String(id));
        return c ? c.name : "?";
      };

      // === MODO MANUAL ===
      if (manual) {
        const elegido = pickManually([a, b], false, nameOfSafe, "Elige al último eliminado");
        if (!elegido) return;

        const manualLoser  = elegido;
        const manualWinner = eq(manualLoser, a) ? b : a;
        const high = Math.max(pctA, pctB), low = Math.min(pctA, pctB);
        [pctA, pctB] = eq(manualWinner, a) ? [high, low] : [low, high];

        // Actualiza estados usando eq(...)
        setContestants(prev => prev.map(c => {
          if (eq(c.id, manualWinner)) {
            return { ...c, status: "finalista", history: [...(c.history||[]), { gala, evento: "6º finalista (público, G13, manual)" }] };
          }
          if (eq(c.id, manualLoser)) {
            return { ...c, status: "eliminado", history: [...(c.history||[]), { gala, evento: "Eliminado (G13, manual)" }] };
          }
          return c;
        }));

        pushLog(`🗳️ (Manual) <strong>${nameOfSafe(manualWinner)}</strong> es salvado/a. ${nameOfSafe(manualLoser)} es eliminado/a.`);

        const seis = contestants
          .filter(c => (eq(c.id, manualWinner) ? true : c.status === "finalista"))
          .map(c => c.name);
        pushLog(`✅ Finalistas anunciados: ${seis.join(", ")}.`);

        // Guardar
        setSummaries(s => ({
          ...s,
          [gala]: { ...(s[gala] || { gala }), g11: { a, b, pctA, pctB, winner: manualWinner, loser: manualLoser } }
        }));

        setCarryNominees([]);

        // Reparto
        setSummaries(s => {
          if (!s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;
          const rep = s[gala][gala].reparto.map(row => {
            const id = row.members[0];
            const c  = contestants.find(x => eq(x.id, id));
            if (!c) return row;
            const g  = c.gender ?? "e";
            const suf = g==="m"?"o":g==="f"?"a":"e";

            if (eq(id, manualWinner)) return { ...row, valor: `Salvad${suf} por el público (manual) > Finalista` };
            if (eq(id, manualLoser))  return { ...row, valor: `Expulsad${suf} por el público (manual)` };
            if (c.status === "finalista" && !eq(id, manualWinner)) return { ...row, valor: "Finalista" };
            return row;
          });
          return { ...s, [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } } };
        });

        setGstate(st => ({ ...st, g11: { ...st.g11, done: true } }));
        finishCeremony("galaCerrada");
        return;
      }

      // === Automático (igual que tenías) ===
      setContestants(prev=>prev.map(c=>
        eq(c.id, winner) ? { ...c, status:"finalista", history:[...c.history,{gala,evento:"6º finalista (público, G13)"}] } :
        eq(c.id, loser)  ? { ...c, status:"eliminado", history:[...c.history,{gala,evento:"Eliminado (G13)"}] } : c
      ));

      pushLog(`🗳️ <strong>${nameOfSafe(winner)}</strong>. ${nameOfSafe(loser)} es eliminado/a.`);

      const seis = contestants.filter(c=> (eq(c.id, winner)?true:c.status==="finalista")).map(c=>c.name);
      pushLog(`✅ Finalistas anunciados: ${seis.join(", ")}.`);

      setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), g11:{ a,b,pctA,pctB,winner } }}));

      setCarryNominees([]);
      setSummaries(s => {
        if (!s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;
        const pctMap = { [String(a)]: pctA, [String(b)]: pctB };
        const rep = s[gala][gala].reparto.map(row => {
          const id = row.members[0];
          const c  = contestants.find(x => eq(x.id, id));
          if (!c) return row;
          const g  = c.gender ?? "e";
          const suf = g==="m"?"o":g==="f"?"a":"e";

          if (c.status === "finalista" && !eq(id, winner)) return { ...row, valor: "Finalista" };
          if (eq(id, winner)) return { ...row, valor: `Salvad${suf} por el público (${(pctMap[String(id)]||0).toFixed(2)}%) > Finalista` };
          if (eq(id, loser))  return { ...row, valor: `Expulsad${suf} por el público (${(pctMap[String(id)]||0).toFixed(2)}%)` };
          return row;
        });
        return { ...s, [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } } };
      });

      setGstate(st=>({...st, g11:{ ...st.g11, done:true }}));
      finishCeremony("galaCerrada");
    }



  // Gala 13
  function gala11Publico(){
    if(carryNominees.length!==2){ pushLog("⚠️ En Gala 13 deben quedar 2 no-finalistas."); return; }
    const [a,b]=carryNominees;
    const [pctA, pctB] = audiencePercentages([a, b], contestants, Math.random, 4, popularityEnabled);
    const winner = pctA>pctB ? a : b;
    const loser  = winner===a ? b : a;
    setContestants(prev=>prev.map(c=>
      c.id===winner ? { ...c, status:"finalista", history:[...c.history,{gala,evento:"6º finalista (público, G13)"}] } :
      c.id===loser  ? { ...c, status:"eliminado", history:[...c.history,{gala,evento:"Eliminado (G13)"}] } : c
    ));
    pushLog(`🏆 Resultado público (G13): ${nameOf(a)} ${fmtPct(pctA)} · ${nameOf(b)} ${fmtPct(pctB)} → Se salva <strong>${nameOf(winner)}</strong>.`);
    const seis = contestants.filter(c=> (c.id===winner?true:c.status==="finalista")).map(c=>c.name);
    pushLog(`✅ Finalistas anunciados: ${seis.join(", ")}.`);
    setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), g11:{ a,b,pctA,pctB,winner } }}));
    setCarryNominees([]);
    // Etiquetar reparto de la G13
    setSummaries(s => {
      if (!s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;

      // pcts por id
      const pctMap = { [a]: pctA, [b]: pctB };
      const rep = s[gala][gala].reparto.map(row => {
        const id = row.members[0]; // en G13 son solos
        const c  = contestants.find(x => x.id === id);
        if (!c) return row;
        const g  = c.gender ?? "e";
        const suf = g==="m"?"o":g==="f"?"a":"e";

        // Ya-finalistas → "Finalista"
        if (c.status === "finalista" && id !== winner) {
          return { ...row, valor: "Finalista" };
        }

        // Ganador del duelo de G13 → "Salvado por el público (%) > Finalista"
        if (id === winner) {
          const pct = pctMap[id];
          return { ...row, valor: `Salvad${suf} por el público (${pct.toFixed(2)}%) > Finalista` };
        }

        // Eliminado en G13 → "Expulsado por el público (%)"
        if (id === loser) {
          const pct = pctMap[id];
          return { ...row, valor: `Expulsad${suf} por el público (${pct.toFixed(2)}%)` };
        }

        return row;
      });

      return { ...s, [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } } };
    });
    setStage("galaCerrada");
  }

  // Galas 12–14 – modo de revelado por pasos
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
      if (r.kind === "duel") {
        const bottom = next.entries.slice(-2);
        setGstate(st => ({ ...st, g12: { ...st.g12, tabla: next.entries,
          revealed: new Set(next.visible.map(index => String(next.entries[index].id))),
          revealQueue: next.entries.filter((_, index) => !next.visible.includes(index)).map(row => row.id),
          pendingPick: null, bottomHigh: bottom[0], bottomLow: bottom[1] } }));
        pushLog(target < next.entries.length-2 ? `🔎 ${nameOf(chosen)} cuenta con los votos necesarios: ${fmtPct(next.entries[target].pct)}.` : `🔴 ${nameOf(chosen)} no cuenta con suficiente apoyo y pasa al duelo.`);
      } else {
        const prepared = { ...gstate, g15: { ...gstate.g15, tabla: next.entries } };
        if (target === 2) g15_revealThird(prepared, true);
        else g15_revealWinner(prepared, true);
        setGstate(st => ({ ...st, g15: { ...st.g15, tabla: next.entries } }));
      }
      setGstate(st => ({ ...st, publicReveal: next }));
      setStage("publicReveal");
      return;
    }
    if (r.screen === "revealed") {
      if (r.cursor + 1 < r.targets.length) {
        setGstate(st => ({ ...st, publicReveal: { ...r, cursor: r.cursor + 1, screen: "announce", selectedId: "" } }));
      } else {
        if (r.kind === "duel") {
          setGstate(st => ({ ...st, publicReveal: { ...r, screen: "duelPerformance", duelPerformances:prepareFinalistDuel(r.entries.slice(-2).map(e=>e.id),contestants,summaries,gala,songsMeta,academy.judges,songs),performed:0, selectedId: "" } }));
        } else {
          setGstate(st => ({ ...st, publicReveal: undefined }));
          setStage("galaCerrada");
        }
      }
      return;
    }
    if(r.screen === 'duelPerformance') {
      if(r.performed<r.duelPerformances.length) {
        const performance=r.duelPerformances[r.performed];
        const updated=applyPopularity(contestants,Object.fromEntries(performance.members.map(m=>[m.id,m.delta])));
        setContestants(updated);
        setSummaries(s=>({...s,[gala]:{...s[gala],popularity:{...s[gala]?.popularity,...Object.fromEntries(updated.filter(c=>performance.members.some(m=>m.id===c.id)).map(c=>[c.id,c.popularity]))},duelPerformances:[...(s[gala]?.duelPerformances || []),performance]}}));
        pushLog(`🎶 ${nameOf(performance.members[0].id)} canta ${performance.song}. ${performance.members[0].detail}`.replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch])));
        setGstate(st=>({...st,publicReveal:{...r,performed:r.performed+1}}));
      } else setGstate(st=>({...st,publicReveal:{...r,screen:'duel',selectedId:''}}));
      return;
    }
    if (r.screen === "duel") {
      if (manual && !r.selectedId) return;
      g12_duel(gstate, r.selectedId || null);
      setGstate(st => ({ ...st, publicReveal: { ...r, screen: "duelResult", selectedId: "" } }));
      setStage("publicReveal");
      return;
    }
    setGstate(st => ({ ...st, publicReveal: undefined }));
    setStage("galaCerrada");
  }

  function g12_setup(){
    const enJuego=contestants.filter(c=>c.status==="finalista");
    if(enJuego.length<3){ pushLog("⚠️ Deben quedar al menos 3 finalistas para 12–14."); return; }
    const pcts=audiencePercentages(enJuego.map(c => c.id), contestants, Math.random, 4, popularityEnabled);
    const tabla=enJuego.map((c,i)=>({id:c.id,name:c.name,pct:pcts[i]})).sort((a,b)=>b.pct-a.pct);
    const onlyPcts=tabla.map(t=>fmtPct(t.pct));
    const revealQueue=shuffle(tabla.map(t=>t.id));
    const bottom2=[...tabla].slice(-2).sort((a,b)=>a.pct-b.pct); // low then high
    setGstate(st=>({...st, g12:{ tabla, revealQueue, revealed:new Set(), bottomLow:bottom2[0], bottomHigh:bottom2[1], duelDone:false }}));
    pushLog(`📊 <strong>Gala ${gala}</strong> – Porcentajes ciegos: ${onlyPcts.join(" · ")}.`);
    setGstate(st => ({ ...st, publicReveal: createPublicReveal(tabla, "duel", 2) }));
    setViewGala(gala);
    setStage("publicReveal");

  }

  function g12_revealNext() {
    const G = gstate?.g12;
    if (!G) return;

    // Normaliza campos con defaults
    const tabla       = Array.isArray(G.tabla) ? G.tabla : [];
    const pendingPick = G.pendingPick || null;

    // revealed puede venir como Set o Array
    const revealedSet = new Set([...(G.revealed || [])].map(String));

    const eq = (a,b) => String(a) === String(b);
    const prettyName = (id) =>
      (tabla.find(x => eq(x.id, id))?.name) || nameOf(id) || String(id);

    // Siempre trabaja con una cola filtrada (sin ids ya revelados)
    const queueFiltered = (G.revealQueue || []).filter(id => !revealedSet.has(String(id)));
    if (!queueFiltered.length && !pendingPick) {
      pushLog("ℹ️ Todos los porcentajes ya fueron asignados.");
      return;
    }

    // ============= MODO MANUAL =============
    if (manual) {
      // 1) No hay pendiente → mostrar % y dejarlo pendiente
      if (!pendingPick) {
        const nextId = queueFiltered[0];
        const it = tabla.find(t => eq(t.id, nextId));
        if (!it) return;

        pushLog(`🔎 ${fmtPct(it.pct)} → pulsa de nuevo para elegir a quién pertenece.`);

        setGstate(st => ({
          ...st,
          g12: {
            ...G,
            // fija la cola ya filtrada para mantener coherencia
            revealQueue: queueFiltered,
            pendingPick: { fromId: nextId, pct: it.pct }
          }
        }));
        return;
      }

      // 2) Hay un % pendiente → pedir a quién asignarlo y resolver
      const { fromId, pct } = pendingPick;

      // candidatos = ids aún no revelados
      const candidates = tabla
        .filter(t => !revealedSet.has(String(t.id)))
        .map(t => t.id);

      const chosenId = pickManually(candidates, false, prettyName, "Elige a quién pertenece ese porcentaje");
      if (!chosenId) return;

      // swap de % si el elegido no es el fromId
      let newTabla = tabla.slice();
      if (!eq(chosenId, fromId)) {
        const fromIdx = newTabla.findIndex(x => eq(x.id, fromId));
        const toIdx   = newTabla.findIndex(x => eq(x.id, chosenId));
        if (fromIdx >= 0 && toIdx >= 0) {
          const tmpPct          = newTabla[toIdx].pct;
          newTabla[toIdx].pct   = newTabla[fromIdx].pct; // el % pendiente pasa al elegido
          newTabla[fromIdx].pct = tmpPct;                // el otro % queda en el origen
        }
      }

      pushLog(`🔎 ${fmtPct(pct)} pertenece a <strong>${prettyName(chosenId)}</strong>.`);

      // marca el elegido como revelado (una sola vez)
      const newRevealed = new Set(revealedSet);
      newRevealed.add(String(chosenId));

      // avanza la cola: quita el primero (fromId). Si chosenId !== fromId,
      // reinsertamos fromId al final para que tenga su propio turno luego.
      const rest = queueFiltered.slice(1);
      const nextQueue = !eq(chosenId, fromId) ? rest.concat([fromId]) : rest;

      setGstate(st => ({
        ...st,
        g12: {
          ...G,
          tabla: newTabla,
          revealed: newRevealed,
          revealQueue: nextQueue,
          pendingPick: null
        }
      }));
      return;
    }

    // ============= AUTOMÁTICO =============
    const nextId = queueFiltered[0];
    const rest   = queueFiltered.slice(1);
    const it     = tabla.find(t => eq(t.id, nextId));
    if (!it) {
      setGstate(st => ({ ...st, g12: { ...G, revealQueue: rest } }));
      return;
    }

    pushLog(`🔎 ${fmtPct(it.pct)} pertenece a <strong>${it.name}</strong>.`);
    const newSet = new Set(revealedSet); newSet.add(String(it.id));
    setGstate(st => ({
      ...st,
      g12: { ...G, revealQueue: rest, revealed: newSet }
    }));
  }


  function g12_duel(currentState = gstate, chosenWinner = null) {
    const G = currentState?.g12;
    if (!G) return;

    const { duelDone, tabla } = G;
    if (duelDone) { pushLog("ℹ️ Duelo ya resuelto."); return; }

    // ✅ GUARD MANUAL: no permitir duelo hasta que TODO esté revelado
    if (manual) {
      const total = (G.tabla || []).length;
      const revealedCount = new Set([...(G.revealed || [])]).size;
      if (G.pendingPick || revealedCount < total) {
        pushLog("⚠️ Falta asignar el último porcentaje. Pulsa 'Revelar siguiente' para completarlo.");
        return;
      }
    }

    const eq = (a,b) => String(a) === String(b);
    const nameFromTabla = (id) =>
      (tabla.find(x => eq(x.id, id))?.name) || nameOf(id) || String(id);

    // Helper para construir item desde tabla
    const getItem = (id) => {
      const t = tabla.find(x => eq(x.id, id));
      return t ? { id: t.id, name: nameFromTabla(t.id), pct: t.pct } : null;
    };

    // ===== MODO MANUAL =====
    if (manual) {
      // Los 2 menos votados (tras tus asignaciones)
      const sorted = [...tabla].sort((a,b) => a.pct - b.pct);
      const bottomA = getItem(sorted[0].id);
      const bottomB = getItem(sorted[1].id);

      // Mostrar quiénes van al duelo con sus %
      pushLog(`🔴 ${fmtPct(bottomA.pct)} pertenece a <strong>${bottomA.name}</strong> (nominado al duelo).`);
      pushLog(`🔴 ${fmtPct(bottomB.pct)} pertenece a <strong>${bottomB.name}</strong> (nominado al duelo).`);

      // % del duelo solo decorativos en el log
      const { high, low } = randomDuelPercents();

      // Tú eliges el ganador del duelo
      const winnerId = chosenWinner || pickManually([bottomA.id, bottomB.id], false, nameFromTabla, "Elige al ganador del duelo");
      if (!winnerId) return;
      const winner = eq(winnerId, bottomA.id) ? bottomA : bottomB;
      const loser  = eq(winnerId, bottomA.id) ? bottomB : bottomA;

      pushLog(`⚔️ Duelo: ${bottomA.name} vs ${bottomB.name} → ${fmtPct(high)} / ${fmtPct(low)}. Se salva <strong>${winner.name}</strong>.`);

      // Marcar eliminado
      setContestants(prev => prev.map(c =>
        eq(c.id, loser.id)
          ? { ...c, status: "eliminado", history: [...c.history, { gala, evento: "Eliminado (duelo público)" }] }
          : c
      ));

      // Guardar resumen
      setSummaries(s => ({
        ...s,
        [gala]: {
          ...(s[gala] || { gala }),
          g12_14: {
            tabla: tabla.map(t => ({ id: t.id, pct: t.pct })),
            duel: { low: bottomA.id, high: bottomB.id, pctWin: Math.max(high, low), pctLose: Math.min(high, low), winner: winner.id }
          }
        }
      }));

      setGstate(st => ({ ...st, g12: { ...G, duelDone: true } }));

      // Reparto SIN % en modo manual
      setSummaries(s => {
        const info = s[gala]?.g12_14;
        if (!info || !s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;

        const lowId     = bottomA.id;
        const highId    = bottomB.id;
        const winnerId2 = winner.id;
        const loserId2  = eq(winnerId2, lowId) ? highId : lowId;

        const gElim  = contestants.find(x => eq(x.id, loserId2))?.gender ?? "e";
        const sufNum = gElim === "m" ? "º" : gElim === "f" ? "ª" : "º/ª";
        const puesto = gala === 14 ? `6${sufNum} Finalista`
                      : gala === 15 ? `5${sufNum} Finalista`
                      : `4${sufNum} Finalista`;

        const rep = s[gala][gala].reparto.map(row => {
          const id = row.members[0];
          if (id == null) return row;

          const g   = contestants.find(x => eq(x.id, id))?.gender ?? "e";
          const suf = g === "m" ? "o" : g === "f" ? "a" : "e";

          if (eq(id, loserId2))                 return { ...row, valor: `${puesto}` };
          if (eq(id, lowId) || eq(id, highId))  return { ...row, valor: `Duelo` };
          return { ...row, valor: `Salvad${suf} por el público` };
        });

        return { ...s, [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } } };
      });

      setStage("galaCerrada");
      return;
    }

    // ===== AUTOMÁTICO =====
    const { bottomLow, bottomHigh } = G;
    if (!bottomLow || !bottomHigh) { pushLog("⚠️ No hay duelistas definidos para el modo automático.", gala); return; }

    const duelPcts = audiencePercentages([bottomHigh.id, bottomLow.id], contestants, Math.random, 4, popularityEnabled);
    const high = Math.max(...duelPcts), low = Math.min(...duelPcts);
    const winner = duelPcts[0] > duelPcts[1] ? bottomHigh : bottomLow;
    const loser  = winner.id === bottomLow.id ? bottomHigh : bottomLow;

    pushLog(`🔴 ${fmtPct(bottomHigh.pct)} pertenece a <strong>${bottomHigh.name}</strong> (nominado al duelo).`);
    pushLog(`🔴 ${fmtPct(bottomLow.pct)} pertenece a <strong>${bottomLow.name}</strong> (nominado al duelo).`);
    pushLog(`⚔️ Duelo: ${bottomHigh.name} vs ${bottomLow.name} → ${fmtPct(high)} / ${fmtPct(low)}. Se salva <strong>${winner.name}</strong>.`);

    setContestants(prev => prev.map(c =>
      eq(c.id, loser.id)
        ? { ...c, status: "eliminado", history: [...c.history, { gala, evento: "Eliminado (duelo público)" }] }
        : c
    ));

    setSummaries(s => ({
      ...s,
      [gala]: {
        ...(s[gala] || { gala }),
        g12_14: {
          tabla: G.tabla.map(t => ({ id: t.id, pct: t.pct })),
          duel: { low: bottomLow.id, high: bottomHigh.id, pctWin: high, pctLose: low, winner: winner.id }
        }
      }
    }));

    setGstate(st => ({ ...st, g12: { ...G, duelDone: true } }));

    // Reparto con % en automático
    setSummaries(s => {
      const info = s[gala]?.g12_14;
      if (!info || !s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;

      const tablaPct = Object.fromEntries(info.tabla.map(t => [t.id, t.pct]));
      const lowId    = info.duel.low;
      const highId   = info.duel.high;
      const winnerId = info.duel.winner;
      const loserId  = (winnerId === lowId ? highId : lowId);

      const gElim  = contestants.find(x => eq(x.id, loserId))?.gender ?? "e";
      const sufNum = gElim === "m" ? "º" : gElim === "f" ? "ª" : "º/ª";
      const puesto = gala === 14 ? `6${sufNum} Finalista`
                    : gala === 15 ? `5${sufNum} Finalista`
                    : `4${sufNum} Finalista`;

      const rep = s[gala][gala].reparto.map(row => {
        const id = row.members[0];
        if (id == null || tablaPct[id] == null) return row;

        const g   = contestants.find(x => eq(x.id, id))?.gender ?? "e";
        const suf = g === "m" ? "o" : g === "f" ? "a" : "e";
        const pct = tablaPct[id];

        if (eq(id, loserId))                 return { ...row, valor: `${puesto} (${pct.toFixed(2)}%)` };
        if (eq(id, lowId) || eq(id, highId)) return { ...row, valor: `Duelo (${pct.toFixed(2)}%)` };
        return { ...row, valor: `Salvad${suf} por el público (${pct.toFixed(2)}%)` };
      });

      return { ...s, [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } } };
    });

    setStage("galaCerrada");
  }



  // Final (G17) – revelado por pasos
  function g15_setup(){
    const enJuego=contestants.filter(c=>c.status==="finalista");
    if(enJuego.length!==3){ pushLog("⚠️ En la final deben quedar 3 finalistas."); return; }
    const pcts=audiencePercentages(enJuego.map(c => c.id), contestants, Math.random, 4, popularityEnabled);
    const tabla=enJuego.map((c,i)=>({id:c.id,name:c.name,pct:pcts[i]})).sort((a,b)=>b.pct-a.pct);
    pushLog(`🏁 <strong>Gala 17 – Final</strong>: porcentajes ciegos ${tabla.map(t=>fmtPct(t.pct)).join(" · ")}.`);
    setGstate(st=>({...st, g15:{ tabla, thirdRevealed:false, winnerRevealed:false }}));
    setGstate(st => ({ ...st, publicReveal: createPublicReveal(tabla, "final", 2) }));
    setViewGala(gala);
    setStage("publicReveal");

  }
    function g15_revealThird(currentState = gstate, automatic = false) {
      if (!currentState?.g15) { pushLog("⚠️ Primero pulsa '📊 Mostrar porcentajes ciegos (Final)'."); return; }
      if (currentState.g15.thirdRevealed) { pushLog("ℹ️ El tercer clasificado ya fue revelado."); return; }

      const tabla = currentState.g15.tabla || [];
      const eq = (a,b) => String(a) === String(b);
      const nameFromTabla = (id) => (tabla.find(t => eq(t.id, id))?.name) || nameOf(id) || String(id);

      // —— MANUAL: eliges 3º/3ª (no tocamos el reparto aquí) ——
      if (manual && !automatic) {
        const ids = tabla.map(t => t.id);
        const terceroId = pickManually(ids, false, nameFromTabla, "Elige al 3º/3ª Finalista");
        if (!terceroId) return;

        setGstate(st => ({ ...st, g15: { ...st.g15, thirdId: terceroId, thirdRevealed: true }}));
        pushLog(`🥉 Tercer clasificado: <strong>${nameFromTabla(terceroId)}</strong>.`);
        return;
      }

      // —— Automático: tampoco tocamos reparto aquí ——
      const tercero = tabla[2];
      setGstate(st => ({ ...st, g15: { ...st.g15, thirdId: tercero?.id, thirdRevealed: true }}));
      pushLog(`🥉 Tercer clasificado: <strong>${tercero.name}</strong>.`);
    }


    function g15_revealWinner(currentState = gstate, automatic = false) {
      if (!currentState?.g15) { pushLog("⚠️ Primero pulsa '📊 Mostrar porcentajes ciegos (Final)'."); return; }
      if (!currentState.g15.thirdRevealed) { pushLog("⚠️ Primero revela el tercer clasificado."); return; }
      if (currentState.g15.winnerRevealed) { pushLog("ℹ️ El ganador ya fue revelado."); return; }

      const tabla = currentState.g15.tabla || [];
      const eq = (a,b) => String(a) === String(b);
      const nameFromTabla = (id) => (tabla.find(t => eq(t.id, id))?.name) || nameOf(id) || String(id);
      const thirdId = currentState.g15.thirdId ?? tabla[2]?.id;

    // —— MODO MANUAL: eliges ganador entre los 2 restantes ——
    if (manual && !automatic) {
      const tabla = currentState.g15.tabla || [];
      const eq = (a,b) => String(a) === String(b);
      const nameFromTabla = (id) => (tabla.find(t => eq(t.id, id))?.name) || nameOf(id) || String(id);

      const thirdId = currentState.g15.thirdId ?? tabla[2]?.id;
      const restantes = tabla.map(t => t.id).filter(id => !eq(id, thirdId));
      if (restantes.length !== 2) { pushLog("⚠️ No hay 2 finalistas restantes para elegir ganador."); return; }

      const winnerId = pickManually(restantes, false, nameFromTabla, "Revela al Ganador/a");
      if (!winnerId) return;
      const secondId = restantes.find(id => !eq(id, winnerId));

      pushLog(`👑 Ganador/a del simulador: <strong>${nameFromTabla(winnerId)}</strong>.`);
      pushLog(`🥈 <strong>${nameFromTabla(secondId)}</strong> queda 2º/ª Finalista.`);

      // Marca ganador en contestants
      setContestants(prev =>
        prev.map(c => eq(c.id, winnerId)
          ? { ...c, status: "ganador", history: [...(c.history||[]), { gala, evento: "Ganador/a (G17)" }] }
          : c
        )
      );

      // Guarda en summaries (tabla + third + winner/second)
      setSummaries(s => ({
        ...s,
        [gala]: {
          ...(s[gala] || { gala }),
          g15: {
            tabla: tabla.map(t => ({ id: t.id, pct: t.pct })),
            third: thirdId,
            winner: winnerId,
            second: secondId
          }
        }
      }));

      // ✅ Reescribe de GOLPE las tres celdas del reparto (sin conservar lo anterior)
      setSummaries(s => {
        if (!s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;

        const pctMap = Object.fromEntries(tabla.map(t => [t.id, t.pct]));
        const rep = s[gala][gala].reparto.map(row => {
          const id = row.members[0];
          if (id == null) return row;

          const c = contestants.find(x => eq(x.id, id));
          if (!c) return row;

          // etiquetas con género
          const g = c.gender ?? "e";
          const ganadorTxt = g === "m" ? "Ganador" : g === "f" ? "Ganadora" : "Ganadore";
          const suf2 = g === "m" ? "2º" : g === "f" ? "2ª" : "2º/ª";
          const suf3 = g === "m" ? "3er" : g === "f" ? "3ª" : "3º/ª";

          // winner > second > third (prioridad explícita) y SIN arrastrar valor previo
          if (eq(id, winnerId)) return { ...row, valor: `${ganadorTxt} (${(pctMap[id] ?? 0).toFixed(2)}%)` };
          if (eq(id, secondId)) return { ...row, valor: `${suf2} Finalista` };
          if (eq(id, thirdId))  return { ...row, valor: `${suf3} Finalista` };

          return row; // demás filas intactas
        });

        return {
          ...s,
          [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } }
        };
      });

      setGstate(st => ({ ...st, g15: { ...st.g15, winnerRevealed: true }}));
      setStage("galaCerrada");
      return;
    }


      // —— AUTOMÁTICO: igual que antes, pero también pintamos todo en un solo paso ——
      const ganador = tabla[0];
      const segundo = tabla[1];
      const tercero = tabla[2];

      pushLog(`👑 Ganador/a del simulador: <strong>${ganador.name}</strong>.`);

      setContestants(prev =>
        prev.map(c => c.id === ganador.id
          ? { ...c, status: "ganador", history: [...c.history, { gala, evento: "Ganador/a (G17)" }] }
          : c
        )
      );

      setSummaries(s => ({
        ...s,
        [gala]: { ...(s[gala] || { gala }), g15: { tabla: tabla.map(t => ({ id: t.id, pct: t.pct })), third: tercero.id, winner: ganador.id, second: segundo.id } }
      }));

      setSummaries(s => {
        if (!s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;
        const pctMap = Object.fromEntries(tabla.map(t => [t.id, t.pct]));

        const rep = s[gala][gala].reparto.map(row => {
          const id = row.members[0];
          if (id == null) return row;
          const c  = contestants.find(x => x.id === id);
          if (!c) return row;

          const g  = c.gender ?? "e";
          const ganadorTxt = g === "m" ? "Ganador" : g === "f" ? "Ganadora" : "Ganadore";
          const suf2 = g === "m" ? "2º" : g === "f" ? "2ª" : "2º/ª";
          const suf3 = g === "m" ? "3er" : g === "f" ? "3ª" : "3º/ª";

          if (id === ganador.id) return { ...row, valor: `${ganadorTxt} (${(pctMap[id] ?? 0).toFixed(2)}%)` };
          if (id === segundo.id) return { ...row, valor: `${suf2} Finalista` };
          if (id === tercero.id) return { ...row, valor: `${suf3} Finalista` };
          return row;
        });

        return { ...s, [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } } };
      });

      setGstate(st => ({ ...st, g15: { ...st.g15, winnerRevealed: true }}));
      setStage("galaCerrada");
    }




  return (
    <div className="min-w-0 px-1 py-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <img
          src="/LogoOT2005_Negro.png"
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

          <OTRosterPicker roster={roster} onChange={updateRoster} onStart={iniciar} />
          <StaffSetup staff={staff} setStaff={setStaff} judgeNames={judgeNames} setJudgeNames={setJudgeNames} />
          <AddSong onAdd={(song,previous)=>{setSongs(old=>[...new Set([...old.filter(title=>title!==previous),song.title])]);setSongsMeta(old=>({...old,exact:{...old.exact,[song.title]:song}}));}} />
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
      {academyBlocked && !academyChat && !academyWeek && academyReparto.length>0 && !summaries[gala]?.distributionReady && (manual || gala!==0) && <SongDistribution key={`distribution-${gala}`} reparto={academyReparto} groupSong={summaries[gala]?.[gala]?.groupSong} contestants={contestants} songs={songs} manual={manual} nominees={carryNominees.filter(id=>academyReparto.some(row=>row.members.includes(id)))} soloOnly={gala===0} direct={gala===0} onConfirm={(reparto,groupSong)=>setSummaries(s=>({...s,[gala]:{...s[gala],distributionReady:true,[gala]:{...s[gala]?.[gala],reparto,groupSong}}}))} />}
      {academyBlocked && !academyChat && (academyWeek || summaries[gala]?.distributionReady || (!manual && gala===0)) && <AcademyWeek week={academyWeek} reparto={academyReparto} groupSong={summaries[gala]?.[gala]?.groupSong}
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

              {gala <= 11 && (
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

            {stage === "votoPublico" && !gstate?.top3Shown && (
              <Button onClick={iniciarVotoPublico} disabled={gstate?.top3Shown}>
                🎤 Presentar favoritos
              </Button>
            )}
            {gstate.top3?.length > 0 && stage === "votoPublico" && (
              gstate.favoriteRevealed ? (
                <></>
              ) : (
                <Button onClick={revelarTop3YFavorito}>
                  {(gstate.top3RevealCount ?? (gstate.top3NamesRevealed ? 3 : 0)) < 3 ? "⭐ Revelar siguiente favorito" : "🌟 Revelar al favorito de la semana"}
                </Button>
              )
            )}

            {/* 👇 FALTA ESTE: valoración del jurado */}


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

              {gala===12 && (
                <div className="flex flex-wrap gap-2">
                      {/* 👇 Nuevo flujo en 3 pasos para el duelo previo a G12 */}
                  {stage==="dueloPendiente" && (
                    <Button onClick={iniciarDueloCiego}>Llega el momento de la verdad</Button>
                  )}
                  {stage==="duelo_ciegos" && (
                    <Button onClick={dueloMostrarFrase}>🗣️ Mostrar frase del presentador</Button>
                  )}
                  {stage==="duelo_revelar" && (
                    <Button onClick={dueloRevelar}>⚔️ Revelar salvado y eliminado</Button>
                  )}
                  {stage==="gala10_jueces" && (<><Button onClick={() => gala10PuntuarJueces(false)}>🧮 Puntuar jurado (G{shownGala(12)})</Button><Button variant="outline" onClick={() => gala10PuntuarJueces(true)}>Revelar todo</Button></>)}
                  {stage==="gala10_profes" && (<Button onClick={() => startCeremony("teachers", gstate.nominados, "specialTeachers")}>🎓 Profesores eligen 4º finalista</Button>)}
                  {stage==="gala10_compas" && (<Button onClick={() => startCeremony("peers", gstate.nominados, "specialPeers", contestants.filter(c => c.status === "finalista").map(c => c.id))}>🧑‍🤝‍🧑 Compañeros eligen 5º finalista</Button>)}
                  {stage==="galaCerrada" && (<Button onClick={goNext}>⏭️ Cerrar gala y pasar a la siguiente</Button>)}
                </div>
              )}

              {gala===13 && (
                <div className="flex flex-wrap gap-2">
                  {stage==="gala11_publico" && !gstate?.g11 && (
                  <Button onClick={g11_iniciarCiegos}>Llega el momento de la verdad</Button>
                )}
                {stage==="gala11_publico" && gstate?.g11 && !gstate.g11.sentence && (
                  <Button onClick={g11_mostrarFrase}>🗣️ Mostrar frase del presentador</Button>
                )}
                {stage==="gala11_publico" && gstate?.g11?.sentence && !gstate.g11.done && (
                  <Button onClick={g11_revelar}>🏆 Revelar salvado (6.º finalista)</Button>
                )}

                  {stage==="galaCerrada" && (<Button onClick={goNext}>⏭️ Cerrar gala y pasar a la siguiente</Button>)}
                </div>
              )}

              {gala>=14 && gala<=16 && (
                <div className="flex flex-wrap gap-2">
                  {stage==="g12_14_publico" && !gstate?.g12 && (
                    <Button onClick={g12_setup}>📊 Mostrar porcentajes ciegos</Button>
                  )}
                  {stage==="g12_14_publico" && gstate?.g12 && gstate.g12.revealQueue?.length>0 && (
                    <Button onClick={g12_revealNext}>🔍 Revelar porcentaje → concursante</Button>
                  )}
                  {stage==="g12_14_publico" && gstate?.g12 && gstate.g12.revealQueue?.length===0 && !gstate.g12.duelDone && (
                    <Button onClick={() => g12_duel()}>⚔️ Resolver duelo</Button>
                  )}
                  {stage==="galaCerrada" && (<Button onClick={goNext}>⏭️ Cerrar gala y pasar a la siguiente</Button>)}
                </div>
              )}

              {gala>=17 && (
                <div className="flex flex-wrap gap-2">
                  {stage==="g15_final" && !gstate?.g15 && (<Button onClick={g15_setup}>📊 Mostrar porcentajes ciegos (Final)</Button>)}
                  {stage==="g15_final" && gstate?.g15 && !gstate.g15.thirdRevealed && (<Button onClick={() => g15_revealThird()}>🥉 Revelar tercer clasificado</Button>)}
                  {stage==="g15_final" && gstate?.g15 && gstate.g15.thirdRevealed && !gstate.g15.winnerRevealed && (<Button onClick={() => g15_revealWinner()}>👑 Revelar ganador</Button>)}
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
                            const {isNom,isFav} = contestantFlags(c,gala,summaries,carryNominees);
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
                    <RepechageReveal songs={songs} manual={manual} onDistribution={repechage.setDistribution} state={repechage.state} contestants={contestants} favoriteId={gstate.favoritoId} onNext={repechage.advance} />
                  ) : stage === "publicReveal" && gstate.publicReveal && viewGala === gala ? (
                    <PublicReveal reveal={gstate.publicReveal} contestants={contestants} manual={manual}
                      duelResult={summaries[gala]?.g12_14?.duel} onSelect={selectPublicIdentity} onNext={advancePublicReveal} />
                  ) : stage === "scoreReveal" && gstate.scoreReveal && viewGala === gala ? (
                    <ScoreReveal judges={academy.judges} reveal={gstate.scoreReveal} contestants={contestants}
                      onNext={advanceScoreReveal} onRevealAll={() => applyScoreResults(gstate.scoreReveal.pending)} />
                  ) : stage === "ceremony" && gstate.ceremony && viewGala === gala ? (
                    <SaveCeremony ceremony={{ ...gstate.ceremony, tie: gstate.peerTie }} contestants={contestants}
                      winnerId={gstate.ceremony.kind === "duel" ? (gstate.ceremony.source === "finalDuel" ? summaries[gala]?.g11?.winner : summaries[gala]?.duel?.winner)
                        : gstate.ceremony.kind === "teachers" ? summaries[gala]?.profesorSalvoId : gstate.salvadoCompanerosId}
                      onNext={advanceCeremony} onContinue={continueCeremony} onRevealAll={revealAllPeerVotes} />
                  ) : stage === "votoPublico" && gstate.top3Shown && viewGala === gala ? (
                    <FavoriteReveal performances={summaries[gala]?.performances} state={gstate} contestants={contestants} onContinue={() => {setStage("juradoEvaluando");setViewGala(gala);}} />
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
                        : contestantFlags(c,gala,summaries,carryNominees).isNom
                        ? "border-orange-500" // 🔶 Nominad@
                        : contestantFlags(c,gala,summaries,carryNominees).isFav
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
                        const favoriteSummary = summaries[viewGala];
                        const favoritePercent = favoriteSummary?.favoritePct ?? (favoriteSummary?.top3Pct?.length ? Math.max(...favoriteSummary.top3Pct) : undefined);
                        const favoriteSuffix = contestants.find(c=>c.id===id)?.gender === 'f' ? 'a' : contestants.find(c=>c.id===id)?.gender === 'm' ? 'o' : 'e';
                        const rawValor = favoriteSummary?.favoritoId === id
                          ? `Favorit${favoriteSuffix} del Público${Number.isFinite(favoritePercent) ? ` (${favoritePercent.toFixed(2)}%)` : ''}`
                          : viewGala === 8 && summaries[8]?.falseNominees
                          ? suspendedNominationLabel(id,summaries[8],contestants,gala===8 ? gstate.publicRank : [])
                          : viewGala === 9 ? returnPerformanceLabel(id,summaries[9],contestants,valores[idx] || valores[0] || "") : valores[idx] || valores[0] || "";
                        const valor = viewGala >= 1 && viewGala <= 11 ? currentGalaLabel(rawValor,id,summaries[viewGala]) : rawValor;
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
              <h2 className="text-xl font-semibold">{showBestPerformances ? "Top 10 de mejores actuaciones" : showRelationships ? "Tabla de Relaciones" : showPopularity ? "Tabla de Popularidad" : "Recorrido del concurso"}</h2>
              {seasonFinished && <label className="w-full text-sm sm:hidden">Tabla
                <select aria-label="Elegir tabla" className="mt-1 w-full rounded-lg border p-2" value={showBestPerformances?'performances':showRelationships?'relationships':showPopularity?'popularity':'journey'} onChange={e=>{setShowBestPerformances(e.target.value==='performances');setShowRelationships(e.target.value==='relationships');setShowPopularity(e.target.value==='popularity');}}>
                  <option value="journey">Recorrido</option><option value="popularity">Popularidad</option><option value="relationships">Relaciones</option><option value="performances">Top 10 actuaciones</option>
                </select>
              </label>}
              {seasonFinished && <Button className="hidden sm:inline-flex" variant="outline" onClick={() => { setShowRelationships(false); setShowBestPerformances(false); setShowPopularity(v => !v); }}>{showPopularity ? "Ver recorrido" : "Tabla de Popularidad"}</Button>}
              {seasonFinished && <Button className="hidden sm:inline-flex" variant="outline" onClick={() => { setShowBestPerformances(false); setShowPopularity(false); setShowRelationships(v => !v); }}>{showRelationships ? "Ver recorrido" : "Tabla de Relaciones"}</Button>}
              {seasonFinished && <Button className="hidden sm:inline-flex" variant="outline" onClick={()=>{setShowRelationships(false);setShowPopularity(false);setShowBestPerformances(v=>!v);}}>{showBestPerformances ? "Ver recorrido" : "Top 10 actuaciones"}</Button>}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={onDownloadRecorrido}>
                  ⬇️ Descargar tabla
                </Button>
              </div>
            </div>
            {showBestPerformances && seasonFinished ? <BestPerformances weeks={academy.weeks} summaries={summaries} contestants={contestants} repechageEnabled={repechageEnabled} /> : showRelationships && seasonFinished ? <RelationshipsTable repechageEnabled={repechageEnabled} contestants={contestants} summaries={summaries} relations={academy.relationships} pairs={academy.pairs} /> : showPopularity && seasonFinished ? <PopularityTable repechageEnabled={repechageEnabled} contestants={contestants} summaries={summaries} /> : <RecorridoTable repechageEnabled={tableRepechageEnabled} contestants={contestants} summaries={summaries} />}
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
    ganador:   (g) => byGender(g, { m:"Ganador",   f:"Ganadora",  e:"Ganadore"  }),
  };

  // Acceso al género de un concursante por id
  const getGender = (id) => contestants.find(c => c.id === id)?.gender ?? "e";

  const headers=["Concursante", "Gala 0", ...visibleGalas(17,repechageEnabled).slice(1).map(g=>g===17?"Gala Final":`Gala ${displayGala(g,repechageEnabled)}`)];
  const cellStyle=(bg,color="#000")=>({ background:bg, color, padding:"0px 6px", border:"1px solid #ddd", fontSize:12, textAlign:"center", whiteSpace:"nowrap" });
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
  if (g15 && winnerId) {
    const topIds=[winnerId, secondId, thirdId].filter(Boolean);
    const topThree=aliveOnly.filter(c=>topIds.includes(c.id));
    const aliveOthers=aliveOnly
      .filter(c=>!topIds.includes(c.id))
      .sort((a,b)=>normName(a.name).localeCompare(normName(b.name)));
    const order=new Map([[winnerId,0],[secondId,1],[thirdId,2]].filter(([k])=>k));
    topThree.sort((a,b)=>(order.get(a.id)??99)-(order.get(b.id)??99));
    sorted=[...topThree, ...aliveOthers, ...eliminatedOnly];
    } else {
      // ya vienen alfabéticos
      sorted=[...aliveOnly, ...eliminatedOnly];
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


    for(const g of visibleGalas(17,repechageEnabled).slice(1)){
      let text="—", style=cellStyle("#eee","#555");
      const elimGala = eliminationGalas.includes(g) ? g : null;
      const special = repechageCell(c,summaries,g);
      if (special) { cells.push({text:special.split ? <SplitJourneyCell parts={special.parts} /> : special.text,style:{...cellStyle(special.background,special.color || '#111'),...(special.split?{padding:0}:{})}}); continue; }
      if (absentAfterElimination(c,summaries,g)) { cells.push({ text: "—", style: cellStyle("#ccc", "#666") }); continue; }
      if (elimGala !== null && g === elimGala) {
        const gnd = getGender(c.id);
        if (g >= 14 && g <= 16) {
          // 6º (G14) · 5º (G15) · 4º (G16) — “º” si es él, “ª” si es ella o elle
          const n   = g === 14 ? "6" : g === 15 ? "5" : "4";
          const suf = gnd === "m" ? "º" : "ª";
          cells.push({ text: `${n}${suf} Finalista`, style: cellStyle("sienna", "#fff") });
        } else {
          cells.push({ text: lbl.eliminado(gnd), style: cellStyle("red", "#fff") });
        }
        continue;
      }

      const s=summaries[g]; if(!s){ cells.push({text,style}); continue; }

      if (g <= 11) {
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

      else if (g === 12) {
        const g10 = s.g10;
        if (g10?.sumas) {
          const sum = g10.sumas[c.id];
          if (typeof sum === "number") {
            const nota = `Nota: ${(sum / 4).toFixed(2)}`;
            const topId = Object.entries(g10.sumas).sort((a,b)=>b[1]-a[1])[0][0];

            if (c.id === topId)                     { text = nota; style = cellStyle("DodgerBlue", "#fff"); }
            else if ((g10.top3 || []).includes(c.id)) { text = nota; style = cellStyle("#fff", "#111"); }
            else if (g10.cuarto === c.id)            { text = nota; style = cellStyle("yellowgreen", "#111"); }
            else if (g10.quinto === c.id)            { text = nota; style = cellStyle("khaki", "#111"); }
            else if ((g10.restantes || []).includes(c.id) || (g10.nominados4 || []).includes(c.id)) {
              text = nota; style = cellStyle("orange", "#111");
            } else {
              text = nota; style = cellStyle("#fff", "#111");
            }
          }
        }
      }

      else if (g === 13) {
        const g11 = s.g11;
        if (g11) {
          const gnd = getGender(c.id);

          if (g11.winner === c.id) {
            text = "Finalista";                           // dejamos "Finalista" sin flexión
            style = cellStyle("lightblue", "#000");
          } else if (g11.a === c.id || g11.b === c.id) {
            const win = c.id === g11.winner;
            text  = win ? "Finalista" : lbl.eliminado(gnd); // Eliminado/Eliminada/Eliminade
            style = win ? cellStyle("lightblue", "#000") : cellStyle("red", "#fff");
          } else {
            text = "Finalista";
            style = cellStyle("lightblue", "#000");
          }
        }
      }

      else if (g >= 14 && g <= 16) {
        const gX = s.g12_14;
        if (gX) {
          const d   = gX.duel;                         // { low, high, pctWin, pctLose, winner }
          const gnd = getGender(c.id);                 // "m" | "f" | "e"
          const loserId = d.winner === d.low ? d.high : d.low;

          if (c.id === loserId) {
            // 6º (G14) · 5º (G15) · 4º (G16) — “º” si es él, “ª” si es ella o elle
            const n    = g === 14 ? "6" : g === 15 ? "5" : "4";
            const suf  = gnd === "m" ? "º" : "ª";
            text  = `${n}${suf} Finalista`;
            style = cellStyle("sienna", "#fff");
          } else if (c.id === d.low || c.id === d.high) {
            // Estuvo en duelo pero se salvó
            text  = "Duelo";
            style = cellStyle("orange", "#111");
          } else {
            // Salvado/Salvada/Salvade
            text  = lbl.salvado(gnd);
            style = cellStyle("#fff", "#111");
          }
        }
      }



      else if (g === 17) {
        const gX = s.g15;
        if (gX) {
          const gnd = getGender(c.id);

          if (gX.winner === c.id) {
            // Ganador/Ganadora/Ganadore
            text  = lbl.ganador(gnd);
            style = cellStyle("gold", "#111");
          } else if (gX.third === c.id) {
            // 3er/3ª Finalista
            text  = ord3(gnd) + " Finalista";
            style = cellStyle("#cd7f32", "#fff");
          } else {
            // 2º/2ª Finalista
            text  = ord2(gnd) + " Finalista";
            style = cellStyle("silver", "#111");
          }
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
                {headers.map((h, i) => (
                  <th
                    colSpan={i===0 ? 2 : 1}
                    key={i}
                    style={{
                      position: "sticky", // luego lo desactivamos temporalmente
                      top: 0,
                      background: "#fafafa",
                      border: "1px solid #ddd",
                      padding: 6,
                      fontSize: 12,
                    }}
                  >
                    {h}
                  </th>
                ))}
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
