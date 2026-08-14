import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight, Briefcase, CalendarDays, CheckCircle2, FileText, Heart,
  Mail, MessageSquare, Plus, Search, UsersRound,
} from 'lucide-react';
import { TalentAudienceLayout } from '../../components/talent/TalentRoleLayout';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { contactTalent, loadPublicTalents, loadRecruitmentTeam, loadTalentConversations, loadTalentFavorites, loadTalentInterviews, PublicTalent, TalentConversation, TalentInterview, toggleTalentFavorite, loadTalentAnalytics, TalentAnalytics, updateRecruitmentPermissions } from '../talent/talentApi';
import TalentAnalyticsPanel, { PeriodSelector } from '../../components/talent/TalentAnalyticsPanel';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';
const MUTED = '#6B7280';

type Section = 'dashboard'|'offres'|'talents'|'favoris'|'candidats'|'entretiens'|'messages'|'statistiques'|'equipe';
type Favorite = PublicTalent;
type Job = { id:string; title?:string; status?:string; applications_count?:number; location?:string; contract_type?:string };
type Application = { id:string; status?:string; tracking_status?:string; users?:{full_name?:string;email?:string}|null; job_offers?:{title?:string}|null };


function sectionFromPath(path:string):Section {
  const last = path.split('/').filter(Boolean).pop() || 'dashboard';
  return (['dashboard','offres','talents','favoris','candidats','entretiens','messages','statistiques','equipe'].includes(last) ? last : 'dashboard') as Section;
}

async function loadRecruitmentData(){
  const res = await fetch(ENDPOINTS.jobPlatformManage, {
    method:'POST',
    headers:edgeAuthHeaders(),
    body:JSON.stringify({ action:'list_my_jobs' }),
  });
  const jobsData = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(jobsData.message || jobsData.error || 'Impossible de charger les offres.');

  const appsRes = await fetch(ENDPOINTS.jobPlatformManage, {
    method:'POST',
    headers:edgeAuthHeaders(),
    body:JSON.stringify({ action:'list_applications' }),
  });
  const appsData = await appsRes.json().catch(()=>({}));
  if(!appsRes.ok) throw new Error(appsData.message || appsData.error || 'Impossible de charger les candidatures.');
  return { jobs: jobsData.jobs || [], applications: appsData.applications || [] };
}

function EmptyState({icon:Icon,title,text,action}:{icon:React.ElementType;title:string;text:string;action?:React.ReactNode}){
  return <div className="rounded-2xl border bg-white px-6 py-12 text-center" style={{borderColor:BORDER}}>
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-50"><Icon size={22} color={GOLD}/></div>
    <h2 className="mt-4 text-base font-semibold" style={{color:BLUE}}>{title}</h2>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{color:MUTED}}>{text}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>;
}

