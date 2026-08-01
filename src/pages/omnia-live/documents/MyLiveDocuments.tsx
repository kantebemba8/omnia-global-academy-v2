import {useEffect,useState} from 'react';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import {liveApi} from '../liveApi';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

const BLUE='#002050';
const DOC_LABELS:any={
 attendance_certificate:'Certificat de présence',
 completion_certificate:'Certificat de réussite',
 cpd_certificate:'Certificat de développement professionnel',
 participation_attestation:'Attestation de participation',
 institutional_document:'Document institutionnel',
 participation:'Attestation de participation',
 success:'Certificat de réussite',
 cpd:'Certificat de développement professionnel'
};

export default function MyLiveDocuments(){
 const [docs,setDocs]=useState<any[]>([]),[msg,setMsg]=useState('');
 useEffect(()=>{
  liveApi('documents_mine_v2').then(r=>setDocs(r.documents||[])).catch(async()=>{
   try{const r=await liveApi('documents_mine');setDocs(r.documents||[])}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
  });
 },[]);

 async function download(id:string){
  try{
   const r=await liveApi('document_download',{}, {document_id:id});
   if(!r.download_url)throw new Error('PDF indisponible.');
   window.open(r.download_url,'_blank','noopener,noreferrer');
  }catch(e){setMsg(e instanceof Error?e.message:'Téléchargement impossible.')}
 }

 return <OmniaLiveLayout><section className="mx-auto max-w-6xl px-4 py-10">
  <h1 className="text-3xl font-black" style={{color:BLUE}}>Mes certificats et documents</h1>
  <p className="mt-2 text-slate-600">Les documents délivrés sont vérifiables par leur numéro et leur code de vérification. Une correction d’un document émis passe par révocation puis nouvelle émission.</p>
  {msg&&<div className="mt-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  <div className="mt-7">
   {docs.length?<>
    <div className="hidden grid-cols-[1.4fr_1fr_.8fr_1fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid">
     <div>Document</div><div>Événement</div><div>État</div><div className="text-right">Actions</div>
    </div>
    {docs.map(d=><div key={d.id} className="grid gap-3 border-b border-slate-200 py-4 text-sm md:grid-cols-[1.4fr_1fr_.8fr_1fr] md:items-center">
     <div>
      <div className="font-semibold" style={{color:BLUE}}>{DOC_LABELS[d.document_type]||d.title||String(d.document_type||'Document').replaceAll('_',' ')}</div>
      <div className="mt-1 text-xs text-slate-400">N° {d.document_number||'—'} · {d.issue_date||d.issued_at?new Date(d.issue_date||d.issued_at).toLocaleDateString('fr-FR'):'—'}</div>
      {d.cpd_hours&&<div className="mt-1 text-xs text-slate-500">Crédits reconnus : {d.cpd_hours} h{d.cpd_points?` · ${d.cpd_points} points`:''}</div>}
     </div>
     <div>{d.event_title||d.live_events?.title||'Événement Omnia Live'}</div>
     <div>{liveStatusLabel(d.status||'issued')}</div>
     <div className="flex flex-wrap justify-start gap-3 md:justify-end">
      {(d.pdf_storage_key||d.id)&&<button onClick={()=>download(d.id)} className="font-semibold" style={{color:BLUE}}>Télécharger PDF</button>}
      {d.verification_code&&<a href={`/verify/live-document/${d.verification_code}`} className="font-semibold text-[#BF8813]">Vérifier</a>}
     </div>
    </div>)}
   </>:<div className="border-y border-slate-200 py-10 text-center text-sm text-slate-500">Aucun document délivré.</div>}
  </div>
 </section></OmniaLiveLayout>
}
