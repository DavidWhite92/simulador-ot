import { teacherFeedback } from "./teacherFeedback.js";
import { describePerformance, describeGroup, describeOpening, performanceIncidents } from "./performanceText.js";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const pick = (items, random) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];
export const popularityOf = c => clamp(Number.isFinite(c?.popularity) ? c.popularity : 50, 0, 100);

// At most eight popularity points can be overturned by the audience's weekly variation.
export function audiencePercentages(ids, contestants, random = Math.random, volatility = 4, popularityEnabled = true) {
  if (!ids.length) return [];
  const weights = ids.map(id => {
    if (!popularityEnabled) return 0.05 + random();
    const pop = popularityOf(contestants.find(c => String(c.id) === String(id)));
    return Math.exp((pop - 50 + (random() * 2 - 1) * volatility) / 32);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map(w => w / total * 10000);
  const units = exact.map(Math.floor);
  const order = exact.map((v, i) => ({ i, remainder: v - units[i], tie: random() }))
    .sort((a, b) => b.remainder - a.remainder || a.tie - b.tie);
  for (let i = 0, left = 10000 - units.reduce((a, b) => a + b, 0); i < left; i++) units[order[i].i]++;
  // An exact duel tie cannot produce a winner; break it by one hundredth.
  if (units.length === 2 && units[0] === units[1]) {
    const first = random() < 0.5 ? 0 : 1;
    units[first]++; units[1 - first]--;
  }
  return units.map(v => v / 100);
}

export function favoriteRanking(contestants, popularityEnabled = true, random = Math.random) {
  const percentages = audiencePercentages(contestants.map(c => c.id), contestants, popularityEnabled ? () => 0.5 : random, 0, popularityEnabled);
  return contestants.map((c, i) => ({ id: c.id, pct: percentages[i], popularity: popularityOf(c) }))
    .sort((a, b) => popularityEnabled ? b.popularity - a.popularity : b.pct - a.pct);
}

export function sortByPopularity(contestants) {
  return [...contestants].sort((a, b) => popularityOf(b) - popularityOf(a) || a.name.localeCompare(b.name, 'es'));
}

const SOLO = [
  [1, 'organiza una cena para levantar el ánimo de toda la casa.'],
  [1, 'escucha a un compañero que echa de menos a su familia.'],
  [1, 'reconoce un error y pide disculpas sin excusas.'],
  [1, 'anima una tarde difícil con su sentido del humor.'],
  [1, 'asume las tareas de limpieza que nadie quería hacer.'],
  [1, 'comparte una historia personal que emociona a la audiencia.'],
  [1, 'celebra los avances de los demás sin competir por el protagonismo.'],
  [1, 'defiende a un compañero ante una crítica injusta.'],
  [-1, 'deja la cocina sin recoger y provoca una discusión.'],
  [-1, 'interrumpe repetidamente una conversación para hablar de sí mismo.'],
  [-1, 'hace un comentario poco empático que incomoda a la casa.'],
  [-1, 'se queja del reparto de tareas y no ayuda a solucionarlo.'],
  [-1, 'reacciona con soberbia a un consejo bienintencionado.'],
  [-1, 'se burla de un error ajeno y pierde apoyo fuera de la Academia.'],
  [-1, 'rompe el descanso de la casa y no acepta las quejas.'],
  [-1, 'habla a espaldas de un compañero y genera desconfianza.'],
];
const REHEARSAL = [
  [1, 'se organizan con generosidad, se escuchan y encuentran una armonía que ilusiona al público.'],
  [1, 'superan un bloqueo ayudándose con la letra y los tiempos.'],
  [1, 'aceptan las correcciones y mejoran juntos el ensayo.'],
  [1, 'dedican tiempo extra a coordinar las entradas sin dejar a nadie atrás.'],
  [-1, 'discuten por el protagonismo y terminan el ensayo sin escucharse.'],
  [-1, 'se culpan mutuamente de los fallos y apenas avanzan.'],
  [-1, 'llegan sin preparar la letra y desperdician la sesión.'],
  [-1, 'rechazan una corrección y el pase de micros acaba con tensión.'],
];
const SOLO_REHEARSAL = [
  [1, 'trabaja con constancia y logra superar un pasaje que se resistía.'],
  [1, 'acepta las correcciones y sorprende con su progreso en el ensayo.'],
  [1, 'se queda practicando y recupera la confianza.'],
  [-1, 'se frustra y abandona el ensayo antes de terminar.'],
  [-1, 'llega sin la letra preparada y rechaza las indicaciones.'],
  [-1, 'se distrae durante la clase y repite los mismos errores.'],
];

const MIC_CHECK = [
  [1, 'ajustan las distancias al micrófono y consiguen que todas las voces se escuchen con claridad.'],
  [1, 'corrigen las entradas después de escuchar la grabación y completan un pase muy sólido.'],
  [1, 'encajan las armonías por primera vez y terminan el pase entre aplausos.'],
  [1, 'aceptan las indicaciones del equipo de sonido y mejoran el equilibrio de la canción.'],
  [-1, 'no escuchan las indicaciones y repiten los mismos errores de volumen.'],
  [-1, 'discuten por quién debe destacar más y dejan el pase sin resolver.'],
  [-1, 'pierden varias entradas y se reprochan los fallos en lugar de corregirlos.'],
  [-1, 'llegan sin coordinar las voces y el pase deja al profesorado preocupado.'],
];
const SOLO_MIC_CHECK = [
  [1, 'controla la distancia al micrófono y sorprende con una voz mucho más equilibrada.'],
  [1, 'escucha la grabación, corrige una entrada y completa un pase convincente.'],
  [1, 'supera los nervios del primer pase y recibe una felicitación del profesorado.'],
  [1, 'ajusta la respiración y consigue sostener la nota que se resistía.'],
  [-1, 'olvida acercarse al micrófono en varias frases y rechaza las correcciones.'],
  [-1, 'se bloquea ante el profesorado y abandona el pase antes de terminar.'],
  [-1, 'fuerza demasiado la voz y no consigue controlar los agudos.'],
  [-1, 'pierde la referencia de la base y termina el pase sin encontrar el ritmo.'],
];

// Additional rehearsal details keep a full cast's weekly sessions distinct.
SOLO_REHEARSAL.push(
  [1, 'marca las respiraciones en la partitura y empieza a cantar con más comodidad.'],
  [1, 'descubre una intención nueva en la letra y conecta con la historia.'],
  [1, 'divide el estribillo en pequeños fragmentos y gana seguridad.'],
  [1, 'practica la coreografía despacio hasta coordinarla con la voz.'],
  [1, 'encuentra una tonalidad cómoda y deja de forzar la garganta.'],
  [1, 'trabaja la pronunciación y consigue que se entienda mejor el texto.'],
  [1, 'escucha versiones de referencia y encuentra una interpretación propia.'],
  [-1, 'depende demasiado de la letra escrita y todavía no puede mirar al frente.'],
  [-1, 'entra tarde en el estribillo y necesita repetirlo varias veces.'],
  [-1, 'pierde la respiración al unir el baile con el canto.'],
  [-1, 'no encuentra la intención de la canción y canta de forma mecánica.'],
  [-1, 'se precipita en las frases y pierde la conexión con la base.'],
  [-1, 'se obsesiona con una nota difícil y descuida el resto del tema.'],
  [-1, 'cambia continuamente de interpretación y termina sin una idea clara.'],
);
SOLO_MIC_CHECK.push(
  [1, 'mantiene el pulso de principio a fin y transmite seguridad frente al profesorado.'],
  [1, 'proyecta la voz sin forzar y completa los agudos con limpieza.'],
  [1, 'coordina los movimientos con el canto y termina con energía.'],
  [1, 'encuentra los silencios adecuados y da intención a cada frase.'],
  [1, 'recupera una entrada complicada sin perder la concentración.'],
  [1, 'vocaliza con claridad y logra que la historia llegue a quienes escuchan.'],
  [1, 'canta sin apoyarse en la letra y disfruta del escenario.'],
  [-1, 'se queda sin aire antes de terminar varias frases.'],
  [-1, 'confunde una estrofa y necesita que le recuerden la letra.'],
  [-1, 'desafina al final del estribillo y recibe nuevas indicaciones.'],
  [-1, 'se centra tanto en la coreografía que descuida la afinación.'],
  [-1, 'canta con poca intención y no consigue transmitir el texto.'],
  [-1, 'acelera el final y pierde la coordinación con la base.'],
  [-1, 'mantiene la mirada en el suelo y se desconecta de la interpretación.'],
);
REHEARSAL.push(
  [1, 'reparten las respiraciones y se dan espacio para que cada voz destaque.'],
  [1, 'ensayan sin la base y descubren cómo empastar sus voces.'],
  [-1, 'proponen interpretaciones incompatibles y no consiguen ponerse de acuerdo.'],
  [-1, 'descuidan las transiciones entre voces y el tema pierde continuidad.'],
);
MIC_CHECK.push(
  [1, 'mantienen el contacto visual y resuelven juntos una entrada complicada.'],
  [1, 'equilibran los solos con las partes compartidas y transmiten complicidad.'],
  [-1, 'se pisan las frases y terminan sin escucharse entre sí.'],
  [-1, 'no consiguen empastar en el estribillo y reciben nuevas correcciones.'],
);

const HOUSEHOLD_GROUP = [
  [1, 'se unen para escribir un himno de la Academia y aportan versos que cuentan lo que están viviendo.'],
  [1, 'organizan una cena conjunta y consiguen que nadie se sienta apartado de la casa.'],
  [1, 'improvisan una canción en el salón y convierten una tarde gris en una celebración.'],
  [1, 'se reúnen para resolver sus diferencias, se escuchan y terminan reconciliándose.'],
  [1, 'preparan una sorpresa para animar a quienes echan de menos a sus familias.'],
  [1, 'reparten las tareas pendientes y dejan la casa recogida trabajando en equipo.'],
  [1, 'comparten sus inseguridades y acuerdan apoyarse sin competir fuera del escenario.'],
  [1, 'inventan un baile para acompañar su himno y contagian su entusiasmo a la audiencia.'],
  [-1, 'se enzarzan en una pelea por la limpieza y acaban reprochándose conflictos de toda la semana.'],
  [-1, 'discuten por el ruido nocturno y nadie acepta ceder para respetar el descanso.'],
  [-1, 'forman un grupo cerrado y dejan fuera de sus planes al resto de la casa.'],
  [-1, 'convierten un juego en una discusión y terminan lanzándose comentarios hirientes.'],
  [-1, 'se disputan el protagonismo al componer una canción conjunta y abandonan el proyecto entre reproches.'],
  [-1, 'alimentan un rumor sobre otros compañeros sin comprobarlo y generan desconfianza.'],
  [-1, 'se culpan del desorden en una reunión de convivencia y terminan hablando a gritos.'],
  [-1, 'se burlan de quienes no participan en sus bromas y provocan malestar en la casa.'],
];

export function createAcademyEvents(contestants, reparto, pairs = [], random = Math.random, songsMeta = {}) {
  const alive = contestants.filter(c => ['active', 'finalista'].includes(c.status));
  if (!alive.length) return [];
  const ids = new Set(alive.map(c => c.id));
  const rows = reparto.map(r => ({ ...r, members: r.members.filter(id => ids.has(id)) })).filter(r => r.members.length);
  const name = id => alive.find(c => c.id === id)?.name || id;
  const count = 5 + Math.floor(random() * 6);
  const events = [], used = new Set();
  const fresh = bank => pick(bank.filter(([,text]) => !used.has(text)), random);
  const currentPairs = pairs.map(pair=>[...pair]);
  const partners = new Map(pairs.flatMap(([a,b]) => [[a,b],[b,a]]));
  for (let i = 0; i < count; i++) {
    let kind = i === 0 ? 'solo' : pick(['solo','group','group','romance'], random);
    let event;
    if (kind === 'group' && alive.length >= 3) {
      const pool = [...alive], members = [];
      const size = 3 + Math.floor(random() * (alive.length - 2));
      for (let j = 0; j < size; j++) members.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
      const [sign,text] = fresh(HOUSEHOLD_GROUP);
      event = {kind, template:text, ids:members.map(c=>c.id), delta:sign * (3 + Math.floor(random()*4)),
        text:`${new Intl.ListFormat('es').format(members.map(c=>c.name))} ${text}`};
    }
    if (kind === 'romance') {
      const available = alive.filter(c => !partners.has(c.id));
      const current = currentPairs.filter(([a,b]) => ids.has(a) && ids.has(b));
      if (!used.has('romance:new') && available.length >= 2 && (current.length === 0 || random() < 0.6)) {
        const a = pick(available, random), b = pick(available.filter(c => c.id !== a.id), random);
        partners.set(a.id, b.id); partners.set(b.id, a.id); currentPairs.push([a.id,b.id]);
        event = { kind, template: 'romance:new', ids: [a.id,b.id], delta: 3, pair: [a.id,b.id], text: `${a.name} y ${b.name} reconocen que sienten algo especial y deciden comenzar una relación. La audiencia celebra su complicidad.` };
      } else if (current.length) {
        const pair = pick(current, random), positive = random() < 0.6;
        if (!used.has('romance:breakup') && random() < 0.04) {
          event = {kind,template:'romance:breakup',ids:pair,breakup:pair,delta:-2,text:`${pair.map(name).join(' y ')} hablan con sinceridad y deciden romper su relación sentimental. A partir de ahora seguirán su camino por separado.`};
          partners.delete(pair[0]); partners.delete(pair[1]);
          currentPairs.splice(currentPairs.indexOf(pair),1);
        }
        const template = positive ? 'romance:positive' : 'romance:negative';
        if (!event && !used.has(template)) event = { kind, template, ids: pair, delta: positive ? 3 : -3, text: `${pair.map(name).join(' y ')} ${positive ? 'se apoyan con cariño después de un día difícil. Su relación conquista a parte del público.' : 'discuten por no encontrar tiempo para compartir. La tensión de la pareja les resta apoyo esta semana.'}` };
      } else kind = 'solo';
    }
    if (!event) {
      const person = pick(alive, random);
      const [sign, text] = fresh(SOLO);
      event = { kind: 'solo', template: text, ids: [person.id], delta: sign * (3 + Math.floor(random() * 5)), text: `${person.name} ${text}` };
    }
    used.add(event.template);
    events.push({ ...event, key: i });
  }
  const rehearsals = new Map();
  const usedFeedback = new Set();
  for (const kind of ['rehearsal','mic']) for (const [index,row] of rows.entries()) {
    const bank = kind === 'mic' ? row.members.length > 1 ? MIC_CHECK : SOLO_MIC_CHECK : row.members.length > 1 ? REHEARSAL : SOLO_REHEARSAL;
    const [sign,text] = fresh(bank);
    used.add(text);
    const previous = rehearsals.get(index);
    const evolution = kind === 'mic' ? previous > 0 ? sign > 0 ? 'El pase consolida el trabajo del ensayo. ' : 'Surgen dificultades que no habían aparecido en el ensayo. ' : sign > 0 ? 'Se aprecia una mejora respecto al ensayo. ' : 'Persisten las dificultades del ensayo. ' : '';
    const event = {kind, template:text, ids:row.members, delta:sign * (3 + Math.floor(random()*4)), song:row.song, key:events.length,
      text:`${kind === 'mic' ? 'En el pase de micros de' : 'Ensayando'} ${row.song || 'su tema'}, ${new Intl.ListFormat('es').format(row.members.map(name))} ${text}${evolution ? ' ' + evolution : ''}`};
    const metadata=songsMeta.exact?.[row.song] || songsMeta.norm?.[normalize(row.song)] || songsMeta[row.song] || {};
    event.isGroup=row.type==='group';
    event.feedback=teacherFeedback({good:sign>0,kind,group:event.isGroup,dance:Number(metadata.baile || 0)},random,usedFeedback);
    if(event.isGroup) {event.delta=0;event.positive=sign>0;event.text=`${kind==='mic'?'Pase de micros':'Ensayo'} de la grupal ${row.song}. ${sign>0?'El grupo gana seguridad y coordina mejor las voces.':'La coordinación todavía falla y hay entradas que necesitan trabajo.'} ${evolution}`;}
    events.push(event);
    if(kind === 'rehearsal') rehearsals.set(index,sign);
  }
  return events;
}

export function applyPopularity(contestants, changes) {
  return contestants.map(c => changes[c.id] == null ? c : { ...c, popularity: clamp(popularityOf(c) + changes[c.id], 0, 100) });
}
const normalize = text => (text || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/^["“”«»]+|["“”«»]+$/g, '').replace(/\s+/g, ' ').trim();
const skills = ['afinacion', 'baile', 'presencia', 'emocion'];
const labels = ['afinación', 'baile', 'presencia escénica', 'emoción'];
export function createPerformances(contestants, reparto, meta = {}, judges = [], random = Math.random) {
  return reparto.filter(row => row.members?.length).map((row, index) => {
    const req = meta.exact?.[(row.song || '').trim()] || meta.norm?.[normalize(row.song)] || meta[row.song] || {};
    const members = row.members.map(id => {
      const c = contestants.find(p => p.id === id);
      const night = (random() - 0.5) * 4.8;
      const incident = random() < 0.14 ? pick(performanceIncidents, random) : null;
      const values = skills.map(key => {
        const alias = key === 'afinacion' ? 'afinación' : key === 'emocion' ? 'emoción' : key;
        const stat = Number(c?.stats?.[key] ?? c?.stats?.[alias] ?? 7.5);
        const demand = Number(req[key] ?? req[alias] ?? 7.5);
        return clamp(6.2 + (stat - demand) * 0.4 + night + (random() - 0.5) * 2.4, 0, 10);
      });
      const score = clamp(values.reduce((a,b) => a+b, 0) / values.length + (incident?.penalty || 0), 0, 10);
      const best = values.indexOf(Math.max(...values)), worst = values.indexOf(Math.min(...values));
      const description = describePerformance({ name: c?.name || id, song: row.song, score, best, worst, values, incident }, random);
      const judge = judges[(index + row.members.indexOf(id)) % 4] || `Juez ${(index + row.members.indexOf(id)) % 4 + 1}`;
      return { id, score, ...description, ...(c?.status === 'eliminado' ? {delta:0} : {}), judge, incident: incident?.key || null, strength: labels[best], weakness: labels[worst] };
    });
    const group = describeGroup(members, random);
    const isGroup=row.type==='group';
    const incidents=members.filter(m=>m.incident && m.incident!=='recuperacion');
    const groupDetail=isGroup ? `${describeOpening(members,random)}${incidents.length ? ' Durante la actuación, '+incidents.slice(0,2).map(m=>m.detail).join(' ') : ' La actuación ha llegado al final sin incidentes destacados.'}` : undefined;
    return { song: row.song, members, group:groupDetail || group, ...(isGroup?{isGroup:true}:{}) };
  });
}

export function performanceNominationModifier(performance) {
  return performance ? clamp((6 - performance.score) * 0.055, -0.22, 0.3) : 0;
}
