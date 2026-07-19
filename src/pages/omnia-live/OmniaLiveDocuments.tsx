import { useEffect, useState } from 'react';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

export default function OmniaLiveDocuments(){
 const [docs,setDocs]=useState<any[]>([]),[message,setMessage]=useState('');
 const load=()=>liveApi('documents_mine').then(d=>setDocs(d.documents||[])).catch(e=>setMessage(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);
 async function download(id:string){try{const r=await liveApi('document_download',{}, {document_id:id});window.open(r.download_url,'_blank')}catch(e){setMessage(e instanceof Error?e.message:'Téléchargement impossible.')}}
 return <OmniaLiveLayout><section className="mx-auto max-w-6xl px-4 py-10"><h1 className="text-3xl font-black" style={{color:'#002050'}}>Mes documents Omnia Live</h1>{message&&<div className="mt-4 rounded-xl bg-slate-50 p-4">{message}</div>}<div className="mt-7 grid gap-4 md:grid-cols-2">{docs.map(d=><div key={d.id} className="rounded-2xl border bg-white p-5"><div className="text-xs uppercase text-slate-400">{d.document_type}</div><div className="mt-1 font-bold">{d.title}</div><div className="mt-2 text-sm text-slate-500">{d.document_number}</div><button onClick={()=>download(d.id)} className="mt-4 rounded-lg bg-[#002050] px-4 py-2 text-sm font-bold text-white">Télécharger PDF</button></div>)}{!docs.length&&<div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">Aucun document émis.</div>}</div></section></OmniaLiveLayout>
}
