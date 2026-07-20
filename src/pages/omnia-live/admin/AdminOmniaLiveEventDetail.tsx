import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { liveApi } from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';

export default function AdminOmniaLiveEventDetail(){
 const {eventId}=useParams();
 const [d,setD]=useState<any>(null),[msg,setMsg]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState('');

 const load=async()=>{
   try{
     let detail=await liveApi('admin_event_detail',{}, {event_id:eventId||''});
     // Opening a submitted dossier means the Super Admin has taken it into review.
     // This replaces the unnecessary manual "Commencer examen" button.
     if(detail?.event?.status==='submitted'){
       await liveApi('admin_review',{method:'POST',body:JSON.stringify({event_id:eventId,decision:'start_review',reason:'Examen commencé automatiquement à l’ouverture du dossier.'})});
       detail=await liveApi('admin_event_detail',{}, {event_id:eventId||''});
     }
     setD(detail);
   }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 };
 useEffect(()=>{load()},[eventId]);

 async function review(decision:string){
   if(['request_changes','reject','suspend'].includes(decision) && !reason.trim()){
     setMsg('Veuillez saisir un motif/message avant cette action.');
     return;
   }
   if(decision==='reject' && !window.confirm('Refuser cette soumission ?')) return;
   if(decision==='suspend' && !window.confirm('Suspendre ce Live et bloquer son accès ?')) return;
   setBusy(decision); setMsg('');
   try{
     const r=await liveApi('admin_review',{method:'POST',body:JSON.stringify({event_id:eventId,decision,reason:reason.trim()})});
     setReason('');
     setMsg(r?.message || 'Action enregistrée.');
     await load();
   }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
   finally{setBusy('')}
 }
 if(!d)return <AdminOmniaLiveShell title="Événement">{msg||'Chargement...'}</AdminOmniaLiveShell>;
 const e=d.event;
 return <AdminOmniaLiveShell title={e.title} subtitle={`${e.organizer_display_name||'—'} · ${e.status}`}>
  {msg&&<div className="mb-4 rounded-xl bg-slate-50 p-4">{msg}</div>}
  <div className="grid gap-5 xl:grid-cols-[1fr_330px]"><div className="space-y-5">
   <div className="rounded-2xl border bg-white p-5"><div className="grid gap-4 md:grid-cols-4">{[['Format',e.event_type],['Mode',e.delivery_type],['Visibilité',e.visibility],['Prix',`${e.price_amount||0} ${e.currency||''}`]].map(([a,b])=><div key={a}><div className="text-xs uppercase text-slate-400">{a}</div><div className="font-semibold">{b||'—'}</div></div>)}</div><p className="mt-5 whitespace-pre-wrap text-sm text-slate-600">{e.long_description}</p></div>
   <div className="rounded-2xl border bg-white p-5"><h2 className="font-bold text-[#002050]">Sessions ({d.sessions.length})</h2><div className="mt-3 space-y-2">{d.sessions.map((s:any)=><div key={s.id} className="rounded-xl bg-slate-50 p-3">{s.title} · {s.starts_at?new Date(s.starts_at).toLocaleString():'—'}</div>)}</div></div>
   <div className="rounded-2xl border bg-white p-5"><h2 className="font-bold text-[#002050]">Médias ({d.media.length})</h2><div className="mt-3 space-y-2">{d.media.map((m:any)=><div key={m.id} className="flex justify-between rounded-xl bg-slate-50 p-3"><span>{m.title||m.file_name||m.media_type}</span><span className="text-xs">{m.status} · {m.processing_status}</span></div>)}</div></div>
   <div className="rounded-2xl border bg-white p-5"><h2 className="font-bold text-[#002050]">Historique de validation</h2><div className="mt-3 space-y-2">{d.review_history.map((h:any)=><div key={h.id} className="border-l-2 border-[#BF8813] pl-3 text-sm"><b>{h.action}</b> · {new Date(h.created_at).toLocaleString()}<div className="text-slate-500">{h.message}</div></div>)}</div></div>
  </div><aside className="space-y-4"><a href={`/omnia-live/${e.id}`} target="_blank" rel="noreferrer" className="block rounded-xl border px-4 py-3 text-center font-bold">Prévisualiser</a><Link to={`/omnia-live/${e.id}/organiser`} className="block rounded-xl border px-4 py-3 text-center font-bold">Superviser la salle</Link><textarea value={reason} onChange={x=>setReason(x.target.value)} rows={3} placeholder="Motif / message" className="w-full rounded-xl border p-3"/><div className="grid gap-2">
  {['under_review','submitted','changes_requested'].includes(e.status)&&<>
    <button disabled={!!busy} onClick={()=>review('request_changes')} className="rounded-xl border border-amber-300 p-3 font-semibold disabled:opacity-50">Demander modifications</button>
    <button disabled={!!busy} onClick={()=>review('approve')} className="rounded-xl bg-[#002050] p-3 font-bold text-white disabled:opacity-50">Approuver</button>
    <button disabled={!!busy} onClick={()=>review('reject')} className="rounded-xl border border-red-300 p-3 font-semibold text-red-700 disabled:opacity-50">Refuser</button>
  </>}
  {['approved','published','live'].includes(e.status)&&
    <button disabled={!!busy} onClick={()=>review('suspend')} className="rounded-xl border border-red-500 p-3 font-semibold text-red-800 disabled:opacity-50">Suspendre</button>
  }
  {e.status==='suspended'&&<div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Ce Live est suspendu.</div>}
</div><div className="rounded-xl bg-slate-50 p-4 text-sm"><b>{d.registrations.length}</b> inscriptions<br/><b>{d.orders.length}</b> commandes<br/><b>{d.rooms.length}</b> salles<br/><b>{d.reports.length}</b> signalements</div></aside></div>
 </AdminOmniaLiveShell>
}
