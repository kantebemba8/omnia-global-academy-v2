import { useEffect, useState } from 'react';
import { liveApi } from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';
export default function AdminOmniaLiveStructures(){
 const [packs,setPacks]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=()=>liveApi('admin_structure_packs').then(d=>setPacks(d.packs||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);
 return <AdminOmniaLiveShell title="Structures & Packs" subtitle="Packs institutionnels Omnia Live et permissions associées.">{msg&&<div className="mb-4 rounded-xl bg-slate-50 p-4">{msg}</div>}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{packs.map(x=><div key={x.id} className="rounded-2xl border bg-white p-5"><div className="text-xs uppercase text-slate-400">{x.status}</div><div className="mt-1 font-bold text-[#002050]">{x.pack_name}</div><div className="mt-3 text-sm text-slate-600">Structure: {x.structure_id}<br/>Membres: {x.max_members??'∞'}<br/>Lives: {x.max_live_events??'∞'}<br/>Stockage: {x.storage_gb??'—'} GB</div><div className="mt-3 flex flex-wrap gap-2 text-xs">{x.archive_enabled&&<span className="rounded bg-slate-100 px-2 py-1">Archive</span>}{x.certificates_enabled&&<span className="rounded bg-slate-100 px-2 py-1">Certificats</span>}{x.reports_enabled&&<span className="rounded bg-slate-100 px-2 py-1">Rapports</span>}</div></div>)}{!packs.length&&<div className="rounded-2xl bg-slate-50 p-8 text-slate-500">Aucun Pack Omnia Live configuré.</div>}</div></AdminOmniaLiveShell>
}
