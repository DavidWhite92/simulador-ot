import {useId,useState} from 'react';
import {motion as Motion} from 'framer-motion';
import {validateReparto,validateDistribution} from '../lib/songEditor';
import {Button} from './ui/button';

export default function SongDistribution({reparto,groupSong,contestants,songs,manual,nominees=[],soloOnly=false,direct=false,onConfirm}) {
  const [rows,setRows]=useState(()=>reparto.map(r=>({...r,members:manual && !soloOnly && !r.members.some(id=>nominees.includes(id)) ? [] : [...r.members]})).sort((a,b)=>Number(b.members.some(id=>nominees.includes(id)))-Number(a.members.some(id=>nominees.includes(id)))));
  const [group,setGroup]=useState(groupSong || '');
  const [editing]=useState(manual), [step,setStep]=useState(0), [selected,setSelected]=useState(null), [error,setError]=useState('');
  const [editPhase,setEditPhase]=useState(1);
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
    if(rows[i].members.includes(id)) return;
    setRows(rs=>{
      const allowed=expected.filter(x=>x===id).length;
      const count=rs.flatMap(r=>r.members).filter(x=>x===id).length;
      let removed=false;
      return rs.map((r,j)=>{
        if(j===i) return {...r,members:[...r.members,id]};
        if(count>=allowed && !removed && r.members.includes(id)) {removed=true;return {...r,members:r.members.filter(x=>x!==id)};}
        return r;
      });
    });setSelected(null);setError('');
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
      <ol className="flex flex-wrap gap-3 text-sm">{['Distribución','Concursantes','Canciones'].map((label,i)=><li key={label} aria-current={editPhase===i+1?'step':undefined} className={editPhase===i+1?'font-bold text-blue-700':''}>{i+1}. {label}</li>)}</ol>
      {groupSong && <div className="rounded border bg-blue-50 p-3"><strong>Grupal · todos los concursantes</strong>{editPhase===3 && search(group,setGroup)}</div>}
      {editPhase===1 && <p className="text-sm">Elige solistas, dúos y tríos. Plazas: {rows.reduce((n,r)=>n+({solo:1,duo:2,trio:3}[r.type] || 1),0)} / {expected.length}.</p>}
      {editPhase===2 && !soloOnly && <><p className="text-sm">Arrastra una foto al grupo o selecciónala y pulsa «Colocar aquí». Pulsa una foto asignada para quitarla.</p>
        <div className="flex flex-wrap gap-2">{people.filter(c=>!nominees.includes(c.id)).map(c=><button key={c.id} type="button" title={c.name} aria-label={`Seleccionar a ${c.name}`} draggable onDragStart={e=>e.dataTransfer.setData('text/plain',String(c.id))} onClick={()=>setSelected(c.id)} className={`rounded border p-1 ${selected===c.id?'ring-2 ring-blue-500':''}`}><img src={c.photo || '/ot_photos/sinfoto.gif'} alt={c.name} width="31" height="31" className="h-[31px] w-[31px] object-cover" /></button>)}</div></>}
      {editPhase===3 && <datalist id={listId}>{songs.map(song=><option key={song} value={song} />)}</datalist>}
      {rows.map((r,i)=><div key={i} onDragOver={e=>{if(editPhase===2)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(editPhase!==2)return;const c=people.find(c=>String(c.id)===e.dataTransfer.getData('text/plain'));assign(c?.id,i);}} className="space-y-2 rounded border p-3">
        <div className="flex flex-wrap items-center gap-3"><strong>{i+1}. {({solo:'Solista',duo:'Dúo',trio:'Trío'})[r.type]}{r.members.some(id=>nominees.includes(id))?' · Nominado':''}</strong>
          {editPhase===1 && <><select aria-label={`Formato actuación ${i+1}`} value={r.type || 'solo'} disabled={locked(r)} onChange={e=>update(i,{type:e.target.value,members:[]})}><option value="solo">Solista</option><option value="duo">Dúo</option><option value="trio">Trío</option></select>
          <button type="button" aria-label="Subir actuación" onClick={()=>move(i,-1)}>↑</button><button type="button" aria-label="Bajar actuación" onClick={()=>move(i,1)}>↓</button>
          {!locked(r) && <button type="button" onClick={()=>setRows(rows.filter((_,j)=>j!==i))}>Quitar grupo</button>}</>}
        </div>
        {editPhase>=2 && <div className="flex min-h-12 flex-wrap gap-2">{r.members.map(id=><button key={id} type="button" title={person(id)?.name} aria-label={`Quitar a ${person(id)?.name}`} disabled={locked(r) || editPhase!==2} onClick={()=>update(i,{members:r.members.filter(x=>x!==id)})}><img className="h-[31px] w-[31px] object-cover" src={person(id)?.photo || '/ot_photos/sinfoto.gif'} alt={person(id)?.name} /></button>)}{editPhase===2 && !locked(r) && <button type="button" className="rounded border p-2" onClick={()=>assign(selected,i)}>Colocar aquí · {r.members.length}/{({solo:1,duo:2,trio:3})[r.type]}</button>}</div>}
        {editPhase===3 && search(r.song,song=>update(i,{song}))}
      </div>)}
      {editPhase===1 && !soloOnly && <Button variant="outline" onClick={()=>setRows([...rows,{type:'solo',members:[],song:'',valor:''}])}>Añadir actuación</Button>}
      <div className="flex flex-wrap gap-2">
        {editPhase>1 && <Button variant="outline" onClick={()=>{setError('');setEditPhase(editPhase-1);}}>Atrás</Button>}
        {editPhase<3 ? <Button onClick={()=>{const err=validateDistribution(rows,expected,nominees,soloOnly,editPhase===2);setError(err);if(err){window.alert(err);return;}setEditPhase(editPhase+1);}}>{editPhase===1?'Repartir concursantes':'Elegir canciones'}</Button> : <Button onClick={confirm}>Confirmar reparto</Button>}
      </div>
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
