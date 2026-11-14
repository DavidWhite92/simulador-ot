import {teacherIdentity} from "./staff.js";
// Fictional dialogue for the simulation, selected to match rehearsal outcomes.
const teachers = {
  'Mamen Márquez': {
    good: ['Muy bien ese twang: la voz proyecta sin que tengas que empujar.', 'Esa colocación está mucho más libre. Guarda la sensación para el estribillo.', 'Has conectado los registros sin romper la frase. Ahora repítelo con el texto.', 'La articulación ya no te corta el aire. Mantén ese apoyo hasta el final.', 'Ese agudo está colocado y no apretado. No lo cambies por querer sonar más fuerte.'],
    bad: ['Cuidado con la colocación: no tires del cuello para alcanzar la nota.', 'No aprietes la garganta buscando twang. Trabajemos el estrechamiento epilaríngeo sin forzar.', 'No intentes mover la epiglotis a voluntad. Busca una emisión cómoda y escucha la resonancia.', 'Se te escapa el aire antes del final. Vamos a repartirlo desde el inicio de la frase.', 'Al cambiar de registro pierdes la vocal. Hazlo primero despacio y sin volumen.'],
  },
  'Manu Guix': {
    good: ['Ahora sí: estás dentro del tempo y la afinación se sostiene hasta el final.', 'Ese acorde ha quedado limpio. Escucha la voz de al lado y no lo estropees subiendo el volumen.', 'Le das un poco de arrr, de intención, y funciona. Pero sin adelantar la entrada.', 'Bien ese final. Quiero exactamente esa precisión cuando esté la banda.', 'La dinámica ya cuenta algo. Guarda fuerza para el último estribillo.'],
    bad: ['No, paramos. La entrada va con el piano, no cuando te apetece. Otra vez desde ahí.', 'Estás por debajo de la nota. Escucha el acorde antes de atacar.', 'El tempo no puede ir detrás de tus nervios. Marca el pulso y entra conmigo.', 'Le das un poco de arrr, sí, pero primero afina. La intención no sustituye a la nota.', 'Estás soltando la última nota antes de tiempo. Escucha la resolución del piano y repítela.'],
  },
  'Vicky Gómez': {
    good: ['Ahora el movimiento acompaña a la música. Guarda esa energía sin perder el aire.', 'Bien los cambios de peso. La transición ya no parece un paso separado.', 'Has encontrado la cuenta exacta. Esa coordinación es la que quiero en la gala.', 'La mirada está arriba y la postura abierta. Eso hace que el gesto llegue.', 'Ese desplazamiento ya es natural. Repite cantando para fijarlo de verdad.'],
    bad: ['La coreografía no puede hacer que dejes de cantar. Vamos a ajustar el esfuerzo.', 'Llegas tarde al cambio de peso. Cuenta cinco, seis, siete, ocho y vuelve a entrar.', 'No mires al suelo para buscar la marca: apréndete el recorrido y mira al frente.', 'Los brazos van por un lado y la canción por otro. Necesitamos una intención común.', 'De cara a la gala quiero ese desplazamiento limpio, sin atropellar al compañero.'],
  },
  'Abril Zamora': {
    good: ['Amore, ahora te creo. No adornes más ese momento: quédate ahí.', 'Amore, has escuchado de verdad al compañero y la canción ha cambiado.', 'Eso, amore. Esa pausa cuenta más que un gesto enorme.', 'Amore, se entiende a quién le estás cantando. Conserva esa imagen para la gala.', 'Qué bonito, amore. Has dejado de demostrar y has empezado a contar.'],
    bad: ['Amore, estás diciendo palabras preciosas, pero no sé qué te pasa por dentro.', 'No me fabriques la lágrima, amore. Piensa a quién necesitas decirle esto.', 'Amore, baja el gesto y escucha el texto. No hace falta subrayarlo todo.', 'Te estás escondiendo detrás de la técnica, amore. ¿Qué quieres conseguir de esa persona?', 'Amore, no desconectes cuando canta el otro. La historia también sigue en tu silencio.'],
  },
  'Noemí Galera': {
    good: ['A esto ya podemos ponerle un lacito y llevarlo a la gala. Ahora, no te confíes.', 'Me has emocionado. Dame un momento, que se me han saltado las lágrimas.', 'Así sí. Se nota que has trabajado y que sabes qué quieres contar.', 'Esto es lo que quería ver: una actuación que empieza y acaba con intención.', 'Hoy has dado un paso enorme. Guarda lo que ha pasado aquí y cuídalo.'],
    bad: ['Esto ahora mismo es un buñuelito. Hay que ordenar las entradas y ponerse a trabajar.', 'No me vale que ayer saliera bien. Necesito verlo aquí, de principio a fin.', 'Hay una canción bonita debajo de este lío. Quita lo que sobra y vuelve al principio.', 'Con esta inseguridad no podemos llegar a la gala. Quiero un plan de trabajo claro.', 'No te estás tomando en serio los detalles. Ahí es donde se te está cayendo la actuación.'],
  },
};

