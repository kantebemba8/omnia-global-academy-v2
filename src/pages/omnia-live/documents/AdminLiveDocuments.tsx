import { useEffect,useState } from 'react';
import { AdminLayout } from '../../../components/AdminLayout';
import { liveApi } from '../liveApi';

export default function AdminLiveDocuments(){
 const [rows,setRows]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=()=>liveApi('document_admin_requests').then(r=>setRows(r.requests||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);
 async function decide(id:string,status:string){await liveApi('document_admin_decision',{method:'POST',body:JSON.stringify({request_id:id,status})});await load()}
 async function issue(id:string){try{await liveApi('document_issue',{method:'POST',body:JSON.stringify({request_id:id})});setMsg('Document validé. Génération PDF requise/programmée.');await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}}
 return <AdminLayout><div className="p-6 md:p-8"><h1 className="text-3xl font-black text-[#002050]">Certificats & CPD — Omnia Live</h1>{msg&&<div className="mt-4 rounded-xl bg-slate-50 p-4">{msg}</div>}
 <div className="mt-7 space-y-3">{rows.map(r=><div key={r.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><b>{r.users?.full_name||r.user_id}</b><div className="text-sm text-slate-500">{r.live_events?.title} · {r.document_type} · {r.status}</div></div><div className="flex gap-2">{r.status==='eligible'&&<><button onClick={()=>decide(r.id,'approved')} className="text-sm font-bold text-emerald-700">Approuver</button><button onClick={()=>decide(r.id,'rejected')} className="text-sm font-bold text-red-700">Refuser</button></>}{r.status==='approved'&&<button onClick={()=>issue(r.id)} className="rounded-lg bg-[#002050] px-3 py-2 text-sm font-bold text-white">Émettre</button>}</div></div></div>)}</div></div></AdminLayout>
}