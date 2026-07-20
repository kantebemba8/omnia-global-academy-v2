import { useEffect,useState } from 'react';
import { AdminLayout } from '../../../components/AdminLayout';
import { liveApi } from '../liveApi';

export default function AdminOmniaLiveIntegrity(){
 const [checks,setChecks]=useState<any[]>([]),[summary,setSummary]=useState<any>({}),[msg,setMsg]=useState('');
 const load=async()=>{try{const r=await liveApi('integrity_checks_run',{method:'POST',body:JSON.stringify({scope:'platform'})});setChecks(r.checks||[]);setSummary(r.summary||{})}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}};
 useEffect(()=>{load()},[]);
 async function resolve(id:string){await liveApi('integrity_check_resolve',{method:'POST',body:JSON.stringify({check_id:id,status:'resolved'})});await load()}
 return <AdminLayout><div className="p-6 md:p-8"><div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-3xl font-black text-[#002050]">Intégrité Omnia Live</h1><p className="mt-2 text-slate-600">Détection de données incohérentes, routes cassées et dépendances manquantes.</p></div><button onClick={load} className="rounded-xl bg-[#002050] px-4 py-3 font-bold text-white">Relancer l’audit</button></div>{msg&&<div className="mt-4 rounded-xl bg-slate-50 p-4">{msg}</div>}
 <div className="mt-7 grid gap-4 sm:grid-cols-4">{[['Critiques',summary.critical],['Erreurs',summary.error],['Avertissements',summary.warning],['OK',summary.resolved]].map(([l,v])=><div key={l} className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">{l}</div><div className="mt-2 text-2xl font-black text-[#002050]">{Number(v||0)}</div></div>)}</div>
 <div className="mt-7 space-y-3">{checks.map(c=><div key={c.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><div className="text-xs font-bold uppercase text-slate-400">{c.severity}</div><b>{c.check_key}</b><div className="mt-1 text-sm text-slate-500">{JSON.stringify(c.details)}</div></div>{c.status==='open'&&<button onClick={()=>resolve(c.id)} className="rounded-lg border px-3 py-2 text-sm font-bold">Marquer résolu</button>}</div></div>)}</div></div></AdminLayout>
}