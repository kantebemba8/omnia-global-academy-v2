import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Search, Trash2 } from 'lucide-react';

const API=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const BLUE='#002050', GOLD='#BF8813';

export default function AdminCourseHealth(){
 const [rows,setRows]=useState<any[]>([]),[summary,setSummary]=useState<any>({}),[loading,setLoading]=useState(true),[q,setQ]=useState(''),[error,setError]=useState('');
 const [deleteTarget,setDeleteTarget]=useState<{id:string;title:string}|null>(null);
 const [deleting,setDeleting]=useState(false);
 async function call(action:string,body:any={}){
   const r=await fetch(API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({action,...body})});
   const d=await r.json();if(!r.ok||d.success===false)throw new Error(d.message||d.error||'Erreur');return d;
 }
 async function load(){setLoading(true);setError('');try{const d=await call('health');setRows(d.rows||[]);setSummary(d.summary||{})}catch(e){setError(e instanceof Error?e.message:'Erreur')}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 async function removeConfirmed(){
   if(!deleteTarget)return;
   setDeleting(true);setError('');
   try{await call('delete_course',{course_id:deleteTarget.id});setDeleteTarget(null);await load()}
   catch(e){setError(e instanceof Error?e.message:'Suppression impossible')}
   finally{setDeleting(false)}
 }
 const filtered=useMemo(()=>rows.filter(x=>`${x.title} ${(x.issues||[]).join(' ')}`.toLowerCase().includes(q.toLowerCase())),[rows,q]);
 return <AdminLayout><div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
   <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-gray-200 pb-5">
     <div><p className="text-xs font-semibold uppercase tracking-[.14em]" style={{color:GOLD}}>Formations & CPD</p>
       <h1 className="text-2xl font-black mt-1" style={{color:BLUE}}>Santé des formations</h1>
       <p className="text-sm text-gray-500 mt-1">Contrôle opérationnel du catalogue. L’indice santé n’est pas la progression pédagogique de la formation.</p></div>
     <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600"><RefreshCw size={15}/>Actualiser</button>
   </div>
   <div className="grid grid-cols-2 lg:grid-cols-4 border-y border-gray-200">
     {[[Activity,'Formations',summary.total],[AlertTriangle,'À surveiller',summary.critical],[CheckCircle2,'Sans alerte',summary.healthy],[Activity,'Saisies en attente',summary.pending_assisted]].map(([I,l,v]:any,i)=>
       <div key={l} className={`py-4 px-3 ${i<3?'lg:border-r border-gray-200':''}`}><I size={17} color={GOLD}/><p className="text-xl font-black mt-2" style={{color:BLUE}}>{v??'—'}</p><p className="text-xs text-gray-500">{l}</p></div>)}
   </div>
   <div className="relative max-w-lg"><Search size={17} className="absolute left-3 top-2.5 text-gray-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher une formation ou une alerte" className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm"/></div>
   {error&&<div className="border-l-4 border-red-500 pl-4 py-2 text-sm text-red-700">{error}</div>}
   <div className="overflow-x-auto border-t border-gray-200"><table className="w-full text-sm">
     <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-200"><th className="py-3">Formation</th><th>Indice santé</th><th>Inscriptions</th><th>Progression apprenants</th><th>Alertes</th><th>Version</th><th></th></tr></thead>
     <tbody>{loading?<tr><td colSpan={7} className="py-12 text-center text-gray-400">Chargement…</td></tr>:filtered.map(x=><tr key={x.course_id} className="border-b border-gray-100">
       <td className="py-3 font-semibold" style={{color:BLUE}}>{x.title}</td>
       <td>{x.health_evaluable===false?<span className="text-gray-400">Non évaluée</span>:<span className="font-semibold">{x.score}/100</span>}</td>
       <td>{x.enrollments}</td><td>{Number(x.avg_progress||0).toFixed(0)} %</td>
       <td>{x.issues?.length?<div className="flex flex-wrap gap-1">{x.issues.map((i:string)=><span key={i} className="text-xs text-red-700">{i}</span>)}</div>:<span className="text-emerald-700">Aucune alerte</span>}</td>
       <td>{x.current_version||'1.0'}</td>
       <td><button onClick={()=>setDeleteTarget({id:x.course_id,title:x.title})} className="text-red-600" title="Supprimer définitivement"><Trash2 size={15}/></button></td>
     </tr>)}</tbody>
   </table></div>
   {deleteTarget&&<div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4">
     <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200 p-5">
       <h3 className="text-lg font-black" style={{color:BLUE}}>Supprimer la formation ?</h3>
       <p className="text-sm text-gray-600 mt-2">Vous allez supprimer définitivement <strong>« {deleteTarget.title} »</strong>.</p>
       <p className="text-xs text-gray-400 mt-2">La suppression sera refusée si la formation possède des inscriptions, commandes ou certificats afin de protéger l’historique métier.</p>
       <div className="flex justify-end gap-3 mt-5">
         <button type="button" disabled={deleting} onClick={()=>setDeleteTarget(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600">Annuler</button>
         <button type="button" disabled={deleting} onClick={removeConfirmed} className="px-4 py-2 rounded-lg text-white text-sm font-semibold bg-red-600 disabled:opacity-50">{deleting?'Suppression…':'Supprimer définitivement'}</button>
       </div>
     </div>
   </div>}
 </div></AdminLayout>
}
