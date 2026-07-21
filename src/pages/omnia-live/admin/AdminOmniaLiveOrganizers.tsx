import {useEffect,useMemo,useState} from 'react';
import {liveApi} from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';
import {omniaDialog} from '../../../lib/omniaDialog';

const tabs=[['all','Tous'],['pending','En attente'],['approved','Validés'],['changes_requested','Modifications demandées'],['rejected','Refusés'],['suspended','Suspendus']] as const;
export default function AdminOmniaLiveOrganizers(){
 const [rows,setRows]=useState<any[]>([]),[tab,setTab]=useState('all'),[msg,setMsg]=useState('');
 const load=()=>liveApi('admin_organizers').then(d=>setRows(d.organizers||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);
 const shown=useMemo(()=>tab==='all'?rows:rows.filter(x=>x.verification_status===tab),[rows,tab]);
 async function decide(id:string,decision:string){
  const needs=decision!=='approved';
  const labels:any={approved:'Valider cet organisateur',changes_requested:'Demander des modifications',rejected:'Refuser cette candidature',suspended:'Suspendre cet organisateur',reactivate:'Réactiver cet organisateur'};
  const r=await omniaDialog({title:labels[decision]||'Décision Organisateur',message:decision==='changes_requested'?'Indiquez clairement les éléments que le candidat doit modifier.':'Confirmez cette décision.',confirmLabel:'Confirmer',danger:['rejected','suspended'].includes(decision),inputLabel:'Message / motif',inputRequired:needs&&!['reactivate'].includes(decision)});
  if(!r.confirmed)return;
  try{await liveApi('admin_organizer_decision',{method:'POST',body:JSON.stringify({application_id:id,decision,note:r.value})});setMsg('Décision enregistrée.');await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }
 return <AdminOmniaLiveShell title="Organisateurs" subtitle="Candidatures, validation et gouvernance des organisateurs Omnia Live.">
  {msg&&<div className="mb-4 rounded-xl bg-slate-50 p-4">{msg}</div>}
  <div className="mb-5 flex flex-wrap gap-2">{tabs.map(([k,l])=><button key={k} onClick={()=>setTab(k)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab===k?'bg-[#002050] text-white':'border bg-white text-slate-600'}`}>{l} {k!=='all'&&`(${rows.filter(x=>x.verification_status===k).length})`}</button>)}</div>
  <div className="space-y-3">{shown.map(x=><article key={x.id} className="rounded-2xl border bg-white p-5">
   <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="font-bold text-[#002050]">{x.display_name}</div><div className="text-sm text-slate-500">{x.users?.full_name} · {x.users?.email}</div><div className="mt-1 text-xs text-slate-400">{x.organizer_type||'Organisateur'}{x.organization_name?` · ${x.organization_name}`:''} · {x.verification_status}</div></div>
   <div className="flex flex-wrap gap-2">
    {['pending','changes_requested','rejected'].includes(x.verification_status)&&<button onClick={()=>decide(x.id,'approved')} className="rounded-lg bg-[#002050] px-3 py-2 text-sm font-bold text-white">Valider</button>}
    {x.verification_status==='pending'&&<button onClick={()=>decide(x.id,'changes_requested')} className="rounded-lg border border-amber-300 px-3 py-2 text-sm text-amber-800">Demander modifications</button>}
    {!['rejected','suspended'].includes(x.verification_status)&&<button onClick={()=>decide(x.id,'rejected')} className="rounded-lg border px-3 py-2 text-sm">Refuser</button>}
    {x.verification_status==='approved'&&<button onClick={()=>decide(x.id,'suspended')} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700">Suspendre</button>}
    {x.verification_status==='suspended'&&<button onClick={()=>decide(x.id,'reactivate')} className="rounded-lg border px-3 py-2 text-sm">Réactiver</button>}
   </div></div>
   {(x.professional_title||x.experience_summary)&&<div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><b>{x.professional_title}</b>{x.experience_summary&&<p className="mt-1 text-slate-600">{x.experience_summary}</p>}</div>}
   {x.admin_note&&<div className="mt-3 text-sm text-amber-800">Dernier message administratif : {x.admin_note}</div>}
  </article>)}{!shown.length&&<div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">Aucun organisateur dans cette catégorie.</div>}</div>
 </AdminOmniaLiveShell>
}