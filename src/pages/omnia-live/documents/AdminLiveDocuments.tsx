import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import AdminOmniaLiveShell from '../admin/AdminOmniaLiveShell';
import {omniaDialog} from '../../../lib/omniaDialog';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

const DOC_LABELS:any={attendance_certificate:'Certificat de présence',completion_certificate:'Certificat de réussite',cpd_certificate:'Certificat CPD',participation_attestation:'Attestation de participation'};

export default function AdminLiveDocuments(){
 const [rows,setRows]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=()=>liveApi('document_admin_requests').then(r=>setRows(r.requests||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);

 async function decide(id:string,status:string){
  const r=await omniaDialog({
   title:status==='approved'?'Approuver le document':'Refuser la demande',
   message:status==='approved'?'Confirmez après vérification des règles d’éligibilité.':'Indiquez la raison du refus.',
   confirmLabel:'Confirmer',
   inputLabel:'Note de décision',
   inputRequired:status==='rejected',
   danger:status==='rejected'
  });
  if(!r.confirmed)return;
  try{await liveApi('document_admin_decision',{method:'POST',body:JSON.stringify({request_id:id,status,decision_note:r.value||null})});await load()}
  catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 async function issue(id:string){
  const r=await omniaDialog({title:'Émettre le document',message:'Le document émis devient un enregistrement vérifiable. Une correction ultérieure nécessite une révocation et une nouvelle émission.',confirmLabel:'Émettre'});
  if(!r.confirmed)return;
  try{
   await liveApi('document_issue_v2',{method:'POST',body:JSON.stringify({request_id:id})});
   setMsg('Document émis ou placé en génération PDF.');
   await load();
  }catch(e){
   try{await liveApi('document_issue',{method:'POST',body:JSON.stringify({request_id:id})});setMsg('Document émis ou placé en génération PDF.');await load()}
   catch(err){setMsg(err instanceof Error?err.message:'Erreur')}
  }
 }

 return <AdminOmniaLiveShell title="Certificats, attestations & CPD" subtitle="Contrôlez l’éligibilité, validez les demandes et émettez les documents Omnia Live.">
  {msg&&<div className="mb-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  {rows.length?<div className="overflow-x-auto"><div className="min-w-[980px]">
   <div className="grid grid-cols-[1.2fr_1.3fr_.9fr_.8fr_1.1fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Participant</div><div>Événement</div><div>Document</div><div>Statut</div><div className="text-right">Actions</div></div>
   {rows.map(r=><div key={r.id} className="grid grid-cols-[1.2fr_1.3fr_.9fr_.8fr_1.1fr] items-center border-b border-slate-200 py-4 text-sm">
    <div className="font-semibold text-[#002050]">{r.users?.full_name||r.user_id}</div>
    <div>{r.live_events?.title||'Événement'}</div>
    <div>{DOC_LABELS[r.document_type]||String(r.document_type||'').replaceAll('_',' ')}</div>
    <div>{liveStatusLabel(r.status)}</div>
    <div className="flex justify-end gap-3">
     {r.status==='eligible'&&<><button onClick={()=>decide(r.id,'approved')} className="font-semibold text-emerald-700">Approuver</button><button onClick={()=>decide(r.id,'rejected')} className="font-semibold text-red-700">Refuser</button></>}
     {r.status==='approved'&&<button onClick={()=>issue(r.id)} className="font-semibold text-[#002050]">Émettre</button>}
    </div>
   </div>)}
  </div></div>:<div className="border-y border-slate-200 py-10 text-center text-sm text-slate-500">Aucune demande de document.</div>}
 </AdminOmniaLiveShell>
}
