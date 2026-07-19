import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { liveApi } from './liveApi';

const BLUE='#002050';

export default function AdminOmniaLiveRefunds(){
 const [rows,setRows]=useState<any[]>([]),[message,setMessage]=useState('');
 const load=()=>liveApi('refunds_admin_queue').then(d=>setRows(d.refunds||[])).catch(e=>setMessage(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);
 async function decide(id:string,decision:string,amount?:number){const reason=prompt('Motif de décision :')||'';try{await liveApi('refund_admin_decision',{method:'POST',body:JSON.stringify({refund_id:id,decision,approved_amount:amount,decision_reason:reason})});await load()}catch(e){setMessage(e instanceof Error?e.message:'Erreur')}}
 return <AdminLayout><div className="p-6 md:p-8"><h1 className="text-3xl font-black" style={{color:BLUE}}>Remboursements Omnia Live</h1>{message&&<div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">{message}</div>}<div className="mt-7 space-y-3">{rows.map(r=><div key={r.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><div className="font-bold">{r.live_events?.title}</div><div className="text-sm text-slate-500">{r.users?.full_name} · {r.requested_amount} {r.live_orders?.currency} · {r.status}</div><div className="mt-2 text-sm">{r.reason_details||r.reason_code}</div></div><div className="flex flex-wrap gap-2"><button onClick={()=>decide(r.id,'under_review')} className="rounded-lg border px-3 py-2 text-sm">Examiner</button><button onClick={()=>decide(r.id,'approved')} className="rounded-lg px-3 py-2 text-sm text-white" style={{background:BLUE}}>Approuver</button><button onClick={()=>{const a=Number(prompt('Montant partiel :')||0);if(a>0)decide(r.id,'partially_approved',a)}} className="rounded-lg border px-3 py-2 text-sm">Partiel</button><button onClick={()=>decide(r.id,'rejected')} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700">Refuser</button>{['approved','partially_approved'].includes(r.status)&&<button onClick={()=>decide(r.id,'processed')} className="rounded-lg border border-emerald-300 px-3 py-2 text-sm text-emerald-700">Marquer traité</button>}</div></div></div>)}{!rows.length&&<div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">Aucune demande.</div>}</div></div></AdminLayout>
}
