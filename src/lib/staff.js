export const staffRoles={director:'Dirección de la Academia',music:'Dirección musical',acting:'Interpretación',technique:'Técnica vocal',coach:'Vocal coach',dance:'Coreografía'};
export const defaultStaff={teachers:{
  director:{name:'Noemí Galera',photo:'/ot_photos/Profesores/NoemiGalera.gif'},
  music:{name:'Manu Guix',photo:'/ot_photos/Profesores/ManuGuix.gif'},
  acting:{name:'Abril Zamora',photo:'/ot_photos/Profesores/AbrilZamora.gif'},
  technique:{name:'Mamen Márquez',photo:'/ot_photos/Profesores/MamenMarquez.gif'},
  coach:{name:'Pablo Lluch',photo:'/ot_photos/Profesores/PabloLluch.gif'},
  dance:{name:'Vicky Gómez',photo:'/ot_photos/Profesores/VickyGomez.gif'},
},judges:Array.from({length:4},()=>({name:'',photo:''}))};
export function teacherIdentity(name,staff) {
  const role=Object.keys(defaultStaff.teachers).find(key=>defaultStaff.teachers[key].name===name);
  const person=staff?.teachers?.[role] || defaultStaff.teachers[role] || {name};
  return {...person,name:person.name?.trim() || staffRoles[role] || name};
}
