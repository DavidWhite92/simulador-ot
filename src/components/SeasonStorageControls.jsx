import {useState} from 'react';
import {Button} from './ui/button';
import {createSeasonStorage} from '../lib/seasonStorage';
import {loadCustomLibrary,restoreCustomLibrary} from '../lib/customLibrary';

export default function SeasonStorageControls({started,buildPayload,pack,unpack,saveCode,setSaveCode,onLoad}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[loading,setLoading]=useState(false),[code,setCode]=useState('');
  const storage=createSeasonStorage();
  async function snapshot() {
    return {...buildPayload(),customContestants:await loadCustomLibrary()};
  }
  function download(payload) {
    const blob=new Blob([JSON.stringify({format:'ot-season-backup',version:1,packed:pack({...payload,saveCode:null})})],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`OT-${payload.mode}-gala-${payload.gala}-${new Date().toISOString().slice(0,10)}.ot.json`;
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  async function save(fileOnly=false) {
    if(busy)return;
    setBusy(true);setMessage('');let payload;
    try {
      payload=await snapshot();
      if(fileOnly) {download(payload);setMessage('Copia preparada para descargar, con la temporada y todos tus concursantes custom.');return;}
      const target=saveCode || await storage.availableCode();
      await storage.save(target,pack({...payload,saveCode:target}));
      setSaveCode(target);
      setMessage(`Temporada guardada. Código: ${target}. Los siguientes guardados actualizarán esta misma partida. El código funciona en este navegador; descarga una copia para usarla en otro dispositivo.`);
      // Migration is optional: a failed migration never invalidates the new save.
      try {await storage.migrateLegacy();} catch { /* Original copies remain untouched. */ }
    } catch(error) {
      if(payload) {
        download(payload);
        setMessage('No se ha podido guardar en el navegador. Se ha preparado una copia descargable con la temporada y tus concursantes custom. Comprueba que el archivo aparece en Descargas antes de cerrar.');
      } else setMessage(`No se pudo preparar el guardado: ${error.message}. Mantén esta página abierta y vuelve a intentarlo.`);
    } finally {setBusy(false);}
  }
  async function load(packed,localCode=null) {
    const payload=unpack(packed);
    if(payload?.v!==1 || !['telecinco','rtve'].includes(payload.mode) || !Array.isArray(payload.contestants)) throw new Error('El archivo no contiene una temporada compatible.');
    await restoreCustomLibrary(payload.customContestants || []);
    onLoad({...payload,saveCode:localCode});setLoading(false);
    setMessage('Temporada cargada. Los concursantes custom existentes se han conservado.');
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      {started && <><Button disabled={busy} onClick={()=>save()}>💾 {busy?'Guardando…':'Guardar'}</Button><Button disabled={busy} variant="outline" onClick={()=>save(true)}>Descargar copia</Button></>}
      <Button disabled={busy} variant="outline" onClick={()=>setLoading(!loading)}>⬇️ Cargar</Button>
    </div>
    {message && <p role="status" className="rounded-lg border bg-white p-3 text-sm">{message}</p>}
    {loading && <div className="space-y-3 rounded-xl border bg-white p-3">
      <form className="flex flex-wrap gap-2" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const packed=await storage.load(code.trim());if(!packed)throw new Error('No existe ese código en este navegador.');await load(packed,code.trim());}catch(error){setMessage(`No se pudo cargar: ${error.message}`);}finally{setBusy(false);}}}>
        <input aria-label="Código de la temporada" className="min-w-0 rounded border p-2" placeholder="Código de guardado" inputMode="numeric" pattern="[0-9]+" required value={code} onChange={e=>setCode(e.target.value)} /><Button disabled={busy}>Cargar código</Button>
      </form>
      <label className="block text-sm">O cargar una copia desde un archivo<input disabled={busy} type="file" accept=".json,.ot" className="mt-2 block w-full" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);try{const backup=JSON.parse(await file.text());if(backup.format!=='ot-season-backup' || backup.version!==1 || typeof backup.packed!=='string')throw new Error('Archivo de copia no válido.');await load(backup.packed);}catch(error){setMessage(`No se pudo cargar: ${error.message}`);}finally{setBusy(false);e.target.value='';}}} /></label>
    </div>}
  </div>;
}
