import {useId,useState} from 'react';
import {motion as Motion} from 'framer-motion';
import {validateReparto} from '../lib/songEditor';
import {Button} from './ui/button';

export default function SongDistribution({reparto,groupSong,contestants,songs,manual,nominees=[],soloOnly=false,direct=false,onConfirm}) {
  const [rows,setRows]=useState(()=>reparto.map(r=>({...r,members:[...r.members]})).sort((a,b)=>Number(b.members.some(id=>nominees.includes(id)))-Number(a.members.some(id=>nominees.includes(id)))));
  const [group,setGroup]=useState(groupSong || '');
  const [editing]=useState(manual), [step,setStep]=useState(0), [selected,setSelected]=useState(null), [error,setError]=useState('');
  const listId=useId();
  const expected=reparto.flatMap(r=>r.members);
  const people=contestants.filter(c=>expected.includes(c.id));
  const person=id=>contestants.find(c=>c.id===id);
  const locked=r=>soloOnly || r.members.some(id=>nominees.includes(id));
  const update=(i,patch)=>setRows(rs=>rs.map((r,j)=>j===i?{...r,...patch}:r));
  function assign(id,i) {
    if(id==null || soloOnly || nominees.includes(id) || locked(rows[i])) return;
    const capacity={solo:1,duo:2,trio:3}[rows[i].type] || 1;
    if(rows[i].members.length>=capacity && !rows[i].members.includes(id)) {setError('Ese grupo está completo. Quita primero un concursante.');return;}
    setRows(rs=>rs.map((r,j)=>({...r,members:j===i?[...r.members.filter(x=>x!==id),id]:r.members.filter(x=>x!==id)})));setSelected(null);setError('');
  }
  function move(i,d) {
    const j=i+d;
    if(j<0 || j>=rows.length || (i<nominees.length)!==(j<nominees.length)) return;
    const next=[...rows]; [next[i],next[j]]=[next[j],next[i]];setRows(next);
  }
  const search=(value,onChange)=><input aria-label="Buscar canción o artista" list={listId} className="min-w-0 w-full rounded border p-2" value={value} placeholder="Escribe una canción o artista…" onChange={e=>onChange(e.target.value)} />;
  const entries=[...(group?[{song:group,members:[],group:true}]:[]),...rows];
  const entry=entries[Math.floor(step/3)];
  const phase=step%3;
  const isNom=entry?.members.some(id=>nominees.includes(id));
  function confirm() {
    const assigned=rows.flatMap(row=>row.members);
    const missing=people.filter(c=>!assigned.includes(c.id));
    const err=missing.length ? `Faltan concursantes por asignar: ${missing.map(c=>c.name).join(', ')}.` : groupSong && !group ? 'Selecciona la canción grupal.' : validateReparto(rows,group,songs,expected,nominees,soloOnly);
    setError(err);
    if(err) {window.alert(err);return;}
    onConfirm(rows,group);
  }
  return <section className="space-y-4 rounded-xl border bg-white p-3">
    <h3 className="text-xl font-semibold">Reparto de temas</h3>
    <p role="alert" className="text-red-700">{error}</p>
    {editing ? <>
      <datalist id={listId}>{songs.map(song=><option key={song} value={song} />)}</datalist>
      {groupSong && <label className="block">Actuación grupal{search(group,setGroup)}</label>}
      {!soloOnly && <><p className="text-sm">Arrastra cada concursante a su canción o selecciónalo y pulsa el grupo. Pulsa su nombre dentro del grupo para quitarlo.</p>
        <div className="flex flex-wrap gap-2">{people.filter(c=>!nominees.includes(c.id)).map(c=><button key={c.id} type="button" draggable onDragStart={e=>e.dataTransfer.setData('text/plain',String(c.id))} onClick={()=>setSelected(c.id)} className={`rounded border p-1 ${selected===c.id?'bg-blue-100':''}`}><img src={c.photo || '/ot_photos/sinfoto.gif'} alt="" width="31" height="31" className="inline-block h-[31px] w-[31px] object-cover" /> {c.name}</button>)}</div></>}
      {rows.map((r,i)=><div key={i} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const c=people.find(c=>String(c.id)===e.dataTransfer.getData('text/plain'));assign(c?.id,i);}} className="space-y-2 rounded border p-2">
        <div className="flex flex-wrap items-center gap-2"><strong>{i+1}.</strong><select aria-label={`Formato actuación ${i+1}`} value={r.type || 'solo'} disabled={locked(r)} onChange={e=>update(i,{type:e.target.value,members:[]})}><option value="solo">Solista</option><option value="duo">Dúo</option><option value="trio">Trío</option></select>
          <button type="button" aria-label="Subir actuación" onClick={()=>move(i,-1)}>↑</button><button type="button" aria-label="Bajar actuación" onClick={()=>move(i,1)}>↓</button>
          {!locked(r) && <button type="button" onClick={()=>setRows(rows.filter((_,j)=>j!==i))}>Quitar grupo</button>}</div>
        {search(r.song,song=>update(i,{song}))}
        <div className="flex min-h-12 flex-wrap gap-2">{r.members.map(id=><button key={id} type="button" disabled={locked(r)} onClick={()=>update(i,{members:r.members.filter(x=>x!==id)})}><img className="inline-block h-[31px] w-[31px] object-cover" src={person(id)?.photo || '/ot_photos/sinfoto.gif'} alt="" /> {person(id)?.name}</button>)}{!locked(r) && <button type="button" className="rounded border p-2" onClick={()=>assign(selected,i)}>Añadir seleccionado aquí</button>}</div>
      </div>)}
      {!soloOnly && <Button variant="outline" onClick={()=>setRows([...rows,{type:'solo',members:[],song:'',valor:''}])}>Añadir actuación</Button>}
      <Button onClick={confirm}>Confirmar reparto</Button>
    </> : entry && !direct ? <>
      <Motion.div key={step} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="space-y-4 py-6 text-center">
        <p>{entry.group?'Empezamos con la canción grupal.':isNom?'Como nominado, ha elegido su propia canción para defender su plaza.':'Vamos con el siguiente tema de examen.'}</p>
        {phase===0 ? <p>{entry.song.match(/»\s*\((.*)\)/)?.[1] ? `Una canción de ${entry.song.match(/»\s*\((.*)\)/)[1]}…` : 'Una nueva canción os espera…'}</p> : <h4 className="text-xl font-bold">{entry.song}</h4>}
        {phase===1 && !entry.group && <p>Y {entry.members.length===1?'la va a cantar…':'la van a cantar…'}</p>}
        {phase===2 && (entry.group?<p>¡La cantáis todos!</p>:<div className="flex flex-wrap justify-center gap-4">{entry.members.map(id=><div key={id}><img className="mx-auto h-[62px] w-[62px] object-cover rounded" src={person(id)?.photo || '/ot_photos/sinfoto.gif'} alt="" /><p>{person(id)?.name}</p></div>)}</div>)}
      </Motion.div>
      <Button onClick={()=>setStep(step+1)}>{phase===0?'Revelar canción':phase===1?entry.group?'Continuar':'Revelar concursantes':'Siguiente tema'}</Button>
      <Button variant="outline" onClick={confirm}>Revelar reparto</Button>
    </> : <>
      {group && <p className="font-semibold">Actuación grupal: {group}</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Concursantes</th><th>Canción</th></tr></thead><tbody>{rows.map((row,i)=><tr key={i} className="border-t"><td className="p-2"><div className="flex flex-wrap gap-2">{row.members.map(id=><span key={id}><img src={person(id)?.photo || '/ot_photos/sinfoto.gif'} alt="" className="inline-block h-[31px] w-[31px] object-cover" /> {person(id)?.name}</span>)}</div></td><td>{row.song}</td></tr>)}</tbody></table></div>
      <Button onClick={confirm}>Continuar</Button>
    </>}
  </section>;
}
