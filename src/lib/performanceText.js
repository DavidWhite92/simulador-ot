const pick = (items, random) => items[Math.floor(random() * items.length)];

export const performanceLevels = [
  { min: 9.2, quality: 'increíble', delta: 5, narration: [
    'ha firmado una actuación memorable, con una seguridad que ha puesto al público en pie.',
    'ha convertido la canción en uno de los grandes momentos de la noche.',
    'ha unido precisión y emoción en una interpretación extraordinaria.',
    'ha hecho suyo el escenario y ha dejado una actuación difícil de olvidar.',
  ], verdict: ['Has llevado esta canción a otro nivel.', 'Hoy hemos visto una actuación excepcional.', 'Has logrado que técnica y emoción se encuentren.', 'Esta es una de esas noches que marcan una trayectoria.'] },
  { min: 8, quality: 'muy buena', delta: 3, narration: [
    'ha brillado con una interpretación muy sólida y un final lleno de fuerza.',
    'ha sorprendido con una actuación muy completa, sin perder el control del tema.',
    'ha dado un salto de nivel y ha mantenido la atención de principio a fin.',
    'ha defendido los pasajes difíciles con soltura y personalidad.',
  ], verdict: ['Has dado un salto importante esta semana.', 'Has resuelto un reto exigente con mucha madurez.', 'Tu seguridad ha permitido que disfrutemos de la canción.', 'Hoy has demostrado que puedes ir más allá de cumplir.'] },
  { min: 6.8, quality: 'buena', delta: 2, narration: [
    'ha hecho una actuación controlada, con intención y momentos de auténtica conexión.',
    'ha defendido bien la canción y ha encontrado un momento para destacar.',
    'ha mostrado una evolución clara y ha resuelto el tema con seguridad.',
    'ha ofrecido una interpretación convincente, sin dejar que los nervios se impongan.',
    'ha encontrado el carácter del tema y lo ha sostenido hasta el final.',
  ], verdict: ['Has dado razones para confiar en tu evolución.', 'El trabajo de esta semana se ha notado.', 'Has defendido bien el tema, aunque todavía hay margen para crecer.', 'Hoy te hemos visto avanzar con claridad.', 'Esta interpretación demuestra que estás encontrando tu sitio.'] },
  { min: 5.8, quality: 'correcta', delta: 0, narration: [
    'ha cumplido con una actuación correcta, sin grandes fallos ni momentos destacados.',
    'ha mantenido el control, aunque la interpretación ha resultado algo previsible.',
    'ha resuelto la canción de forma ordenada, pero sin terminar de sorprender.',
    'ha llegado al final sin tropiezos importantes, aunque ha faltado un sello personal.',
    'ha ofrecido una versión sobria que ha cumplido sin dejar demasiada huella.',
  ], verdict: ['Has cumplido, pero necesitamos un paso más.', 'La corrección está ahí; ahora falta arriesgar.', 'No ha habido grandes tropiezos, aunque tampoco un momento memorable.', 'Queremos escuchar algo que solo puedas aportar tú.', 'Has mantenido el control, pero falta intención.'] },
  { min: 4.6, quality: 'regular', delta: -1, narration: [
    'ha tenido una actuación irregular, alternando momentos resueltos con otros inseguros.',
    'ha empezado con dudas y solo ha encontrado el tema por momentos.',
    'ha mostrado destellos interesantes, pero le ha faltado continuidad.',
    'ha completado la canción sin encontrar un equilibrio entre voz e interpretación.',
    'ha tenido una noche desigual: los aciertos no han compensado todos los descuidos.',
  ], verdict: ['Has alternado aciertos con momentos de inseguridad.', 'Necesitas mantener durante toda la canción lo que hoy solo ha aparecido a ratos.', 'No basta con resolver algunos pasajes si el conjunto pierde continuidad.', 'Te hemos visto buscar la canción sin terminar de encontrarla.', 'Hay material para trabajar, pero todavía falta consistencia.'] },
  { min: 3, quality: 'mala', delta: -2, narration: [
    'ha perdido el control de varios pasajes y no ha conseguido recuperar la actuación.',
    'ha tenido una noche difícil, con errores que han roto la continuidad del tema.',
    'ha llegado al escenario con inseguridad y la canción ha quedado por debajo de lo esperado.',
    'ha encadenado varios fallos y ha terminado sin conectar con el público.',
    'ha sufrido durante la interpretación y no ha podido sostener el resultado.',
  ], verdict: ['El resultado de hoy está por debajo de lo que pedía el tema.', 'Necesitas revisar lo ocurrido y trabajar con más precisión.', 'Esta noche no has conseguido sostener la canción.', 'El ensayo no ha terminado de trasladarse al escenario.', 'Los errores han impedido que podamos entrar en tu interpretación.'] },
  { min: 0, quality: 'desastre', delta: -4, narration: [
    'ha vivido una actuación desastrosa, sin poder sostener la voz ni la interpretación.',
    'ha visto cómo la actuación se desmoronaba y no ha encontrado una salida.',
    'ha perdido el hilo de la canción y los errores han dominado toda la actuación.',
    'ha atravesado su noche más complicada, con un resultado muy lejos del nivel exigido.',
  ], verdict: ['Hoy la actuación se ha desmoronado.', 'Los problemas han afectado al conjunto de la interpretación.', 'Necesitas reconstruir este tema desde la base.', 'Esta noche no hemos encontrado una interpretación suficientemente resuelta.'] },
];

