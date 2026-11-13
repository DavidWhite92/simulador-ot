import {useState} from 'react';
import {customSongs} from '../lib/songEditor';
export default function AddSong({onAdd}) {
  const [title,setTitle]=useState(''), [artist,setArtist]=useState(''), [message,setMessage]=useState('');
  const [stats,setStats]=useState({afinacion:7,baile:7,presencia:7,emocion:7});
  function save(e) {
    e.preventDefault();
    const song={title:`«${title.trim()}» (${artist.trim()})`,...stats};
    const existing=customSongs();
    if(existing.some(s=>s.title.toLowerCase()===song.title.toLowerCase())) {setMessage('Esta canción ya existe.');return;}
    try {localStorage.setItem('ot_custom_songs',JSON.stringify([...existing,song]));} catch {setMessage('No se pudo guardar la canción en el dispositivo.');return;}
    onAdd(song); setTitle('');setArtist('');setMessage('Canción añadida al catálogo.');
  }
  return <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Añadir canciones</summary><form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2">
    <label>Tema<input required maxLength={160} className="block w-full border p-2" value={title} onChange={e=>setTitle(e.target.value)} /></label>
    <label>Artista<input required maxLength={160} className="block w-full border p-2" value={artist} onChange={e=>setArtist(e.target.value)} /></label>
    {Object.keys(stats).map(k=><label key={k}>{({afinacion:'Afinación',baile:'Baile',presencia:'Presencia',emocion:'Emoción'})[k]}<input type="number" min="0" max="15" required className="block w-full border p-2" value={stats[k]} onChange={e=>setStats({...stats,[k]:Number(e.target.value)})} /></label>)}
    <button className="rounded border p-2" type="submit">Añadir canción</button><p role="status">{message}</p>
  </form></details>;
}
