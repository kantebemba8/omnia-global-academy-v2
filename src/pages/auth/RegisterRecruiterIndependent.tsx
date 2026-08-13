import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase as BriefcaseBusiness, Eye, EyeOff, Info, ShieldCheck } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch, authSessionFetch } from '../../lib/authApi';
import { COUNTRIES, getPrefix } from '../../lib/countries';
import { getSessionToken, getStoredUser } from '../../lib/session';

const input = 'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050]';
const label = 'block text-sm font-medium text-gray-700 mb-1.5';
type StoredUser={full_name?:string;email?:string;phone_number?:string;roles?:string[]};
type FormState={full_name:string;email:string;phone_local:string;password:string;confirm_password:string;country_code:string;company_name:string;job_title:string;linkedin_url:string;website_url:string;allow_email:boolean;allow_sms:boolean;subscribe_newsletter:boolean};

type RegisterResponse={success:boolean;message?:string;user_id?:string;email_sent?:boolean};

export function RegisterRecruiterIndependent() {
  const navigate = useNavigate();
  const existingUser=getStoredUser<StoredUser>();
  const addingToExistingAccount=Boolean(getSessionToken()&&existingUser);
  const [form,setForm]=useState<FormState>({full_name:existingUser?.full_name||'',email:existingUser?.email||'',phone_local:'',password:'',confirm_password:'',country_code:'',company_name:'',job_title:'',linkedin_url:'',website_url:'',allow_email:true,allow_sms:false,subscribe_newsletter:false});
  const [showPassword,setShowPassword]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const set=<K extends keyof FormState>(key:K,value:FormState[K])=>setForm(current=>({...current,[key]:value}));

  async function submit(event:React.FormEvent){
    event.preventDefault();setError('');
    if(!addingToExistingAccount&&form.password!==form.confirm_password){setError('Les mots de passe ne correspondent pas.');return}
    if(!addingToExistingAccount&&!form.country_code){setError('Sélectionnez votre pays.');return}
    setLoading(true);
    try{
      if(addingToExistingAccount){
        const response=await authSessionFetch<RegisterResponse>('auth-register',{action:'apply_existing_role',target_role:'recruteur_independant',company_name:form.company_name.trim(),job_title:form.job_title.trim(),linkedin_url:form.linkedin_url.trim()||null,website_url:form.website_url.trim()||null});
        if(!response.success)throw new Error(response.message||'Candidature impossible.');
        navigate('/inscription?mode=add-role',{replace:true});return;
      }
      const phoneNumber=getPrefix(form.country_code)+form.phone_local.replace(/^0+/,'');
      const response=await authFetch<RegisterResponse>('auth-register',{role:'recruteur_independant',full_name:form.full_name.trim(),email:form.email.trim(),professional_email:form.email.trim(),phone_number:phoneNumber,password:form.password,country_code:form.country_code,company_name:form.company_name.trim(),job_title:form.job_title.trim(),linkedin_url:form.linkedin_url.trim()||null,website_url:form.website_url.trim()||null,allow_email:form.allow_email,allow_sms:form.allow_sms,subscribe_newsletter:form.subscribe_newsletter});
      if(!response.success)throw new Error(response.message||'Inscription impossible.');
      navigate('/verifier-otp',{state:{email:form.email.trim().toLowerCase(),purpose:'inscription',user_id:response.user_id,initial_email_sent:response.email_sent!==false}});
    }catch(err){setError(err instanceof Error?err.message:'Une erreur est survenue.')}finally{setLoading(false)}
  }

  return <AuthLayout title={addingToExistingAccount?'Devenir Recruteur indépendant':'Inscription recruteur indépendant'} subtitle={addingToExistingAccount?'Ajoutez l’espace Recruteur à votre compte Omnia après validation de votre candidature.':'Créez votre compte Omnia et candidatez pour utiliser Omnia Talent'} variant="wide">
    <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      {error&&<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{error}</div>}
      <div className="flex items-start gap-3 border-y border-amber-200 py-3 text-sm text-gray-600 md:col-span-2"><Info size={17} style={{color:'#BF8813',flexShrink:0,marginTop:1}}/><p>{addingToExistingAccount?<>Vous utilisez votre compte actuel <strong>{existingUser?.email}</strong>. Aucun second compte n’est nécessaire.</>:<>Votre identité Omnia peut cumuler plusieurs espaces. L’accès Recruteur sera ajouté uniquement après validation.</>}</p></div>
      {!addingToExistingAccount&&<><div><label className={label}>Nom complet</label><input required className={input} value={form.full_name} onChange={e=>set('full_name',e.target.value)} autoComplete="name"/></div><div><label className={label}>Email</label><input required type="email" className={input} value={form.email} onChange={e=>set('email',e.target.value)} autoComplete="email"/></div></>}
      <div><label className={label}>Entreprise ou cabinet</label><div className="relative"><BriefcaseBusiness size={17} className="absolute left-3 top-3.5 text-gray-400"/><input required className={`${input} pl-10`} value={form.company_name} onChange={e=>set('company_name',e.target.value)}/></div></div>
      <div><label className={label}>Fonction</label><input required className={input} value={form.job_title} onChange={e=>set('job_title',e.target.value)} placeholder="Responsable recrutement, consultant RH…"/></div>
      {!addingToExistingAccount&&<div className="md:col-span-2"><label className={label}>Téléphone</label><div className="flex flex-col gap-2 sm:flex-row"><select className={`${input} sm:max-w-[210px]`} value={form.country_code} onChange={e=>set('country_code',e.target.value)}><option value="">Indicatif</option>{COUNTRIES.map(country=><option key={country.code} value={country.code}>{country.prefix} {country.label}</option>)}</select><input required className={input} value={form.phone_local} onChange={e=>set('phone_local',e.target.value)} autoComplete="tel"/></div></div>}
      <div><label className={label}>LinkedIn <span className="text-gray-400">(optionnel)</span></label><input type="url" className={input} value={form.linkedin_url} onChange={e=>set('linkedin_url',e.target.value)} placeholder="https://www.linkedin.com/in/..."/></div>
      <div><label className={label}>Site internet <span className="text-gray-400">(optionnel)</span></label><input type="url" className={input} value={form.website_url} onChange={e=>set('website_url',e.target.value)} placeholder="https://..."/></div>
      {!addingToExistingAccount&&<><div><label className={label}>Mot de passe</label><div className="relative"><input required minLength={8} type={showPassword?'text':'password'} className={input} value={form.password} onChange={e=>set('password',e.target.value)} autoComplete="new-password"/><button type="button" onClick={()=>setShowPassword(value=>!value)} className="absolute right-3 top-3.5 text-gray-400" aria-label="Afficher le mot de passe">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div><div><label className={label}>Confirmer le mot de passe</label><input required minLength={8} type={showPassword?'text':'password'} className={input} value={form.confirm_password} onChange={e=>set('confirm_password',e.target.value)} autoComplete="new-password"/></div><label className="flex items-start gap-3 border-t border-gray-200 pt-4 text-sm text-gray-600 md:col-span-2"><input type="checkbox" checked={form.subscribe_newsletter} onChange={e=>set('subscribe_newsletter',e.target.checked)} className="mt-0.5"/><span>S’abonner à Omnia Newsletter. Ce consentement est facultatif et peut être retiré à tout moment.</span></label></>}
      <div className="flex items-start gap-3 border-y border-gray-200 py-3 text-sm text-gray-600 md:col-span-2"><ShieldCheck size={17} style={{color:'#BF8813',flexShrink:0,marginTop:1}}/><p>La validation porte uniquement sur l’espace Recruteur. Une attente, un refus ou une suspension Recruteur ne bloque pas vos autres espaces Omnia.</p></div>
      <button disabled={loading} className="w-full rounded-lg bg-[#002050] py-3 font-semibold text-white disabled:opacity-60 md:col-span-2">{loading?'Envoi…':addingToExistingAccount?'Transmettre ma candidature Recruteur':'Créer mon compte et candidater'}</button>
    </form>
  </AuthLayout>;
}
