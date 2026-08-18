import { edgeAuthHeaders } from '../lib/edgeAuth';
import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Building2, ExternalLink, Link2, Radio, Save, ShieldCheck, Trash2, Video, Wallet } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const PRICING_API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/course-pricing-workflow`;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

async function call(action:string, body:Record<string,unknown>={}){
  const res = await fetch(API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({action,...body})});
  const data = await res.json().catch(()=>({success:false,error:'INVALID_RESPONSE'}));
  if(!res.ok || data.success===false) throw new Error(data.message||data.error||'Une erreur est survenue');
  return data;
}

type Props={course:any;locked?:boolean;onPatch:(patch:Record<string,unknown>)=>void;onSaved?:(message:string)=>void};
type OrganizationOption={
  key:string;source:'certification_organization'|'recognition_partner';organization_id?:string|null;
  recognition_partner_id?:string|null;recognition_program_id?:string|null;name:string;type:string;
  logo_url?:string|null;badge_url?:string|null;signature_url?:string|null;stamp_url?:string|null;
  website_url?:string|null;description?:string|null;course_logo_authorized:boolean;
  certificate_logo_authorized:boolean;default_certification_name?:string|null;credit_value?:number|null;credit_unit?:string|null;
};

type CertDraft={registry_key:string;type:string;organization_id:string;recognition_partner_id:string;recognition_program_id:string;
  organization_name:string;certification_name:string;code:string;credit_value:string;credit_unit:string;expires_at:string;
  verification_url:string;logo_url:string;badge_url:string;signature_url:string;stamp_url:string;
  display_on_course:boolean;display_on_certificate:boolean;use_registry_assets:boolean};

const emptyCert:CertDraft={registry_key:'custom',type:'other',organization_id:'',recognition_partner_id:'',recognition_program_id:'',organization_name:'',certification_name:'',code:'',credit_value:'',credit_unit:'heures de formation',expires_at:'',verification_url:'',logo_url:'',badge_url:'',signature_url:'',stamp_url:'',display_on_course:true,display_on_certificate:true,use_registry_assets:true};

export default function StudioCommercialCertificationPanel({course,locked=false,onPatch,onSaved}:Props){
  const isProfessor = typeof window !== 'undefined' && window.location.pathname.includes('/professeur/');
  const [saving,setSaving]=useState(false);
  const [rules,setRules]=useState<any>(null);
  const [certifications,setCertifications]=useState<any[]>([]);
  const [organizations,setOrganizations]=useState<OrganizationOption[]>([]);
  const [pricingComment,setPricingComment]=useState('');
  const [liveLinks,setLiveLinks]=useState<any[]>([]);
  const [liveOptions,setLiveOptions]=useState<{events:any[];media:any[]}>({events:[],media:[]});
  const [linkTarget,setLinkTarget]=useState('');
  const [linkPosition,setLinkPosition]=useState('0');
  const [newCert,setNewCert]=useState<CertDraft>({...emptyCert,registry_key:'omnia',type:'omnia',organization_name:'Omnia Global Academy',certification_name:'Certification Omnia'});

  useEffect(()=>{ if(!course?.id) return; Promise.all([call('get_commercialization',{course_id:course.id}),call('list_live_content_options',{course_id:course.id}).catch(()=>({events:[],media:[]}))]).then(([d,live])=>{setRules(d.revenue_rules||null);setCertifications(d.certifications||[]);setOrganizations(d.organization_options||[]);setLiveLinks(d.live_links||[]);setLiveOptions({events:live.events||[],media:live.media||[]});if(d.course) onPatch(d.course)}).catch(()=>{}); },[course?.id]);

  const selectedOrganization=useMemo(()=>organizations.find(item=>item.key===newCert.registry_key)||null,[organizations,newCert.registry_key]);
  const professorShare=useMemo(()=>{
    if(!rules) return null;
    const key=course.is_assisted?(course.certification_requested?'commission_assistee_avec_cpd':'commission_assistee_sans_cpd'):(course.certification_requested?'commission_normal_avec_cpd':'commission_normal_sans_cpd');
    return rules[key]||null;
  },[rules,course.is_assisted,course.certification_requested]);

  function chooseOrganization(key:string){
    const option=organizations.find(item=>item.key===key);
    if(!option){setNewCert({...emptyCert,registry_key:'custom'});return;}
    setNewCert(current=>({...current,registry_key:key,type:option.type||'partner',organization_id:option.organization_id||'',recognition_partner_id:option.recognition_partner_id||'',recognition_program_id:option.recognition_program_id||'',organization_name:option.name,certification_name:option.default_certification_name||current.certification_name||`Certification ${option.name}`,credit_value:option.credit_value==null?'':String(option.credit_value),credit_unit:option.credit_unit||current.credit_unit,verification_url:option.website_url||'',logo_url:option.logo_url||'',badge_url:option.badge_url||'',signature_url:option.signature_url||'',stamp_url:option.stamp_url||'',use_registry_assets:true}));
  }

  async function saveCommercial(){
    if(!course.id) return onSaved?.('Enregistrez d’abord le brouillon de la formation.');
    setSaving(true);try{const d=await call('save_commercialization',{course_id:course.id,sale_mode:course.sale_mode||'paid',desired_price_amount:Number(course.desired_price_amount||0),sale_currency:course.sale_currency||'XOF',promotion_price_amount:course.promotion_price_amount?Number(course.promotion_price_amount):null,structure_payment_mode:course.structure_payment_mode||'free',structure_fixed_amount:course.structure_fixed_amount?Number(course.structure_fixed_amount):null});const meta=await call('update_course',{course_id:course.id,certificate_mode:course.certificate_mode||'omnia'});onPatch({...d.course,...meta.course});onSaved?.('Finalisation commerciale enregistrée.');}catch(e:any){onSaved?.(e.message)}finally{setSaving(false)}
  }

  async function structurePricingAction(action:'structure_accept'|'structure_revision'){
    if(!course.id) return;
    if(action==='structure_revision'&&!pricingComment.trim()) return onSaved?.('Indiquez la raison de la révision tarifaire.');
    setSaving(true);try{const res=await fetch(PRICING_API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({course_id:course.id,action,comment:pricingComment.trim()||undefined,desired_price_amount:Number(course.desired_price_amount||0)})});const d=await res.json().catch(()=>({}));if(!res.ok||d.error)throw new Error(d.message||d.error||'Action tarifaire impossible');onPatch({pricing_status:d.pricing_status,price_xof:d.price_xof??course.price_xof});setPricingComment('');onSaved?.(action==='structure_accept'?'Nouveau prix accepté par la Structure.':'Révision tarifaire demandée à Omnia.');}catch(e:any){onSaved?.(e.message)}finally{setSaving(false)}
  }

  async function addLiveLink(){
    if(!course.id||!linkTarget) return onSaved?.('Choisissez un Live ou un Replay à relier.');
    const [kind,id]=linkTarget.split(':');
    setSaving(true);try{await call('add_course_live_link',{course_id:course.id,event_id:kind==='event'?id:undefined,media_id:kind==='media'?id:undefined,position:Math.max(0,Number(linkPosition||0))});const d=await call('get_commercialization',{course_id:course.id});setLiveLinks(d.live_links||[]);setLinkTarget('');setLinkPosition('0');onSaved?.('Contenu Omnia Live relié à la formation. Les apprenants inscrits recevront automatiquement le droit d’accès.');}catch(e:any){onSaved?.(e.message)}finally{setSaving(false)}
  }

  async function removeLiveLink(linkId:string){
    if(!course.id) return;
    setSaving(true);try{await call('remove_course_live_link',{course_id:course.id,link_id:linkId});setLiveLinks(v=>v.filter(x=>x.id!==linkId));onSaved?.('Liaison retirée de la formation.');}catch(e:any){onSaved?.(e.message)}finally{setSaving(false)}
  }

  async function addCertification(){
    if(!course.id) return onSaved?.('Enregistrez d’abord le brouillon.');
    setSaving(true);try{const d=await call('save_course_certification_request',{course_id:course.id,certification:{...newCert,credit_value:newCert.credit_value?Number(newCert.credit_value):null}});setCertifications(v=>[...v,d.certification]);onPatch({certification_requested:true});setNewCert({...emptyCert});onSaved?.('Certification ajoutée et envoyée à validation.');}catch(e:any){onSaved?.(e.message)}finally{setSaving(false)}
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
      {professorShare&&<div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Règle actuelle : créateur {professorShare.professeur??professorShare.structure??0}% · plateforme {professorShare.plateforme??0}%. Cette information vient des réglages de l’Administration Omnia.</div>}
      <button disabled={saving||locked} onClick={saveCommercial} className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{background:BLUE}}><Save size={14}/>Enregistrer la commercialisation</button>
    </div>

    <div className="rounded-xl border bg-white p-4" style={{borderColor:BORDER}}>
      <div className="flex items-center gap-2"><Link2 size={17} color={GOLD}/><h3 className="text-sm font-semibold" style={{color:BLUE}}>Lives & Replays inclus</h3></div>
      <p className="mt-1 text-xs text-gray-500">Reliez sans duplication un Live, une formation synchrone ou un Replay Omnia Live. Toute inscription à cette formation accordera automatiquement l’accès correspondant.</p>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_110px_auto]"><select disabled={locked||saving} value={linkTarget} onChange={e=>setLinkTarget(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}><option value="">Choisir un contenu Omnia Live</option>{liveOptions.events.map(ev=><option key={`event:${ev.id}`} value={`event:${ev.id}`}>Live · {ev.title} · {String(ev.delivery_type||'').replaceAll('_',' ')}</option>)}{liveOptions.media.map(m=><option key={`media:${m.id}`} value={`media:${m.id}`}>{m.media_type==='replay'?'Replay':'Vidéo'} · {m.title||'Sans titre'}</option>)}</select><input disabled={locked||saving} type="number" min="0" value={linkPosition} onChange={e=>setLinkPosition(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}} placeholder="Ordre"/><button disabled={locked||saving||!linkTarget} onClick={addLiveLink} className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{background:BLUE}}>Relier</button></div>
      {liveLinks.length>0&&<div className="mt-3 divide-y rounded-lg border" style={{borderColor:BORDER}}>{liveLinks.map(link=>{const ev=link.live_events;const media=link.live_media;return <div key={link.id} className="flex items-center gap-3 px-3 py-2 text-sm"><span className="shrink-0" style={{color:GOLD}}>{media?<Video size={15}/>:<Radio size={15}/>}</span><div className="min-w-0 flex-1"><p className="truncate font-medium" style={{color:BLUE}}>{link.title_override||media?.title||ev?.title||'Contenu Omnia Live'}</p><p className="text-[11px] text-gray-500">{media?(media.media_type==='replay'?'Replay':'Vidéo'):String(ev?.delivery_type||'Live').replaceAll('_',' ')} · ordre {link.position||0}</p></div><button disabled={locked||saving} onClick={()=>removeLiveLink(link.id)} className="p-1 text-red-600 disabled:opacity-40" title="Retirer la liaison"><Trash2 size={14}/></button></div>})}</div>}
    </div>



    <div className="rounded-xl border bg-white p-4" style={{borderColor:BORDER}}>
      <div className="flex items-center gap-2"><ShieldCheck size={17} color={GOLD}/><h3 className="text-sm font-semibold" style={{color:BLUE}}>Certification</h3></div>
      <p className="mt-1 text-xs text-gray-500">Choisissez ce que reçoit l’apprenant après réussite. Les détails externes ne sont demandés que lorsqu’ils sont réellement nécessaires.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[['omnia','Certificat Omnia'],['external','Omnia + certification externe'],['none','Aucun certificat']].map(([value,label])=><label key={value} className={`rounded-xl border p-3 text-xs font-semibold ${course.certificate_mode===value||(!course.certificate_mode&&value==='omnia')?'bg-blue-50':'bg-white'}`} style={{borderColor:course.certificate_mode===value||(!course.certificate_mode&&value==='omnia')?BLUE:BORDER,color:BLUE}}><input type="radio" className="mr-2" name="certificate-mode" value={value} disabled={locked} checked={(course.certificate_mode||'omnia')===value} onChange={()=>onPatch({certificate_mode:value,certification_requested:value==='external'})}/>{label}</label>)}
      </div>
    </div>

    {(course.certificate_mode||'omnia')==='external' && <div className="rounded-xl border bg-white p-4" style={{borderColor:BORDER}}>
      <div className="flex items-center gap-2"><BadgeCheck size={17} color={GOLD}/><h3 className="text-sm font-semibold" style={{color:BLUE}}>Certification externe et partenaire</h3></div>
      <p className="mt-1 text-xs text-gray-500">Choisissez de préférence un organisme déjà validé. Ses logos et autorisations seront repris automatiquement après validation de l’Administration Omnia.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-gray-600 md:col-span-2">Organisme validé<select disabled={locked} value={newCert.registry_key} onChange={e=>chooseOrganization(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}><option value="custom">Nouvel organisme / saisie manuelle</option>{organizations.map(o=><option key={o.key} value={o.key}>{o.name}{o.default_certification_name?` — ${o.default_certification_name}`:''}</option>)}</select></label>
        <label className="text-xs font-medium text-gray-600">Type<select disabled={locked} value={newCert.type} onChange={e=>setNewCert({...newCert,type:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}><option value="omnia">OGA</option><option value="cpd">Développement professionnel continu (CPD)</option><option value="structure">Structure</option><option value="professor">Professeur</option><option value="partner">Partenaire</option><option value="other">Autre</option></select></label>
        <label className="text-xs font-medium text-gray-600">Organisme<input disabled={locked||newCert.registry_key!=='custom'} value={newCert.organization_name} onChange={e=>setNewCert({...newCert,organization_name:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}/></label>
        <label className="text-xs font-medium text-gray-600 md:col-span-2">Nom de la certification<input disabled={locked} value={newCert.certification_name} onChange={e=>setNewCert({...newCert,certification_name:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}/></label>
        <label className="text-xs font-medium text-gray-600">Code / référence<input disabled={locked} value={newCert.code} onChange={e=>setNewCert({...newCert,code:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}/></label>
        <label className="text-xs font-medium text-gray-600">Crédits / heures<input disabled={locked} type="number" min="0" value={newCert.credit_value} onChange={e=>setNewCert({...newCert,credit_value:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}/></label>
        <label className="text-xs font-medium text-gray-600">Unité<input disabled={locked} value={newCert.credit_unit} onChange={e=>setNewCert({...newCert,credit_unit:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}/></label>
        <label className="text-xs font-medium text-gray-600">Expiration<input disabled={locked} type="date" value={newCert.expires_at} onChange={e=>setNewCert({...newCert,expires_at:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}/></label>
        <label className="text-xs font-medium text-gray-600 md:col-span-2">Lien de vérification ou site officiel<input disabled={locked} type="url" value={newCert.verification_url} onChange={e=>setNewCert({...newCert,verification_url:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}} placeholder="https://…"/></label>
      </div>
      {selectedOrganization&&<div className="mt-3 flex items-start gap-3 rounded-xl border bg-slate-50 p-3" style={{borderColor:BORDER}}>{selectedOrganization.logo_url?<img src={selectedOrganization.logo_url} alt={selectedOrganization.name} className="h-12 w-20 object-contain"/>:<Building2 className="mt-1 text-slate-400"/>}<div className="min-w-0 text-xs text-slate-600"><p className="font-semibold" style={{color:BLUE}}>{selectedOrganization.name}</p><p>Logo page formation : {selectedOrganization.course_logo_authorized?'autorisé':'non autorisé'} · Logo certificat : {selectedOrganization.certificate_logo_authorized?'autorisé':'non autorisé'}</p>{selectedOrganization.website_url&&<a href={selectedOrganization.website_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[#002050]">Voir le site officiel <ExternalLink size={11}/></a>}</div></div>}
      {newCert.registry_key==='custom'&&<div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Un nouvel organisme peut être proposé, mais aucun logo ne sera affiché avant validation de son identité et de l’autorisation d’usage par l’Administration Omnia.</div>}
      <div className="mt-3 flex flex-wrap gap-5 text-xs text-gray-700"><label className="flex items-center gap-2"><input type="checkbox" checked={newCert.display_on_course} onChange={e=>setNewCert({...newCert,display_on_course:e.target.checked})}/>Afficher sur la page de formation</label><label className="flex items-center gap-2"><input type="checkbox" checked={newCert.display_on_certificate} onChange={e=>setNewCert({...newCert,display_on_certificate:e.target.checked})}/>Afficher sur le certificat</label></div>
      <button disabled={saving||locked||!newCert.organization_name.trim()||!newCert.certification_name.trim()} onClick={addCertification} className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{background:BLUE}}><BadgeCheck size={14}/>Ajouter et soumettre</button>

      <div className="mt-5 space-y-2">{certifications.map(cert=><div key={cert.id} className="flex items-center gap-3 rounded-lg border p-3" style={{borderColor:BORDER}}>{(cert.immutable_asset_snapshot?.logo_url||cert.logo_url||cert.badge_url)?<img src={cert.immutable_asset_snapshot?.logo_url||cert.logo_url||cert.badge_url} alt="" className="h-10 w-16 object-contain"/>:<Building2 size={18} className="text-slate-400"/>}<div className="min-w-0 flex-1"><p className="text-sm font-semibold" style={{color:BLUE}}>{cert.certification_name}</p><p className="text-xs text-gray-500">{cert.organization_name} · {cert.status}</p></div><div className="text-right text-[11px] text-gray-500"><p>{cert.display_on_course?'Page formation':'Masqué page'}</p><p>{cert.display_on_certificate?'Certificat':'Masqué certificat'}</p></div></div>)}</div>
    </div>}
  </div>;
}
