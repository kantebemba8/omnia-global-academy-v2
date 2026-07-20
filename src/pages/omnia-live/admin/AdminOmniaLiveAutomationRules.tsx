import { useEffect,useState } from 'react';
import { AdminLayout } from '../../../components/AdminLayout';
import { liveApi } from '../liveApi';

export default function AdminOmniaLiveAutomationRules(){
 const [rows,setRows]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=()=>liveApi('admin_automation_rules').then(r=>setRows(r.rules||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);
 async function toggle(r:any){await liveApi('automation_rule_save',{method:'POST',body:JSON.stringify({...r,enabled:!r.enabled})});await load()}
 return <AdminLayout><div className="p-6 md:p-8"><h1 className="text-3xl font-black text-[#002050]">Automatisations Omnia Live</h1><p className="mt-2 text-slate-600">Règles globales et par événement.</p>{msg&&<div className="mt-4 rounded-xl bg-slate-50 p-4">{msg}</div>}<div className="mt-7 space-y-3">{rows.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5"><div><b>{r.rule_key}</b><div className="text-sm text-slate-500">{r.trigger_type} · {r.channel}{r.trigger_offset_minutes?` · ${r.trigger_offset_minutes} min`:''}</div></div><label className="flex items-center gap-2 text-sm font-semibold"><span>{r.enabled?'Actif':'Inactif'}</span><input type="checkbox" checked={!!r.enabled} onChange={()=>toggle(r)}/></label></div>)}</div></div></AdminLayout>
}