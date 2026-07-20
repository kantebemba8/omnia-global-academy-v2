import { useEffect,useState } from 'react';
import { useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from '../liveApi';

export default function VerifyLiveDocument(){
 const {code}=useParams();const [r,setR]=useState<any>(null);
 useEffect(()=>{if(code)liveApi('document_verify',{}, {code}).then(setR).catch(()=>setR({valid:false}))},[code]);
 return <OmniaLiveLayout><section className="mx-auto max-w-2xl px-4 py-14"><div className="rounded-3xl border bg-white p-8 text-center">
 <div className="text-5xl">{r?.valid?'✓':'?'}</div><h1 className="mt-4 text-2xl font-black text-[#002050]">{r?.valid?'Document Omnia Live valide':'Vérification du document'}</h1>
 {r?.document&&<div className="mt-6 space-y-2 text-left text-sm"><p><b>Participant :</b> {r.document.participant_name}</p><p><b>Événement :</b> {r.document.event_title}</p><p><b>Document :</b> {r.document.document_number}</p><p><b>Date :</b> {r.document.issue_date}</p>{r.document.cpd_hours&&<p><b>CPD :</b> {r.document.cpd_hours} h</p>}</div>}
 {r&&!r.valid&&<div className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">Document introuvable ou révoqué.</div>}</div></section></OmniaLiveLayout>
}