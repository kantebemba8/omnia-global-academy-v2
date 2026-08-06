import {useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import {liveApi} from '../liveApi';

const BLUE='#002050';

export default function EventDocumentSettings(){
 const {liveId}=useParams();
 const [r,setR]=useState<any>({
  documents_enabled:true,
  free_event_document_policy:'attendance_based',
  default_document_type:'attendance_certificate',
  minimum_attendance_percent:80,
  minimum_sessions_attended:null,
  require_all_mandatory_sessions:false,
  require_completion:false,
  require_assessment:false,
  minimum_assessment_score:null,
  cpd_enabled:false,
  cpd_hours:null,
  cpd_points:null,
  cpd_reference:'',
  auto_issue:false,
  organizer_can_request:true,
  super_admin_validation_required:true
 });
 const [msg,setMsg]=useState('');

 useEffect(()=>{if(liveId)liveApi('document_rules_get',{}, {event_id:liveId}).then(x=>x.rules&&setR((old:any)=>({...old,...x.rules}))).catch(()=>{})},[liveId]);

 async function save(){
  const attendance=Number(r.minimum_attendance_percent);
  if(!Number.isFinite(attendance)||attendance<0||attendance>100){setMsg('La présence minimale doit être comprise entre 0 et 100 %.');return}
  if(r.require_assessment){
   const score=Number(r.minimum_assessment_score);
   if(!Number.isFinite(score)||score<0||score>100){setMsg('Le score minimal doit être compris entre 0 et 100 %.');return}
  }
  if(r.cpd_enabled&&Number(r.cpd_hours||0)<=0){setMsg('Renseignez un nombre d’heures ou de crédits supérieur à zéro.');return}
  try{await liveApi('document_rules_save',{method:'POST',body:JSON.stringify({...r,event_id:liveId})});setMsg('Règles de documents enregistrées.')}
  catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 return <OmniaLiveLayout><section className="mx-auto max-w-5xl px-4 py-10">
  <h1 className="text-3xl font-black" style={{color:BLUE}}>Certificats, attestations et reconnaissances</h1>
  <p className="mt-2 text-slate-600">Définissez précisément les conditions d’éligibilité. Une simple inscription ne doit jamais suffire à obtenir automatiquement un certificat.</p>

  <div className="mt-7 space-y-7">
   <section className="border-b border-slate-200 pb-6">
    <label className="flex items-center justify-between gap-4"><div><div className="font-semibold" style={{color:BLUE}}>Documents activés</div><div className="text-sm text-slate-500">Autorise l’émission de documents pour cet événement.</div></div><input type="checkbox" checked={!!r.documents_enabled} onChange={e=>setR({...r,documents_enabled:e.target.checked})}/></label>
   </section>

   <section className="border-b border-slate-200 pb-6">
    <h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Type de document et présence</h2>
    <div className="grid gap-4 md:grid-cols-2">
     <label><span className="mb-1 block text-sm font-semibold">Document par défaut</span><select className="w-full rounded-lg border border-slate-300 p-3" value={r.default_document_type} onChange={e=>setR({...r,default_document_type:e.target.value})}><option value="attendance_certificate">Certificat de présence</option><option value="completion_certificate">Certificat de réussite</option><option value="participation_attestation">Attestation de participation</option><option value="cpd_certificate">Certificat de développement professionnel</option></select></label>
     <label><span className="mb-1 block text-sm font-semibold">Événement gratuit</span><select className="w-full rounded-lg border border-slate-300 p-3" value={r.free_event_document_policy} onChange={e=>setR({...r,free_event_document_policy:e.target.value})}><option value="attendance_based">Document selon présence</option><option value="none">Aucun document</option><option value="manual_admin">Décision manuelle de l’Administration Omnia</option></select></label>
     <label><span className="mb-1 block text-sm font-semibold">Présence minimale (%)</span><input type="number" min="0" max="100" className="w-full rounded-lg border border-slate-300 p-3" value={r.minimum_attendance_percent??80} onChange={e=>setR({...r,minimum_attendance_percent:Number(e.target.value)})}/></label>
     <label><span className="mb-1 block text-sm font-semibold">Nombre minimum de sessions suivies</span><input type="number" min="0" className="w-full rounded-lg border border-slate-300 p-3" value={r.minimum_sessions_attended??''} onChange={e=>setR({...r,minimum_sessions_attended:e.target.value===''?null:Number(e.target.value)})} placeholder="Optionnel"/></label>
    </div>
    <label className="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" checked={!!r.require_all_mandatory_sessions} onChange={e=>setR({...r,require_all_mandatory_sessions:e.target.checked})}/><span>Toutes les sessions obligatoires doivent être suivies.</span></label>
    <label className="mt-3 flex items-center gap-3 text-sm"><input type="checkbox" checked={!!r.require_completion} onChange={e=>setR({...r,require_completion:e.target.checked})}/><span>La formation doit être marquée comme terminée.</span></label>
   </section>

   <section className="border-b border-slate-200 pb-6">
    <h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Évaluation</h2>
    <label className="flex items-center gap-3"><input type="checkbox" checked={!!r.require_assessment} onChange={e=>setR({...r,require_assessment:e.target.checked})}/><span className="font-semibold">Une évaluation réussie est obligatoire</span></label>
    {r.require_assessment&&<label className="mt-4 block max-w-sm"><span className="mb-1 block text-sm font-semibold">Score minimum (%)</span><input type="number" min="0" max="100" className="w-full rounded-lg border border-slate-300 p-3" value={r.minimum_assessment_score??''} onChange={e=>setR({...r,minimum_assessment_score:Number(e.target.value)})}/></label>}
   </section>

   <section className="border-b border-slate-200 pb-6">
    <h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Reconnaissance professionnelle</h2>
    <label className="flex items-center gap-3"><input type="checkbox" checked={!!r.cpd_enabled} onChange={e=>setR({...r,cpd_enabled:e.target.checked})}/><span className="font-semibold">Activer les informations de reconnaissance</span></label>
    {r.cpd_enabled&&<div className="mt-4 grid gap-4 md:grid-cols-3"><label><span className="mb-1 block text-sm font-semibold">Heures ou crédits reconnus</span><input type="number" min="0" step="0.25" className="w-full rounded-lg border border-slate-300 p-3" value={r.cpd_hours??''} onChange={e=>setR({...r,cpd_hours:Number(e.target.value)})}/></label><label><span className="mb-1 block text-sm font-semibold">Points ou unités reconnus</span><input type="number" min="0" step="0.25" className="w-full rounded-lg border border-slate-300 p-3" value={r.cpd_points??''} onChange={e=>setR({...r,cpd_points:e.target.value===''?null:Number(e.target.value)})}/></label><label><span className="mb-1 block text-sm font-semibold">Référence de reconnaissance</span><input className="w-full rounded-lg border border-slate-300 p-3" value={r.cpd_reference||''} onChange={e=>setR({...r,cpd_reference:e.target.value})}/></label></div>}
   </section>

   <section>
    <h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Workflow d’émission</h2>
    <div className="space-y-3 text-sm">
     <label className="flex items-center gap-3"><input type="checkbox" checked={!!r.organizer_can_request} onChange={e=>setR({...r,organizer_can_request:e.target.checked})}/><span>L’organisateur peut demander l’émission pour un participant éligible.</span></label>
     <label className="flex items-center gap-3"><input type="checkbox" checked={!!r.super_admin_validation_required} onChange={e=>setR({...r,super_admin_validation_required:e.target.checked})}/><span>Validation de l’Administration Omnia obligatoire avant émission.</span></label>
     <label className="flex items-center gap-3"><input type="checkbox" checked={!!r.auto_issue} onChange={e=>setR({...r,auto_issue:e.target.checked})}/><span>Émission automatique uniquement après validation de toutes les règles d’éligibilité.</span></label>
    </div>
   </section>

   <button onClick={save} className="rounded-lg bg-[#002050] px-5 py-2.5 text-sm font-bold text-white">Enregistrer les règles</button>
   {msg&&<div className="border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  </div>
 </section></OmniaLiveLayout>
}
