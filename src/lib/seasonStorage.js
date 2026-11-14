let opening;
function database() {
  if(!opening) opening=new Promise((resolve,reject)=>{
    const request=indexedDB.open('ot-simulator',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('records');
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Cierra otras pestañas del simulador e inténtalo de nuevo.'));
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=undefined;};resolve(db);};
  }).catch(error=>{opening=undefined;throw error;});
  return opening;
}
export async function readRecord(key) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readonly');
    const request=tx.objectStore('records').get(key);
    tx.oncomplete=()=>resolve(request.result);
    tx.onabort=()=>reject(tx.error || new Error('No se pudo leer el guardado.'));
    tx.onerror=()=>reject(tx.error);
  });
}
export async function writeRecord(key,value) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readwrite');
    tx.objectStore('records').put(value,key);
    // Only confirm success after the transaction is durably committed.
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error || new Error('No se pudo completar el guardado.'));
    tx.onerror=()=>reject(tx.error);
  });
}

export function createSeasonStorage({read=readRecord,write=writeRecord,local=globalThis.localStorage}={}) {
  const legacy=code=>local.getItem(`ot_save_${code}`);
  return {
    async load(code) {
      let record;
      try {record=await read(`save:${code}`);} catch(error) {if(!legacy(code))throw error;}
      return record?.packed || legacy(code);
    },
    async availableCode() {
      const start=Math.floor(Math.random()*9000);
      for(let i=0;i<9000;i++) {
        const code=String(1000+(start+i)%9000);
        if(!legacy(code) && !await read(`save:${code}`)) return code;
      }
      throw new Error('No quedan códigos libres. Descarga una copia de la temporada.');
    },
    async save(code,packed) {
      await write(`save:${code}`,{packed,updatedAt:Date.now()});
    },
    async migrateLegacy() {
      const keys=Array.from({length:local.length},(_,i)=>local.key(i)).filter(key=>/^ot_save_\d+$/.test(key || ''));
      for(const key of keys) {
        const packed=local.getItem(key), dbKey=`save:${key.slice(8)}`;
        if(!packed) continue;
        const existing=await read(dbKey);
        if(!existing) await write(dbKey,{packed,updatedAt:Date.now()});
        const verified=await read(dbKey);
        // Never discard an unverified copy or anything changed by another tab.
        if(verified?.packed===packed && local.getItem(key)===packed) local.removeItem(key);
      }
    },
  };
}
