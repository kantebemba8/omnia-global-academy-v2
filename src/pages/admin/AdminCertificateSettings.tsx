import { ChangeEvent, useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Upload } from 'lucide-react';
const API=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/certificate-admin`;
const BLUE='#002050',GOLD='#BF8813';
async function fileData(file:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file)})}

export default function AdminCertificateSettings(){
 const [s,setS]=useState<any>({}),[loading,setLoading]=useState(true),[msg,setMsg]=useState(''),[tab,setTab]=useState<'documents'|'verification'>('documents');
 async function load(){setLoading(true);try{const r=await fetch(`${API}?action=settings`,{headers:edgeAuthHeaders()});const d=await r.json();setS(d.settings||{})}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 async function save(){const r=await fetch(API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({action:'save_settings',settings:s})});const d=await r.json();setMsg(d.success?'Modifications enregistrées.':d.message||d.error||'Erreur')}
 async function upload(e:ChangeEvent<HTMLInputElement>,key:string){const f=e.target.files?.[0];if(!f)return;const r=await fetch(API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({action:'upload_asset',filename:f.name,mime:f.type,data_url:await fileData(f)})});const d=await r.json();if(d.url)setS((x:any)=>({...x,[key]:d.url}))}
 if(loading)return <AdminLayout><div className="max-w-6xl mx-auto p-10 text-center text-gray-400">Chargement…</div></AdminLayout>;
 return <AdminLayout><div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
  <header className="border-b border-gray-200 pb-5"><p className="text-xs font-semibold uppercase tracking-[.14em]" style={{color:GOLD}}>Certificats & attestations</p><h1 className="text-2xl font-black mt-1" style={{color:BLUE}}>Paramètres</h1><p className="text-sm text-gray-500 mt-1">Gérez les documents, signatures, langues et la page publique de vérification sans modifier le code.</p></header>
  <nav className="flex gap-6 border-b border-gray-200">
    <button onClick={()=>setTab('documents')} className={`pb-3 text-sm font-semibold ${tab==='documents'?'border-b-2':''}`} style={{borderColor:GOLD,color:tab==='documents'?BLUE:'#6B7280'}}>Certificats & attestations</button>
    <button onClick={()=>setTab('verification')} className={`pb-3 text-sm font-semibold ${tab==='verification'?'border-b-2':''}`} style={{borderColor:GOLD,color:tab==='verification'?BLUE:'#6B7280'}}>Page de vérification</button>
  </nav>
  {msg&&<div className="border-l-4 pl-3 py-2 text-sm" style={{borderColor:GOLD}}>{msg}</div>}
  {tab==='documents'?<>
    <section className="border-b border-gray-200 pb-6"><h2 className="font-black" style={{color:BLUE}}>Identité institutionnelle</h2>
      <div className="grid md:grid-cols-2 gap-4 mt-4"><label className="text-sm">Nom officiel<input value={s.institution_name||''} onChange={e=>setS({...s,institution_name:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label><label className="text-sm">Libellé du signataire institutionnel<input value={s.institution_signature_label||''} onChange={e=>setS({...s,institution_signature_label:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label></div>
      <div className="grid md:grid-cols-2 gap-6 mt-5"><Asset title="Logo OGA" value={s.certificate_logo_url} onChange={e=>upload(e,'certificate_logo_url')}/><Asset title="Signature / sceau institutionnel facultatif" value={s.institution_signature_url} onChange={e=>upload(e,'institution_signature_url')}/></div>
    </section>
    <section className="border-b border-gray-200 pb-6"><h2 className="font-black" style={{color:BLUE}}>Textes des certificats et attestations</h2><p className="text-xs text-gray-400 mt-1">Le type de document est choisi automatiquement selon la formation ou le type de Live. Les badges validés sont ajoutés automatiquement.</p>
      <div className="grid gap-4 mt-4"><label className="text-sm">Français<input value={s.certificate_text_fr||''} onChange={e=>setS({...s,certificate_text_fr:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label><label className="text-sm">Anglais<input value={s.certificate_text_en||''} onChange={e=>setS({...s,certificate_text_en:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label><label className="text-sm">Espagnol<input value={s.certificate_text_es||''} onChange={e=>setS({...s,certificate_text_es:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label></div>
    </section>
  </>:<>
    <section className="border-b border-gray-200 pb-6"><h2 className="font-black" style={{color:BLUE}}>Page publique de vérification</h2><p className="text-sm text-gray-500 mt-1">Ces réglages contrôlent les informations visibles lors de la vérification publique d’un certificat ou d’une attestation.</p>
      <div className="grid md:grid-cols-2 gap-4 mt-4"><label className="text-sm">Titre français<input value={s.verification_title_fr||''} onChange={e=>setS({...s,verification_title_fr:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label><label className="text-sm">Titre anglais<input value={s.verification_title_en||''} onChange={e=>setS({...s,verification_title_en:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label><label className="text-sm">Message valide<input value={s.verification_valid_fr||''} onChange={e=>setS({...s,verification_valid_fr:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label><label className="text-sm">Message révoqué<input value={s.verification_revoked_fr||''} onChange={e=>setS({...s,verification_revoked_fr:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label></div>
      <div className="mt-5 grid sm:grid-cols-2 gap-3">{[['show_verification_beneficiary','Bénéficiaire'],['show_verification_course','Formation / événement'],['show_verification_issuer','Émetteur'],['show_verification_date','Date d’émission'],['show_verification_badges','Badges / accréditations validés']].map(([k,l])=><label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(s[k]??'true')==='true'} onChange={e=>setS({...s,[k]:String(e.target.checked)})}/>{l}</label>)}</div>
    </section>
  </>}
  <button onClick={save} className="px-5 py-2.5 rounded-lg text-white font-semibold" style={{background:BLUE}}>Enregistrer</button>
 </div></AdminLayout>
}
function Asset({title,value,onChange}:{title:string,value?:string,onChange:(e:ChangeEvent<HTMLInputElement>)=>void}){return <div><p className="text-sm font-semibold">{title}</p><label className="mt-2 inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer"><Upload size={14}/>Joindre une image<input type="file" accept="image/*" className="hidden" onChange={onChange}/></label>{value&&<img src={value} className="h-16 mt-3 object-contain" alt={title}/>}</div>}