teachers['Mamen Márquez'].good.push('El ataque está equilibrado: ni aire de más ni golpe glótico.', 'La transición entre registros conserva el apoyo y la vocal. Muy bien ese passaggio.', 'Ese tracto vocal más libre está dando brillo sin añadir presión.', 'Has estabilizado el vibrato y la afinación no se mueve.');
teachers['Mamen Márquez'].bad.push('Cuidado con ese ataque glótico. Prueba la entrada con menos presión subglótica.', 'Al pasar al agudo abres demasiado la vocal. Ajusta la resonancia sin tensar la mandíbula.', 'Vamos a trabajar el passaggio con un ejercicio de tracto vocal semiocluido antes de repetir la frase.', 'La lengua se está retrayendo y te oscurece la vocal. Relájala y vuelve a colocar el sonido.');
teachers['Noemí Galera'].bad.push('Te separas demasiado del micro y desaparece la frase. No podemos perder el texto justo ahí.', 'Acerca el micro al volver al verso: ese cambio de distancia se está comiendo tu voz.', 'No apartes el micro antes de terminar la última palabra. La frase todavía no ha acabado.');
teachers['Noemí Galera'].good.push('Ahora controlas la distancia del micro y se entiende hasta la última palabra.');
teachers['Pablo Lluch']={good:['La vocal está más centrada y el sonido encaja mejor con la base.', 'Has limpiado el ataque y ahora el sonido tiene continuidad.', 'Ese color encaja con la canción. Conserva la misma intención en el estribillo.', 'La frase respira sin cortarse. Así el sonido puede crecer con naturalidad.'],bad:['No cambies el color de la vocal a mitad de nota: el sonido pierde el centro.', 'La voz se está quedando detrás de la base. Busca claridad sin gritar.', 'Vamos a enlazar las vocales para que el fraseo no suene a trozos.', 'Escucha primero la armonía y encuentra tu hueco; no intentes cubrirlo todo con volumen.']};
const collective={
 'Manu Guix':{good:['Las entradas ya están juntas. Conservad ese pulso cuando entre toda la banda.', 'Ese acorde está equilibrado: cada voz tiene su sitio y ninguna tapa a las demás.'],bad:['Paramos: las entradas no están juntas. Escuchad el piano y respirad en la misma cuenta.', 'El final del estribillo se cae de afinación. Vamos voz por voz antes de volver a unirlo.']},
 'Pablo Lluch':{good:['Habéis acercado las vocales y el empaste ahora suena natural.', 'Las voces mantienen su personalidad, pero el conjunto tiene un color común.'],bad:['No estáis usando la misma vocal y el acorde se abre. Busquemos un color común.', 'Una voz está tapando al resto. Bajad el volumen y escuchad cómo encaja la armonía.']},
 'Abril Zamora':{good:['Amores, os habéis escuchado y la historia tiene sentido entre todas las voces.', 'Qué bonito, amores. La emoción pasa de una voz a otra sin romperse.'],bad:['Amores, no estáis contando la misma historia. Escuchaos también cuando no os toca cantar.', 'Amores, cada parte está bien por separado, pero falta una intención que os una.']},
 'Mamen Márquez':{good:['Las vocales están alineadas y el acorde resuena sin que forcéis.', 'Habéis coordinado la respiración y las frases llegan completas.'],bad:['No empujéis para escucharos. Alinead las vocales y dejad espacio a las otras voces.', 'El acorde pierde centro cuando cambiáis de registro. Trabajad esa transición en conjunto.']},
 'Noemí Galera':{good:['A este conjunto podemos ponerle un lacito y llevarlo a la gala.', 'Me habéis emocionado. Esa conexión es lo que quiero ver en el escenario.'],bad:['Esto es un buñuelito todavía. Ordenad las entradas y trabajad también el conjunto.', 'No apartéis el micro para buscaros con la mirada. Se pierde el texto y se rompe la canción.']},
 'Vicky Gómez':{good:['Los desplazamientos están coordinados y dejan respirar a la canción.', 'Habéis encontrado una energía común sin perder las marcas.'],bad:['Las marcas no pueden romper la escucha. Repetid el desplazamiento mientras cantáis.', 'No lleváis la misma energía en el movimiento. Ajustemos las cuentas antes de correr.']},
};

