// Fictional dialogue for the simulation, selected to match rehearsal outcomes.
const teachers = {
  'Mamen Márquez': {
    good: ['Muy bien ese twang: la voz proyecta sin que tengas que empujar.', 'Esa colocación está mucho más libre. Guarda la sensación para el estribillo.', 'Has conectado los registros sin romper la frase. Ahora repítelo con el texto.', 'La articulación ya no te corta el aire. Mantén ese apoyo hasta el final.', 'Ese agudo está colocado y no apretado. No lo cambies por querer sonar más fuerte.'],
    bad: ['Cuidado con la colocación: no tires del cuello para alcanzar la nota.', 'No aprietes la garganta buscando twang. Trabajemos el estrechamiento epilaríngeo sin forzar.', 'No intentes mover la epiglotis a voluntad. Busca una emisión cómoda y escucha la resonancia.', 'Se te escapa el aire antes del final. Vamos a repartirlo desde el inicio de la frase.', 'Al cambiar de registro pierdes la vocal. Hazlo primero despacio y sin volumen.'],
  },
  'Manu Guix': {
    good: ['Ahora sí: estás dentro del tempo y la afinación se sostiene hasta el final.', 'Ese acorde ha quedado limpio. Escucha la voz de al lado y no lo estropees subiendo el volumen.', 'Le das un poco de arrr, de intención, y funciona. Pero sin adelantar la entrada.', 'Bien ese final. Quiero exactamente esa precisión cuando esté la banda.', 'La dinámica ya cuenta algo. Guarda fuerza para el último estribillo.'],
    bad: ['No, paramos. La entrada va con el piano, no cuando te apetece. Otra vez desde ahí.', 'Estás por debajo de la nota. Escucha el acorde antes de atacar.', 'El tempo no puede ir detrás de tus nervios. Marca el pulso y entra conmigo.', 'Le das un poco de arrr, sí, pero primero afina. La intención no sustituye a la nota.', 'No os escucháis: cada voz está haciendo su final. Respiramos juntos y repetimos.'],
  },
  'Vicky Gómez': {
    good: ['Ahora el movimiento acompaña a la música. Guarda esa energía sin perder el aire.', 'Bien los cambios de peso. La transición ya no parece un paso separado.', 'Os habéis encontrado en la misma cuenta. Esa coordinación es la que quiero en la gala.', 'La mirada está arriba y la postura abierta. Eso hace que el gesto llegue.', 'Ese desplazamiento ya es natural. Repite cantando para fijarlo de verdad.'],
    bad: ['La coreografía no puede hacer que dejes de cantar. Vamos a ajustar el esfuerzo.', 'Llegas tarde al cambio de peso. Cuenta cinco, seis, siete, ocho y vuelve a entrar.', 'No mires al suelo para buscar la marca: apréndete el recorrido y mira al frente.', 'Los brazos van por un lado y la canción por otro. Necesitamos una intención común.', 'De cara a la gala quiero ese desplazamiento limpio, sin atropellar al compañero.'],
  },
  'Abril Zamora': {
    good: ['Amore, ahora te creo. No adornes más ese momento: quédate ahí.', 'Amore, has escuchado de verdad al compañero y la canción ha cambiado.', 'Eso, amore. Esa pausa cuenta más que un gesto enorme.', 'Amore, se entiende a quién le estás cantando. Conserva esa imagen para la gala.', 'Qué bonito, amore. Has dejado de demostrar y has empezado a contar.'],
    bad: ['Amore, estás diciendo palabras preciosas, pero no sé qué te pasa por dentro.', 'No me fabriques la lágrima, amore. Piensa a quién necesitas decirle esto.', 'Amore, baja el gesto y escucha el texto. No hace falta subrayarlo todo.', 'Te estás escondiendo detrás de la técnica, amore. ¿Qué quieres conseguir de esa persona?', 'Amore, no desconectes cuando canta el otro. La historia también sigue en tu silencio.'],
  },
  'Noemí Galera': {
    good: ['A esto ya podemos ponerle un lacito y llevarlo a la gala. Ahora, no os confiéis.', 'Me habéis emocionado. Dadme un momento, que se me han saltado las lágrimas.', 'Así sí. Se nota que habéis trabajado y que sabéis qué queréis contar.', 'Esto es lo que quería ver: una actuación que empieza y acaba con intención.', 'Hoy habéis dado un paso enorme. Guardad lo que ha pasado aquí y cuidadlo.'],
    bad: ['Esto ahora mismo es un buñuelito. Hay que ordenar las entradas y ponerse a trabajar.', 'No me vale que ayer saliera bien. Necesito verlo aquí, de principio a fin.', 'Hay una canción bonita debajo de este lío. Quitad lo que sobra y volved al principio.', 'Con esta inseguridad no podemos llegar a la gala. Quiero un plan de trabajo claro.', 'No os estáis tomando en serio los detalles. Ahí es donde se os está cayendo la actuación.'],
  },
};

export function teacherFeedback({good,kind,group=false,dance=0},random=Math.random,used=new Set()) {
  const eligible=['Mamen Márquez','Manu Guix','Abril Zamora','Noemí Galera',...(group || dance>=8?['Vicky Gómez']:[])];
  const selected=[];
  if(group) selected.push('Manu Guix');
  const count=1+Math.floor(random()*2);
  while(selected.length<count) {
    const options=eligible.filter(name=>!selected.includes(name));
    selected.push(options[Math.floor(random()*options.length)]);
  }
  return selected.map(teacher=>{
    const bank=teachers[teacher][good?'good':'bad'];
    const fresh=bank.filter(text=>!used.has(text));
    const choices=fresh.length?fresh:bank;
    const text=choices[Math.floor(random()*choices.length)];used.add(text);
    return {teacher,text:`${text}${kind==='mic'?' Ese es el objetivo para la gala.':''}`};
  });
}