export default function StructureRecruitment(){
  const location = useLocation();
  const section = sectionFromPath(location.pathname);
  const [talents,setTalents] = useState<PublicTalent[]>([]);
  const [jobs,setJobs] = useState<Job[]>([]);
  const [applications,setApplications] = useState<Application[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [query,setQuery] = useState('');
  const [favorites,setFavorites] = useState<Favorite[]>([]);
  const [interviews,setInterviews] = useState<TalentInterview[]>([]);
  const [conversations,setConversations] = useState<TalentConversation[]>([]);
  const [contactTarget,setContactTarget] = useState<PublicTalent|null>(null);
  const [contactMessage,setContactMessage] = useState('');
  const [contactBusy,setContactBusy] = useState(false);
  const [analytics,setAnalytics] = useState<TalentAnalytics|null>(null);
  const [periodDays,setPeriodDays] = useState(30);

  useEffect(()=>{
    let alive = true;
    Promise.allSettled([loadPublicTalents(),loadRecruitmentData(),loadTalentFavorites('structure'),loadTalentInterviews('structure'),loadTalentConversations('structure'),loadTalentAnalytics('structure',periodDays)]).then(results=>{
      if(!alive) return;
      if(results[0].status==='fulfilled') setTalents(results[0].value); else setError('Les profils publics ne sont pas disponibles pour le moment.');
      if(results[1].status==='fulfilled') { setJobs(results[1].value.jobs); setApplications(results[1].value.applications); }
      else setError(prev=>prev || 'Les données de recrutement de la Structure ne sont pas disponibles pour le moment.');
      if(results[2].status==='fulfilled') setFavorites(results[2].value);
      if(results[3].status==='fulfilled') setInterviews(results[3].value);
      if(results[4].status==='fulfilled') setConversations(results[4].value);
      if(results[5].status==='fulfilled') setAnalytics(results[5].value.analytics);
      setLoading(false);
    });
    return ()=>{alive=false};
  },[periodDays]);

  const filteredTalents = useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q) return talents;
    return talents.filter(t=>[t.full_name,t.professional_title,t.location,t.country,...(t.skills||[]),...(t.sectors||[])].filter(Boolean).join(' ').toLowerCase().includes(q));
  },[talents,query]);

  async function toggleFavorite(t:PublicTalent){
    try {
      const result = await toggleTalentFavorite(t.id,'structure');
      setFavorites(prev=>result.favorite?[...prev.filter(f=>f.id!==t.id),t]:prev.filter(f=>f.id!==t.id));
    } catch(e) { setError(e instanceof Error?e.message:'Favori indisponible.'); }
  }

  async function submitContact(){
    if(!contactTarget || contactMessage.trim().length<5) return;
    setContactBusy(true);
    try {
      await contactTalent(contactTarget.id,contactMessage.trim(),'Prise de contact Structure','structure');
      setConversations(await loadTalentConversations('structure'));
      setContactTarget(null); setContactMessage('');
    } catch(e) { setError(e instanceof Error?e.message:'Contact indisponible.'); }
    finally { setContactBusy(false); }
  }

  const titles:Record<Section,string> = {
    dashboard:'Tableau de bord recrutement', offres:'Offres', talents:'Recherche de talents', favoris:'Talents favoris', candidats:'Candidats', entretiens:'Entretiens', messages:'Messages', statistiques:'Statistiques', equipe:'Équipe recrutement',
  };

  return <TalentAudienceLayout audience="structure">
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold" style={{color:BLUE}}>{titles[section]}</h1><p className="mt-1 text-sm" style={{color:MUTED}}>Module Recrutement de votre Structure · Omnia Talent</p></div>
        {section!=='offres' && <Link to="/structure/offres-emploi" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{background:BLUE}}><Plus size={16}/>Déposer une offre</Link>}
      </div>

      {error && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>}
      {section==='dashboard' && <Dashboard jobs={jobs} applications={applications} talents={talents} favorites={favorites} loading={loading}/>} 
      {section==='offres' && <OffersRedirect jobs={jobs}/>} 
      {section==='talents' && <Talents talents={filteredTalents} query={query} setQuery={setQuery} loading={loading} favorites={favorites} toggleFavorite={toggleFavorite} contact={setContactTarget}/>} 
      {section==='favoris' && <Favorites favorites={favorites} contact={setContactTarget}/>} 
      {section==='candidats' && <Candidates applications={applications}/>} 
      {section==='entretiens' && <Interviews interviews={interviews}/>}
      {section==='messages' && <Conversations conversations={conversations}/>}
      {section==='statistiques' && <div className="space-y-5"><div className="flex justify-end"><PeriodSelector value={periodDays} onChange={setPeriodDays}/></div><TalentAnalyticsPanel analytics={analytics} loading={loading} mode="structure"/></div>} 
      {section==='equipe' && <Team/>}
    </div>
    {contactTarget && <ContactModal talent={contactTarget} message={contactMessage} setMessage={setContactMessage} busy={contactBusy} close={()=>{setContactTarget(null);setContactMessage('')}} submit={submitContact}/>}
  </TalentAudienceLayout>;
}

