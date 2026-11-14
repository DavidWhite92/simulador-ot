import {useState} from 'react';
import {customSongs} from '../lib/songEditor';
export default function AddSong({onAdd}) {
  const [title,setTitle]=useState(''), [artist,setArtist]=useState(''), [message,setMessage]=useState('');
  const [saved,setSaved]=useState(customSongs), [editing,setEditing]=useState(null);
  const [stats,setStats]=useState({afinacion:7,baile:7,presencia:7,emocion:7});
  function save(e) {
    e.preventDefault();
    if(!title.trim() || !artist.trim()) {setMessage('Escribe el tema y el artista.');return;}
    const song={title:`«${title.trim()}» (${artist.trim()})`,...stats};
    const existing=customSongs();
    if(existing.some(s=>s.title!==editing && s.title.toLowerCase()===song.title.toLowerCase())) {setMessage('Esta canción ya existe.');return;}
    const next=editing ? existing.map(s=>s.title===editing?song:s) : [...existing,song];
    try {localStorage.setItem('ot_custom_songs',JSON.stringify(next));} catch {setMessage('No se pudo guardar la canción en el dispositivo.');return;}
    onAdd(song,editing);setSaved(next);setEditing(null);setTitle('');setArtist('');setMessage('Canción guardada en el catálogo.');
  }
  return <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Añadir o editar canciones</summary><label className="mt-3 block">Canciones guardadas en este navegador<select className="block w-full border p-2" value={editing || ''} onChange={e=>{const song=saved.find(s=>s.title===e.target.value);setEditing(song?.title || null);const parts=song?.title.match(/^«(.*)» \((.*)\)$/);setTitle(parts?.[1] || '');setArtist(parts?.[2] || '');if(song)setStats(Object.fromEntries(Object.keys(stats).map(k=>[k,song[k] ?? 7])));setMessage('');}}><option value="">Crear una canción nueva</option>{saved.map(s=><option key={s.title} value={s.title}>{s.title}</option>)}</select></label><form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2">
    <label>Tema<input required maxLength={160} className="block w-full border p-2" value={title} onChange={e=>setTitle(e.target.value)} /></label>
    <label>Artista<input required maxLength={160} className="block w-full border p-2" value={artist} onChange={e=>setArtist(e.target.value)} /></label>
    {Object.keys(stats).map(k=><label key={k}>{({afinacion:'Afinación',baile:'Baile',presencia:'Presencia',emocion:'Emoción'})[k]}<input type="number" min="0" max="15" required className="block w-full border p-2" value={stats[k]} onChange={e=>setStats({...stats,[k]:Number(e.target.value)})} /></label>)}
    <button className="rounded border p-2" type="submit">{editing?'Guardar cambios':'Añadir canción'}</button><p role="status">{message}</p>
  </form></details>;
}
