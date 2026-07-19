import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { liveApi } from '../liveApi';
import OrganizerShell from './OrganizerShell';

export default function OrganizerEvents(){
 const [items,setItems]=useState<any[]>([]),[status,setStatus]=useState(''),[q,setQ]=useState(''),[err,setErr]=useState('');
 const load=()=>liveApi('organizer_events',{}, {status:status||undefined,q:q||undefined}).then(d=>setItems(d.items||[])).catch(e=>setErr(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[status]);
 return <OrganizerShell title="Mes événements" subtitle="Brouillons, validation, publication, direct et historique.">
  <div className="mb-5 flex flex-wrap gap-3"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="Rechercher..." className="rounded-xl border px-4 py-2"/><select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border px-4 py-2"><option value="">Tous statuts</option>{['draft','submitted','under_review','changes_requested','approved','published','live','completed','suspended','cancelled','rejected'].map(x=><option key={x}>{x}</option>)}</select><button onClick={load} className="rounded-xl bg-[#002050] px-4 py-2 font-bold text-white">Rechercher</button></div>
  {err&&<div className="mb-4 rounded-xl bg-red-50 p-4">{err}</div>}
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(x=><div key={x.id} className="rounded-2xl border bg-white p-5"><div className="text-xs uppercase text-slate-400">{x.status}</div><div className="mt-1 font-bold text-[#002050]">{x.title}</div><div className="mt-2 text-sm text-slate-500">{x.delivery_type} · {x.starts_at?new Date(x.starts_at).toLocaleString():'Pas de date'}</div><div className="mt-4 flex flex-wrap gap-2">{['draft','changes_requested'].includes(x.status)&&<Link to={`/omnia-live/studio/${x.id}`} className="rounded-lg bg-[#002050] px-3 py-2 text-sm font-bold text-white">Reprendre Studio</Link>}<Link to={`/omnia-live/organisateur/evenements/${x.id}`} className="rounded-lg border px-3 py-2 text-sm font-semibold">Gérer</Link>{['published','live'].includes(x.status)&&<Link to={`/omnia-live/${x.id}/organiser`} className="rounded-lg border border-[#BF8813] px-3 py-2 text-sm font-semibold">Salle Live</Link>}</div></div>)}{!items.length&&<div className="rounded-2xl bg-slate-50 p-8 text-slate-500">Aucun événement.</div>}</div>
 </OrganizerShell>
}