function Dashboard({jobs,applications,talents,favorites,loading}:{jobs:Job[];applications:Application[];talents:PublicTalent[];favorites:Favorite[];loading:boolean}){
  const metrics=[
    {label:'Offres actives',value:jobs.filter(j=>j.status==='approved').length,icon:Briefcase},
    {label:'Candidatures',value:applications.length,icon:FileText},
    {label:'Talents publics',value:talents.length,icon:UsersRound},
    {label:'Favoris',value:favorites.length,icon:Heart},
  ];
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(m=><div key={m.label} className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><div className="flex items-center justify-between"><div><p className="text-sm" style={{color:MUTED}}>{m.label}</p><p className="mt-2 text-2xl font-semibold" style={{color:BLUE}}>{loading?'—':m.value}</p></div><div className="rounded-xl p-3" style={{background:'rgba(191,136,19,.12)'}}><m.icon size={20} color={GOLD}/></div></div></div>)}</div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><div className="flex items-center justify-between"><h2 className="text-base font-semibold" style={{color:BLUE}}>Candidatures récentes</h2><Link to="/structure/recrutement/candidats" className="text-sm font-semibold" style={{color:GOLD}}>Voir toutes</Link></div>{applications.length===0?<p className="mt-6 text-sm" style={{color:MUTED}}>Aucune candidature reçue.</p>:<div className="mt-4 divide-y">{applications.slice(0,5).map(a=><div key={a.id} className="flex items-center gap-3 py-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold" style={{color:BLUE}}>{(a.users?.full_name||a.users?.email||'CA').slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" style={{color:BLUE}}>{a.users?.full_name||a.users?.email||'Identité non renseignée'}</p><p className="truncate text-xs" style={{color:MUTED}}>{a.job_offers?.title||'Offre non renseignée'} · {a.tracking_status||a.status||'Statut non renseigné'}</p></div></div>)}</div>}</div>
      <div className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><h2 className="text-base font-semibold" style={{color:BLUE}}>Actions rapides</h2><div className="mt-4 space-y-2">{[
        ['/structure/offres-emploi','Créer ou gérer une offre',Briefcase],['/structure/recrutement/talents','Rechercher des talents',Search],['/structure/recrutement/favoris','Voir les favoris',Heart],
      ].map(([path,label,Icon]:any)=><Link key={path} to={path} className="flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium" style={{borderColor:BORDER,color:BLUE}}><Icon size={17} color={GOLD}/><span className="flex-1">{label}</span><ArrowRight size={15}/></Link>)}</div></div>
    </div>
  </>;
}

function OffersRedirect({jobs}:{jobs:Job[]}){
  return <div className="rounded-2xl border bg-white p-6" style={{borderColor:BORDER}}><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-base font-semibold" style={{color:BLUE}}>Gestion des offres</h2><p className="mt-1 text-sm" style={{color:MUTED}}>{jobs.length} offre(s) rattachée(s) à votre Structure.</p></div><Link to="/structure/offres-emploi" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{background:BLUE}}>Ouvrir la gestion des offres<ArrowRight size={16}/></Link></div></div>;
}

function Talents({talents,query,setQuery,loading,favorites,toggleFavorite,contact}:any){
  return <>
    <div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-3 text-gray-400" size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Métier, compétence, secteur, pays…" className="w-full rounded-xl border bg-white py-2.5 pl-10 pr-3 text-sm outline-none" style={{borderColor:BORDER}}/></label></div>
    {loading?<p className="mt-8 text-sm" style={{color:MUTED}}>Chargement des profils publics…</p>:talents.length===0?<div className="mt-6"><EmptyState icon={UsersRound} title="Aucun talent trouvé" text="Seuls les profils rendus visibles dans Omnia Career apparaissent ici."/></div>:<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{talents.map((t:PublicTalent)=>{const fav=favorites.some((f:Favorite)=>f.id===t.id);return <article key={t.id} className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><div className="flex items-start gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-sm font-semibold" style={{color:BLUE}}>{t.photo_url?<img src={t.photo_url} alt="" className="h-full w-full object-cover"/>:t.full_name.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold" style={{color:BLUE}}>{t.full_name}</h3><p className="truncate text-xs" style={{color:MUTED}}>{t.professional_title||'Titre non renseigné'}</p><p className="mt-1 truncate text-xs" style={{color:MUTED}}>{t.location||t.country||'Localisation non renseignée'}</p></div><button onClick={()=>toggleFavorite(t)} className="rounded-lg p-2" aria-label="Favori"><Heart size={18} fill={fav?GOLD:'none'} color={fav?GOLD:'#9CA3AF'}/></button></div><div className="mt-4 flex flex-wrap gap-2">{(t.skills||[]).slice(0,4).map(s=><span key={s} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">{s}</span>)}</div><div className="mt-5 flex gap-2"><Link to={`/profil/${t.id}`} className="flex-1 rounded-xl border px-3 py-2 text-center text-sm font-semibold" style={{borderColor:BORDER,color:BLUE}}>Voir le profil</Link><button onClick={()=>contact(t)} className="rounded-xl px-3 py-2 text-white" style={{background:BLUE}}><Mail size={16}/></button></div></article>})}</div>}
  </>;
}

function Favorites({favorites,contact}:{favorites:Favorite[];contact:(t:PublicTalent)=>void}){
  if(!favorites.length) return <EmptyState icon={Heart} title="Aucun talent favori" text="Ajoutez des profils depuis la recherche de talents pour les retrouver ici."/>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{favorites.map(f=><div key={f.id} className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-sm font-semibold" style={{color:BLUE}}>{f.photo_url?<img src={f.photo_url} alt="" className="h-full w-full object-cover"/>:f.full_name.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" style={{color:BLUE}}>{f.full_name}</p><p className="truncate text-xs" style={{color:MUTED}}>{f.professional_title||'Titre non renseigné'}</p></div></div><div className="mt-4 flex gap-2"><Link to={`/profil/${f.id}`} className="flex-1 rounded-xl border px-3 py-2 text-center text-sm font-semibold" style={{borderColor:BORDER,color:BLUE}}>Voir</Link><button onClick={()=>contact(f)} className="rounded-xl px-3 py-2 text-white" style={{background:BLUE}}><Mail size={16}/></button></div></div>)}</div>;
}
function Candidates({applications}:{applications:Application[]}){
  if(!applications.length) return <EmptyState icon={FileText} title="Aucun candidat" text="Les candidatures reçues sur les offres de votre Structure apparaîtront ici."/>;
  return <div className="rounded-2xl border bg-white" style={{borderColor:BORDER}}><div className="divide-y">{applications.map(a=><div key={a.id} className="flex flex-wrap items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold" style={{color:BLUE}}>{(a.users?.full_name||a.users?.email||'CA').slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" style={{color:BLUE}}>{a.users?.full_name||a.users?.email||'Identité non renseignée'}</p><p className="truncate text-xs" style={{color:MUTED}}>{a.job_offers?.title||'Offre non renseignée'}</p></div><span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{background:'rgba(191,136,19,.12)',color:GOLD}}>{a.tracking_status||a.status||'Statut non renseigné'}</span></div>)}</div></div>;
}

function Interviews({interviews}:{interviews:TalentInterview[]}){
  if(!interviews.length) return <EmptyState icon={CalendarDays} title="Aucun entretien programmé" text="Les demandes d’entretien réelles de votre Structure apparaîtront ici."/>;
  return <div className="space-y-3">{interviews.map(i=><div key={i.id} className="rounded-2xl border bg-white p-4" style={{borderColor:BORDER}}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold" style={{color:BLUE}}>{i.title}</p><p className="mt-1 text-xs" style={{color:MUTED}}>{i.talent?.full_name||'Identité non renseignée'} · {new Date(i.scheduled_at).toLocaleString('fr-FR')}</p></div><span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{background:'rgba(191,136,19,.12)',color:GOLD}}>{i.status}</span></div></div>)}</div>;
}

function Conversations({conversations}:{conversations:TalentConversation[]}){
  if(!conversations.length) return <EmptyState icon={MessageSquare} title="Aucun message" text="Les conversations réelles de la Structure avec les talents apparaîtront ici."/>;
  return <div className="divide-y rounded-2xl border bg-white" style={{borderColor:BORDER}}>{conversations.map(c=><div key={c.id} className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold" style={{color:BLUE}}>{(c.talent?.full_name||'TA').slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" style={{color:BLUE}}>{c.talent?.full_name||'Identité non renseignée'}</p><p className="truncate text-xs" style={{color:MUTED}}>{c.last_message?.body||c.subject||'Aucun contenu'}</p></div><span className="text-xs text-gray-400">{new Date(c.last_message_at).toLocaleDateString('fr-FR')}</span></div>)}</div>;
}

function ContactModal({talent,message,setMessage,busy,close,submit}:any){
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold" style={{color:BLUE}}>Contacter {talent.full_name}</h2><p className="mt-1 text-sm" style={{color:MUTED}}>La prise de contact sera enregistrée et notifiée.</p></div><button onClick={close} className="text-gray-500">×</button></div><textarea value={message} onChange={e=>setMessage(e.target.value)} rows={6} className="mt-5 w-full rounded-xl border p-3 text-sm" style={{borderColor:BORDER}} placeholder="Présentez votre opportunité."/><div className="mt-5 flex justify-end gap-2"><button onClick={close} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{borderColor:BORDER,color:BLUE}}>Annuler</button><button onClick={submit} disabled={busy||message.trim().length<5} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{background:BLUE}}>{busy?'Envoi…':'Envoyer'}</button></div></div></div>;
}

function Team(){
  const corePermissions = [
    ['can_post_job','Publier des offres'],
    ['can_search_talent','Rechercher des talents'],
    ['can_contact_talent','Contacter les talents'],
    ['can_manage_jobs','Gérer les offres'],
    ['can_view_applications','Voir les candidatures'],
    ['can_schedule_interview','Programmer les entretiens'],
  ] as const;
  const [members,setMembers]=useState<any[]>([]);
  const [busyUserId,setBusyUserId]=useState('');
  const [error,setError]=useState('');

  async function load(){
    try { const result=await loadRecruitmentTeam(); setMembers(result.members||[]); }
    catch(e){ setError(e instanceof Error?e.message:'Équipe indisponible.'); }
  }
  useEffect(()=>{void load()},[]);

  async function setRecruitmentAccess(member:any,enabled:boolean){
    if(!member.user_id||member.is_primary) return;
    const next:Record<string,boolean> = Object.fromEntries(corePermissions.map(([key])=>[key,enabled]));
    next.can_manage_team = enabled && member.recruitment_permissions?.can_manage_team === true;
    setBusyUserId(String(member.user_id)); setError('');
    try{ await updateRecruitmentPermissions(member.user_id,next); await load(); }
    catch(e){ setError(e instanceof Error?e.message:'Permission non enregistrée.'); }
    finally{ setBusyUserId(''); }
  }

  async function toggleManageTeam(member:any){
    if(!member.user_id||member.is_primary) return;
    const current = member.recruitment_permissions || {};
    const next = {...current,can_manage_team:current.can_manage_team!==true};
    setBusyUserId(String(member.user_id)); setError('');
    try{ await updateRecruitmentPermissions(member.user_id,next); await load(); }
    catch(e){ setError(e instanceof Error?e.message:'Permission non enregistrée.'); }
    finally{ setBusyUserId(''); }
  }

  return <div className="space-y-8">
    <section className="border-y py-6" style={{borderColor:BORDER}}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold" style={{color:BLUE}}>Permissions de recrutement</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6" style={{color:MUTED}}>Le recrutement n’est pas un rôle séparé. La Structure accorde ou retire ici les droits de recrutement à un membre déjà rattaché à son équipe.</p>
        </div>
        <Link to="/structure/equipe" className="inline-flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-semibold" style={{borderColor:GOLD,color:BLUE}}>Gérer les membres<ArrowRight size={16}/></Link>
      </div>
      {error&&<div className="mt-4 border-l-4 border-red-500 py-2 pl-3 text-sm text-red-700">{error}</div>}
      <div className="mt-5 border-l-4 py-3 pl-4 text-sm leading-6" style={{borderColor:GOLD,color:MUTED}}>
        Pour ajouter une nouvelle personne, utilisez d’abord <strong style={{color:BLUE}}>Équipe & délégations</strong>. Une fois membre de la Structure, son accès recrutement peut être activé ici.
      </div>
    </section>

    <section>
      <div className="border-b pb-3" style={{borderColor:BORDER}}>
        <h2 className="font-semibold" style={{color:BLUE}}>Membres de la Structure</h2>
        <p className="mt-1 text-sm" style={{color:MUTED}}>Les données de recrutement restent toujours rattachées à la Structure, jamais à un rôle autonome.</p>
      </div>
      {members.length===0?<p className="py-8 text-sm" style={{color:MUTED}}>Aucun membre d’équipe disponible. Ajoutez d’abord un membre depuis Équipe & délégations.</p>:<div className="divide-y" style={{borderColor:BORDER}}>{members.map((member:any)=>{
        const current=member.recruitment_permissions||{};
        const hasAccess=member.is_primary||corePermissions.some(([key])=>current[key]===true);
        const busy=busyUserId===String(member.user_id);
        return <div key={member.user_id} className="py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-semibold" style={{color:BLUE}}>{member.users?.full_name||'Membre de la Structure'}</p>
              <p className="mt-1 text-sm" style={{color:MUTED}}>{member.users?.email||'Email non affiché'} · {member.role_in_org||'Membre'}</p>
              <p className="mt-1 text-xs" style={{color:member.status==='actif'||member.status==='active'?'#15803D':'#B91C1C'}}>{member.is_primary?'Responsable principal':member.status==='actif'||member.status==='active'?'Membre actif':'Membre non actif'}</p>
            </div>
            <label className="flex items-center gap-3 text-sm font-semibold" style={{color:BLUE}}>
              <span>{member.is_primary?'Accès recrutement inclus':'Accès recrutement'}</span>
              <input type="checkbox" checked={hasAccess} disabled={member.is_primary||busy||!['actif','active'].includes(String(member.status))} onChange={event=>void setRecruitmentAccess(member,event.target.checked)}/>
            </label>
          </div>
          {hasAccess&&<div className="mt-4">
            <div className="grid gap-x-8 md:grid-cols-2">{corePermissions.map(([key,label])=><div key={key} className="flex items-center gap-2 border-b py-2 text-xs" style={{borderColor:BORDER}}><CheckCircle2 size={14} color="#15803D"/><span>{label}</span><span className="ml-auto font-semibold text-green-700">Autorisé</span></div>)}</div>
            {!member.is_primary&&<label className="mt-3 flex items-center justify-between border-l-4 py-2 pl-3 text-xs" style={{borderColor:GOLD}}><span>Peut gérer les permissions recrutement des autres membres</span><input type="checkbox" checked={current.can_manage_team===true} onChange={()=>void toggleManageTeam(member)} disabled={busy}/></label>}
          </div>}
        </div>;
      })}</div>}
    </section>
  </div>;
}

