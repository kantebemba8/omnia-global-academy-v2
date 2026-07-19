import { useState } from 'react';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

export default function OmniaLiveDocumentVerify(){
 const [code,setCode]=useState(''),[result,setResult]=useState<any>(null),[message,setMessage]=useState('');
 async function verify(){try{const r=await liveApi('document_verify',{}, {code});setResult(r);setMessage('')}catch(e){setMessage(e instanceof Error?e.message:'Erreur')}}
 return <OmniaLiveLayout><section className="mx-auto max-w-2xl px-4 py-16"><h1 className="text-3xl font-black" style={{color:'#002050'}}>Vérifier un document Omnia Live</h1><div className="mt-7 rounded-2xl border bg-white p-6"><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Code de vérification" className="w-full rounded-xl border p-3"/><button onClick={verify} className="mt-4 rounded-xl bg-[#002050] px-5 py-3 font-bold text-white">Vérifier</button>{result&&<div className={`mt-5 rounded-xl p-4 ${result.valid?'bg-emerald-50 text-emerald-800':'bg-red-50 text-red-700'}`}>{result.valid?<><div className="font-bold">Document valide</div><div className="mt-2 text-sm">{result.document?.title} · {result.document?.document_number}</div></>:<div className="font-bold">Document invalide ou révoqué</div>}</div>}{message&&<div className="mt-4 text-sm">{message}</div>}</div></section></OmniaLiveLayout>
}
