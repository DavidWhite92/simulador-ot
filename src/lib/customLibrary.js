import {readRecord,writeRecord} from './seasonStorage.js';
const KEY='ot_custom_contestants';
function legacyCustoms() {
  const entries=JSON.parse(localStorage.getItem(KEY) || '[]');
  if(!Array.isArray(entries)) throw new Error('No se pudo leer la biblioteca de concursantes custom.');
  return entries;
}
export async function loadCustomLibrary() {
  const old=legacyCustoms();
  try {const stored=await readRecord('custom-library');return stored?.entries || old;}
  catch(error) {if(old.length)return old;throw error;}
}
export async function saveCustomLibrary(entries) {
  // Retain the original localStorage library as a compatibility copy.
  await writeRecord('custom-library',{entries});
}
export function mergeCustomLibraries(existing,incoming) {
  const result=[...existing];
  for(const entry of incoming) {
    if(!entry || typeof entry.name!=='string') throw new Error('La copia contiene un concursante custom inválido.');
    // A repeated import must not create duplicate contestants.
    const same=result.some(c=>c.name===entry.name && c.photo===entry.photo && c.gender===entry.gender && JSON.stringify(c.stats)===JSON.stringify(entry.stats));
    if(same)continue;
    let id=entry.id || `custom-${result.length}`;
    const base=id;let i=1;
    while(result.some(c=>String(c.id)===String(id))) id=`${base}-copia-${i++}`;
    result.push({...entry,id});
  }
  return result;
}
export async function restoreCustomLibrary(incoming=[]) {
  if(!incoming.length)return;
  const current=await loadCustomLibrary();
  await saveCustomLibrary(mergeCustomLibraries(current,incoming));
}
