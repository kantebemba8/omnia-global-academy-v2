import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { CheckCircle2, Clock3, RefreshCw, ShieldCheck, UserRoundCog, XCircle } from 'lucide-react';

const API=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const BLUE='#002050', GOLD='#BF8813';
type Tab='assisted'|'certifications';

async function call(action:string,body:any={}){
  const r=await fetch(API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({action,...body})});
  const d=await r.json(); if(!r.ok||d.success===false) throw new Error(d.message||d.error||'Erreur'); return d;
}
const frStatus=(s:string)=>({pending:'En attente',in_progress:'En cours',completed:'Terminée',rejected:'Refusée',validated:'Validée',expired:'Expirée'}[s]||s||'—');

export default function AdminAssistedCourses(){
 const [tab,setTab]=useState<Tab>('assisted'),[items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){setLoading(true);setError('');try{const d=await call(tab==='assisted'?'list_assisted_requests':'admin_list_course_certifications');setItems(d.items||[])}catch(e){setError(e instanceof Error?e.message:'Erreur')}finally{setLoading(false)}}
 useEffect(()=>{load()},[tab]);
 async function update(id:string,status:string){try{await call(tab==='assisted'?'admin_update_assisted_request':'admin_update_course_certification',{id,status});await load()}catch(e){setError(e instanceof Error?e.message:'Erreur')}}
 return <AdminLayout><div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
   <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-gray-200 pb-5">
     <div><p className="text-xs font-semibold uppercase tracking-[.14em]" style={{color:GOLD}}>Formations & CPD</p>
       <h1 className="text-2xl font-black mt-1" style={{color:BLUE}}>Saisie assistée & certifications</h1>
       <p className="text-sm text-gray-500 mt-1">Traitez les demandes reçues depuis le Studio de formation.</p></div>
     <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600"><RefreshCw size={15}/>Actualiser</button>
   </div>
   <div className="flex gap-6 border-b border-gray-200">
     <button onClick={()=>setTab('assisted')} className="pb-3 text-sm font-semibold border-b-2" style={{color:tab==='assisted'?BLUE:'#667085',borderColor:tab==='assisted'?GOLD:'transparent'}}>Saisie assistée</button>
     <button onClick={()=>setTab('certifications')} className="pb-3 text-sm font-semibold border-b-2" style={{color:tab==='certifications'?BLUE:'#667085',borderColor:tab==='certifications'?GOLD:'transparent'}}>Certifications de formations</button>
   </div>
   {error&&<div className="border-l-4 border-red-500 pl-4 py-2 text-sm text-red-700">{error}</div>}
   {loading?<div className="py-16 text-center text-sm text-gray-400">Chargement…</div>:items.length===0?<div className="border-y border-gray-200 py-14 text-center text-sm text-gray-500">Aucune demande.</div>:
   <div className="border-t border-gray-200">{items.map(x=><div key={x.id} className="py-4 border-b border-gray-100">
     <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
       <div className="min-w-0">
         <div className="flex items-center gap-2">{tab==='assisted'?<UserRoundCog size={17} color={GOLD}/>:<ShieldCheck size={17} color={GOLD}/>}
           <h2 className="font-semibold text-sm" style={{color:BLUE}}>{tab==='assisted'?(x.courses?.title||'Formation sans titre'):(x.certification_name||'Certification')}</h2></div>
         <p className="text-xs text-gray-400 mt-1">{tab==='assisted'?`${x.users?.full_name||'Créateur'} · ${x.service_type||'Service non renseigné'}`:`${x.organization_name||'Organisme non renseigné'} · ${x.courses?.title||''}`}</p>
         <p className="text-sm text-gray-600 mt-2">{x.instructions||x.code||'Aucune précision supplémentaire.'}</p>
       </div>
       <div className="flex items-center gap-3 flex-wrap">
         <span className="text-xs font-semibold text-gray-500">{frStatus(x.status)}</span>
         {tab==='assisted'?<>
           <button onClick={()=>update(x.id,'in_progress')} className="text-xs font-semibold text-gray-700 inline-flex items-center gap-1"><Clock3 size={13}/>Prendre en charge</button>
           <button onClick={()=>update(x.id,'completed')} className="text-xs font-semibold inline-flex items-center gap-1" style={{color:'#1E7A52'}}><CheckCircle2 size={13}/>Terminée</button>
           <button onClick={()=>update(x.id,'rejected')} className="text-xs font-semibold text-red-700 inline-flex items-center gap-1"><XCircle size={13}/>Refuser</button>
         </>:<>
           <button onClick={()=>update(x.id,'validated')} className="text-xs font-semibold" style={{color:'#1E7A52'}}>Valider</button>
           <button onClick={()=>update(x.id,'rejected')} className="text-xs font-semibold text-red-700">Refuser</button>
           <button onClick={()=>update(x.id,'expired')} className="text-xs font-semibold text-gray-600">Marquer expirée</button>
         </>}
       </div>
     </div>
   </div>)}</div>}
 </div></AdminLayout>
}
