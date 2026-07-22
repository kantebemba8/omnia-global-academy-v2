import {useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import {liveApi} from '../liveApi';

const BLUE='#002050';
const DOC_LABELS:any={attendance_certificate:'Certificat de présence',completion_certificate:'Certificat de réussite',cpd_certificate:'Certificat CPD',participation_attestation:'Attestation de participation',participation:'Attestation de participation',success:'Certificat de réussite',cpd:'Certificat CPD'};

export default function VerifyLiveDocument(){
 const {code}=useParams();
 const [r,setR]=useState<any>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{
  if(!code)return;
  liveApi('document_verify_v2',{}, {code})
   .then(setR)
   .catch(()=>liveApi('document_verify',{}, {code}).then(setR).catch(()=>setR({valid:false})))
   .finally(()=>setLoading(false));
 },[code]);

 return <OmniaLiveLayout><section className="mx-auto max-w-2xl px-4 py-14">
  <div className="border-y border-slate-200 py-8">
   {loading?<div className="text-center text-slate-500">Vérification…</div>:<>
    <div className="text-center text-4xl">{r?.valid?'✓':'!'}</div>
    <h1 className="mt-4 text-center text-2xl font-black" style={{color:BLUE}}>{r?.valid?'Document Omnia Live valide':'Document non valide'}</h1>
    {r?.document&&<div className="mt-7 grid gap-3 text-sm">
     <p><b>Participant :</b> {r.document.participant_name}</p>
     <p><b>Événement :</b> {r.document.event_title}</p>
     <p><b>Type :</b> {DOC_LABELS[r.document.document_type]||String(r.document.document_type||'Document').replaceAll('_',' ')}</p>
     <p><b>Numéro :</b> {r.document.document_number}</p>
     <p><b>Date d’émission :</b> {r.document.issue_date?new Date(r.document.issue_date).toLocaleDateString('fr-FR'):'—'}</p>
     {r.document.cpd_hours&&<p><b>CPD :</b> {r.document.cpd_hours} h{r.document.cpd_points?` · ${r.document.cpd_points} points`:''}</p>}
    </div>}
    {r&&!r.valid&&<div className="mt-6 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">Ce code ne correspond à aucun document actif ou le document a été révoqué.</div>}
   </>}
  </div>
 </section></OmniaLiveLayout>
}
