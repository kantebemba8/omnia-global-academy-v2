import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import ParticipantShell from './ParticipantShell';

export default function ParticipantNotifications(){
 const [rows,setRows]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=()=>liveApi('participant_notifications').then(d=>setRows(d.notifications||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);
 async function action(id:string,a:string){try{await liveApi('participant_notification_update',{method:'POST',body:JSON.stringify({notification_id:id,action:a})});await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}}
 return <ParticipantShell title="Notifications" subtitle="Rappels, confirmations, changements et informations Omnia Live.">
  {msg&&<div className="mb-4 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  {rows.length?rows.map(n=><div key={n.id} className={`border-b border-slate-200 py-5 ${n.read_at?'':'bg-amber-50/40 px-3'}`}>
   <div className="font-bold text-[#002050]">{n.payload?.subject||n.payload?.title||String(n.notification_type||'Notification').replaceAll('_',' ')}</div>
   <div className="mt-2 text-sm text-slate-600">{n.payload?.message||''}</div>
   <div className="mt-2 text-xs text-slate-400">{n.scheduled_at?new Date(n.scheduled_at).toLocaleString('fr-FR'):'—'}</div>
   <div className="mt-3 flex gap-3">{!n.read_at&&<button onClick={()=>action(n.id,'read')} className="text-sm font-semibold text-[#002050]">Marquer comme lue</button>}<button onClick={()=>action(n.id,'dismiss')} className="text-sm text-slate-500">Masquer</button></div>
  </div>):<div className="border-y border-slate-200 py-10 text-center text-slate-500">Aucune notification.</div>}
 </ParticipantShell>
}
