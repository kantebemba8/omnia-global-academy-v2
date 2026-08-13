import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Eye,EyeOff,Info} from 'lucide-react';
import {AuthLayout} from '../../components/AuthLayout';
import {authFetch} from '../../lib/authApi';
import {COUNTRIES,getPrefix} from '../../lib/countries';

const input='w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050]';
const label='block text-sm font-medium text-gray-700 mb-1.5';

export function RegisterOrganizer(){
 const nav=useNavigate();
 const [f,setF]=useState<any>({full_name:'',email:'',phone_local:'',password:'',confirm_password:'',birth_date:'',country_code:'',display_name:'',organizer_type:'independent',professional_title:'',organization_name:'',website_url:'',bio:'',experience_summary:'',event_topics:'',allow_email:true,allow_sms:false,subscribe_newsletter:false});
 const [show,setShow]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const set=(k:string,v:any)=>setF((x:any)=>({...x,[k]:v}));
 async function submit(e:React.FormEvent){e.preventDefault();if(f.password!==f.confirm_password){setError('Les mots de passe ne correspondent pas');return}if(!f.country_code){setError('Sélectionnez votre pays.');return}setLoading(true);setError('');
  try{const phone_number=getPrefix(f.country_code)+f.phone_local.replace(/^0+/,'');const d:any=await authFetch('auth-register',{...f,role:'organizer',phone_number,event_topics:f.event_topics.split(',').map((x:string)=>x.trim()).filter(Boolean)});if(!d.success){setError(d.message||'Erreur');return}nav('/verifier-otp',{state:{email:f.email.trim().toLowerCase(),purpose:'inscription',user_id:d.user_id,initial_email_sent:d.email_sent!==false}})}catch(e){setError(e instanceof Error?e.message:'Erreur')}finally{setLoading(false)}
 }
 return <AuthLayout title="Inscription Organisateur" subtitle="Organisez des Lives, conférences, masterclass et événements sur Omnia Live" variant="wide">
  <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">{error&&<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{error}</div>}
   <div className="flex items-start gap-2 p-3 rounded-lg md:col-span-2"
     style={{ backgroundColor: '#FFF8E7', border: '1px solid #FDE68A' }}>
     <Info size={15} style={{ color: '#BF8813', flexShrink: 0, marginTop: 1 }} />
     <p className="text-xs" style={{ color: '#374151' }}>
       Votre demande sera examinée par l’équipe Omnia avant activation.
       L’organisateur ne sera activé qu’après validation.
     </p>
   </div>
   <div><label className={label}>Nom complet</label><input required className={input} value={f.full_name} onChange={e=>set('full_name',e.target.value)}/></div>
   <div><label className={label}>Nom public / nom d’organisateur</label><input required className={input} value={f.display_name} onChange={e=>set('display_name',e.target.value)} placeholder="Nom affiché sur vos événements"/></div>
   <div><label className={label}>Email</label><input required type="email" className={input} value={f.email} onChange={e=>set('email',e.target.value)}/></div>
   <div><label className={label}>Téléphone</label><div className="flex flex-col gap-2 sm:flex-row"><select className={input} value={f.country_code} onChange={e=>set('country_code',e.target.value)}><option value="">Indicatif</option>{COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.prefix} {c.label}</option>)}</select><input required className={input} value={f.phone_local} onChange={e=>set('phone_local',e.target.value)}/></div></div>
   <div><label className={label}>Date de naissance</label><input required type="date" className={input} value={f.birth_date} onChange={e=>set('birth_date',e.target.value)}/></div>
   <div><label className={label}>Type d’organisateur</label><select className={input} value={f.organizer_type} onChange={e=>set('organizer_type',e.target.value)}><option value="independent">Indépendant</option><option value="company">Entreprise</option><option value="association">Association</option><option value="media">Média</option><option value="expert">Expert / conférencier</option><option value="other">Autre</option></select></div>
   <div><label className={label}>Fonction / titre professionnel</label><input className={input} value={f.professional_title} onChange={e=>set('professional_title',e.target.value)}/></div>
   <div><label className={label}>Organisation représentée <span className="text-gray-400">(optionnel)</span></label><input className={input} value={f.organization_name} onChange={e=>set('organization_name',e.target.value)}/></div>
   <div><label className={label}>Site internet <span className="text-gray-400">(optionnel)</span></label><input className={input} value={f.website_url} onChange={e=>set('website_url',e.target.value)}/></div>
   <div><label className={label}>Thèmes d’événements</label><input required className={input} value={f.event_topics} onChange={e=>set('event_topics',e.target.value)} placeholder="Entrepreneuriat, finance, technologie…"/></div>
   <div className="md:col-span-2"><label className={label}>Expérience d’organisation</label><textarea required rows={3} className={input} value={f.experience_summary} onChange={e=>set('experience_summary',e.target.value)}/></div>
   <div className="md:col-span-2"><label className={label}>Présentation</label><textarea rows={3} className={input} value={f.bio} onChange={e=>set('bio',e.target.value)}/></div>
   <div><label className={label}>Mot de passe</label><div className="relative"><input required minLength={8} type={show?'text':'password'} className={input} value={f.password} onChange={e=>set('password',e.target.value)}/><button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-3.5 text-gray-400">{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
   <div><label className={label}>Confirmer le mot de passe</label><input required type={show?'text':'password'} className={input} value={f.confirm_password} onChange={e=>set('confirm_password',e.target.value)}/></div>
   <label className="flex items-start gap-3 border-t border-gray-200 pt-4 text-sm text-gray-600 md:col-span-2"><input type="checkbox" checked={Boolean(f.subscribe_newsletter)} onChange={e=>set('subscribe_newsletter',e.target.checked)} className="mt-0.5"/><span>S’abonner à Omnia Newsletter. Ce consentement est facultatif et peut être retiré à tout moment.</span></label>
   <button disabled={loading} className="w-full rounded-lg bg-[#002050] py-3 font-semibold text-white md:col-span-2">{loading?'Inscription…':'Soumettre ma candidature'}</button>
  </form>
 </AuthLayout>
}