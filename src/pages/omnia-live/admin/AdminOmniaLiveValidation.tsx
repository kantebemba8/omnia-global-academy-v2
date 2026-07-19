import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { liveApi } from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';
export default function AdminOmniaLiveValidation(){
 const [items,setItems]=useState<any[]>([]),[error,setError]=useState('');
 useEffect(()=>{liveApi('admin_queue').then(d=>setItems(d.items||[])).catch(e=>setError(e instanceof Error?e.message:'Erreur'))},[]);
 return <AdminOmniaLiveShell title="Validation Omnia Live" subtitle="Soumissions pédagogiques, commerciales et publication.">{error&&<div className="mb-4 rounded-xl bg-red-50 p-4">{error}</div>}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(x=><Link key={x.id} to={`/admin/omnia-live/evenements/${x.id}`} className="rounded-2xl border bg-white p-5 hover:border-[#BF8813]"><div className="text-xs uppercase text-slate-400">{x.status}</div><div className="mt-1 font-bold text-[#002050]">{x.title}</div><div className="mt-2 text-sm text-slate-500">{x.organizer_display_name}</div></Link>)}{!items.length&&<div className="rounded-2xl bg-slate-50 p-8 text-slate-500">Aucune demande.</div>}</div></AdminOmniaLiveShell>
}
