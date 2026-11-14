export function secondChance(id,performances={}) {
  const performance=performances[id];
  if(!performance || performance.score>=6.8 || Object.values(performances).filter(p=>p.score<6.8).length<4) return '';
  return performance.score<4.6 ? 'Pero te vamos a dar una oportunidad. No la desaproveches: necesitas trabajar para que la próxima actuación sea distinta.' : 'A pesar de todo, confiamos en tus posibilidades y queremos que sigas, al menos una semana más, en la Academia.';
}
export function favoriteComment(performance) {
  const opening='Enhorabuena por el apoyo del público.';
  if(!performance) return `${opening} Aprovecha esta semana para seguir creciendo.`;
  const appraisal=performance.score>=8?'Has hecho una actuación brillante, con seguridad y emoción.':performance.score>=6.8?'Has defendido bien la canción, aunque aún puedes pulir detalles.':performance.score>=5.8?'Has cumplido, pero necesitamos que arriesgues y conectes más.':performance.score>=4.6?'Tu actuación ha sido irregular y han faltado precisión y seguridad.':'La actuación ha tenido fallos importantes y no ha estado al nivel que esperamos.';
  return `${opening} ${appraisal} ${performance.score<5.8?'Hoy el público te ha librado de una nominación segura. Has tenido suerte: aprovecha el tiempo y trabaja estos errores.':'Disfruta de este reconocimiento y sigue trabajando esta semana.'}`;
}
