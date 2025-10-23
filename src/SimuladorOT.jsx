import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toPng } from 'html-to-image';
import OTRosterPicker from "./components/OTRosterPicker";


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
      if (g === 2)  return { trios:2, duos:5,  solos:0  };
      if (g === 3)  return { trios:1, duos:5,  solos:0  };
      if (g === 4)  return { trios:1, duos:4,  solos:1  };
      if (g === 5)  return { trios:1, duos:3,  solos:2  };
      if (g === 6)  return { trios:0, duos:4,  solos:2  };
      if (g === 7)  return { trios:0, duos:3,  solos:3  };
      if (g === 8)  return { trios:0, duos:2,  solos:4  };
      if (g === 9)  return { trios:0, duos:1,  solos:5  };
      if (g === 10) return { trios:0, duos:0,  solos:6  };
      if (g === 11) return { trios:0, duos:0,  solos:5  };
      if (g === 12 || g === 13) return { trios:0, duos:0, solos:Infinity };
      if (g === 14) return { trios:0, duos:2,  solos:Infinity };
      if (g === 15) return { trios:0, duos:0,  solos:Infinity };
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
        if (galaNum <= 9) {
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

      // 3) Reglas específicas de la GALA 10
      if (galaNum === 10) {
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

      // 2) Si NO es finalista pero está entre los nominados que pasan a G11
      if (nominadosG11.has(id)) {
        const g = getG(id), sufG = suf(g);
        const prefix = parts.length ? parts.join(" > ") + " > " : "";
        return `${prefix}Propuest${sufG} por el jurado > Nominad${sufG}`;
      }
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

// 2) En Gala 14: cada persona repite su PRIMER valor en todas sus filas
if (galaNum === 14) {
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

export default function SimuladorOT() {
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
  const clearTypedList = () => {
    setNamesInput("");           // vacía el textarea
    setPendingRealRoster(null);  // opcional: limpia plantillas importadas
  };


  // 🆕 Nuevo estado para las canciones
  const [songs, setSongs] = useState([]);
  const [songsReady, setSongsReady] = useState(false);
  const [songsMeta, setSongsMeta] = useState({}); // { title -> {afinacion, baile, presencia, emocion} }

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

  const pushLog = (entry, galaNum=gala)=> setGalaLogs(logs=>({...logs,[galaNum]:[...(logs[galaNum]||[]), entry]}));
  const nameOf = (id)=> contestants.find(x=>x.id===id)?.name ?? "?";
  const nextStageFor = (num) => num<=9? (carryNominees.length===2?"dueloPendiente":"votoPublico") : num===10? (carryNominees.length===2?"dueloPendiente":"gala10_jueces") : num===11?"gala11_publico" : num<=14?"g12_14_publico":"g15_final";

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
        } else {
          // G12–G15: solo finalistas (y en G15 también valdrá “ganador” si ya lo marcas)
          vivos = pool.filter(c => c.status === "finalista" || c.status === "ganador");
        }

        setGstate({
          publicRank: [], top3: [], top3Pct: undefined, favoritoId: undefined, top3Shown: false,
          evaluacionOrden: shuffle(vivos.map(v => v.id)), evalResults: [], salvados: new Set(),
          nominados: [], profesorSalvoId: undefined, votosCompaneros: [], salvadoCompanerosId: undefined,
          currentEvaluadoId: undefined, currentEvaluadoLogIndex: undefined, g12: undefined, g15: undefined
        });

        const activosIds = vivos.map(c => c.id);
        const nominadosDuelo = (num >= 2 ? [...carryNominees] : []);
        const repartoBase = buildRepartoParaGala(num, activosIds, nominadosDuelo);
        const reparto = buildRepartoConCanciones({
            galaNum: num,
            reparto: repartoBase,
            summaries,
            allSongs: songs,
          });
      // ✅ Guardado de la nueva gala: arrastra solo duelSaved de la anterior
      setSummaries(s => {
        const prev = s[num - 1];                      // gala anterior
        const duelSaved = prev?.duelSaved || {};      // traer el "salvado por el público (%)"

        return {
          ...s,
          [num]: {
            ...(s[num] || { gala: num }),
            duelSaved,                                // pasar a la nueva gala

            // aquí se guarda también el reparto (temas de la gala nueva)
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

      // G12–G14: 6º/5º/4º Finalista
      if ((galaNum === 12 || galaNum === 13 || galaNum === 14) &&
          /\b(6|5|4)(º|ª)?\b/.test(v) && has("finalista")) {
        return { bg: "sienna", fg: "#fff" };
      }

      // ——— G10 finales específicos ———
      if (galaNum === 10 && has("finalista") && has("por los profesores"))
        return { bg: "yellowgreen", fg: "#111" };
      if (galaNum === 10 && has("finalista") && has("por los compañeros"))
        return { bg: "khaki", fg: "#111" };

      // Propuestos/Nominados sin ser finalistas (evita pisar los finalistas)
      if (has("propuest") && has("nominad") && !has("finalista"))
        return { bg: "orange", fg: "#111" };

      // Colores de propuesta con salvado (aplican también si no es G10-finalista)
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

      let decision;
      if (needDoubt <= 0)               decision = "entra";
      else if (remaining === needDoubt) decision = "duda";
      else                              decision = Math.random() < 0.20 ? "duda" : "entra";

      if (decision === "duda") doubt.add(id); else entered.add(id);

      const nextIdx = idx + 1;

      // 1) Actualiza estado (sin logs dentro)
      setGstate(prev => ({ ...prev, g0: { ...st, entered, doubt, idx: nextIdx } }));

      // 2) Escribe logs UNA sola vez
      if (decision === "duda") pushLog(`⚠️ ${nameOf(id)} queda <em>EN DUDA</em>.`, 0);
      else                      pushLog(`🎤 ${nameOf(id)} entra directamente a la Academia.`, 0);

      if (nextIdx >= order.length) {
        pushLog(`✅ En duda: ${Array.from(doubt).map(nameOf).join(", ")}.`, 0);
        setStage("g0_profes");
      }
    }

    function g0_profesSalvan(){
      const st = gstate?.g0; if(!st) return;
      const candidatos = Array.from(st.doubt);
      if (candidatos.length !== 4 && candidatos.length !== 3) {
        pushLog("⚠️ Aún no hay 4 en duda para que decidan los profesores."); return;
      }
      const elegido = pickRandom(candidatos,1)[0];
      pushLog(`🎓 Profesores salvan a <strong>${nameOf(elegido)}</strong> (entra).`);
      setGstate(stAll => {
        const entered = new Set(st.entered); entered.add(elegido);
        const doubt   = new Set(st.doubt);   doubt.delete(elegido);
        return { ...stAll, g0:{ ...st, entered, doubt, profesSaved: elegido } };
      });
      setStage("g0_publico");
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
      setStage(nextStageFor(gala));
    }


  // Galas 1–9
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
        writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → <strong>NOMINADO/A</strong>.`);
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
        writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → <strong>NOMINADO/A</strong>.`);
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
        writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → <strong>NOMINADO/A</strong>.`);
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
        writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → <strong>NOMINADO/A</strong>.`);
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



    function profesoresSalvanUno(){
        if(!gstate || gstate.nominados.length!==4) return;

        const salvado = pickRandom(gstate.nominados,1)[0];
        pushLog(`🎓 Profesores salvan a <strong>${nameOf(salvado)}</strong>.`);

        const nominados = gstate.nominados.filter(id=>id!==salvado);
        const salvados  = new Set(gstate.salvados); salvados.add(salvado);

        setGstate({...gstate, profesorSalvoId: salvado, nominados, salvados});

        // 1) Guardar S de la gala con el "profesorSalvoId"
        setSummaries(s => ({
          ...s,
          [gala]: { ...(s[gala] || { gala }), profesorSalvoId: salvado, juradoNominados: s[gala]?.juradoNominados || gstate.nominados }
        }));

        // 2) 💡 Recalcular la tabla de reparto de esta gala
        setSummaries(s => {
          const Sact = {
            ...s,
            [gala]: {
              ...(s[gala] || { gala }),
              profesorSalvoId: salvado,
              juradoNominados: s[gala]?.juradoNominados || gstate.nominados,
              top3Ids: s[gala]?.top3Ids || [],   // 👈 también aquí
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

  // Gala 10
    function gala10PuntuarJueces(){
      // Activos deben ser 7
      const vivos = contestants.filter(c => c.status === "active");
      if (vivos.length !== 7) { pushLog("⚠️ Para la Gala 10 deben quedar exactamente 7 activos."); return; }

      // ---- 1) Contar nominaciones por concursante en Galas 1–9
      const countNominaciones = (id) => {
        let n = 0;
        for (let g = 1; g <= 9; g++) {
          const s = summaries[g];
          if (!s) continue;
          if ((s.juradoNominados || []).includes(id)) n++;
        }
        return n;
      };

      const nomCounts = Object.fromEntries(vivos.map(c => [c.id, countNominaciones(c.id)]));
      const maxNoms   = Math.max(0, ...Object.values(nomCounts)); // 0 si todos 0
      const DEBUG_G10 = false;     // para ocultar/mostrar "📊 G10 bias debug"
      const SHOW_G10_SUMMARY = false; // para ocultar/mostrar "📊 Gala 10 – Sumas del jurado"

      if (DEBUG_G10) {
        pushLog(`📊 G10 bias debug: ${vivos.map(c => `${nameOf(c.id)} → ${nomCounts[c.id] || 0} nominaciones`).join(" · ")}`);
      }

      // helper para redondear a medios puntos
      const toHalf = (x) => Math.round(x * 2) / 2;

      // ---- 2) Puntuar con sesgo positivo a quien tenga menos nominaciones
      //       bonus por juez = biasMax * favor * (0.75..1.25)
      //       donde favor = (maxNoms - nomCount) / maxNoms   (si maxNoms=0, favor=0)
      //const biasMax = 0.8; // máximo ~0.8 puntos de bonus por juez

      // ---- 2) Puntuar con sesgo positivo a quien tenga menos nominaciones (versión percentil)
      const scores = {};  // id -> [n1,n2,n3,n4]
      const sumas  = {};  // id -> suma

      // Orden por MENOS nominaciones (para percentil con empates)
      const vivosOrdenNomsAsc = [...vivos].sort((a,b) => (nomCounts[a.id]||0) - (nomCounts[b.id]||0));

      // Calibración del sesgo (ajusta si quieres afinar)
      const MU_MIN = 6.50;   // media mínima esperable (muchas nominaciones)
      const MU_MAX = 9.50;   // media máxima esperable (cero nominaciones)
      const DEV    = 0.60;   // dispersión alrededor de la media (±DEV)
      const ALPHA  = 0.75;   // mezcla hacia la media sesgada (0..1). 0.75 = sesgo claro

      const jitterSigned = (range) => (Math.random()*2 - 1) * range; // uniforme [-range, +range]

      vivos.forEach(c => {
        // percentil por pocas nominaciones: 0 = más nominaciones (peor), 1 = menos nominaciones (mejor)
      const pos  = vivosOrdenNomsAsc.findIndex(x => x.id === c.id);      // 0..len-1 (0 = menos nominaciones)
      const perc = (pos + 0.5) / vivosOrdenNomsAsc.length;               // 0..1
      const favor = 1 - perc;                                            // 🔁 INVERTIMOS: 1 = menos noms, 0 = más

      // media "objetivo": menos nominaciones → más cerca de MU_MAX
      const muTarget = MU_MIN + favor * (MU_MAX - MU_MIN);               // ✅ dirección correcta


        // 4 jueces: cada nota = mezcla de base + (media sesgada) + ruido, a pasos de 0.5
        const notas = [0,0,0,0].map(() => {
          const base   = randomHalfStep(5,10);              // tu base 5.0..10.0
          const mix    = base*(1-ALPHA) + muTarget*ALPHA;   // mezcla hacia sesgo
          const noisy  = mix + jitterSigned(DEV);           // ruido ±DEV
          return toHalf(clamp(noisy, 5, 10));
        });

        scores[c.id] = notas;
        sumas[c.id]  = +(notas.reduce((a,b)=>a+b,0)).toFixed(2);
      });

      // ---- 3) Ordenar, logs y estados como antes
      const orden   = [...vivos].sort((a,b)=> sumas[b.id] - sumas[a.id]);
      const top3    = orden.slice(0,3);
      const bottom4 = orden.slice(3); // ← estos son los 4 "propuestos del jurado" de G10

      const th = `<tr><th>Concursante</th><th>Juez 1</th><th>Juez 2</th><th>Juez 3</th><th>Juez 4</th><th>Total</th></tr>`;
      const rows = orden.map(c=>{
        const n = scores[c.id];
        return `<tr><td>${c.name}</td><td>${n[0].toFixed(1)}</td><td>${n[1].toFixed(1)}</td><td>${n[2].toFixed(1)}</td><td>${n[3].toFixed(1)}</td><td><strong>${sumas[c.id].toFixed(2)}</strong></td></tr>`;
      }).join("");

      pushLog(`📋 Desglose jurado (G10):<div style="overflow:auto;"><table style="border-collapse:collapse;"><thead>${th}</thead><tbody>${rows}</tbody></table></div>`);

      // marca estado de finalista en contestants para los top3
      setContestants(prev => prev.map(c => 
        top3.some(t=>t.id===c.id)
          ? { ...c, status:"finalista", history:[...c.history,{gala,evento:"Finalista por jurado (G10)"}] }
          : c
      ));

      if (SHOW_G10_SUMMARY) {
        pushLog(`📊 <strong>Gala 10</strong> – Sumas del jurado: ${orden.map((x,i)=>`${i+1}. ${x.name} (${sumas[x.id].toFixed(2)})`).join(" · ")}.`);
      }
      pushLog(`👑 Finalistas por jurado (G10): <strong>${top3.map(t=>t.name).join(", ")}</strong>. Nominados (4): ${bottom4.map(t=>t.name).join(", ")}.`);

      // ✅ usa setGstate funcional para no pisar campos previos
      setGstate(prev => ({ 
        ...prev,
        g10_scores: scores,
        g10_sumas:  sumas,
        nominados:  bottom4.map(b=>b.id)
      }));

      // Etiquetado adicional para reparto de la G10 (solo top3 → Finalista)
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
                // Ojo: SOLO añadimos para top3. (Para 4º/5º y nominados a G11
                // lo construye rellenarValoracionesReparto con la lógica ya puesta.)
                return `Salvad${suf} por el jurado > Finalista`;
              }
              return row.valor || "";
            }).reduce((acc, v, i) => acc || v, row.valor) // conserva si ya había
          };
        });

        return { ...s, [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } } };
      });

      // ✅ Guarda la "foto" de G10 en summaries:
      //    - g10.sumas/top3/nominados4
      //    - juradoNominados = los 4 bottom (fuente para "Propuesto > Nominado" y para deducir
      //      los 2 que pasan a G11 restando los finalistas cuando más tarde salven profes/compis)
      setSummaries(s => ({
        ...s,
        [gala]: { 
          ...(s[gala] || { gala }),
          // ← IMPORTANTÍSIMO para la lógica de etiquetas:
          juradoNominados: bottom4.map(t => t.id),

          g10: {
            ...(s[gala]?.g10 || {}),
            sumas,
            top3: top3.map(t=>t.id),
            nominados4: bottom4.map(t=>t.id),
            cuarto: "",         // se rellenará en gala10_profes
            quinto: "",         // se rellenará en gala10_compas
            restantes: []       // opcional, por si lo usas después
          }
        }
      }));

      setStage("gala10_profes");
    }

  function gala10Profes(){ if(!gstate || !gstate.nominados || gstate.nominados.length!==4) return; const salvado=pickRandom(gstate.nominados,1)[0]; setContestants(prev=>prev.map(c=>c.id===salvado?{...c,status:"finalista",history:[...c.history,{gala,evento:"4º finalista (profes, G10)"}]}:c)); pushLog(`🎓 Profesores eligen 4º finalista (G10): <strong>${nameOf(salvado)}</strong>.`); const restantes=gstate.nominados.filter(id=>id!==salvado); setGstate({...gstate, nominados:restantes, profesorSalvoId:salvado}); setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), g10:{ ...(s[gala]?.g10||{}), cuarto:salvado, restantes } }})); setStage("gala10_compas"); }
  
  function gala10Compas(){
    if (!gstate) return;

    const electores  = contestants.filter(c => c.status === "finalista").map(c => c.id);
    const candidatos = gstate.nominados; // deben ser 3 ids
    if (!Array.isArray(candidatos) || candidatos.length !== 3) {
      pushLog("⚠️ No hay 3 nominados para la votación de compañeros (G10).");
      return;
    }

    // 1) Emisión de votos
    const votos = [];
    electores.forEach(v => {
      const elegido = pickRandom(candidatos, 1)[0];
      votos.push({ voterId: v, votedId: elegido });
    });

    // 2) Lista de votos
    const votosList = votos.map(v => `<li>${nameOf(v.voterId)} → ${nameOf(v.votedId)}</li>`).join("");
    pushLog(`🧑‍🤝‍🧑 Votación de compañeros (G10):<ul style="margin:4px 0 0 16px;">${votosList}</ul>`);

    // 3) Recuento inicial
    const recuento = { [candidatos[0]]:0, [candidatos[1]]:0, [candidatos[2]]:0 };
    votos.forEach(v => recuento[v.votedId]++);
    pushLog(`📊 Recuento de votos (compañeros, G10): ${
      candidatos.map(id => `<strong>${nameOf(id)}</strong> ${recuento[id]}`).join(" · ")
    }`);

    // 4) Empate en cabeza → privilegio +1 del finalista con mejor nota del jurado en G10
    let max = Math.max(...candidatos.map(id => recuento[id]));
    let empatados = candidatos.filter(id => recuento[id] === max);

    if (empatados.length > 1) {
      const sumas = (summaries?.[gala]?.g10?.sumas) ?? gstate?.g10_sumas ?? null;
      if (sumas) {
        const electorPrivilegiado = [...electores].sort((a,b) => {
          const sa = typeof sumas[a] === "number" ? sumas[a] : -Infinity;
          const sb = typeof sumas[b] === "number" ? sumas[b] : -Infinity;
          if (sb !== sa) return sb - sa;                // mayor suma primero
          return String(a).localeCompare(String(b));    // desempate estable
        })[0];

        const suVoto = votos.find(v => v.voterId === electorPrivilegiado)?.votedId;
        if (suVoto && empatados.includes(suVoto)) {
          recuento[suVoto] += 1; // +1 SOLO en caso de empate y si su voto está entre los empatados
          pushLog(`🏅 Desempate: mejor nota del jurado en G10 (${nameOf(electorPrivilegiado)}) otorga +1 a <strong>${nameOf(suVoto)}</strong>.`);
        }
        // recalcular por si rompimos el empate
        max = Math.max(...candidatos.map(id => recuento[id]));
        empatados = candidatos.filter(id => recuento[id] === max);
      }
    }

    // 5) Recuento final
    pushLog(`📊 Recuento final (compañeros, G10): ${
      candidatos.map(id => `<strong>${nameOf(id)}</strong> ${recuento[id]}`).join(" · ")
    }`);

    // 6) Ganador (si persiste empate, azar entre empatados)
    const ganador = (empatados.length > 1) ? pickRandom(empatados, 1)[0] : empatados[0];
    if (!ganador) { pushLog("⚠️ No se pudo determinar el 5º finalista por compañeros."); return; }

    // 7) Marcar 5º finalista
    setContestants(prev => prev.map(c => c.id === ganador ? {
      ...c,
      status: "finalista",
      history: [...(c.history || []), { gala, evento: "5º finalista (compañeros, G10)" }]
    } : c));
    pushLog(`✅ Más votado por compañeros: <strong>${nameOf(ganador)}</strong> (5º finalista).`);
    pushLog(`✅ Más votado por compañeros: <strong>${nameOf(ganador)}</strong> (5º finalista).`);
      setSummaries(s => ({
        ...s,
        [10]: {
          ...(s[10] || { gala: 10 }),
          salvadoCompanerosId: ganador
        }
        }));

    // 8) Preparar duelo para G11 (quedan 2 nominados)
    const nominadosRestantes = candidatos.filter(id => id !== ganador);
    const salvadosSet = new Set(gstate.salvados); salvadosSet.add(ganador);

    setGstate({
      ...gstate,
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
          // los que siguen “vivos” como nominados tras G10 (irán a G11)
          restantes: candidatos.filter(id => id !== ganador)
        }
      }
    }));
    pushLog(`🟥 Nominados para la próxima gala: <strong>${nameOf(nominadosRestantes[0])}</strong> vs <strong>${nameOf(nominadosRestantes[1])}</strong>.`);
    setCarryNominees(nominadosRestantes);

    setSummaries(prev => rellenarValoracionesReparto(10, prev, contestants));


    // 9) Cambiar etapa → mostrará el botón "Cerrar gala..."
    setStage("galaCerrada");
  }




    function g11_iniciarCiegos(){
      if(carryNominees.length!==2){ pushLog("⚠️ En Gala 11 deben quedar 2 no-finalistas."); return; }
      const [a,b]=carryNominees;
      const { high, low } = randomDuelPercents();
      const highForA = Math.random()<0.5;
      const pctA = highForA?high:low;
      const pctB = highForA?low:high;
      const winner = pctA>pctB ? a : b;
      const loser  = winner===a ? b : a;

      setGstate(st=>({...st, g11:{ a,b,pctA,pctB,winner,loser, sentence:false, done:false }}));
      pushLog(`📊 Porcentajes ciegos (G11): ${fmtPct(pctA)} · ${fmtPct(pctB)}.`);
    }

    function g11_mostrarFrase(){
      const P = gstate?.g11; if(!P){ pushLog("⚠️ Primero muestra los porcentajes ciegos."); return; }
      const savedPct = Math.max(P.pctA, P.pctB);
      pushLog(`🗣️ <em>La audiencia ha decidido qué debe proseguir su formación en la academia con un (${savedPct.toFixed(1)}%)… y convertirse en el último/a finalista...</em>`);
      setGstate(st=>({...st, g11:{ ...st.g11, sentence:true }}));
    }

    function g11_revelar(){
      const P = gstate?.g11; if(!P){ pushLog("⚠️ No hay paquete preparado."); return; }
      const { a,b,pctA,pctB,winner,loser } = P;

      // Estado real
      setContestants(prev=>prev.map(c=>
        c.id===winner ? { ...c, status:"finalista", history:[...c.history,{gala,evento:"6º finalista (público, G11)"}] } :
        c.id===loser  ? { ...c, status:"eliminado", history:[...c.history,{gala,evento:"Eliminado (G11)"}] } : c
      ));

      pushLog(`🗳️ <strong>${nameOf(winner)}</strong>. ${nameOf(loser)} es eliminado/a.`);
      const seis = contestants.filter(c=> (c.id===winner?true:c.status==="finalista")).map(c=>c.name);
      pushLog(`✅ Finalistas anunciados: ${seis.join(", ")}.`);

      // Persistencia + etiquetado de reparto (idéntico a tu flujo, solo movido aquí)
      setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), g11:{ a,b,pctA,pctB,winner } }}));

      setCarryNominees([]);
      // Etiqueta “Valoración” de la gala 11 como ya hacías
      setSummaries(s => {
        if (!s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;
        const pctMap = { [a]: pctA, [b]: pctB };
        const rep = s[gala][gala].reparto.map(row => {
          const id = row.members[0]; // en G11 son solos
          const c  = contestants.find(x => x.id === id);
          if (!c) return row;
          const g  = c.gender ?? "e";
          const suf = g==="m"?"o":g==="f"?"a":"e";

          // Ya-finalistas → "Finalista"
          if (c.status === "finalista" && id !== winner) {
            return { ...row, valor: "Finalista" };
          }
          // Ganador del duelo → "Salvado por el público (%) > Finalista"
          if (id === winner) {
            const pct = pctMap[id];
            return { ...row, valor: `Salvad${suf} por el público (${pct.toFixed(2)}%) > Finalista` };
          }
          // Eliminado → "Expulsado por el público (%)"
          if (id === loser) {
            const pct = pctMap[id];
            return { ...row, valor: `Expulsad${suf} por el público (${pct.toFixed(2)}%)` };
          }
          return row;
        });
        return { ...s, [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } } };
      });

      setGstate(st=>({...st, g11:{ ...st.g11, done:true }}));
      setStage("galaCerrada");
    }


  // Gala 11
  function gala11Publico(){
    if(carryNominees.length!==2){ pushLog("⚠️ En Gala 11 deben quedar 2 no-finalistas."); return; }
    const [a,b]=carryNominees;
    const { high, low } = randomDuelPercents();
    const highForA = Math.random()<0.5;
    const pctA = highForA?high:low;
    const pctB = highForA?low:high;
    const winner = pctA>pctB ? a : b;
    const loser  = winner===a ? b : a;
    setContestants(prev=>prev.map(c=>
      c.id===winner ? { ...c, status:"finalista", history:[...c.history,{gala,evento:"6º finalista (público, G11)"}] } :
      c.id===loser  ? { ...c, status:"eliminado", history:[...c.history,{gala,evento:"Eliminado (G11)"}] } : c
    ));
    pushLog(`🏆 Resultado público (G11): ${nameOf(a)} ${fmtPct(pctA)} · ${nameOf(b)} ${fmtPct(pctB)} → Se salva <strong>${nameOf(winner)}</strong>.`);
    const seis = contestants.filter(c=> (c.id===winner?true:c.status==="finalista")).map(c=>c.name);
    pushLog(`✅ Finalistas anunciados: ${seis.join(", ")}.`);
    setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), g11:{ a,b,pctA,pctB,winner } }}));
    setCarryNominees([]);
    // Etiquetar reparto de la G11
    setSummaries(s => {
      if (!s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;

      // pcts por id
      const pctMap = { [a]: pctA, [b]: pctB };
      const rep = s[gala][gala].reparto.map(row => {
        const id = row.members[0]; // en G11 son solos
        const c  = contestants.find(x => x.id === id);
        if (!c) return row;
        const g  = c.gender ?? "e";
        const suf = g==="m"?"o":g==="f"?"a":"e";

        // Ya-finalistas → "Finalista"
        if (c.status === "finalista" && id !== winner) {
          return { ...row, valor: "Finalista" };
        }

        // Ganador del duelo de G11 → "Salvado por el público (%) > Finalista"
        if (id === winner) {
          const pct = pctMap[id];
          return { ...row, valor: `Salvad${suf} por el público (${pct.toFixed(2)}%) > Finalista` };
        }

        // Eliminado en G11 → "Expulsado por el público (%)"
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
  function g12_setup(){
    const enJuego=contestants.filter(c=>c.status==="finalista");
    if(enJuego.length<3){ pushLog("⚠️ Deben quedar al menos 3 finalistas para 12–14."); return; }
    const pcts=randomPercentages(enJuego.length);
    const tabla=enJuego.map((c,i)=>({id:c.id,name:c.name,pct:pcts[i]})).sort((a,b)=>b.pct-a.pct);
    const onlyPcts=tabla.map(t=>fmtPct(t.pct));
    const revealQueue=shuffle(tabla.map(t=>t.id));
    const bottom2=[...tabla].slice(-2).sort((a,b)=>a.pct-b.pct); // low then high
    setGstate(st=>({...st, g12:{ tabla, revealQueue, revealed:new Set(), bottomLow:bottom2[0], bottomHigh:bottom2[1], duelDone:false }}));
    pushLog(`📊 <strong>Gala ${gala}</strong> – Porcentajes ciegos: ${onlyPcts.join(" · ")}.`);
  }
  function g12_revealNext(){
    if(!gstate?.g12){ return; }
    const { revealQueue, revealed, tabla } = gstate.g12;
    if(revealQueue.length===0){ pushLog("ℹ️ Ya se revelaron todos los porcentajes."); return; }
    const id = revealQueue[0];
    const rest = revealQueue.slice(1);
    const it = tabla.find(t=>t.id===id);
    pushLog(`🔎 ${fmtPct(it.pct)} pertenece a <strong>${it.name}</strong>.`);
    const newSet = new Set(Array.from(revealed)); newSet.add(id);
    setGstate(st=>({...st, g12:{ ...st.g12, revealQueue:rest, revealed:newSet }}));
  }
  function g12_duel(){
    if(!gstate?.g12){ return; }
    const { bottomLow, bottomHigh, duelDone } = gstate.g12;
    if(duelDone){ pushLog("ℹ️ Duelo ya resuelto."); return; }
    // ambos últimos son nominados al duelo (ya implícito); ahora revelamos el resultado
    const { high, low } = randomDuelPercents();
    const winner=Math.random()<0.55?bottomHigh:bottomLow; const loser=winner.id===bottomLow.id?bottomHigh:bottomLow;
    pushLog(`🔴 ${fmtPct(bottomHigh.pct)} pertenece a <strong>${bottomHigh.name}</strong> (nominado al duelo).`);
    pushLog(`🔴 ${fmtPct(bottomLow.pct)} pertenece a <strong>${bottomLow.name}</strong> (nominado al duelo).`);
    pushLog(`⚔️ Duelo: ${bottomHigh.name} vs ${bottomLow.name} → ${fmtPct(high)} / ${fmtPct(low)}. Se salva <strong>${winner.name}</strong>.`);
    setContestants(prev=>prev.map(c=> c.id===loser.id?{...c,status:"eliminado",history:[...c.history,{gala,evento:"Eliminado (duelo público)"}]}:c ));
    setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), g12_14:{ tabla:gstate.g12.tabla.map(t=>({id:t.id,pct:t.pct})), duel:{ low:bottomLow.id, high:bottomHigh.id, pctWin:high, pctLose:low, winner:winner.id } } }}));
    setGstate(st=>({...st, g12:{ ...st.g12, duelDone:true }}));
    // Etiquetar reparto G12–G14
    setSummaries(s => {
      const info = s[gala]?.g12_14;
      if (!info || !s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;

      const tablaPct = Object.fromEntries(info.tabla.map(t => [t.id, t.pct]));
      const bottomLowId  = info.duel.low;
      const bottomHighId = info.duel.high;
      const winnerId     = info.duel.winner;
      const loserId      = winnerId === bottomLowId ? bottomHighId : bottomLowId;

      // Puesto del eliminado: 6º (G12), 5º (G13), 4º finalista (G14)
      const gElim = contestants.find(x => x.id === loserId)?.gender ?? "e";
      const sufNum = gElim==="m" ? "º" : gElim==="f" ? "ª" : "º/ª";
      const puesto = gala === 12 ? `6${sufNum} Finalista`
                  : gala === 13 ? `5${sufNum} Finalista`
                  : `4${sufNum} Finalista`;


      const rep = s[gala][gala].reparto.map(row => {
        // filas pueden ser solos; usamos cada miembro si hiciera falta
        const id = row.members[0];
        const g  = contestants.find(x => x.id === id)?.gender ?? "e";
        const suf = g==="m"?"o":g==="f"?"a":"e";
        const pct = tablaPct[id];
        if (id == null || pct == null) return row;

        // Eliminado → puesto + %
        if (id === loserId) {
          return { ...row, valor: `${puesto} (${pct.toFixed(2)}%)` };
        }

        // Los dos bottom (incluyendo al que se salva) → "Duelo (%)"
        if (id === bottomLowId || id === bottomHighId) {
          // Si además es el winner, puedes optar por “Salvado por el público (%)”
          // pero el enunciado pide etiquetar como "Duelo (%)". Dejamos "Duelo (%)".
          return { ...row, valor: `Duelo (${pct.toFixed(2)}%)` };
        }

        // Resto de finalistas → “Salvado por el público (%)”
        return { ...row, valor: `Salvad${suf} por el público (${pct.toFixed(2)}%)` };
      });

      return { ...s, [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } } };
    });

    setStage("galaCerrada");
  }

  // Final (G15) – revelado por pasos
  function g15_setup(){
    const enJuego=contestants.filter(c=>c.status==="finalista");
    if(enJuego.length!==3){ pushLog("⚠️ En la final deben quedar 3 finalistas."); return; }
    const pcts=randomPercentages(3);
    const tabla=enJuego.map((c,i)=>({id:c.id,name:c.name,pct:pcts[i]})).sort((a,b)=>b.pct-a.pct);
    pushLog(`🏁 <strong>Gala 15 – Final</strong>: porcentajes ciegos ${tabla.map(t=>fmtPct(t.pct)).join(" · ")}.`);
    setGstate(st=>({...st, g15:{ tabla, thirdRevealed:false, winnerRevealed:false }}));
  }
  function g15_revealThird(){
    if(!gstate?.g15){ pushLog("⚠️ Primero pulsa '📊 Mostrar porcentajes ciegos (Final)'."); return; }
    if(gstate.g15.thirdRevealed){ pushLog("ℹ️ El tercer clasificado ya fue revelado."); return; }
    const tercero=gstate.g15.tabla[2];
    pushLog(`🥉 Tercer clasificado: <strong>${tercero.name}</strong>.`);
    setGstate(st=>({...st, g15:{ ...st.g15, thirdRevealed:true }}));
  }
  function g15_revealWinner(){
  if(!gstate?.g15){ pushLog("⚠️ Primero pulsa '📊 Mostrar porcentajes ciegos (Final)'."); return; }
  if(!gstate.g15.thirdRevealed){ pushLog("⚠️ Primero revela el tercer clasificado."); return; }
  if(gstate.g15.winnerRevealed){ pushLog("ℹ️ El ganador ya fue revelado."); return; }

  const ganador = gstate.g15.tabla[0];
  pushLog(`👑 Ganador/a del simulador: <strong>${ganador.name}</strong>.`);
  const tercero = gstate.g15.tabla[2];

  // ✅ NUEVO: marca al ganador para que la Plantilla muestre 🏆 Ganador
  setContestants(prev =>
    prev.map(c =>
      c.id === ganador.id
        ? { ...c, status: "ganador", history: [...c.history, { gala, evento: "Ganador/a (G15)" }] }
        : c
    )
  );

  setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), g15:{ tabla:gstate.g15.tabla.map(t=>({id:t.id,pct:t.pct})), third:tercero.id, winner:ganador.id } }}));
  setGstate(st=>({...st, g15:{ ...st.g15, winnerRevealed:true }}));

  // Etiquetar reparto de la Final (G15)
    setSummaries(s => {
      if (!s[gala] || !s[gala][gala] || !s[gala][gala].reparto) return s;
      const tabla = gstate?.g15?.tabla || [];
      const pctMap = Object.fromEntries(tabla.map(t => [t.id, t.pct]));
      const ganadorId = tabla[0]?.id;
      const segundoId = tabla[1]?.id;
      const terceroId = tabla[2]?.id;

      const rep = s[gala][gala].reparto.map(row => {
        const id = row.members[0];
        const g  = contestants.find(x => x.id === id)?.gender ?? "e";
        const pct = pctMap[id];

        // 🏆 Ganador/a/e (sin “Ganadoro”)
        const ganadorTxt = g === "m" ? "Ganador" : g === "f" ? "Ganadora" : "Ganadore";

        if (id === ganadorId) {
          return { ...row, valor: `${ganadorTxt} (${pct.toFixed(2)}%)` };
        }
        if (id === segundoId) {
          // 2º (m), 2ª (f), 2º/ª (no binario)
          const ord2 = g === "m" ? "2º" : g === "f" ? "2ª" : "2º/ª";
          return { ...row, valor: `${ord2} Finalista` };
        }
        if (id === terceroId) {
          // ✅ 3er (m), 3ª (f), 3º/ª (no binario)
          const ord3 = g === "m" ? "3er" : g === "f" ? "3ª" : "3º/ª";
          return { ...row, valor: `${ord3} Finalista` };
        }

        return row;
      });

      return { ...s, [gala]: { ...(s[gala] || { gala }), [gala]: { ...(s[gala]?.[gala] || {}), reparto: rep } } };
    });

  setStage("galaCerrada");
}


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <img
          src="/LogoOT2005_Negro.png"
          alt="Simulador Web de Operación Triunfo"
          className="h-16 sm:h-20 md:h-[6.75rem] w-auto transition-all duration-300"
        />

        <div className="flex gap-2 w-full sm:w-auto">
          {canPickRoster && (
            <Button
              onClick={() => setRoute("selector")}
              className="flex-1 sm:flex-none px-3 py-2 text-sm sm:px-4 sm:py-2 sm:text-base"
            >
              {/* etiqueta corta en móvil, larga en ≥sm */}
              <span className="sm:hidden">Elegir concursantes</span>
              <span className="hidden sm:inline">👥 Elegir concursantes OT</span>
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
            <p className="text-sb text-muted-foreground">Escribe exactamente <strong>18 nombres</strong> (uno por línea) y pulsa <strong>Iniciar</strong>. O bien <strong>elige a tu propio concursante</strong> (¡Asegúrate de dejar espacio en esta lista!)</p>
            <p className="text-sb text-muted-foreground">Puedes también <strong>crear</strong> a tu propio concursante con sus estadísticas propias. Al guardar lo podrás utilizar en este navegador cuando quieras. Si escribes el nombre directamente en esta lista no tendrá estadísticas y podría ser más propenso a la nominación.</p>
            <p className="text-xs text-muted-foreground">Puedes indicar <strong>género</strong> al final: <code>Nombre - el/elle/ella</code>. Si no lo indicas el género será n/b por defecto.</p>
            <Textarea rows={12} value={namesInput} onChange={e=>setNamesInput(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={iniciar}>▶️ Iniciar</Button>
              <Button variant="outline" onClick={clearTypedList}>
                Limpiar lista
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

              {gala <= 9 && (
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

            {stage === "votoPublico" && (
              <Button onClick={iniciarVotoPublico} disabled={gstate?.top3Shown}>
                🧪 Mostrar 3 más votados
              </Button>
            )}
            {gstate.top3?.length > 0 && stage === "votoPublico" && (
              <Button onClick={revelarTop3YFavorito}>✅ Revelar favorito y porcentajes Top3</Button>
            )}

            {/* 👇 FALTA ESTE: valoración del jurado */}
            {stage === "juradoEvaluando" && (
              <Button onClick={evaluarSiguientePorJurado}>⚖️ Evaluar siguiente concursante</Button>
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

              {gala===10 && (
                <div className="flex flex-wrap gap-2">
                      {/* 👇 Nuevo flujo en 3 pasos para el duelo previo a G10 */}
                  {stage==="dueloPendiente" && (
                    <Button onClick={iniciarDueloCiego}>📊 Porcentajes ciegos (previo a G10)</Button>
                  )}
                  {stage==="duelo_ciegos" && (
                    <Button onClick={dueloMostrarFrase}>🗣️ Mostrar frase del presentador</Button>
                  )}
                  {stage==="duelo_revelar" && (
                    <Button onClick={dueloRevelar}>⚔️ Revelar salvado y eliminado</Button>
                  )}
                  {stage==="gala10_jueces" && (<Button onClick={gala10PuntuarJueces}>🧮 Puntuar jurado (G10)</Button>)}
                  {stage==="gala10_profes" && (<Button onClick={gala10Profes}>🎓 Profesores eligen 4º finalista</Button>)}
                  {stage==="gala10_compas" && (<Button onClick={gala10Compas}>🧑‍🤝‍🧑 Compañeros eligen 5º finalista</Button>)}
                  {stage==="galaCerrada" && (<Button onClick={goNext}>⏭️ Cerrar gala y pasar a la siguiente</Button>)}
                </div>
              )}

              {gala===11 && (
                <div className="flex flex-wrap gap-2">
                  {stage==="gala11_publico" && !gstate?.g11 && (
                  <Button onClick={g11_iniciarCiegos}>📊 Porcentajes ciegos (G11)</Button>
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

              {gala>=12 && gala<=14 && (
                <div className="flex flex-wrap gap-2">
                  {stage==="g12_14_publico" && !gstate?.g12 && (
                    <Button onClick={g12_setup}>📊 Mostrar porcentajes ciegos</Button>
                  )}
                  {stage==="g12_14_publico" && gstate?.g12 && gstate.g12.revealQueue?.length>0 && (
                    <Button onClick={g12_revealNext}>🔍 Revelar porcentaje → concursante</Button>
                  )}
                  {stage==="g12_14_publico" && gstate?.g12 && gstate.g12.revealQueue?.length===0 && !gstate.g12.duelDone && (
                    <Button onClick={g12_duel}>⚔️ Resolver duelo</Button>
                  )}
                  {stage==="galaCerrada" && (<Button onClick={goNext}>⏭️ Cerrar gala y pasar a la siguiente</Button>)}
                </div>
              )}

              {gala>=15 && (
                <div className="flex flex-wrap gap-2">
                  {stage==="g15_final" && !gstate?.g15 && (<Button onClick={g15_setup}>📊 Mostrar porcentajes ciegos (Final)</Button>)}
                  {stage==="g15_final" && gstate?.g15 && !gstate.g15.thirdRevealed && (<Button onClick={g15_revealThird}>🥉 Revelar tercer clasificado</Button>)}
                  {stage==="g15_final" && gstate?.g15 && gstate.g15.thirdRevealed && !gstate.g15.winnerRevealed && (<Button onClick={g15_revealWinner}>👑 Revelar ganador</Button>)}
                </div>
              )}

              <Tabs defaultValue="historial">
                <TabsList>
                  <TabsTrigger value="plantilla">👥 Concursantes</TabsTrigger>
                  <TabsTrigger value="historial">🎤 Galas</TabsTrigger>
                </TabsList>
                <TabsContent value="plantilla" className="mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {contestants.map(c=>(
                      <motion.div key={c.id} layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
                        <Card className="border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              {/* Foto en lugar del nombre (con fallback) */}
                              <img
                                src={
                                  (c.photo && c.photo.trim()) ||
                                  photoByName.get(norm(c.name)) ||
                                  "/ot_photos/sinfoto.gif"
                                }
                                alt={c.name}
                                title={c.name}
                                className={`w-14 h-14 rounded-md object-cover bg-white border transition-all duration-500 ${
                                  c.status === "eliminado" ? "grayscale opacity-90" : ""
                                }`}
                              />
                              {/* Badge de estado se mantiene igual */}
                              <div>
                                {c.status === "active"    && (<Badge variant="secondary">En academia</Badge>)}
                                {c.status === "eliminado" && (<Badge variant="destructive">Eliminado/a</Badge>)}
                                {c.status === "finalista" && (<Badge>⭐ Finalista</Badge>)}
                                {c.status === "ganador"   && (<Badge>🏆 Ganador/a</Badge>)}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
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

          <div className="space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-semibold">Estado</h2>
                <div className="space-y-2 text-sm">
                  <div><Badge variant="outline">Activos</Badge> {active.length}</div>
                  <div><Badge variant="outline">Eliminados</Badge> {eliminated.length}</div>
                  <div><Badge variant="outline">Finalistas</Badge> {finalists.length} / 6</div>
                  {carryNominees.length===2 && gala<=9 && (
                    <div className="mt-2">
                      <Badge variant="secondary">🗳️ Nominados en votación</Badge>
                      <div className="text-xs mt-1">{carryNominees.map(id=>nameOf(id)).join(" vs ")}</div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Reglas: Favorito solo hasta <strong>Gala 9</strong>. <strong>Gala 10</strong>: jurado puntúa a 7 → top3 finalistas, 4 nominados → profes 4º, compañeros 5º → a <strong>Gala 11</strong> el público elige 6º. <strong>Gala 12–14</strong>: público decide con porcentajes ciegos y duelo en la misma gala. <strong>Gala 15</strong>: final con 3.</div>
              </CardContent>
            </Card>
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
    ganador:   (g) => byGender(g, { m:"Ganador",   f:"Ganadora",  e:"Ganadore"  }),
  };

  // Acceso al género de un concursante por id
  const getGender = (id) => contestants.find(c => c.id === id)?.gender ?? "e";

  const headers=["Concursante", "Gala 0", ...Array.from({length:15},(_,i)=> (i+1===15?"Gala Final":`Gala ${i+1}`))];
  const cellStyle=(bg,color="#000")=>({ background:bg, color, padding:"4px 6px", border:"1px solid #ddd", fontSize:12, textAlign:"center", whiteSpace:"nowrap" });
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
    }

    for(let g=1; g<=15; g++){
      let text="—", style=cellStyle("#eee","#555");
      if (elimGala !== null && g > elimGala) { cells.push({ text: "—", style: cellStyle("#ccc", "#666") }); continue; }
      if (elimGala !== null && g === elimGala) {
        const gnd = getGender(c.id);
        if (g >= 12 && g <= 14) {
          // 6º (G12) · 5º (G13) · 4º (G14) — “º” si es él, “ª” si es ella o elle
          const n   = g === 12 ? "6" : g === 13 ? "5" : "4";
          const suf = gnd === "m" ? "º" : "ª";
          cells.push({ text: `${n}${suf} Finalista`, style: cellStyle("sienna", "#fff") });
        } else {
          cells.push({ text: lbl.eliminado(gnd), style: cellStyle("red", "#fff") });
        }
        continue;
      }

      const s=summaries[g]; if(!s){ cells.push({text,style}); continue; }

      if (g <= 9) {
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

      else if (g === 10) {
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

      else if (g === 11) {
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

      else if (g >= 12 && g <= 14) {
        const gX = s.g12_14;
        if (gX) {
          const d   = gX.duel;                         // { low, high, pctWin, pctLose, winner }
          const gnd = getGender(c.id);                 // "m" | "f" | "e"
          const loserId = d.winner === d.low ? d.high : d.low;

          if (c.id === loserId) {
            // 6º (G12) · 5º (G13) · 4º (G14) — “º” si es él, “ª” si es ella o elle
            const n    = g === 12 ? "6" : g === 13 ? "5" : "4";
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



      else if (g === 15) {
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
