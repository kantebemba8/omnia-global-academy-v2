import { ChangeEvent, useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Upload } from 'lucide-react';

const API=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/certificate-admin`;
const BLUE='#002050',GOLD='#BF8813';

async function fileData(file:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file)})}

export default function AdminCertificateSettings(){
 const [s,setS]=useState<any>({}),[loading,setLoading]=useState(true),[msg,setMsg]=useState('');
 async function load(){setLoading(true);const r=await fetch(`${API}?action=settings`,{headers:edgeAuthHeaders()});const d=await r.json();setS(d.settings||{});setLoading(false)}
 useEffect(()=>{load()},[]);
 async function save(){const r=await fetch(API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({action:'save_settings',settings:s})});const d=await r.json();setMsg(d.success?'Modifications enregistrées.':d.message||d.error||'Erreur')}
 async function upload(e:ChangeEvent<HTMLInputElement>,key:string){const f=e.target.files?.[0];if(!f)return;const r=await fetch(API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({action:'upload_asset',filename:f.name,mime:f.type,data_url:await fileData(f)})});const d=await r.json();if(d.url)setS((x:any)=>({...x,[key]:d.url}))}
 if(loading)return <AdminLayout><div className="p-12 text-center text-gray-400">Chargement…</div></AdminLayout>;
 return <AdminLayout><div className="max-w-6xl mx-auto px-6 py-6 space-y-7">
  <header className="border-b border-gray-200 pb-5"><p className="text-xs font-semibold uppercase tracking-[.14em]" style={{color:GOLD}}>Certificats & attestations</p><h1 className="text-2xl font-black mt-1" style={{color:BLUE}}>Paramètres</h1><p className="text-sm text-gray-500 mt-1">Identité, langues, signatures institutionnelles et page publique de vérification.</p></header>
  {msg&&<div className="border-l-4 pl-3 py-2 text-sm" style={{borderColor:GOLD}}>{msg}</div>}
  <section className="border-b border-gray-200 pb-6"><h2 className="font-black" style={{color:BLUE}}>Identité institutionnelle</h2>
   <div className="grid md:grid-cols-2 gap-4 mt-4">
    <label className="text-sm">Nom officiel<input value={s.institution_name||''} onChange={e=>setS({...s,institution_name:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label>
    <label className="text-sm">Libellé du signataire institutionnel<input value={s.institution_signature_label||''} onChange={e=>setS({...s,institution_signature_label:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label>
   </div>
   <div className="grid md:grid-cols-2 gap-4 mt-4">
    <div><p className="text-sm font-semibold">Logo OGA</p><label className="mt-2 inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer"><Upload size={14}/>Joindre une image<input type="file" accept="image/*" className="hidden" onChange={e=>upload(e,'certificate_logo_url')}/></label>{s.certificate_logo_url&&<img src={s.certificate_logo_url} className="h-16 mt-3 object-contain" alt="Logo"/>}</div>
    <div><p className="text-sm font-semibold">Signature / sceau institutionnel facultatif</p><p className="text-xs text-gray-400 mt-1">Recommandé : signature institutionnelle, pas la signature personnelle du Super-admin.</p><label className="mt-2 inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer"><Upload size={14}/>Joindre<input type="file" accept="image/*" className="hidden" onChange={e=>upload(e,'institution_signature_url')}/></label>{s.institution_signature_url&&<img src={s.institution_signature_url} className="h-16 mt-3 object-contain" alt="Signature"/>}</div>
   </div>
  </section>
  <section className="border-b border-gray-200 pb-6"><h2 className="font-black" style={{color:BLUE}}>Textes multilingues</h2>
   <div className="grid gap-4 mt-4">
    <label className="text-sm">Français<input value={s.certificate_text_fr||''} onChange={e=>setS({...s,certificate_text_fr:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label>
    <label className="text-sm">Anglais<input value={s.certificate_text_en||''} onChange={e=>setS({...s,certificate_text_en:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label>
    <label className="text-sm">Espagnol<input value={s.certificate_text_es||''} onChange={e=>setS({...s,certificate_text_es:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label>
   </div>
  </section>
  <section className="border-b border-gray-200 pb-6"><h2 className="font-black" style={{color:BLUE}}>Page publique de vérification</h2>
   <div className="grid md:grid-cols-2 gap-4 mt-4">
    <label className="text-sm">Titre FR<input value={s.verification_title_fr||''} onChange={e=>setS({...s,verification_title_fr:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label>
    <label className="text-sm">Titre EN<input value={s.verification_title_en||''} onChange={e=>setS({...s,verification_title_en:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label>
   </div>
   <div className="mt-4 grid sm:grid-cols-2 gap-2">{[['show_verification_beneficiary','Bénéficiaire'],['show_verification_course','Formation / événement'],['show_verification_issuer','Émetteur'],['show_verification_date','Date'],['show_verification_badges','Badges / accréditations']].map(([k,l])=><label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(s[k]??'true')==='true'} onChange={e=>setS({...s,[k]:String(e.target.checked)})}/>{l}</label>)}</div>
  </section>
  <button onClick={save} className="px-5 py-2.5 rounded-lg text-white font-semibold" style={{background:BLUE}}>Enregistrer les paramètres</button>
 </div></AdminLayout>
}
