import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { liveApi } from './liveApi';

export default function AdminOmniaLiveCancellations(){
 const [rows,setRows]=useState<any[]>([]),[message,setMessage]=useState('');
 const load=()=>liveApi('cancellation_admin_queue').then(d=>setRows(d.requests||[])).catch(e=>setMessage(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);
 async function decide(id:string,decision:string){const reason=prompt('Motif / décision :')||'';try{await liveApi('cancellation_admin_decision',{method:'POST',body:JSON.stringify({request_id:id,decision,reason})});await load()}catch(e){setMessage(e instanceof Error?e.message:'Erreur')}}
 return <AdminLayout><div className="p-6 md:p-8"><h1 className="text-3xl font-black" style={{color:'#002050'}}>Annulations et reports Omnia Live</h1>{message&&<div className="mt-4 rounded-xl bg-slate-50 p-4">{message}</div>}<div className="mt-7 space-y-3">{rows.map(r=><div key={r.id} className="rounded-2xl border bg-white p-5"><div className="font-bold">{r.live_events?.title}</div><div className="text-sm text-slate-500">{r.request_type} · {r.reason_code} · {r.status}</div><p className="mt-2 text-sm">{r.reason_details}</p><div className="mt-4 flex gap-2"><button onClick={()=>decide(r.id,'under_review')} className="rounded-lg border px-3 py-2">Examiner</button><button onClick={()=>decide(r.id,'approved')} className="rounded-lg bg-[#002050] px-3 py-2 text-white">Approuver</button><button onClick={()=>decide(r.id,'rejected')} className="rounded-lg border border-red-300 px-3 py-2 text-red-700">Refuser</button>{r.status==='approved'&&<button onClick={()=>decide(r.id,'processed')} className="rounded-lg border border-emerald-300 px-3 py-2 text-emerald-700">Appliquer</button>}</div></div>)}{!rows.length&&<div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">Aucune demande.</div>}</div></div></AdminLayout>
}
