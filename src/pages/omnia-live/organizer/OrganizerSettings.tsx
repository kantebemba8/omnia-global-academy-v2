import { useEffect, useState } from 'react';
import OrganizerShell from './OrganizerShell';
import { liveApi } from '../liveApi';
export default function OrganizerSettings(){
 const [requests,setRequests]=useState<any[]>([]),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('organizer_cancellations').then(d=>setRequests(d.requests||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);
 return <OrganizerShell title="Paramètres & demandes" subtitle="Suivez les demandes d’annulation/report et les décisions de l’Administration Omnia.">{msg&&<div className="mb-4 rounded-xl bg-slate-50 p-4">{msg}</div>}<div className="space-y-3">{requests.map(x=><div key={x.id} className="rounded-2xl border bg-white p-5"><div className="font-bold text-[#002050]">{x.live_events?.title}</div><div className="text-sm text-slate-500">{x.request_type} · {x.status}</div><p className="mt-2 text-sm">{x.reason_details}</p>{x.admin_decision_reason&&<div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">Décision admin : {x.admin_decision_reason}</div>}</div>)}{!requests.length&&<div className="rounded-2xl bg-slate-50 p-8 text-slate-500">Aucune demande en cours.</div>}</div></OrganizerShell>
}
