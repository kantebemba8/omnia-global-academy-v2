import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { liveApi } from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';
import {deliveryLabel,liveStatusLabel} from '../../../lib/omniaLiveLabels';

export default function AdminOmniaLiveEvents(){
 const [items,setItems]=useState<any[]>([]),[status,setStatus]=useState(''),[q,setQ]=useState(''),[error,setError]=useState('');
 const load=()=>liveApi('admin_events',{}, {status:status||undefined,q:q||undefined}).then(d=>setItems(d.items||[])).catch(e=>setError(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[status]);
 return <AdminOmniaLiveShell title="Tous les événements" subtitle="Tous les statuts, formats et organisateurs Omnia Live.">
  <div className="mb-5 flex flex-wrap gap-3"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="Rechercher..." className="rounded-xl border px-4 py-2"/><select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border px-4 py-2"><option value="">Tous statuts</option>{['draft','submitted','under_review','changes_requested','approved','published','live','completed','suspended','cancelled','rejected'].map(x=><option key={x} value={x}>{liveStatusLabel(x)}</option>)}</select><button onClick={load} className="rounded-xl bg-[#002050] px-4 py-2 font-bold text-white">Rechercher</button></div>
  {error&&<div className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
  <div className="overflow-hidden rounded-2xl border bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">Titre</th><th className="p-4">Organisateur</th><th className="p-4">Type</th><th className="p-4">Statut</th><th className="p-4">Date</th><th className="p-4"></th></tr></thead><tbody>{items.map(x=><tr key={x.id} className="border-t"><td className="p-4 font-semibold">{x.title}</td><td className="p-4">{x.organizer_display_name||'—'}</td><td className="p-4">{deliveryLabel(x.delivery_type)}</td><td className="p-4">{liveStatusLabel(x.status)}</td><td className="p-4">{x.starts_at?new Date(x.starts_at).toLocaleString('fr-FR'):'—'}</td><td className="p-4"><Link to={`/admin/omnia-live/evenements/${x.id}`} className="font-bold text-[#002050]">Gérer</Link></td></tr>)}</tbody></table></div>{!items.length&&<div className="p-8 text-center text-slate-500">Aucun événement.</div>}</div>
 </AdminOmniaLiveShell>
}