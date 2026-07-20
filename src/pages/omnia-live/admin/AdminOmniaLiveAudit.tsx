import { useEffect,useState } from 'react';
import { AdminLayout } from '../../../components/AdminLayout';
import { liveApi } from '../liveApi';

export default function AdminOmniaLiveAudit(){
 const [rows,setRows]=useState<any[]>([]),[q,setQ]=useState(''),[action,setAction]=useState('');
 const load=()=>liveApi('audit_log_list',{}, {q:q||undefined,action:action||undefined}).then(r=>setRows(r.items||[])).catch(()=>{});
 useEffect(()=>{load()},[]);
 return <AdminLayout><div className="p-6 md:p-8"><h1 className="text-3xl font-black text-[#002050]">Journal d’audit Omnia Live</h1><div className="mt-5 flex flex-wrap gap-3"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher..." className="rounded-xl border px-4 py-2"/><input value={action} onChange={e=>setAction(e.target.value)} placeholder="Action" className="rounded-xl border px-4 py-2"/><button onClick={load} className="rounded-xl bg-[#002050] px-4 py-2 font-bold text-white">Filtrer</button></div><div className="mt-7 overflow-hidden rounded-2xl border bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Date</th><th className="p-3">Acteur</th><th className="p-3">Rôle</th><th className="p-3">Action</th><th className="p-3">Entité</th><th className="p-3">Résultat</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t"><td className="p-3">{new Date(r.created_at).toLocaleString()}</td><td className="p-3">{r.actor_user_id||'Système'}</td><td className="p-3">{r.actor_role||'—'}</td><td className="p-3 font-semibold">{r.action}</td><td className="p-3">{r.entity_type||'—'}</td><td className="p-3">{r.result}</td></tr>)}</tbody></table></div></div></div></AdminLayout>
}