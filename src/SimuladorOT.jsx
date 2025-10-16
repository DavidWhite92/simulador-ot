import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Utils
const uid = () => Math.random().toString(36).slice(2);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmtPct = (n) => `${n.toFixed(2)}%`;
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

// Baraja valoraciones con reglas:
//  - Nunca más de 2 nominados seguidos
//  - El último nominado sale en penúltima o última posición
function buildValoracionesOrder(allIds, nomineeIds){
  const N = allIds.length;
  const nomSet = new Set(nomineeIds);
  const nom   = nomineeIds.slice();
  const otros = allIds.filter(id => !nomSet.has(id));

  const shuffleInPlace = arr => { for (let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; };
  shuffleInPlace(nom); shuffleInPlace(otros);

  // reservar 1 nominado para penúltima/última
  let slotUlt = Math.random() < 0.5 ? N-1 : N-2;
  if (nom.length === 0) slotUlt = N-1;
  const reservado = nom.length ? nom.pop() : null;

  const order = [];
  let consecNom = 0;
  let nomInFirst3 = 0;

  for (let i = 0; i < N; i++) {
    if (reservado && i === slotUlt) {
      if (consecNom === 2 && otros.length) { order.push(otros.pop()); consecNom = 0; i++; }
      order.push(reservado); consecNom++; if (i < 3) nomInFirst3++;
      continue;
    }

    const earlyCap = (i < 3 && nomInFirst3 >= 1);      // en primeras 3, máx 1 nominable
    const puedeNom = nom.length > 0 && consecNom < 2 && !earlyCap;
    const debeNom  = !earlyCap && otros.length === 0 && nom.length > 0 && consecNom < 2;

    let pick = null;
    if (debeNom || (puedeNom && Math.random() < 0.5)) {
      pick = nom.pop(); consecNom++; if (i < 3) nomInFirst3++;
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
    const raw2=+(45+Math.random()*10).toFixed(2); const { high, low } = randomDuelPercents();
    results.push(Math.abs(high2+low2-100)<1e-9 && high2>=50 && low2<=50?"g11 split ok":"g11 split FAIL");
  }catch(e){ results.push("tests threw: "+String(e)); }
  return results;
}

export default function SimuladorOT(){
  const [namesInput, setNamesInput] = useState(Array.from({length:16},(_,i)=>`Concursante ${i+1}`).join("\n"));
  const [contestants, setContestants] = useState([]);
  const [gala, setGala] = useState(1);
  const [galaLogs, setGalaLogs] = useState({});
  const [viewGala, setViewGala] = useState(1);
  const [carryNominees, setCarryNominees] = useState([]);
  const [stage, setStage] = useState("inicio");
  const [gstate, setGstate] = useState(null);
  const [summaries, setSummaries] = useState({});
  const [testResults, setTestResults] = useState([]);

  useEffect(()=>{ setTestResults(runSelfTests()); },[]);

  const active     = useMemo(()=>contestants.filter(c=>c.status==="active"),[contestants]);
  const finalists = useMemo(
  () => contestants.filter(c => c.status === "finalista" || c.status === "ganador"),
  [contestants]
);

  const eliminated = useMemo(()=>contestants.filter(c=>c.status==="eliminado"),[contestants]);

  const pushLog = (entry, galaNum=gala)=> setGalaLogs(logs=>({...logs,[galaNum]:[...(logs[galaNum]||[]), entry]}));
  const nameOf = (id)=> contestants.find(x=>x.id===id)?.name ?? "?";
  const nextStageFor = (num) => num<=9? (carryNominees.length===2?"dueloPendiente":"votoPublico") : num===10? (carryNominees.length===2?"dueloPendiente":"gala10_jueces") : num===11?"gala11_publico" : num<=14?"g12_14_publico":"g15_final";

  function iniciar(){
    const lines = namesInput.split(/\r?\n/).map(s=>s.trim()).filter(s=>s.length>0);
    if(lines.length !== 16){
      alert(`Hay ${lines.length} nombres. Deben ser exactamente 16, uno por línea (sin líneas vacías).`);
      return;
    }
    
  const inits = lines.map(line=>{
  const { name, gender } = parseNameLine(line);
  return { id:uid(), name, gender, status:"active", history:[] };
});
    try{
      setContestants(inits);
      setGala(1); setViewGala(1);
      setCarryNominees([]); setSummaries({});
      setGalaLogs({1:["🎬 <strong>Comienza el simulador de OT</strong> con 16 concursantes."]});
      prepararNuevaGala(1, inits);
    }catch(e){ console.error(e); alert("Ha ocurrido un error iniciando el simulador. Revisa la consola."); }
  }
  function reiniciar(){ setContestants([]); setGala(1); setViewGala(1); setGalaLogs({}); setCarryNominees([]); setStage("inicio"); setGstate(null); setSummaries({}); }

  function prepararNuevaGala(num, list=contestants){
    const vivos=(list||contestants).filter(c=>c.status==="active");
    setGstate({ publicRank:[], top3:[], top3Pct:undefined, favoritoId:undefined, top3Shown:false, evaluacionOrden:shuffle(vivos.map(v=>v.id)), evalResults:[], salvados:new Set(), nominados:[], profesorSalvoId:undefined, votosCompaneros:[], salvadoCompanerosId:undefined, currentEvaluadoId: undefined, currentEvaluadoLogIndex: undefined, g12:undefined, g15:undefined });
    setViewGala(num); setGalaLogs(p=>({...p,[num]:p[num]||[]})); setStage(nextStageFor(num));
  }
  const goNext = ()=>{ const next=gala+1; setGala(next); prepararNuevaGala(next); };

  // Galas 1–9
  function resolverDueloPendiente(){
    if(carryNominees.length!==2){ setStage(nextStageFor(gala)); return; }
    const [a,b]=carryNominees;
    const base=50+(Math.random()*10-5), widen=Math.random()<0.25?Math.random()*10-5:0; const raw=clamp(base+widen,40,60);
    const { high, low } = randomDuelPercents();
    const assignHigherToA=Math.random()<0.5; const pctA=assignHigherToA?high:low; const pctB=assignHigherToA?low:high;
    const winner=pctA>pctB?a:b; const loser=winner===a?b:a;
    setContestants(prev=> prev.map(c=> c.id===loser?{...c,status:"eliminado",history:[...c.history,{gala,evento:"Eliminado",detalle:`${fmtPct(c.id===a?pctB:pctA)} vs ${fmtPct(c.id===a?pctA:pctB)}`}]}: c ));
    setGstate(st=>({ ...(st||{}), top3Ban:new Set([winner]) }));
    pushLog(`📣 <strong>Resultado nominados</strong>: ${nameOf(a)} ${fmtPct(pctA)} · ${nameOf(b)} ${fmtPct(pctB)} → Se salva <strong>${nameOf(winner)}</strong>.`);
    setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), duel:{a,b,pctA,pctB,winner} }}));
    setCarryNominees([]); setStage(nextStageFor(gala));
  }
  function iniciarVotoPublico(){
    if(!gstate || gstate.top3Shown) return;
    const vivos=contestants.filter(c=>c.status==="active");
    const rands = randomPercentages(vivos.length);
    const ranked=vivos.map((c,i)=>({id:c.id,pct:rands[i]})).sort((a,b)=>b.pct-a.pct);
    const top3Ids=ranked.filter(r=>!(gstate.top3Ban||new Set()).has(r.id)).slice(0,3).map(r=>r.id);
    setGstate({...gstate, publicRank:ranked, top3:top3Ids, top3Shown:true});
    pushLog(`👁️ Top 3 del público (nombres): ${shuffle(top3Ids).map(nameOf).join(" · ")}`);
    setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), top3:top3Ids }}));
  }
  function revelarTop3YFavorito(){
    if(!gstate || gstate.top3.length===0) return; if(gala>=10){ pushLog(`ℹ️ Desde la Gala 10 no hay favorito. Continua con la evaluación del jurado.`); setStage("juradoEvaluando"); return; }
   

    const top3 = gstate.top3.map(id=>gstate.publicRank.find(r=>r.id===id)).filter(Boolean).sort((a,b)=>b.pct-a.pct);
    const favorito=top3[0]; const top3Pct=top3.map(t=>t.pct); const salvados=new Set(gstate.salvados); salvados.add(favorito.id);
    pushLog(`🌟 <strong>Favorito/a</strong>: ${nameOf(favorito.id)}. Porcentajes Top3: ${top3.map(t=>`${nameOf(t.id)} ${fmtPct(t.pct)}`).join(" · ")}`);
    setGstate({...gstate, favoritoId:favorito.id, salvados, top3Pct, finalTwoPlan:undefined});
    setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), top3Pct, favoritoId:favorito.id }}));
    setStage("juradoEvaluando");
  }
  function evaluarSiguientePorJurado(){
      if(!gstate) return;

      // 1) Construir el orden al entrar por primera vez en el jurado (favorito inmune, resto nominable)
      if (!gstate.evaluacionOrden || gstate.evaluacionOrden.length === 0) {
        const vivosIds  = contestants.filter(c => c.status === "active").map(c => c.id);
        const favId     = gstate.favoritoId || null;
        const nomineeIds = favId ? vivosIds.filter(id => id !== favId) : [...vivosIds];

        const ordenValoraciones = buildValoracionesOrder(vivosIds, nomineeIds);

        setGstate(st => ({
          ...st,
          evaluacionOrden: ordenValoraciones,
          currentEvaluadoIndex: 0,
          currentEvaluadoId: null
        }));
        setSummaries(s => ({
          ...s,
          [gala]: { ...(s[gala] || { gala }), ordenValoraciones }
        }));
        return; // el siguiente click ya usa el orden creado
      }

      const vivos = contestants.filter(c => c.status === "active").map(c => c.id);
      const writeAt = (idx, html) =>
        setGalaLogs(prev => { const arr = [ ...(prev[gala] || []) ]; arr[idx] = html; return { ...prev, [gala]: arr }; });

      // 2) Si no hay "actual evaluado", abrir ficha y placeholder
      if (!gstate.currentEvaluadoId) {
        const pend = gstate.evaluacionOrden.filter(id => vivos.includes(id) && !gstate.salvados.has(id) && !gstate.nominados.includes(id));

        // Si no queda nadie por evaluar: completar nominados hasta 4 y pasar de etapa
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

        // Hay alguien por evaluar → abre log “...” y guarda referencia
        const actualId = pend[0];
        const idx = (galaLogs[gala]?.length || 0);
        setGalaLogs(prev => { const arr = [ ...(prev[gala] || []) ]; arr.push(`⚖️ Jurado evalúa a <strong>${nameOf(actualId)}</strong> → …`); return { ...prev, [gala]: arr }; });
        setGstate({ ...gstate, currentEvaluadoId: actualId, currentEvaluadoLogIndex: idx });
        return;
      }

      // 3) Ya hay "actual evaluado": decidir acción y actualizar estado
      const id = gstate.currentEvaluadoId;
      const logIdx = gstate.currentEvaluadoLogIndex ?? (galaLogs[gala]?.length || 1) - 1;

      // reconstruir pendientes (id primero)
      let pend = gstate.evaluacionOrden.filter(x => vivos.includes(x) && !gstate.salvados.has(x) && !gstate.nominados.includes(x));
      if (pend[0] !== id) pend = [ id, ...pend.filter(x => x !== id) ];

      const remaining = pend.length;
      const needed = 4 - gstate.nominados.length;
      let plan = gstate.finalTwoPlan;

      // 3A) Barrera: si ya hay 3 nominados y quedan >2 por evaluar, este va salvado
      if (gstate.nominados.length >= 3 && remaining > 2) {
        writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → cruza la pasarela (salvado/a).`);
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

      // 3B) Plan especial para las dos últimas valoraciones
      if (remaining === 2 && !plan) {
        if (needed >= 2) {
          plan = ["nominado", "nominado"];
        } else if (needed === 1) {
          plan = Math.random() < 0.5 ? ["nominado", "salvado"] : ["salvado", "nominado"];
        } else {
          plan = ["salvado", "salvado"];
        }
      }

      // 3C) Decidir acción con sesgo de salvado al inicio y ventana deslizante
      const evIndex = gstate.evalResults.length;                // cuántos ya evaluados (0 = primero, 1 = segundo, ...)
      const last2   = gstate.evalResults.slice(-2).map(r => r.result);
      let decision;

      if (remaining === needed) {
        decision = "nominado";
      }
      else if (remaining === 2 && plan) {
        decision = plan[0];
      }
      else if (evIndex < 3 && gstate.nominados.length >= 1) {
        // en las 3 primeras valoraciones, como mucho 1 nominado
        decision = "salvado";
      }
      else {
        // ventana deslizante: si en las últimas 3 ya hubo 2 nominados, este va salvado
        const last3 = gstate.evalResults.slice(-3).map(r => r.result);
        const nomsInLast3 = last3.filter(x => x === "nominado").length;
        if (nomsInLast3 >= 2) {
          decision = "salvado";
        } else {
          // prob original por % público
          const votePct  = gstate.publicRank.find(r => r.id === id)?.pct ?? 50;
          const probBase = clamp(0.55 - (votePct - 50) / 150, 0.25, 0.8); // prob de ser NOMINADO

          // ajustes de ritmo
          const ev    = gstate.evalResults.length;
          const total = ev + remaining;
          const ratio = total ? ev / total : 0;
          let prob    = probBase;
          if (ratio < 0.4 && gstate.nominados.length >= 1) prob = Math.max(0.15, prob - 0.2);
          if (ratio < 0.6 && gstate.nominados.length >= 2) prob = Math.max(0.15, prob - 0.25);

          // sesgo de salvado para 1.º y 2.º (más fuerte en galas tempranas)
          const earlyNomBias = (() => {
            if (evIndex === 0) {               // primero
              if (gala <= 3) return -0.28;
              if (gala <= 6) return -0.20;
              return -0.14;
            }
            if (evIndex === 1) {               // segundo
              if (gala <= 3) return -0.18;
              if (gala <= 6) return -0.12;
              return -0.08;
            }
            return 0;
          })();

          prob = clamp(prob + earlyNomBias, 0.05, 0.85);  // reducir prob de NOMINADO para 1.º/2.º
          decision = Math.random() < prob ? "nominado" : "salvado";
        }
      }

      // seguridad: nunca 3 nominados seguidos, PERO respeta el plan de las dos últimas
      const inLastTwo = (remaining <= 2);
      if (!inLastTwo && decision === "nominado" && last2[0] === "nominado" && last2[1] === "nominado") {
        decision = "salvado";
      }

      // Postcondición: que aún sea posible llegar a 4 nominados
      let nomAfter = gstate.nominados.length + (decision === "nominado" ? 1 : 0);
      let remAfter = remaining - 1;
      let needAfter = 4 - nomAfter;
      if (needAfter > remAfter) {
        // si no llegamos a 4, forzamos nominación aquí
        decision = "nominado";
        nomAfter = gstate.nominados.length + 1;
        remAfter = remaining - 1;
      }
      
      // 3D) Aplicar decisión + avanzar plan + sacar de orden
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
        writeAt(logIdx, `⚖️ Jurado evalúa a <strong>${nameOf(id)}</strong> → cruza la pasarela (salvado/a).`);
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

  function profesoresSalvanUno(){ if(!gstate || gstate.nominados.length!==4) return; const salvado=pickRandom(gstate.nominados,1)[0]; pushLog(`🎓 Profesores salvan a <strong>${nameOf(salvado)}</strong>.`); const nominados=gstate.nominados.filter(id=>id!==salvado); const salvados=new Set(gstate.salvados); salvados.add(salvado); setGstate({...gstate, profesorSalvoId:salvado, nominados, salvados}); setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), profesorSalvoId:salvado }})); setStage("companerosVotan"); }
  function companerosVotan(){ if(!gstate) return; const electores=Array.from(gstate.salvados), candidatos=gstate.nominados, votos=[]; electores.forEach(v=>{ votos.push({voterId:v,votedId:pickRandom(candidatos,1)[0]}); }); const recuento=Object.fromEntries(candidatos.map(c=>[c,0])); votos.forEach(v=>recuento[v.votedId]++); let max=Math.max(...Object.values(recuento)); let empatados=Object.entries(recuento).filter(([,n])=>n===max).map(([id])=>id); if(empatados.length>1 && gstate.favoritoId){ const votoFav=votos.find(x=>x.voterId===gstate.favoritoId)?.votedId; if(votoFav && empatados.includes(votoFav)) recuento[votoFav]++; max=Math.max(...Object.values(recuento)); empatados=Object.entries(recuento).filter(([,n])=>n===max).map(([id])=>id); } const ganador=pickRandom(empatados,1)[0]; const votosList = votos.map(v=>`<li>${nameOf(v.voterId)} → ${nameOf(v.votedId)}</li>`).join(""); pushLog(`🧑‍🤝‍🧑 Votación de compañeros:<ul style=\"margin:4px 0 0 16px;\">${votosList}</ul>${gstate.favoritoId?"<div class=\\\"text-xs\\\">* El voto del favorito vale doble en caso de empate</div>":""}`); pushLog(`✅ Más votado por compañeros: <strong>${nameOf(ganador)}</strong> (se salva).`); const nominadosRestantes=candidatos.filter(id=>id!==ganador); const salvados=new Set(gstate.salvados); salvados.add(ganador); setGstate({...gstate, votosCompaneros:votos, salvadoCompanerosId:ganador, nominados:nominadosRestantes, salvados}); setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), salvadoCompanerosId:ganador, finalNominees:nominadosRestantes }})); pushLog(`🟥 Nominados para la próxima gala: <strong>${nameOf(nominadosRestantes[0])}</strong> vs <strong>${nameOf(nominadosRestantes[1])}</strong>.`); setCarryNominees(nominadosRestantes); setStage("galaCerrada"); }

  // Gala 10
  function gala10PuntuarJueces(){
    const vivos=contestants.filter(c=>c.status==="active"); if(vivos.length!==7){ pushLog("⚠️ Para la Gala 10 deben quedar exactamente 7 activos."); return; }
    const scores={}, sumas={}; vivos.forEach(c=>{ const notas=[randomHalfStep(),randomHalfStep(),randomHalfStep(),randomHalfStep()]; scores[c.id]=notas; sumas[c.id]=+(notas.reduce((a,b)=>a+b,0)).toFixed(2); }); const orden=[...vivos].sort((a,b)=>sumas[b.id]-sumas[a.id]); const top3=orden.slice(0,3), bottom4=orden.slice(3);
    const th = `<tr><th>Concursante<\/th><th>Juez 1<\/th><th>Juez 2<\/th><th>Juez 3<\/th><th>Juez 4<\/th><th>Total<\/th><\/tr>`;
    const rows = orden.map(c=>{ const n = scores[c.id]; return `<tr><td>${c.name}<\/td><td>${n[0].toFixed(1)}<\/td><td>${n[1].toFixed(1)}<\/td><td>${n[2].toFixed(1)}<\/td><td>${n[3].toFixed(1)}<\/td><td><strong>${sumas[c.id].toFixed(2)}<\/strong><\/td><\/tr>`; }).join("");
    pushLog(`📋 Desglose jurado (G10):<div style=\"overflow:auto;\"><table style=\"border-collapse:collapse;\"><thead>${th}<\/thead><tbody>${rows}<\/tbody><\/table><\/div>`);
    setContestants(prev=> prev.map(c=> top3.some(t=>t.id===c.id)?{...c,status:"finalista",history:[...c.history,{gala,evento:"Finalista por jurado (G10)"}]}: c ));
    pushLog(`📊 <strong>Gala 10</strong> – Sumas del jurado: ${orden.map((x,i)=>`${i+1}. ${x.name} (${sumas[x.id].toFixed(2)})`).join(" · ")}.`);
    pushLog(`👑 Finalistas por jurado (G10): ${top3.map(t=>t.name).join(", ")}. Nominados (4): ${bottom4.map(t=>t.name).join(", ")}.`);
    setGstate({...gstate, g10_scores:scores, g10_sumas:sumas, nominados:bottom4.map(b=>b.id)});
    setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), g10:{ sumas, top3:top3.map(t=>t.id), nominados4:bottom4.map(t=>t.id), cuarto:"", quinto:"", restantes:[] } }}));
    setStage("gala10_profes");
  }
  function gala10Profes(){ if(!gstate || !gstate.nominados || gstate.nominados.length!==4) return; const salvado=pickRandom(gstate.nominados,1)[0]; setContestants(prev=>prev.map(c=>c.id===salvado?{...c,status:"finalista",history:[...c.history,{gala,evento:"4º finalista (profes, G10)"}]}:c)); pushLog(`🎓 Profesores eligen 4º finalista (G10): <strong>${nameOf(salvado)}</strong>.`); const restantes=gstate.nominados.filter(id=>id!==salvado); setGstate({...gstate, nominados:restantes, profesorSalvoId:salvado}); setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), g10:{ ...(s[gala]?.g10||{}), cuarto:salvado, restantes } }})); setStage("gala10_compas"); }
  function gala10Compas(){ if(!gstate) return; const electores=contestants.filter(c=>c.status==="finalista").map(c=>c.id); const candidatos=gstate.nominados; const votos=[]; electores.forEach(v=>{ const elegido=pickRandom(candidatos,1)[0]; votos.push({voterId:v,votedId:elegido}); }); const recuento={ [candidatos[0]]:0,[candidatos[1]]:0,[candidatos[2]]:0 }; votos.forEach(v=>recuento[v.votedId]++); const max=Math.max(...Object.values(recuento)); const empatados=Object.entries(recuento).filter(([,n])=>n===max).map(([id])=>id); const ganador=pickRandom(empatados,1)[0]; setContestants(prev=>prev.map(c=>c.id===ganador?{...c,status:"finalista",history:[...c.history,{gala,evento:"5º finalista (compañeros, G10)"}]}:c)); pushLog(`🧑‍🤝‍🧑 Compañeros eligen 5º finalista (G10): <strong>${nameOf(ganador)}</strong>. Votos: ${votos.map(v=>`${nameOf(v.voterId)} → ${nameOf(v.votedId)}`).join(" · ")}`); const restantes=candidatos.filter(id=>id!==ganador); setCarryNominees(restantes); pushLog(`➡️ A <strong>Gala 11</strong>: el público decide el 6º finalista entre ${restantes.map(nameOf).join(" y ")}.`); setSummaries(s=>({...s,[gala]:{ ...(s[gala]||{gala}), g10:{ ...(s[gala]?.g10||{}), quinto:ganador, restantes } }})); setStage("galaCerrada"); }

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
  setStage("galaCerrada");
}


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Simulador web de Operación Triunfo</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>{ const data={ fecha:new Date().toISOString(), galaActual:gala, concursantes:contestants, registros:galaLogs, resumenes:summaries }; const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="simulador-ot.json"; a.click(); URL.revokeObjectURL(url); }}>⬇️ Exportar</Button>
          <Button variant="outline" onClick={reiniciar}>🔄 Reiniciar</Button>
        </div>
      </div>

      {contestants.length===0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Escribe exactamente 16 nombres (uno por línea) y pulsa <strong>Iniciar</strong>.</p>
            <p className="text-xs text-muted-foreground">Puedes indicar género al final: <code>Nombre - él</code> / <code>Nombre - ella</code> / <code>Nombre - elle</code></p>
            <Textarea rows={12} value={namesInput} onChange={e=>setNamesInput(e.target.value)} />
            <div className="flex gap-2"><Button onClick={iniciar}>▶️ Iniciar</Button></div>
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

              {gala<=9 && (
                <div className="flex flex-wrap gap-2">
                  {stage==="dueloPendiente" && (<Button onClick={resolverDueloPendiente}>⚖️ Resolver duelo de nominados</Button>)}
                  {stage==="votoPublico" && (<Button onClick={iniciarVotoPublico} disabled={!!gstate?.top3Shown}>👁️ Mostrar 3 más votados</Button>)}
                  {gstate?.top3?.length>0 && stage==="votoPublico" && (<Button onClick={revelarTop3YFavorito}>✅ Revelar favorito y porcentajes Top3</Button>)}
                  {stage==="juradoEvaluando" && (
                    <div className="flex flex-wrap gap-2">
                      {!gstate?.currentEvaluadoId ? (
                        <Button onClick={evaluarSiguientePorJurado}>⚖️ Evaluar siguiente concursante</Button>
                      ) : (
                        <Button onClick={evaluarSiguientePorJurado}>⏱️ Revelar ya</Button>
                      )}
                    </div>
                  )}
                  {stage==="profesSalvan" && (<Button onClick={profesoresSalvanUno}>🎓 Profesores salvan 1</Button>)}
                  {stage==="companerosVotan" && (<Button onClick={companerosVotan}>🧑‍🤝‍🧑 Votan compañeros</Button>)}
                  {stage==="galaCerrada" && (<Button onClick={goNext}>⏭️ Cerrar gala y pasar a la siguiente</Button>)}
                </div>
              )}

              {gala===10 && (
                <div className="flex flex-wrap gap-2">
                  {stage==="dueloPendiente" && (<Button onClick={resolverDueloPendiente}>⚖️ Resolver duelo de nominados (previo a G10)</Button>)}
                  {stage==="gala10_jueces" && (<Button onClick={gala10PuntuarJueces}>🧮 Puntuar jurado (G10)</Button>)}
                  {stage==="gala10_profes" && (<Button onClick={gala10Profes}>🎓 Profesores eligen 4º finalista</Button>)}
                  {stage==="gala10_compas" && (<Button onClick={gala10Compas}>🧑‍🤝‍🧑 Compañeros eligen 5º finalista</Button>)}
                  {stage==="galaCerrada" && (<Button onClick={goNext}>⏭️ Cerrar gala y pasar a la siguiente</Button>)}
                </div>
              )}

              {gala===11 && (
                <div className="flex flex-wrap gap-2">
                  {stage==="gala11_publico" && (<Button onClick={gala11Publico}>🗳️ Revelar resultado del público (G11)</Button>)}
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
                  <TabsTrigger value="plantilla">👥 Plantilla</TabsTrigger>
                  <TabsTrigger value="historial">📜 Registro</TabsTrigger>
                </TabsList>
                <TabsContent value="plantilla" className="mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {contestants.map(c=>(
                      <motion.div key={c.id} layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
                        <Card className="border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{c.name}</div>
                              <div>
                                {c.status==="active" && (<Badge variant="secondary">En academia</Badge>)}
                                {c.status==="eliminado" && (<Badge variant="destructive">Eliminado</Badge>)}
                                {c.status==="finalista" && (<Badge>⭐ Finalista</Badge>)}
                                {c.status==="ganador" && (<Badge>🏆 Ganador</Badge>)}
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
                    {Array.from({length:gala},(_,i)=>i+1).map(g=>(
                      <Button key={g} size="sm" variant={g===viewGala?"default":"outline"} onClick={()=>setViewGala(g)}>Gala {g}</Button>
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
                  {testResults.length>0 && (
                    <div className="text-xs text-muted-foreground">Tests: {testResults.join(" · ")}</div>
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

      {Object.keys(summaries).length>0 && (
        <Card>
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recorrido del concurso</h2>
              <Badge variant="outline">Provisional hasta Gala 15</Badge>
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

  const headers=["Concursante", ...Array.from({length:15},(_,i)=> (i+1===15?"Gala Final":`Gala ${i+1}`))];
  const cellStyle=(bg,color="#000")=>({ background:bg, color, padding:"4px 6px", border:"1px solid #ddd", fontSize:12, textAlign:"center", whiteSpace:"nowrap" });

  const g15 = summaries[15]?.g15, winnerId=g15?.winner, thirdId=g15?.third, secondId=g15 ? [...g15.tabla].sort((a,b)=>b.pct-a.pct)[1]?.id : undefined;
  const eliminatedOnly = contestants.filter(c => c.status === "eliminado").sort((a,b) => { const ga=a.history.find(h=>h.evento?.startsWith?.("Eliminado"))?.gala ?? 0; const gb=b.history.find(h=>h.evento?.startsWith?.("Eliminado"))?.gala ?? 0; return gb-ga; });
  const aliveOnly = contestants.filter(c => c.status !== "eliminado");

  let sorted;
  if (g15 && winnerId) {
    const topIds=[winnerId, secondId, thirdId].filter(Boolean);
    const topThree=aliveOnly.filter(c=>topIds.includes(c.id));
    const aliveOthers=aliveOnly.filter(c=>!topIds.includes(c.id));
    const order=new Map([[winnerId,0],[secondId,1],[thirdId,2]].filter(([k])=>k));
    topThree.sort((a,b)=>(order.get(a.id)??99)-(order.get(b.id)??99));
    sorted=[...topThree, ...aliveOthers, ...eliminatedOnly];
  } else sorted=[...aliveOnly, ...eliminatedOnly];

  const rows = sorted.map(c=>{
    const cells=[{text:c.name, style:cellStyle("#fff","#111") }];
    const elimGala=c.history.find(h=>h.evento?.startsWith?.("Eliminado"))?.gala ?? null;
    for(let g=1; g<=15; g++){
      let text="—", style=cellStyle("#eee","#555");
      if(elimGala && g>elimGala){ cells.push({text:"—", style:cellStyle("#ccc","#666")}); continue; }
      if (elimGala && g === elimGala) {const gnd = getGender(c.id); cells.push({ text: lbl.eliminado(gnd), style: cellStyle("red", "#fff") }); continue;}
      const s=summaries[g]; if(!s){ cells.push({text,style}); continue; }

      if (g <= 9) {
        const inTop3    = (s.top3 || []).includes(c.id);
        const favorito  = s.favoritoId;
        const juradoNom = s.juradoNominados || [];
        const prof      = s.profesorSalvoId;
        const comp      = s.salvadoCompanerosId;
        const finales   = s.finalNominees || [];

        // 👇 obtener género del concursante
        const gnd = getGender(c.id);

        // determinar quién lo nominó o salvó
        const by =
          finales.includes(c.id) ? "finaltwo" :
          comp === c.id           ? "compas"    :
          prof === c.id           ? "profes"    :
          (juradoNom.includes(c.id) ? "jurado"  : null);

        if (by) {
          const color = {
            jurado: "orange",
            profes: "yellowgreen",
            compas: "khaki",
            finaltwo: "orange",
          }[by] || "orange";

          // 👉 Nominado/Nominada/Nominade (con º si estuvo en top3)
          text  = inTop3 ? lbl.nominado(gnd) + "º" : lbl.nominado(gnd);
          style = cellStyle(color, "#111");
        }
        else if (favorito === c.id) {
          // 👉 Favorito/Favorita/Favorite
          text  = lbl.favorito(gnd);
          style = cellStyle("DodgerBlue", "#fff");
        }
        else if (inTop3) {
          // 👉 Salvado/Salvada/Salvade (Top 3)
          text  = lbl.salvado(gnd);
          style = cellStyle("#AFEEEE", "#111");
        }
        else {
          // 👉 Salvado/Salvada/Salvade (normal)
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
            style = cellStyle("DodgerBlue", "#fff");
          } else if (g11.a === c.id || g11.b === c.id) {
            const win = c.id === g11.winner;
            text  = win ? "Finalista" : lbl.eliminado(gnd); // Eliminado/Eliminada/Eliminade
            style = win ? cellStyle("DodgerBlue", "#fff") : cellStyle("red", "#fff");
          } else {
            text = "Finalista";
            style = cellStyle("DodgerBlue", "#fff");
          }
        }
      }

      else if (g >= 12 && g <= 14) {
        const gX = s.g12_14;
        if (gX) {
          const d   = gX.duel;            // { low, high, pctWin, pctLose, winner }
          const gnd = getGender(c.id);    // "m" | "f" | "e"

          if (c.id === d.low && d.winner !== c.id) {
            text  = lbl.eliminado(gnd);   // Eliminado/Eliminada/Eliminade
            style = cellStyle("red", "#fff");
          } else if (c.id === d.low || c.id === d.high) {
            text  = "Duelo";
            style = cellStyle("orange", "#111");
          } else {
            text  = lbl.salvado(gnd);     // Salvado/Salvada/Salvade
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
    <div className="overflow-auto">
      <table style={{ borderCollapse:"collapse", width:"100%" }}>
        <thead>
          <tr>
            {headers.map((h,i)=>(<th key={i} style={{ position:"sticky", top:0, background:"#fafafa", border:"1px solid #ddd", padding:6, fontSize:12 }}>{h}</th>))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells,ri)=>(<tr key={ri}>{cells.map((c,ci)=>(<td key={ci} style={c.style}>{c.text}</td>))}</tr>))}
        </tbody>
      </table>
    </div>
  );
}
