import { useEffect, useState } from 'react';
import { liveApi } from '../liveApi';
import ParticipantShell from './ParticipantShell';
export default function ParticipantNotifications(){
 const [rows,setRows]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=()=>liveApi('participant_notifications').then(d=>setRows(d.notifications||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);
 async function action(id:string,a:string){try{await liveApi('participant_notification_update',{method:'POST',body:JSON.stringify({notification_id:id,action:a})});await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}}
 return <ParticipantShell title="Notifications" subtitle="Rappels, confirmations, modifications et informations Omnia Live.">{msg&&<div className="mb-4 rounded-xl bg-slate-50 p-4">{msg}</div>}<div className="space-y-3">{rows.map(n=><div key={n.id} className={`rounded-2xl border p-5 ${n.read_at?'bg-white':'bg-amber-50'}`}><div className="font-bold text-[#002050]">{n.payload?.subject||n.payload?.title||n.notification_type}</div><div className="mt-2 text-sm text-slate-600">{n.payload?.message||''}</div><div className="mt-2 text-xs text-slate-400">{new Date(n.scheduled_at).toLocaleString()}</div><div className="mt-3 flex gap-2">{!n.read_at&&<button onClick={()=>action(n.id,'read')} className="rounded-lg border px-3 py-1.5 text-sm">Marquer lu</button>}<button onClick={()=>action(n.id,'dismiss')} className="rounded-lg border px-3 py-1.5 text-sm">Masquer</button></div></div>)}{!rows.length&&<div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">Aucune notification.</div>}</div></ParticipantShell>
}
