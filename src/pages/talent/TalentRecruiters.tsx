import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStoredUser } from '../../lib/session';
import { Briefcase, Check, Clock3, KeyRound, Search, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { TalentLayout } from '../../components/talent/TalentLayout';
import { joinRecruitmentStructure, loadRecruiterStatus, RecruiterStatus, submitRecruiterApplication } from './talentApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

export default function TalentRecruiters() {
  const user = getStoredUser<{ full_name?: string; email?: string; phone_number?: string; roles?: string[] }>();
  const [profile, setProfile] = useState<RecruiterStatus | null>(null);
  const [loading, setLoading] = useState(!!user);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [form, setForm] = useState({ company_name:'', job_title:'', professional_email:user?.email||'', phone:user?.phone_number||'', country:'', linkedin_url:'', website_url:'', recruiter_type:'independent' });

  async function refresh() {
    if (!user) return;
    setLoading(true); setError('');
    try { const r = await loadRecruiterStatus(); setProfile(r.profile); }
    catch (e) { setError(e instanceof Error ? e.message : 'Statut recruteur indisponible.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { const r = await submitRecruiterApplication(form); setProfile(r.profile); }
    catch (e) { setError(e instanceof Error ? e.message : 'Demande impossible.'); }
    finally { setBusy(false); }
  }
  async function join() {
    if (!joinCode.trim()) return;
    setBusy(true); setError('');
    try { const r = await joinRecruitmentStructure(joinCode.trim()); setProfile(r.profile); setJoinCode(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Code invalide ou expiré.'); }
    finally { setBusy(false); }
  }

  const canOpenDashboard = profile?.status === 'approved' || !!user?.roles?.some(role => role === 'recruteur' || role === 'super_admin');
  return <TalentLayout><div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
    <div className="max-w-3xl"><span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{background:'rgba(191,136,19,.12)',color:GOLD}}>Pour les recruteurs</span><h1 className="mt-5 text-3xl font-semibold leading-tight" style={{color:BLUE}}>Repérez des talents et recrutez dans un environnement Omnia vérifié</h1><p className="mt-4 text-base leading-7 text-gray-600">Le recruteur indépendant dispose d’un espace dédié. Le recruteur rattaché à une Structure rejoint son équipe avec un code et utilise le module Recrutement de la Structure.</p></div>
    {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="mt-7 flex flex-wrap gap-3">{canOpenDashboard ? <Link to={profile?.recruiter_type==='structure'?'/structure/recrutement/dashboard':'/talent/recruteur/dashboard'} className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white" style={{background:BLUE}}><Briefcase size={17}/>Ouvrir mon espace recrutement</Link> : !user ? <><Link to="/inscription/apprenant" className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white" style={{background:BLUE}}><UserPlus size={17}/>Créer un compte Omnia</Link><Link to="/connexion" className="rounded-lg border px-5 py-3 text-sm font-semibold" style={{borderColor:BORDER,color:BLUE}}>Se connecter</Link></> : null}</div>

    {user && loading && <p className="mt-8 text-sm text-gray-500">Chargement du statut recruteur…</p>}
    {user && profile && !canOpenDashboard && <div className="mt-8 rounded-xl border bg-white p-6" style={{borderColor:BORDER}}><div className="flex items-center gap-3"><Clock3 color={GOLD}/><div><h2 className="font-semibold" style={{color:BLUE}}>Demande recruteur : {profile.status}</h2><p className="mt-1 text-sm text-gray-500">{profile.status==='pending'?'Votre demande attend la validation du Super Admin.':profile.status==='rejected'?(profile.rejection_reason||'Votre demande a été refusée.'):profile.status==='suspended'?(profile.rejection_reason||'Votre compte recruteur est suspendu.'):'Statut en cours.'}</p></div></div></div>}

    {user && !profile && <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <form onSubmit={submit} className="rounded-xl border bg-white p-6" style={{borderColor:BORDER}}><h2 className="text-lg font-semibold" style={{color:BLUE}}>Demande recruteur indépendant</h2><p className="mt-1 text-sm text-gray-500">Votre profil sera vérifié par le Super Admin avant activation.</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{[
        ['company_name','Entreprise ou cabinet *'],['job_title','Fonction *'],['professional_email','Email professionnel *'],['phone','Téléphone'],['country','Pays'],['linkedin_url','LinkedIn'],['website_url','Site web'],
      ].map(([key,label])=><label key={key} className={key==='linkedin_url'||key==='website_url'?'sm:col-span-2':''}><span className="mb-1.5 block text-xs font-semibold text-gray-600">{label}</span><input required={['company_name','job_title','professional_email'].includes(key)} type={key==='professional_email'?'email':'text'} value={(form as any)[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className="w-full rounded-lg border px-3 py-2.5 text-sm" style={{borderColor:BORDER}}/></label>)}</div><button disabled={busy} className="mt-5 rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{background:BLUE}}>{busy?'Envoi…':'Envoyer ma demande'}</button></form>
      <div className="rounded-xl border bg-white p-6" style={{borderColor:BORDER}}><div className="flex items-center gap-3"><KeyRound color={GOLD}/><h2 className="text-lg font-semibold" style={{color:BLUE}}>Rejoindre une Structure</h2></div><p className="mt-3 text-sm leading-6 text-gray-500">Saisissez le code transmis par le Responsable Structure. Votre compte sera rattaché à son équipe recrutement avec les permissions prévues.</p><input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="CODE RECRUTEMENT" className="mt-5 w-full rounded-lg border px-3 py-3 text-sm uppercase tracking-wider" style={{borderColor:BORDER}}/><button type="button" onClick={join} disabled={busy||!joinCode.trim()} className="mt-3 w-full rounded-lg border px-4 py-3 text-sm font-semibold disabled:opacity-50" style={{borderColor:GOLD,color:BLUE}}>Rejoindre la Structure</button></div>
    </div>}

    <div className="mt-10 grid gap-4 md:grid-cols-3">{[
      {icon:Search,title:'Rechercher',text:'Filtrer les profils publics selon les compétences, secteurs, langues et disponibilité.'},
      {icon:UsersRound,title:'Sélectionner',text:'Consulter les profils autorisés et enregistrer des candidats potentiels.'},
      {icon:Briefcase,title:'Recruter',text:'Publier des offres, suivre les candidatures et organiser les entretiens.'},
    ].map(item=><div key={item.title} className="rounded-xl border bg-white p-5" style={{borderColor:BORDER}}><item.icon size={20} color={GOLD}/><h2 className="mt-3 text-base font-semibold" style={{color:BLUE}}>{item.title}</h2><p className="mt-2 text-sm leading-6 text-gray-500">{item.text}</p></div>)}</div>
    <div className="mt-10 rounded-xl border bg-white p-6" style={{borderColor:BORDER}}><div className="flex items-center gap-3"><ShieldCheck color={GOLD}/><h2 className="text-lg font-semibold" style={{color:BLUE}}>Validation et confiance</h2></div><ul className="mt-5 grid gap-3 md:grid-cols-2">{['Email professionnel vérifié','Validation du compte par le Super Admin','Traçabilité des prises de contact','Respect de la visibilité choisie par l’apprenant'].map(text=><li key={text} className="flex items-center gap-2 text-sm text-gray-600"><Check size={16} color={GOLD}/>{text}</li>)}</ul></div>
  </div></TalentLayout>;
}
