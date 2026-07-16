import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Building2, FileUp, HandHelping, Save, ShieldCheck, Wallet } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

function authToken(){ return localStorage.getItem('omnia_session_token') || ''; }
async function call(action:string, body:Record<string,unknown>={}){
  const res = await fetch(API,{method:'POST',headers:{Authorization:`Bearer ${authToken()}`,'Content-Type':'application/json'},body:JSON.stringify({action,...body})});
  const data = await res.json().catch(()=>({success:false,error:'INVALID_RESPONSE'}));
  if(!res.ok || data.success===false) throw new Error(data.message||data.error||'Une erreur est survenue');
  return data;
}

type Props={
  course:any;
  locked?:boolean;
  onPatch:(patch:Record<string,unknown>)=>void;
  onSaved?:(message:string)=>void;
};

export default function StudioCommercialCertificationPanel({course,locked=false,onPatch,onSaved}:Props){
  const [saving,setSaving]=useState(false);
  const [rules,setRules]=useState<any>(null);
  const [files,setFiles]=useState<File[]>([]);
  const [instructions,setInstructions]=useState('');
  const [assistedType,setAssistedType]=useState<'with_certification'|'without_certification'>('without_certification');
  const [certifications,setCertifications]=useState<any[]>([]);
  const [newCert,setNewCert]=useState({type:'omnia',organization_name:'Omnia Global Academy',certification_name:'Certification Omnia',code:'',credit_value:'',credit_unit:'heures de formation',expires_at:'',verification_url:'',badge_url:'',signature_url:'',stamp_url:''});

  useEffect(()=>{ if(!course?.id) return; call('get_commercialization',{course_id:course.id}).then(d=>{setRules(d.revenue_rules||null);setCertifications(d.certifications||[]); if(d.course) onPatch(d.course)}).catch(()=>{}); },[course?.id]);

  const professorShare=useMemo(()=>{
    if(!rules) return null;
    const key=course.is_assisted?(course.certification_requested?'commission_assistee_avec_cpd':'commission_assistee_sans_cpd'):(course.certification_requested?'commission_normal_avec_cpd':'commission_normal_sans_cpd');
    return rules[key]||null;
  },[rules,course.is_assisted,course.certification_requested]);

  async function saveCommercial(){
    if(!course.id) return onSaved?.('Enregistrez d’abord le brouillon de la formation.');
    setSaving(true);
    try{
      const d=await call('save_commercialization',{course_id:course.id,sale_mode:course.sale_mode||'paid',desired_price_amount:Number(course.desired_price_amount||0),sale_currency:course.sale_currency||'XOF',promotion_price_amount:course.promotion_price_amount?Number(course.promotion_price_amount):null,structure_payment_mode:course.structure_payment_mode||'free',structure_fixed_amount:course.structure_fixed_amount?Number(course.structure_fixed_amount):null});
      onPatch(d.course||{});onSaved?.('Commercialisation enregistrée.');
    }catch(e:any){onSaved?.(e.message)}finally{setSaving(false)}
  }

  async function requestAssistance(){
    if(!course.id) return onSaved?.('Enregistrez d’abord le brouillon.');
    setSaving(true);
    try{
      const uploaded:any[]=[];
      for(const file of files){
        const ext=file.name.split('.').pop()||'bin'; const path=`${course.id}/assisted/${crypto.randomUUID()}.${ext}`;
        const signed=await call('prepare_upload',{course_id:course.id,bucket_name:'course-resources',storage_path:path});
        await fetch(signed.signedUrl,{method:'PUT',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});
        uploaded.push({name:file.name,size:file.size,mime:file.type,url:`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/course-resources/${path}`});
      }
      const d=await call('request_assisted_entry',{course_id:course.id,service_type:assistedType,instructions,documents:uploaded});
      onPatch({is_assisted:true,assisted_status:d.request.status,assisted_request_id:d.request.id});setFiles([]);onSaved?.('Demande de saisie assistée envoyée.');
    }catch(e:any){onSaved?.(e.message)}finally{setSaving(false)}
  }

  async function addCertification(){
    if(!course.id) return onSaved?.('Enregistrez d’abord le brouillon.');
    setSaving(true);
    try{
      const d=await call('save_course_certification_request',{course_id:course.id,certification:newCert});
      setCertifications((v)=>[...v,d.certification]);onPatch({certification_requested:true});onSaved?.('Certification ajoutée et envoyée à validation.');
    }catch(e:any){onSaved?.(e.message)}finally{setSaving(false)}
  }

  return <div className="space-y-4">
    <div className="rounded-xl border bg-white p-4" style={{borderColor:BORDER}}>
      <div className="flex items-center gap-2"><Wallet size={17} color={GOLD}/><h3 className="text-sm font-semibold" style={{color:BLUE}}>Commercialisation</h3></div>
      <p className="mt-1 text-xs text-gray-500">Définissez le prix public souhaité. La répartition réelle est appliquée depuis les règles administratives déjà configurées.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">Mode de vente<select disabled={locked} value={course.sale_mode||'paid'} onChange={e=>onPatch({sale_mode:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}><option value="paid">Payante</option><option value="free">Gratuite</option></select></label>
        {course.sale_mode!=='free'&&<label className="text-xs font-medium text-gray-600">Prix souhaité<input disabled={locked} type="number" min="0" value={course.desired_price_amount||''} onChange={e=>onPatch({desired_price_amount:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}/></label>}
        <label className="text-xs font-medium text-gray-600">Devise<select disabled={locked} value={course.sale_currency||'XOF'} onChange={e=>onPatch({sale_currency:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}><option>XOF</option><option>EUR</option><option>USD</option></select></label>
        {course.sale_mode!=='free'&&<label className="text-xs font-medium text-gray-600">Prix promotionnel facultatif<input disabled={locked} type="number" min="0" value={course.promotion_price_amount||''} onChange={e=>onPatch({promotion_price_amount:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}/></label>}
      </div>
      {professorShare&&<div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Règle actuelle : créateur {professorShare.professeur??professorShare.structure??0}% · plateforme {professorShare.plateforme??0}%. Cette information vient des réglages Super Admin.</div>}
      <button disabled={saving||locked} onClick={saveCommercial} className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{background:BLUE}}><Save size={14}/>Enregistrer la commercialisation</button>
    </div>

    <div className="rounded-xl border bg-white p-4" style={{borderColor:BORDER}}>
      <div className="flex items-center gap-2"><HandHelping size={17} color={GOLD}/><h3 className="text-sm font-semibold" style={{color:BLUE}}>Saisie assistée par Omnia</h3></div>
      <p className="mt-1 text-xs text-gray-500">Envoyez vos documents et consignes. Omnia saisira la formation dans votre Studio, puis vous la retrouverez prête à valider.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2"><select value={assistedType} onChange={e=>{setAssistedType(e.target.value as any); if(e.target.value==='without_certification') setInstructions('')}} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}><option value="without_certification">Sans certification externe</option><option value="with_certification">Avec certification externe</option></select><label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}><FileUp size={15}/>Ajouter PDF, Word, PowerPoint, Excel ou ZIP<input multiple type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,image/*" onChange={e=>setFiles(Array.from(e.target.files||[]))}/></label></div>
      {files.length>0&&<p className="mt-2 text-xs text-gray-500">{files.map(f=>f.name).join(', ')}</p>}
      <p className="mt-2 text-xs text-gray-500">{assistedType==='without_certification'?'Aucune explication n’est exigée. Ajoutez vos documents puis validez la demande.':'Une explication est obligatoire pour préciser la certification externe souhaitée.'}</p>
      {assistedType==='with_certification'&&<textarea value={instructions} onChange={e=>setInstructions(e.target.value)} rows={3} className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}} placeholder="Expliquez la certification externe demandée, l’organisme, les contraintes et les consignes particulières."/>}
      <button disabled={saving||locked||(assistedType==='with_certification'&&!instructions.trim())} onClick={requestAssistance} className="mt-3 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{background:GOLD}}>{assistedType==='with_certification'?'Envoyer la demande':'Valider la demande'}</button>
      {course.assisted_status&&<span className="ml-3 text-xs text-gray-500">Statut : {course.assisted_status}</span>}
    </div>

    <div className="rounded-xl border bg-white p-4" style={{borderColor:BORDER}}>
      <div className="flex items-center gap-2"><ShieldCheck size={17} color={GOLD}/><h3 className="text-sm font-semibold" style={{color:BLUE}}>Certification de la formation</h3></div>
      <p className="mt-1 text-xs text-gray-500">Une formation peut recevoir la certification Omnia, CPD ou une autre reconnaissance. Le Super Admin valide toujours les références avant affichage.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <select value={newCert.type} onChange={e=>setNewCert(v=>({...v,type:e.target.value,organization_name:e.target.value==='omnia'?'Omnia Global Academy':v.organization_name}))} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}><option value="omnia">Certification Omnia</option><option value="cpd">CPD</option><option value="partner">Organisme partenaire</option><option value="other">Autre certification</option></select>
        <input value={newCert.organization_name} onChange={e=>setNewCert(v=>({...v,organization_name:e.target.value}))} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}} placeholder="Organisme certificateur"/>
        <input value={newCert.certification_name} onChange={e=>setNewCert(v=>({...v,certification_name:e.target.value}))} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}} placeholder="Nom de la certification"/>
        <input value={newCert.code} onChange={e=>setNewCert(v=>({...v,code:e.target.value}))} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}} placeholder="Code / numéro"/>
        <input value={newCert.credit_value} onChange={e=>setNewCert(v=>({...v,credit_value:e.target.value}))} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}} placeholder="Valeur (ex. 12)"/>
        <input value={newCert.credit_unit} onChange={e=>setNewCert(v=>({...v,credit_unit:e.target.value}))} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}} placeholder="Unité (heures CPD, crédits...)"/>
        <input value={newCert.badge_url} onChange={e=>setNewCert(v=>({...v,badge_url:e.target.value}))} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}} placeholder="URL badge/logo"/>
        <input value={newCert.signature_url} onChange={e=>setNewCert(v=>({...v,signature_url:e.target.value}))} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}} placeholder="URL signature"/>
        <input value={newCert.stamp_url} onChange={e=>setNewCert(v=>({...v,stamp_url:e.target.value}))} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}} placeholder="URL tampon/cachet"/>
      </div>
      <button disabled={saving||locked||!newCert.organization_name.trim()||!newCert.certification_name.trim()} onClick={addCertification} className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{background:BLUE}}><BadgeCheck size={14}/>Ajouter et soumettre à validation</button>
      <div className="mt-3 space-y-2">{certifications.map(c=><div key={c.id} className="flex items-center justify-between rounded-lg border p-3 text-xs" style={{borderColor:BORDER}}><div><b>{c.certification_name}</b><div className="text-gray-500">{c.organization_name} · {c.credit_value||''} {c.credit_unit||''}</div></div><span className="rounded-full bg-gray-100 px-2 py-1">{c.status}</span></div>)}</div>
    </div>
  </div>;
}
