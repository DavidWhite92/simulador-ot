import {useContext,useState} from 'react';
import catalog from '../lib/staffCatalog.json';
import {staffRoles,defaultStaff} from '../lib/staff';
import {readCustomPhoto} from '../lib/customPhoto';
import {StaffContext} from "../lib/StaffContext";
export function StaffBadge({name,photo}) {
  const staff=useContext(StaffContext);
  const image=photo ?? [...Object.values(staff.teachers || {}),...(staff.judges || [])].find(p=>p.name===name)?.photo;
  return <span className="inline-flex items-center gap-2">{image && <img src={image} alt="" className="h-[31px] w-[31px] rounded object-cover" />}<strong>{name}</strong></span>;
}
function PersonEditor({label,person,options,onChange}) {
  const [error,setError]=useState('');
  return <div className="space-y-2 rounded border p-3"><h3 className="font-semibold">{label}</h3>
    <select aria-label={`Elegir ${label}`} className="w-full rounded border p-2" value={options.some(p=>p.photo===person.photo)?person.photo:''} onChange={e=>onChange(options.find(p=>p.photo===e.target.value) || {name:'',photo:''})}><option value="">Personalizado / sin foto</option>{options.map(p=><option key={p.photo} value={p.photo}>{p.name}</option>)}</select>
    <input aria-label={`Nombre de ${label}`} placeholder={label} maxLength={60} value={person.name} onChange={e=>onChange({...person,name:e.target.value})} className="w-full rounded border p-2" />
    {person.photo && <img src={person.photo} alt={person.name} className="h-[62px] w-[62px] rounded object-cover" />}
    <label className="block text-sm">Subir foto (máximo 5 MB)<input type="file" accept="image/*" className="block w-full" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const photo=await readCustomPhoto(file);onChange({...person,photo});setError('');}catch(err){setError(err.message);}e.target.value='';}} /></label>
    {person.photo && <button type="button" onClick={()=>onChange({...person,photo:''})}>Quitar foto</button>}<p role="alert">{error}</p>
  </div>;
}
export default function StaffSetup({staff,setStaff,judgeNames,setJudgeNames}) {
  return <div className="space-y-3">
    <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Profesorado de la Academia</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(staffRoles).map(([role,label])=><PersonEditor key={role} label={label} person={staff.teachers[role] || defaultStaff.teachers[role]} options={catalog.Profesores} onChange={person=>setStaff(s=>({...s,teachers:{...s.teachers,[role]:person}}))} />)}</div></details>
    <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Jueces del concurso</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{judgeNames.map((name,i)=><PersonEditor key={i} label={`Juez ${i+1}`} person={{...staff.judges[i],name}} options={catalog.Jurado} onChange={person=>{setJudgeNames(names=>names.map((n,j)=>j===i?person.name:n));setStaff(s=>({...s,judges:s.judges.map((p,j)=>j===i?person:p)}));}} />)}</div></details>
  </div>;
}
