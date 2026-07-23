import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BarChart3, Briefcase, CalendarDays, FileText, Heart,
  Mail, MessageSquare, Plus, Search, Settings2, Star, UsersRound,
} from 'lucide-react';
import { StructureLayout } from '../../components/StructureLayout';
import { ENDPOINTS } from '../../lib/config';
import { contactTalent, createStructureRecruiter, loadPublicTalents, loadRecruitmentTeam, loadTalentConversations, loadTalentFavorites, loadTalentInterviews, PublicTalent, TalentConversation, TalentInterview, setStructureRecruiterStatus, toggleTalentFavorite, loadTalentAnalytics, TalentAnalytics, updateRecruitmentPermissions } from '../talent/talentApi';
import TalentAnalyticsPanel, { PeriodSelector } from '../../components/talent/TalentAnalyticsPanel';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';
const MUTED = '#6B7280';

type Section = 'dashboard'|'offres'|'talents'|'favoris'|'candidats'|'entretiens'|'messages'|'statistiques'|'equipe';
type Favorite = PublicTalent;
type Job = { id:string; title?:string; status?:string; applications_count?:number; location?:string; contract_type?:string };
type Application = { id:string; status?:string; tracking_status?:string; users?:{full_name?:string;email?:string}|null; job_offers?:{title?:string}|null };

function getToken(){ return localStorage.getItem('omnia_session_token') || ''; }

function sectionFromPath(path:string):Section {
  const last = path.split('/').filter(Boolean).pop() || 'dashboard';
  return (['dashboard','offres','talents','favoris','candidats','entretiens','messages','statistiques','equipe'].includes(last) ? last : 'dashboard') as Section;
}

