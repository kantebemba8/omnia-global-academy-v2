import { useEffect, useState } from 'react';
import ParticipantShell from './ParticipantShell';
import { liveApi } from '../liveApi';
export default function ParticipantRefunds(){
 const [rows,setRows]=useState<any[]>([]),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('participant_refunds').then(d=>setRows(d.refunds||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);
 return <ParticipantShell title="Mes remboursements" subtitle="Suivez toutes vos demandes et décisions Super Admin.">{msg&&<div className="mb-4 rounded-xl bg-slate-50 p-4">{msg}</div>}<div className="space-y-3">{rows.map(x=><div key={x.id} className="rounded-2xl border bg-white p-5"><div className="font-bold text-[#002050]">{x.live_events?.title}</div><div className="mt-1 text-sm text-slate-500">{x.requested_amount} {x.live_orders?.currency} · {x.status}</div><p className="mt-2 text-sm">{x.reason_details||x.reason_code}</p>{x.decision_reason&&<div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">Décision : {x.decision_reason}</div>}</div>)}{!rows.length&&<div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">Aucune demande de remboursement.</div>}</div></ParticipantShell>
}