const strengths = [
  ['Ha sostenido la afinación incluso en los pasajes exigentes.', 'Ha dibujado las notas con precisión y ha cuidado los finales de frase.', 'La voz ha sonado estable y bien colocada.'],
  ['Ha integrado el movimiento sin perder el ritmo.', 'El baile ha acompañado la canción con naturalidad.', 'Ha coordinado voz y movimiento con soltura.'],
  ['Ha ocupado el escenario con seguridad.', 'Su presencia ha mantenido la atención del público.', 'Ha manejado las miradas y las pausas con intención.'],
  ['Ha transmitido la letra con sinceridad.', 'Ha encontrado una emoción creíble, sin exagerar.', 'Su interpretación ha dado sentido a cada frase.'],
];
const weaknesses = [
  ['La afinación ha sido inestable en varios pasajes.', 'Las entradas fuera de tono han roto algunas frases.', 'Las notas sostenidas han perdido estabilidad.'],
  ['El baile y la voz no siempre han ido a la vez.', 'Los movimientos han llegado fuera de tiempo.', 'La coordinación ha fallado en los cambios de ritmo.'],
  ['Su presencia se ha diluido en varios momentos.', 'La inseguridad corporal ha restado fuerza al tema.', 'Ha perdido el contacto con el público.'],
  ['La letra ha sonado sin intención.', 'Ha faltado conexión emocional con lo que estaba cantando.', 'La interpretación ha resultado distante.'],
];
const directStrong = ['Has sostenido bien la afinación.', 'Has integrado voz y movimiento.', 'Has mostrado seguridad sobre el escenario.', 'Has conectado con el significado de la letra.'];
const directWeak = ['La afinación necesita más trabajo.', 'Necesitas coordinar mejor los pasos y la voz.', 'Te ha faltado presencia y seguridad escénica.', 'Necesitas encontrar una intención más clara en la letra.'];
const openings = ['Hemos seguido tu trabajo con atención.', 'Quiero hablar de lo que hemos visto esta noche.', 'Esta canción nos permite ver dónde estás.', 'Hoy había un reto importante para ti.', 'Te hemos escuchado de principio a fin.', 'Vamos a valorar lo que has hecho sobre el escenario.', 'Tu actuación nos ha dejado cosas que comentar.', 'Quiero detenerme en cómo has defendido este tema.', 'Esta semana te pedíamos un paso adelante.', 'Voy a hablarte del resultado de esta noche.', 'Hemos visto cómo afrontabas cada parte de la canción.', 'Tu interpretación merece que nos detengamos en los detalles.'];

