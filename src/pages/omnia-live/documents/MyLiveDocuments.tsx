import { useEffect,useState } from 'react';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from '../liveApi';

export default function MyLiveDocuments(){
 const [docs,setDocs]=useState<any[]>([]);
 useEffect(()=>{liveApi('documents_mine').then(r=>setDocs(r.documents||[])).catch(()=>{})},[]);
 return <OmniaLiveLayout><section className="mx-auto max-w-6xl px-4 py-10">
 <h1 className="text-3xl font-black text-[#002050]">Mes certificats et documents</h1>
 <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{docs.map(d=><article key={d.id} className="rounded-2xl border bg-white p-5">
 <div className="text-xs font-bold uppercase text-[#BF8813]">{d.document_type}</div>
 <h2 className="mt-2 font-bold text-[#002050]">{d.event_title}</h2>
 <div className="mt-2 text-sm text-slate-500">N° {d.document_number}</div>
 <div className="mt-1 text-sm text-slate-500">Émis le {new Date(d.issue_date).toLocaleDateString()}</div>
 {d.cpd_hours&&<div className="mt-2 text-sm">CPD : {d.cpd_hours} h {d.cpd_points?`· ${d.cpd_points} points`:''}</div>}
 <div className="mt-4 flex gap-2">{d.pdf_storage_key&&<button className="rounded-lg bg-[#002050] px-3 py-2 text-sm font-bold text-white">Télécharger PDF</button>}<a href={`/verify/live-document/${d.verification_code}`} className="rounded-lg border px-3 py-2 text-sm font-semibold">Vérifier</a></div>
 </article>)}
 {!docs.length&&<div className="rounded-2xl bg-slate-50 p-8 text-slate-500">Aucun document délivré.</div>}</div>
 </section></OmniaLiveLayout>
}