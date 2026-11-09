const pick = (items, random) => items[Math.floor(random() * items.length)];
const general = [
  [1, 'recibe un mensaje de su familia y comparte entre lágrimas lo mucho que necesitaba escucharlo.'],
  [1, 'lee el apoyo de antiguos compañeros y agradece que sigan acompañando su camino.'],
  [1, 'consuela a quien ha vuelto de la gala con dudas y consigue arrancarle una sonrisa.'],
  [1, 'reconoce sus fallos de la noche y propone trabajar en ellos sin buscar excusas.'],
  [1, 'celebra el éxito de un compañero y le cede el protagonismo durante El Chat.'],
  [1, 'se emociona al descubrir que su actuación ha ayudado a alguien a superar un día difícil.'],
  [1, 'cuenta entre risas una anécdota del directo y rebaja la tensión de la casa.'],
  [-1, 'interrumpe el mensaje de apoyo de un compañero para volver a hablar de su propia gala.'],
  [-1, 'desprecia los elogios que recibe otra persona y genera malestar en la casa.'],
  [-1, 'presume de su actuación y asegura que los demás no estaban a su altura.'],
  [-1, 'hace una broma sobre los nervios de un compañero que no sienta nada bien.'],
  [-1, 'se niega a escuchar las críticas y corta la conversación de forma brusca.'],
  [1, 'recibe un mensaje de su antiguo profesor de música y recuerda quién le animó a presentarse al concurso.'],
  [1, 'improvisa una divertida recreación de los nervios entre bambalinas y hace reír a toda la casa.'],
  [1, 'agradece al equipo técnico haberle ayudado a resolver un problema antes de salir a cantar.'],
  [1, 'se emociona con el mensaje de un seguidor que se ha sentido identificado con su historia.'],
  [1, 'pide disculpas por una discusión durante los ensayos y reconoce el esfuerzo de su compañero.'],
  [1, 'admite que le cuesta gestionar la presión y encuentra comprensión al hablar sin fingir seguridad.'],
  [1, 'comparte un mensaje de apoyo para quienes han abandonado el concurso.'],
  [-1, 'lee un comentario crítico y responde con desprecio a quienes no disfrutaron de su actuación.'],
  [-1, 'acapara las preguntas del Chat y apenas deja intervenir al resto.'],
  [-1, 'atribuye todos sus errores al sonido sin reconocer que también falló en los ensayos.'],
  [-1, 'minimiza la emoción de un compañero al recibir un mensaje familiar y crea un momento incómodo.'],
  [-1, 'convierte una anécdota compartida en una competición por ver quién recibió más aplausos.'],
];
const nominated = [
  [1, 'rompe a llorar por la nominación y recibe mensajes que le ayudan a recuperar fuerzas.'],
  [1, 'admite que tiene miedo a salir, pero agradece con sinceridad el cariño que está recibiendo.'],
  [1, 'defiende con calma que la valoración del jurado fue injusta. Su forma de explicarlo despierta simpatía.'],
  [1, 'se enfada por la nominación, explica sus motivos sin atacar a nadie y encuentra apoyo entre la audiencia.'],
  [1, 'pregunta a sus compañeros por sus votos, escucha sus razones y termina abrazándolos.'],
  [1, 'promete aprovechar la semana y acepta la nominación como una oportunidad para mejorar.'],
  [-1, 'culpa a sus compañeros de la nominación y les reprocha que no sepan reconocer el talento.'],
  [-1, 'arremete contra los jueces sin aceptar ningún error propio. La pataleta no convence al público.'],
  [-1, 'se enfada por no recibir suficientes votos y exige explicaciones con malos modos.'],
  [-1, 'insinúa que su rival no merece seguir en la Academia y provoca rechazo.'],
  [-1, 'rechaza el consuelo de sus compañeros y acusa a todos de fingir cariño ante las cámaras.'],
  [1, 'se planta ante una crítica que considera desproporcionada y expresa su malestar con respeto.'],
];
const saved = [
  [1, 'agradece la salvación sin olvidar a quienes siguen nominados.'],
  [1, 'se acerca a los nominados para ofrecerles ayuda con los ensayos de la próxima semana.'],
  [-1, 'celebra su salvación con tanta superioridad que incomoda a los nominados.'],
  [-1, 'asegura que era evidente que debía salvarse y resta mérito al resto.'],
];

export function createChatEvents(contestants, summary = {}, random = Math.random, allowNominations = true, gala = summary.gala) {
  const excluded = new Set(summary.gala0?.eliminados || []);
  const people = contestants.filter(c => ['active','finalista','ganador'].includes(c.status) && !excluded.has(c.id));
  if (!people.length) return [];
  const nominees = people.filter(c => allowNominations && summary.finalNominees?.includes(c.id));
  const saves = new Set([summary.profesorSalvoId, summary.salvadoCompanerosId]);
  const votes = summary.votosCompaneros || [];
  const compassion = gala >= 1 && gala <= 5 && votes.length && allowNominations
    ? nominees.filter(c => !votes.some(v => v.votedId === c.id)).map(c => ({
      kind: 'compassion', ids: [c.id], delta: 4,
      text: `${c.name} no ha recibido ningún voto de sus compañeros para salvarse. Durante El Chat llegan mensajes de cariño: el público se compadece y se vuelca en su apoyo.`,
    })) : [];
  const used = new Set();
  const count = 3 + Math.floor(random() * 5);
  return [...compassion, ...Array.from({ length: Math.max(0, count - compassion.length) }, (_, i) => {
    const person = pick(i === 0 && nominees.length ? nominees : people, random);
    const bank = !allowNominations ? general : summary.finalNominees?.includes(person.id) ? nominated : saves.has(person.id) ? [...saved, ...general] : general;
    const available = bank.filter(([,text]) => !used.has(text));
    const [sign, text] = pick(available.length ? available : bank, random);
    used.add(text);
    return { ids: [person.id], text: `${person.name} ${text}`, delta: sign * (1 + Math.floor(random() * 2)) };
  })];
}