export function teacherFeedback({good,kind,group=false,dance=0,members=[],romantic=false,staff},random=Math.random,used=new Set()) {
  const eligible=['Mamen Márquez','Manu Guix','Abril Zamora','Noemí Galera','Pablo Lluch',...(group || dance>=8?['Vicky Gómez']:[])];
  const choose=items=>items[Math.floor(random()*items.length)];
  const comments=[];
  const emit=(teacher,text)=>{const identity=teacherIdentity(teacher,staff);comments.push({teacher:identity.name,photo:identity.photo,text});};
  const phrase=(teacher,positive)=>{
    const all=teachers[teacher][positive?'good':'bad'];
    const bank=members.length===1?all.filter(text=>!/compañero|cuando canta el otro|al lado/.test(text)):all;
    const fresh=bank.filter(text=>!used.has(text));const text=choose(fresh.length?fresh:bank);used.add(text);return text;
  };
  if(!members.length) {
    const selected=group?['Manu Guix']: [choose(eligible)];
    if(random()>.5) selected.push(choose(eligible.filter(t=>!selected.includes(t))));
    selected.forEach(t=>emit(t,phrase(t,good)));return comments;
  }
  const targets=group ? [...members].sort((a,b)=>a.score-b.score).slice(0,3) : members;
  for(const member of targets) {
    const positive=member.score>=6.8;
    const teacher=group || (kind==='mic' && !positive) ? 'Manu Guix' : choose(eligible);
    let text=phrase(teacher,positive);
    if(teacher==='Manu Guix' && !positive && kind==='mic') text=choose([
      'cuidado con tu entrada, estás bajo. Escucha el acorde: no seguimos hasta que esa nota esté en su sitio.',
      'cuando vuelves al segundo verso y alargas esa vocal, la nota se cae. Repítelo con el piano, sin adornos.',
      'no estás afinando el ataque del estribillo. Marca el tempo y vuelve a entrar conmigo.',
      'el final de la frase está por debajo. No lo tapes con fuerza: necesito precisión antes de la gala.',
      'te has adelantado a la base y luego has arrastrado la nota. Vamos a separar ritmo y afinación.',
    ]);
    if(teacher==='Abril Zamora' && romantic && members.length===2) text=positive?'Amore, qué precioso cuando miras y dejas que la otra voz te responda. Guarda esa ternura, sin actuar de más.':'Amore, no me enseñes una cara de enamoramiento: escucha a quien tienes delante y deja que te importe lo que te dice.';
    emit(teacher,`${member.name}, ${text}`);
  }
  if(members.length>1) {
    const teacher=group?'Manu Guix':romantic?'Abril Zamora':choose(eligible);
    let text=choose(collective[teacher][good?'good':'bad']);
    if(romantic && teacher==='Abril Zamora') text=good?'Amores, qué cosa más preciosa: os miráis, os escucháis y parece que la canción acaba de nacer entre los dos. No forcéis nada más.':'Amores, esta canción necesita intimidad. No cantéis cada cual su solo: dejaos afectar por lo que os dice la otra voz.';
    emit(teacher,text);
  }
  return comments;
}