async function loadRecruitmentData(){
  const res = await fetch(ENDPOINTS.jobPlatformManage, {
    method:'POST',
    headers:{ Authorization:`Bearer ${getToken()}`, 'Content-Type':'application/json' },
    body:JSON.stringify({ action:'list_my_jobs' }),
  });
  const jobsData = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(jobsData.message || jobsData.error || 'Impossible de charger les offres.');

  const appsRes = await fetch(ENDPOINTS.jobPlatformManage, {
    method:'POST',
    headers:{ Authorization:`Bearer ${getToken()}`, 'Content-Type':'application/json' },
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
  const navigate = useNavigate();
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

  return <StructureLayout>
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
  </StructureLayout>;
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
    {loading?<p className="mt-8 text-sm" style={{color:MUTED}}>Chargement des profils publics…</p>:talents.length===0?<div className="mt-6"><EmptyState icon={UsersRound} title="Aucun talent trouvé" text="Seuls les profils rendus visibles dans Omnia Career apparaissent ici."/></div>:<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{talents.map((t:PublicTalent)=>{const fav=favorites.some((f:Favorite)=>f.id===t.id);return <article key={t.id} className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><div className="flex items-start gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-sm font-semibold" style={{color:BLUE}}>{t.photo_url?<img src={t.photo_url} alt="" className="h-full w-full object-cover"/>:t.full_name.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold" style={{color:BLUE}}>{t.full_name}</h3><p className="truncate text-xs" style={{color:MUTED}}>{t.professional_title||'Titre non renseigné'}</p><p className="mt-1 truncate text-xs" style={{color:MUTED}}>{t.location||t.country||'Localisation non renseignée'}</p></div><button onClick={()=>toggleFavorite(t)} className="rounded-lg p-2" aria-label="Favori"><Heart size={18} fill={fav?GOLD:'none'} color={fav?GOLD:'#9CA3AF'}/></button></div><div className="mt-4 flex flex-wrap gap-2">{(t.skills||[]).slice(0,4).map(s=><span key={s} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">{s}</span>)}</div><div className="mt-5 flex gap-2"><Link to={`/talent/profil/${t.id}`} className="flex-1 rounded-xl border px-3 py-2 text-center text-sm font-semibold" style={{borderColor:BORDER,color:BLUE}}>Voir le profil</Link><button onClick={()=>contact(t)} className="rounded-xl px-3 py-2 text-white" style={{background:BLUE}}><Mail size={16}/></button></div></article>})}</div>}
  </>;
}

function Favorites({favorites,contact}:{favorites:Favorite[];contact:(t:PublicTalent)=>void}){
  if(!favorites.length) return <EmptyState icon={Heart} title="Aucun talent favori" text="Ajoutez des profils depuis la recherche de talents pour les retrouver ici."/>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{favorites.map(f=><div key={f.id} className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-sm font-semibold" style={{color:BLUE}}>{f.photo_url?<img src={f.photo_url} alt="" className="h-full w-full object-cover"/>:f.full_name.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" style={{color:BLUE}}>{f.full_name}</p><p className="truncate text-xs" style={{color:MUTED}}>{f.professional_title||'Titre non renseigné'}</p></div></div><div className="mt-4 flex gap-2"><Link to={`/talent/profil/${f.id}`} className="flex-1 rounded-xl border px-3 py-2 text-center text-sm font-semibold" style={{borderColor:BORDER,color:BLUE}}>Voir</Link><button onClick={()=>contact(f)} className="rounded-xl px-3 py-2 text-white" style={{background:BLUE}}><Mail size={16}/></button></div></div>)}</div>;
}
function Candidates({applications}:{applications:Application[]}){
  if(!applications.length) return <EmptyState icon={FileText} title="Aucun candidat" text="Les candidatures reçues sur les offres de votre Structure apparaîtront ici."/>;
  return <div className="rounded-2xl border bg-white" style={{borderColor:BORDER}}><div className="divide-y">{applications.map(a=><div key={a.id} className="flex flex-wrap items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold" style={{color:BLUE}}>{(a.users?.full_name||a.users?.email||'CA').slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" style={{color:BLUE}}>{a.users?.full_name||a.users?.email||'Identité non renseignée'}</p><p className="truncate text-xs" style={{color:MUTED}}>{a.job_offers?.title||'Offre non renseignée'}</p></div><span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{background:'rgba(191,136,19,.12)',color:GOLD}}>{a.tracking_status||a.status||'Statut non renseigné'}</span></div>)}</div></div>;
}

function Statistics({jobs,applications,favorites}:{jobs:Job[];applications:Application[];favorites:Favorite[]}){
  const accepted=applications.filter(a=>['accepted','offer','hired'].includes(a.tracking_status||a.status||'')).length;
  const interview=applications.filter(a=>(a.tracking_status||a.status)==='interview').length;
  const metrics=[['Offres totales',jobs.length],['Candidatures',applications.length],['Entretiens',interview],['Acceptées',accepted],['Favoris',favorites.length]];
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(([label,value])=><div key={String(label)} className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><p className="text-sm" style={{color:MUTED}}>{label}</p><p className="mt-2 text-2xl font-semibold" style={{color:BLUE}}>{value}</p></div>)}</div>;
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
  const permissionKeys = [
    ['can_post_job','Publier des offres'],
    ['can_search_talent','Rechercher des talents'],
    ['can_contact_talent','Contacter les talents'],
    ['can_manage_jobs','Gérer les offres'],
    ['can_view_applications','Voir les candidatures'],
    ['can_schedule_interview','Programmer les entretiens'],
    ['can_manage_team','Gérer l’équipe recrutement'],
  ] as const;
  const defaultPermissions:Record<string,boolean> = {
    can_post_job:true, can_search_talent:true, can_contact_talent:true,
    can_manage_jobs:true, can_view_applications:true, can_schedule_interview:true,
    can_manage_team:false,
  };
  const [members,setMembers]=useState<any[]>([]);
  const [form,setForm]=useState({full_name:'',email:'',phone_number:'',country_code:'ML',job_title:'Recruteur Structure',role_label:'Recruteur Structure'});
  const [permissions,setPermissions]=useState<Record<string,boolean>>(defaultPermissions);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState<{email:string;password:string;emailSent:boolean}|null>(null);

  async function load(){
    try { const result=await loadRecruitmentTeam(); setMembers(result.members||[]); }
    catch(e){ setError(e instanceof Error?e.message:'Équipe indisponible.'); }
  }
  useEffect(()=>{load()},[]);

  async function create(){
    setBusy(true); setError(''); setSuccess(null);
    try{
      const result=await createStructureRecruiter({...form,permissions});
      setSuccess({email:form.email,password:result.temporary_password,emailSent:result.email_sent});
      setForm({full_name:'',email:'',phone_number:'',country_code:'ML',job_title:'Recruteur Structure',role_label:'Recruteur Structure'});
      setPermissions(defaultPermissions);
      await load();
    }catch(e){setError(e instanceof Error?e.message:'Création impossible.');}
    finally{setBusy(false);}
  }

  async function changeStatus(userId:string,status:'actif'|'suspendu'|'retire'){
    setBusy(true); setError('');
    try{ await setStructureRecruiterStatus(userId,status); await load(); }
    catch(e){ setError(e instanceof Error?e.message:'Modification impossible.'); }
    finally{ setBusy(false); }
  }

  async function togglePermission(member:any,key:string){
    const current = member.recruitment_permissions || {};
    const next = {...current,[key]:!current[key]};
    setBusy(true); setError('');
    try{ await updateRecruitmentPermissions(member.user_id,next); await load(); }
    catch(e){ setError(e instanceof Error?e.message:'Permission non enregistrée.'); }
    finally{ setBusy(false); }
  }

  return <div className="space-y-8">
    <section className="border-y py-6" style={{borderColor:BORDER}}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-base font-semibold" style={{color:BLUE}}>Créer un recruteur interne</h2><p className="mt-1 max-w-2xl text-sm leading-6" style={{color:MUTED}}>Le compte est créé au nom de votre Structure. Les informations de l’organisation sont reprises automatiquement. Un mot de passe temporaire est généré et devra être modifié à la première connexion.</p></div>
        <Link to="/structure/equipe" className="inline-flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-semibold" style={{borderColor:GOLD,color:BLUE}}>Équipe générale<ArrowRight size={16}/></Link>
      </div>
      {error&&<div className="mt-4 border-l-4 border-red-500 py-2 pl-3 text-sm text-red-700">{error}</div>}
      {success&&<div className="mt-4 border-l-4 py-3 pl-3 text-sm" style={{borderColor:GOLD,color:BLUE}}><p className="font-semibold">Compte créé : {success.email}</p><p className="mt-1">Mot de passe temporaire : <span className="font-mono font-bold">{success.password}</span></p><p className="mt-1 text-xs text-gray-500">{success.emailSent?'Les accès ont aussi été envoyés par email.':'Brevo n’est pas configuré : transmettez ces accès de manière sécurisée.'}</p></div>}
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <FieldLine label="Nom complet" value={form.full_name} onChange={value=>setForm({...form,full_name:value})}/>
        <FieldLine label="Email professionnel" value={form.email} onChange={value=>setForm({...form,email:value})} type="email"/>
        <FieldLine label="Téléphone professionnel" value={form.phone_number} onChange={value=>setForm({...form,phone_number:value})}/>
        <FieldLine label="Pays" value={form.country_code} onChange={value=>setForm({...form,country_code:value.toUpperCase()})}/>
        <FieldLine label="Fonction" value={form.job_title} onChange={value=>setForm({...form,job_title:value})}/>
        <label className="block"><span className="mb-1 block text-xs font-semibold" style={{color:BLUE}}>Rôle interne</span><select value={form.role_label} onChange={event=>setForm({...form,role_label:event.target.value})} className="h-11 w-full border-b bg-transparent px-1 text-sm" style={{borderColor:GOLD}}><option>Responsable recrutement</option><option>Recruteur Structure</option><option>Chargé de sourcing</option><option>Lecture seule</option></select></label>
      </div>
      <div className="mt-6"><p className="text-xs font-semibold uppercase tracking-wider" style={{color:BLUE}}>Permissions initiales</p><div className="mt-3 grid gap-x-8 md:grid-cols-2">{permissionKeys.map(([key,label])=><label key={key} className="flex items-center justify-between border-b py-3 text-sm" style={{borderColor:BORDER}}><span>{label}</span><input type="checkbox" checked={!!permissions[key]} onChange={()=>setPermissions({...permissions,[key]:!permissions[key]})}/></label>)}</div></div>
      <div className="mt-6 flex justify-end"><button onClick={create} disabled={busy||!form.full_name.trim()||!form.email.trim()||!form.phone_number.trim()} className="border-b-2 px-2 py-2 text-sm font-semibold disabled:opacity-40" style={{borderColor:GOLD,color:BLUE}}>{busy?'Création…':'Créer le compte recruteur'}</button></div>
    </section>

    <section>
      <div className="border-b pb-3" style={{borderColor:BORDER}}><h2 className="font-semibold" style={{color:BLUE}}>Équipe de recrutement</h2><p className="mt-1 text-sm" style={{color:MUTED}}>Les droits sont appliqués uniquement au recrutement de votre Structure.</p></div>
      {members.length===0?<p className="py-8 text-sm" style={{color:MUTED}}>Aucun recruteur interne configuré.</p>:<div className="divide-y" style={{borderColor:BORDER}}>{members.map((member:any)=><div key={member.user_id} className="py-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-semibold" style={{color:BLUE}}>{member.users?.full_name||'Membre Structure'}</p><p className="mt-1 text-sm" style={{color:MUTED}}>{member.users?.email||'Email non affiché'} · {member.role_in_org||'Rôle interne'}</p><p className="mt-1 text-xs" style={{color:member.status==='actif'?'#15803D':'#B91C1C'}}>{member.is_primary?'Responsable principal':member.status==='actif'?'Actif':'Suspendu'}</p></div>{!member.is_primary&&<div className="flex gap-2">{member.status==='actif'?<button onClick={()=>changeStatus(member.user_id,'suspendu')} disabled={busy} className="px-2 py-2 text-xs font-semibold text-amber-700">Suspendre</button>:<button onClick={()=>changeStatus(member.user_id,'actif')} disabled={busy} className="px-2 py-2 text-xs font-semibold text-green-700">Réactiver</button>}<button onClick={()=>changeStatus(member.user_id,'retire')} disabled={busy} className="px-2 py-2 text-xs font-semibold text-red-700">Retirer</button></div>}</div>{!member.is_primary&&<div className="mt-4 grid gap-x-8 md:grid-cols-2">{permissionKeys.map(([key,label])=><label key={key} className="flex items-center justify-between border-b py-2 text-xs" style={{borderColor:BORDER}}><span>{label}</span><input type="checkbox" checked={!!member.recruitment_permissions?.[key]} onChange={()=>togglePermission(member,key)} disabled={busy||member.status!=='actif'}/></label>)}</div>}</div>)}</div>}
    </section>
  </div>;
}

function FieldLine({label,value,onChange,type='text'}:{label:string;value:string;onChange:(value:string)=>void;type?:string}){
  return <label className="block"><span className="mb-1 block text-xs font-semibold" style={{color:BLUE}}>{label}</span><input type={type} value={value} onChange={event=>onChange(event.target.value)} className="h-11 w-full border-b bg-transparent px-1 text-sm outline-none" style={{borderColor:GOLD}}/></label>;
}

