import { useEffect, useState } from 'react';
import { setMusicVolume, unlockMusic } from '../lib/audio';

export default function MusicControl() {
  const [open,setOpen]=useState(false);
  const [volume,setVolume]=useState(0.5);
  const [muted,setMuted]=useState(false);
  useEffect(() => {
    document.addEventListener('pointerdown',unlockMusic);
    document.addEventListener('keydown',unlockMusic);
    return () => { document.removeEventListener('pointerdown',unlockMusic); document.removeEventListener('keydown',unlockMusic); };
  },[]);
  useEffect(() => { setMusicVolume(volume,muted); },[volume,muted]);
  return <div className="fixed right-5 top-4 z-50 rounded-xl border bg-white p-2 shadow-lg">
    <button aria-label={open ? muted ? 'Activar música' : 'Silenciar música' : 'Abrir volumen de música'} title="Música y volumen" onClick={() => { if(!open) setOpen(true); else setMuted(v=>!v); }} className="px-3 text-2xl">{muted || volume===0 ? '♪̸' : '♫'}</button>
    {open && <div className="flex items-center gap-2"><label className="text-sm">Volumen <input aria-label="Volumen de música" type="range" min="0" max="1" step="0.01" value={volume} onChange={e=>{setVolume(Number(e.target.value));setMuted(false);}} /></label><button aria-label="Cerrar control de volumen" onClick={()=>setOpen(false)}>×</button></div>}
  </div>;
}