export const performanceIncidents = [
  { key: 'letra', penalty: -2.4, narration: 'Se ha quedado en blanco y ha olvidado parte de la letra antes de poder reincorporarse.', jury: 'El olvido de la letra ha interrumpido la interpretación; necesitamos que puedas recuperar el hilo.' },
  { key: 'gallo', penalty: -1.8, narration: 'Un gallo enorme en la nota más expuesta ha roto el momento culminante del tema.', jury: 'El gallo en esa nota tan expuesta ha afectado al resultado; trabaja el apoyo sin forzar la voz.' },
  { key: 'entrada', penalty: -1.2, narration: 'Ha entrado a destiempo y ha pasado varias frases intentando alcanzar la base.', jury: 'La entrada a destiempo ha arrastrado varias frases; necesitas afianzar la escucha de la base.' },
  { key: 'recuperacion', penalty: 0.5, narration: 'Ha salvado un pequeño tropiezo con una improvisación natural, sin perder el hilo del tema.', jury: 'Has reaccionado con oficio a ese tropiezo y has logrado mantener la canción en marcha.' },
];

export function describePerformance({ name, song, score, best, worst, values, incident }, random) {
  const level = performanceLevels.find(l => score >= l.min) || performanceLevels.at(-1);
  const hasGood = score >= 6.8 || (score >= 4.6 && values[best] >= 6.5);
  const hasBad = score < 5.8 || values[worst] < 4.5;
  const detail = [
    `${name} ${pick(level.narration, random)}`,
    hasGood ? pick(strengths[best], random) : '',
    hasBad ? pick(weaknesses[worst], random) : '',
    incident?.narration,
  ].filter(Boolean).join(' ');
  const critique = [pick(openings, random), `En ${song || 'tu tema'}, ${pick(level.verdict, random).replace(/^./, c => c.toLowerCase())}`,
    hasGood ? directStrong[best] : '', hasBad ? directWeak[worst] : '', incident?.jury].filter(Boolean).join(' ');
  return { quality: level.quality, delta: level.delta, detail, critique };
}

export function describeGroup(members, random) {
  if (members.length < 2) return '';
  const average = members.reduce((sum,m) => sum + m.score, 0) / members.length;
  const spread = Math.max(...members.map(m => m.score)) - Math.min(...members.map(m => m.score));
  const options = average < 3 ? ['El conjunto se ha desmoronado: no ha habido coordinación ni una interpretación compartida.', 'La actuación conjunta ha perdido el rumbo y nadie ha conseguido recuperar la unidad.']
    : average < 4.6 ? ['Al conjunto le ha faltado coordinación; las entradas y la escucha no han funcionado.', 'Las voces no han encontrado un punto de encuentro y el tema ha quedado roto.']
    : spread > 2.5 ? ['El conjunto ha quedado desigual: algunas partes estaban mejor resueltas y ha faltado equilibrio.', 'La diferencia de nivel entre sus integrantes ha impedido una interpretación uniforme.']
    : average >= 8 ? ['El conjunto ha brillado: las voces han conectado con una complicidad extraordinaria.', 'La actuación conjunta ha potenciado lo mejor de sus integrantes y ha dejado un gran momento.']
    : average >= 6.8 ? ['Como conjunto han conectado: las voces se han apoyado y la interpretación ha tenido unidad.', 'La escucha entre sus integrantes ha permitido construir una actuación sólida.']
    : average >= 5.8 ? ['Como conjunto han cumplido correctamente, con entradas coordinadas y sin grandes sorpresas.', 'La actuación conjunta ha sido ordenada, aunque le ha faltado personalidad.']
    : ['El conjunto ha alternado momentos de conexión con otros de desconcierto.', 'Las voces han encajado solo a ratos y la interpretación ha quedado irregular.'];
  return pick(options, random);
}
