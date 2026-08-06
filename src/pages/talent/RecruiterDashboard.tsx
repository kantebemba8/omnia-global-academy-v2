import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Briefcase, CalendarDays, CheckCircle2, FileText, Heart,
  Mail, MessageSquare, Plus, Search, Settings, UserRound, UsersRound, X, Archive,
} from 'lucide-react';
import { RecruiterLayout } from '../../components/talent/RecruiterLayout';
import { RoleDashboardPanel, RoleDashboardStatCard } from '../../components/dashboard/RoleDashboardCards';
import { dashboardGreeting } from '../../lib/dashboardGreeting';
import {
  contactTalent, loadPublicTalents, loadTalentConversations, loadTalentDashboard,
  loadTalentFavorites, loadTalentInterviews, PublicTalent, TalentConversation,
  TalentInterview, toggleTalentFavorite, loadRecruiterStatus,
} from './talentApi';
import { getStoredUser } from '../../lib/session';
import { ENDPOINTS } from '../../lib/config';
import { JobApplicationMode, labelApplicationStatus, normalizeApplicationMode } from '../../lib/jobApplicationModes';
import { edgeAuthHeaders } from '../../lib/edgeAuth';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type User = { id?: string; full_name?: string; email?: string; phone_number?: string; roles?: string[] };
type ManagedJob = {
  id: string; title: string; description?: string; status?: string; location?: string | null;
  contract_type?: string | null; category?: string | null; deadline?: string | null;
  applications_count?: number; application_mode?: JobApplicationMode | string | null;
  recruiter_company?: string | null; external_apply_url?: string | null; external_apply_email?: string | null;
};
type ManagedApplication = {
  id: string; status?: string; tracking_status?: string; submitted_at?: string;
  users?: { full_name?: string } | null;
  job_offers?: { title?: string; application_mode?: string } | null;
};
const EMPTY_JOB = {
  title:'', description:'', location:'', contract_type:'CDI', category:'', deadline:'',
  salary_range:'', required_level:'', skills_required:'', recruiter_company:'', recruiter_name:'',
  recruiter_email:'', application_mode:'omnia_managed' as JobApplicationMode,
  external_apply_url:'', external_apply_email:'', application_instructions:'',
};

async function manageJobs<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENDPOINTS.jobPlatformManage, {
    method:'POST',
    headers:edgeAuthHeaders({ 'Content-Type':'application/json' }),
    body:JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.message || data.error || 'Service recrutement indisponible.');
  return data as T;
}
type Section = 'dashboard'|'offres'|'talents'|'favoris'|'candidatures'|'entretiens'|'messages'|'profil'|'parametres';

function sectionFromPath(path: string): Section {
  const last = path.split('/').filter(Boolean).pop() || 'dashboard';
  return (['dashboard','offres','talents','favoris','candidatures','entretiens','messages','profil','parametres'].includes(last) ? last : 'dashboard') as Section;
}

function EmptyState({ icon: Icon, title, text, action }: { icon: React.ElementType; title: string; text: string; action?: React.ReactNode }) {
  return <div className="border-y border-gray-200 px-2 py-12 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center"><Icon size={22} color={GOLD} /></div><h2 className="mt-3 text-base font-semibold" style={{ color: BLUE }}>{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">{text}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

export default function RecruiterDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const section = sectionFromPath(location.pathname);
  const [user] = useState<User | null>(() => getStoredUser<User>());
  const [talents, setTalents] = useState<PublicTalent[]>([]);
  const [jobs, setJobs] = useState<ManagedJob[]>([]);
  const [applications, setApplications] = useState<ManagedApplication[]>([]);
  const [favorites, setFavorites] = useState<PublicTalent[]>([]);
  const [interviews, setInterviews] = useState<TalentInterview[]>([]);
  const [conversations, setConversations] = useState<TalentConversation[]>([]);
  const [metrics, setMetrics] = useState({ favorites: 0, contacts: 0, upcoming_interviews: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [contactTarget, setContactTarget] = useState<PublicTalent | null>(null);
  const [contactMessage, setContactMessage] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobForm, setJobForm] = useState(EMPTY_JOB);
  const [jobSaving, setJobSaving] = useState(false);
  const [accessState, setAccessState] = useState<'checking'|'allowed'|'pending'|'rejected'|'suspended'|'denied'>('checking');
  const previewMode = new URLSearchParams(location.search).get('preview') === 'true' && !!user?.roles?.includes('super_admin');

  useEffect(() => {
    let active = true;
    const roles = user?.roles || [];
    if (!user) { navigate('/connexion'); return; }
    if (previewMode) { setAccessState('allowed'); return; }
    if (!roles.some(role => ['recruteur_independant','recruteur'].includes(role))) {
      navigate('/talent/recruteurs');
      return;
    }
    loadRecruiterStatus()
      .then(result => {
        if (!active) return;
        const profile = result.profile;
        if (profile?.status === 'approved' && profile.recruiter_type === 'independent') setAccessState('allowed');
        else if (profile?.status === 'pending') setAccessState('pending');
        else if (profile?.status === 'rejected') setAccessState('rejected');
        else if (profile?.status === 'suspended') setAccessState('suspended');
        else setAccessState('denied');
      })
      .catch(() => { if (active) setAccessState('denied'); });
    return () => { active = false; };
  }, [user, navigate, previewMode]);

  async function loadAll() {
    setLoading(true); setError('');
    const results = await Promise.allSettled([
      loadPublicTalents(),
      manageJobs<{jobs:ManagedJob[]}>({ action:'list_my_jobs' }),
      manageJobs<{applications:ManagedApplication[]}>({ action:'list_applications' }),
      loadTalentFavorites(), loadTalentDashboard(), loadTalentInterviews(), loadTalentConversations(),
    ]);
    if (results[0].status === 'fulfilled') setTalents(results[0].value); else setError('Les profils publics ne sont pas disponibles pour le moment.');
    if (results[1].status === 'fulfilled') setJobs(results[1].value.jobs || []); else setError(prev => prev || 'Vos offres ne sont pas disponibles pour le moment.');
    if (results[2].status === 'fulfilled') setApplications(results[2].value.applications || []); else setError(prev => prev || 'Les candidatures ne sont pas disponibles pour le moment.');
    if (results[3].status === 'fulfilled') setFavorites(results[3].value);
    if (results[4].status === 'fulfilled') setMetrics(results[4].value.metrics);
    if (results[5].status === 'fulfilled') setInterviews(results[5].value);
    if (results[6].status === 'fulfilled') setConversations(results[6].value);
    setLoading(false);
  }
  useEffect(() => { if (accessState === 'allowed') loadAll(); }, [accessState]);

  async function toggleFavorite(t: PublicTalent) {
    try {
      const result = await toggleTalentFavorite(t.id);
      setFavorites(prev => result.favorite ? [...prev.filter(f => f.id !== t.id), t] : prev.filter(f => f.id !== t.id));
      setMetrics(prev => ({ ...prev, favorites: Math.max(0, prev.favorites + (result.favorite ? 1 : -1)) }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Favori indisponible.'); }
  }

  async function submitContact() {
    if (!contactTarget || contactMessage.trim().length < 5) return;
    setContactBusy(true);
    try {
      await contactTalent(contactTarget.id, contactMessage.trim());
      setContactTarget(null); setContactMessage('');
      setMetrics(prev => ({ ...prev, contacts: prev.contacts + 1 }));
      setConversations(await loadTalentConversations());
    } catch (e) { setError(e instanceof Error ? e.message : 'Contact indisponible.'); }
    finally { setContactBusy(false); }
  }

  async function createJob() {
    if (previewMode) return;
    setJobSaving(true); setError('');
    try {
      await manageJobs({
        action:'create_job',
        job:{
          ...jobForm,
          skills_required:jobForm.skills_required.split(',').map(value => value.trim()).filter(Boolean),
        },
      });
      setJobForm(EMPTY_JOB); setShowJobForm(false);
      await loadAll();
    } catch (e) { setError(e instanceof Error ? e.message : 'Création de l’offre impossible.'); }
    finally { setJobSaving(false); }
  }

  async function updateApplicationStatus(applicationId:string, status:string) {
    if (previewMode) return;
    try {
      await manageJobs({ action:'update_application_status', application_id:applicationId, status });
      const result = await manageJobs<{applications:ManagedApplication[]}>({ action:'list_applications' });
      setApplications(result.applications || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Mise à jour de la candidature impossible.'); }
  }

  async function archiveJob(jobId:string) {
    if (previewMode) return;
    try {
      await manageJobs({ action:'archive_job', job_id:jobId });
      const result = await manageJobs<{jobs:ManagedJob[]}>({ action:'list_my_jobs' });
      setJobs(result.jobs || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Archivage impossible.'); }
  }

  const filteredTalents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return talents;
    return talents.filter(t => [t.full_name,t.professional_title,t.location,t.country,...(t.skills||[]),...(t.sectors||[])].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [talents, query]);

  const talentHeaderItems = useMemo(() => talents.slice(0, 100).map(talent => ({
    id: `talent-${talent.id}`,
    label: talent.full_name,
    description: [talent.professional_title, talent.location || talent.country].filter(Boolean).join(' · '),
    keywords: [...(talent.skills || []), ...(talent.sectors || [])],
    path: `/profil/${talent.id}`,
  })), [talents]);

  const titleMap: Record<Section,string> = {
    dashboard:'Accueil', offres:'Mes offres', talents:'Rechercher des talents', favoris:'Talents favoris', candidatures:'Candidatures', entretiens:'Entretiens', messages:'Messages', profil:'Profil recruteur', parametres:'Paramètres',
  };

  if (accessState !== 'allowed') {
    const message = accessState === 'checking' ? 'Vérification de votre accès…'
      : accessState === 'pending' ? 'Votre dossier recruteur attend la validation de l’Administration Omnia.'
      : accessState === 'rejected' ? 'Votre dossier recruteur n’a pas été validé.'
      : accessState === 'suspended' ? 'Votre accès recruteur est suspendu.'
      : 'Cet espace est réservé aux recruteurs indépendants validés.';
    return <RecruiterLayout title="Espace recruteur indépendant" subtitle="Omnia Talent"><div className="mx-auto max-w-4xl px-6 py-12"><div className="border-y border-gray-200 py-10"><h2 className="text-xl font-semibold" style={{color:BLUE}}>Accès Omnia Talent</h2><p className="mt-3 text-sm leading-6 text-gray-500">{message}</p>{accessState!=='checking'&&<Link to="/talent/recruteurs" className="mt-5 inline-flex items-center gap-2 border-b-2 py-2 text-sm font-semibold" style={{color:BLUE,borderColor:GOLD}}>Consulter mon statut <ArrowRight size={16}/></Link>}</div></div></RecruiterLayout>;
  }

  return <RecruiterLayout title={titleMap[section]} subtitle="Omnia Talent" searchValue={section === 'talents' ? query : undefined} onSearchChange={section === 'talents' ? setQuery : undefined} searchItems={section === 'talents' ? talentHeaderItems : undefined}>
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      {error && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>}
      {section === 'dashboard' && <DashboardHome user={user} talents={talents} jobs={jobs} metrics={metrics} loading={loading} />}
      {section === 'talents' && <TalentsSection talents={filteredTalents} loading={loading} query={query} setQuery={setQuery} favorites={favorites} toggleFavorite={toggleFavorite} contact={setContactTarget} />}
      {section === 'favoris' && <FavoritesSection favorites={favorites} contact={setContactTarget} />}
      {section === 'offres' && <OffersSection jobs={jobs} loading={loading} previewMode={previewMode} openForm={()=>setShowJobForm(true)} archiveJob={archiveJob}/>}
      {section === 'candidatures' && <ApplicationsSection applications={applications} previewMode={previewMode} updateStatus={updateApplicationStatus}/>}
      {section === 'entretiens' && <InterviewsSection interviews={interviews} />}
      {section === 'messages' && <ConversationsSection conversations={conversations} />}
      {section === 'profil' && <ProfileSection user={user} />}
      {section === 'parametres' && <SettingsSection />}
    </div>
    {contactTarget && <ContactModal talent={contactTarget} message={contactMessage} setMessage={setContactMessage} busy={contactBusy} close={() => { setContactTarget(null); setContactMessage(''); }} submit={submitContact} />}
    {showJobForm && !previewMode && <JobModal form={jobForm} setForm={setJobForm} busy={jobSaving} close={()=>setShowJobForm(false)} submit={createJob}/>}
  </RecruiterLayout>;
}

function DashboardHome({ user, talents, jobs, metrics, loading }: { user: User|null; talents: PublicTalent[]; jobs: ManagedJob[]; metrics: { favorites:number; contacts:number; upcoming_interviews:number }; loading: boolean }) {
  const indicators = [
    { label:'Offres actives', value: jobs.length, icon:Briefcase, path:'/talent/recruteur/offres' },
    { label:'Talents publics', value: talents.length, icon:UsersRound, path:'/talent/recruteur/talents' },
    { label:'Talents favoris', value:metrics.favorites, icon:Heart, path:'/talent/recruteur/favoris' },
    { label:'Entretiens à venir', value:metrics.upcoming_interviews, icon:CalendarDays, path:'/talent/recruteur/entretiens' },
  ];
  return <>
    <div className="mb-6"><h2 className="text-2xl font-semibold" style={{ color: BLUE }}>{dashboardGreeting(user?.full_name)}</h2></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {indicators.map((metric, index) => (
        <RoleDashboardStatCard
          key={metric.label}
          label={metric.label}
          value={loading ? '—' : metric.value}
          icon={metric.icon}
          accent={[BLUE, '#1E7A52', GOLD, '#7C3AED'][index]}
          to={metric.path}
        />
      ))}
    </div>
    <RoleDashboardPanel className="mt-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3"><h3 className="font-semibold" style={{ color:BLUE }}>Talents récemment visibles</h3><Link to="/talent/recruteur/talents" className="text-sm font-semibold" style={{ color:GOLD }}>Voir tous</Link></div>
      {talents.length===0?<p className="py-6 text-sm text-gray-500">Aucun profil public disponible.</p>:<div className="divide-y divide-gray-100">{talents.slice(0,5).map(t=><Link key={t.id} to={`/profil/${t.id}`} className="flex items-center gap-3 py-4"><Avatar talent={t}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" style={{ color:BLUE }}>{t.full_name}</p><p className="truncate text-xs text-gray-500">{t.professional_title || 'Profil professionnel'}{t.location ? ` · ${t.location}` : ''}</p></div><ArrowRight size={16} className="text-gray-400"/></Link>)}</div>}
    </RoleDashboardPanel>
  </>;
}

function Avatar({talent}:{talent:PublicTalent}) { return <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-sm font-semibold" style={{color:BLUE}}>{talent.photo_url?<img src={talent.photo_url} alt="" className="h-full w-full object-cover"/>:talent.full_name.slice(0,2).toUpperCase()}</div>; }

function TalentsSection({ talents, loading, query, setQuery, favorites, toggleFavorite, contact }: any) {
  return <><div className="flex flex-col gap-3 border-b border-gray-200 pb-5 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-3 text-gray-400" size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Métier, compétence, secteur, pays…" className="w-full border-b-2 bg-transparent py-2.5 pl-10 pr-3 text-sm outline-none" style={{ borderColor:GOLD }}/></label><select className="border-b bg-transparent px-3 py-2.5 text-sm" style={{ borderColor:BORDER }}><option>Toutes les disponibilités</option><option>Disponible immédiatement</option><option>En poste</option><option>Freelance</option></select></div>{loading?<p className="mt-8 text-sm text-gray-500">Chargement des profils publics…</p>:talents.length===0?<div className="mt-6"><EmptyState icon={UsersRound} title="Aucun talent trouvé" text="Aucun profil public ne correspond à votre recherche."/></div>:<div className="divide-y divide-gray-200">{talents.map((t:PublicTalent)=>{const fav=favorites.some((f:PublicTalent)=>f.id===t.id);return <article key={t.id} className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 gap-3"><Avatar talent={t}/><div className="min-w-0 flex-1"><h3 className="truncate font-semibold" style={{ color:BLUE }}>{t.full_name}</h3><p className="truncate text-sm text-gray-500">{t.professional_title || 'Profil professionnel'}{(t.location||t.country)?` · ${t.location||t.country}`:''}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">{(t.skills||[]).slice(0,5).map(s=><span key={s}>{s}</span>)}</div></div></div><div className="flex items-center gap-2"><button onClick={()=>toggleFavorite(t)} className="p-2" aria-label="Favori"><Heart size={18} fill={fav?GOLD:'none'} color={fav?GOLD:'#98A2B3'}/></button><Link to={`/profil/${t.id}`} className="border-b-2 px-2 py-2 text-sm font-semibold" style={{ borderColor:GOLD,color:BLUE }}>Voir le profil</Link><button onClick={()=>contact(t)} className="px-2 py-2" style={{color:GOLD}} aria-label="Contacter"><Mail size={18}/></button></div></article>})}</div>}</>;
}

function FavoritesSection({ favorites, contact }: { favorites: PublicTalent[]; contact:(t:PublicTalent)=>void }) {
  if (!favorites.length) return <EmptyState icon={Heart} title="Aucun talent favori" text="Ajoutez des profils depuis la recherche pour les retrouver ici." action={<Link to="/talent/recruteur/talents" className="inline-flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-semibold" style={{ borderColor:GOLD,color:BLUE }}><Search size={16}/>Rechercher</Link>}/>;
  return <div className="divide-y divide-gray-200">{favorites.map(f=><div key={f.id} className="flex flex-wrap items-center gap-3 py-5"><Avatar talent={f}/><div className="min-w-0 flex-1"><p className="truncate font-semibold" style={{ color:BLUE }}>{f.full_name}</p><p className="truncate text-sm text-gray-500">{f.professional_title||'Profil professionnel'}</p></div><Link to={`/profil/${f.id}`} className="border-b-2 px-2 py-2 text-sm font-semibold" style={{borderColor:GOLD,color:BLUE}}>Voir</Link><button onClick={()=>contact(f)} className="px-2 py-2" style={{color:GOLD}}><Mail size={17}/></button></div>)}</div>;
}

function jobStatusLabel(status?:string) {
  const labels:Record<string,string> = {
    approved:'Publiée', pending_moderation:'En attente de validation', rejected:'Refusée',
    changes_requested:'Modification demandée', suspended:'Suspendue', archived:'Archivée',
  };
  return labels[status || ''] || status || 'Brouillon';
}

function OffersSection({jobs,loading,previewMode,openForm,archiveJob}:{jobs:ManagedJob[];loading:boolean;previewMode:boolean;openForm:()=>void;archiveJob:(id:string)=>void}) {
  return <section><div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-5"><div><h2 className="text-xl font-semibold" style={{color:BLUE}}>Mes offres</h2><p className="mt-1 text-sm text-gray-500">Chaque offre est soumise à l’Administration Omnia avant publication.</p></div>{!previewMode&&<button onClick={openForm} className="inline-flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-semibold" style={{borderColor:GOLD,color:BLUE}}><Plus size={16}/>Créer une offre</button>}</div>{loading?<p className="py-8 text-sm text-gray-500">Chargement…</p>:jobs.length===0?<EmptyState icon={Briefcase} title="Aucune offre créée" text="Votre première offre apparaîtra ici après son enregistrement." action={!previewMode?<button onClick={openForm} className="inline-flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-semibold" style={{borderColor:GOLD,color:BLUE}}><Plus size={16}/>Créer une offre</button>:undefined}/>:<div className="divide-y divide-gray-200">{jobs.map(job=><div key={job.id} className="flex flex-col gap-3 py-5 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold" style={{color:BLUE}}>{job.title}</h3><span className="text-xs font-semibold" style={{color:job.status==='approved'?'#15803D':job.status==='rejected'?'#B91C1C':GOLD}}>{jobStatusLabel(job.status)}</span></div><p className="mt-1 text-sm text-gray-500">{job.recruiter_company || 'Recruteur indépendant'} · {job.contract_type || 'Contrat non défini'} · {job.location || 'Lieu non défini'}</p><p className="mt-2 text-xs text-gray-500">Mode : {normalizeApplicationMode(job.application_mode)==='omnia_managed'?'Candidature gérée sur Omnia':normalizeApplicationMode(job.application_mode)==='external_link'?'Lien externe':'Email externe'} · {job.applications_count || 0} candidature(s)</p></div>{!previewMode&&job.status!=='archived'&&<button onClick={()=>archiveJob(job.id)} className="inline-flex items-center gap-2 px-2 py-2 text-sm text-gray-500 hover:text-red-700"><Archive size={16}/>Archiver</button>}</div>)}</div>}</section>;
}

function ApplicationsSection({applications,previewMode,updateStatus}:{applications:ManagedApplication[];previewMode:boolean;updateStatus:(id:string,status:string)=>void}) {
  if (!applications.length) return <EmptyState icon={FileText} title="Aucune candidature reçue" text="Les candidatures liées à vos offres seront centralisées ici avec leur statut réel."/>;
  return <section><div className="border-b border-gray-200 pb-5"><h2 className="text-xl font-semibold" style={{color:BLUE}}>Candidatures</h2><p className="mt-1 text-sm text-gray-500">Aucune donnée sensible inutile n’est affichée dans cette vue.</p></div><div className="divide-y divide-gray-200">{applications.map(application=><div key={application.id} className="flex flex-col gap-3 py-5 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><p className="font-semibold" style={{color:BLUE}}>{application.users?.full_name || 'Candidat'}</p><p className="mt-1 text-sm text-gray-500">{application.job_offers?.title || 'Offre'} · {application.submitted_at?new Date(application.submitted_at).toLocaleDateString('fr-FR'):'Date non renseignée'}</p></div>{previewMode?<span className="text-sm font-semibold" style={{color:GOLD}}>{labelApplicationStatus(application.tracking_status || application.status)}</span>:<select value={application.tracking_status || application.status || 'submitted'} onChange={event=>updateStatus(application.id,event.target.value)} className="border-b bg-transparent px-2 py-2 text-sm" style={{borderColor:GOLD,color:BLUE}}><option value="received">Reçue</option><option value="viewed">Vue</option><option value="under_review">En analyse</option><option value="shortlisted">Présélectionnée</option><option value="interview">Entretien</option><option value="accepted">Acceptée</option><option value="rejected">Refusée</option><option value="archived">Archivée</option></select>}</div>)}</div></section>;
}

function JobModal({form,setForm,busy,close,submit}:{form:typeof EMPTY_JOB;setForm:(value:typeof EMPTY_JOB)=>void;busy:boolean;close:()=>void;submit:()=>void}) {
  const field=(key:keyof typeof EMPTY_JOB,label:string,type='text')=><label className="block"><span className="mb-1 block text-xs font-semibold" style={{color:BLUE}}>{label}</span><input type={type} value={String(form[key])} onChange={event=>setForm({...form,[key]:event.target.value})} className="h-11 w-full border-b bg-transparent px-1 text-sm outline-none" style={{borderColor:BORDER}}/></label>;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6"><div className="flex items-start justify-between border-b border-gray-200 pb-4"><div><h2 className="text-lg font-semibold" style={{color:BLUE}}>Créer une offre</h2><p className="mt-1 text-sm text-gray-500">L’offre sera contrôlée par l’Administration Omnia avant publication.</p></div><button onClick={close} className="p-2 text-gray-500"><X size={20}/></button></div><div className="grid gap-5 py-6 md:grid-cols-2">{field('title','Titre du poste')}{field('recruiter_company','Entreprise / cabinet')}{field('location','Lieu')}{field('contract_type','Type de contrat')}{field('category','Secteur')}{field('deadline','Date limite','date')}<label className="block md:col-span-2"><span className="mb-1 block text-xs font-semibold" style={{color:BLUE}}>Mode de candidature</span><select value={form.application_mode} onChange={event=>setForm({...form,application_mode:event.target.value as JobApplicationMode})} className="h-11 w-full border-b bg-transparent px-1 text-sm" style={{borderColor:BORDER}}><option value="omnia_managed">Gérée sur Omnia</option><option value="external_link">Lien externe</option><option value="external_email">Email externe</option></select></label>{form.application_mode==='external_link'&&field('external_apply_url','Lien de candidature')}{form.application_mode==='external_email'&&field('external_apply_email','Email de candidature')}{field('recruiter_name','Nom du recruteur')}{field('recruiter_email','Email professionnel')}<label className="block md:col-span-2"><span className="mb-1 block text-xs font-semibold" style={{color:BLUE}}>Description détaillée</span><textarea rows={6} value={form.description} onChange={event=>setForm({...form,description:event.target.value})} className="w-full border-b bg-transparent px-1 py-2 text-sm outline-none" style={{borderColor:BORDER}}/></label><label className="block md:col-span-2"><span className="mb-1 block text-xs font-semibold" style={{color:BLUE}}>Compétences, séparées par des virgules</span><input value={form.skills_required} onChange={event=>setForm({...form,skills_required:event.target.value})} className="h-11 w-full border-b bg-transparent px-1 text-sm" style={{borderColor:BORDER}}/></label></div><div className="flex justify-end gap-3 border-t border-gray-200 pt-4"><button onClick={close} className="px-3 py-2 text-sm font-semibold text-gray-500">Annuler</button><button onClick={submit} disabled={busy} className="border-b-2 px-3 py-2 text-sm font-semibold disabled:opacity-50" style={{borderColor:GOLD,color:BLUE}}>{busy?'Envoi…':'Soumettre à l’Administration Omnia'}</button></div></div></div>;
}


function InterviewsSection({interviews}:{interviews:TalentInterview[]}) {
  if (!interviews.length) return <EmptyState icon={CalendarDays} title="Aucun entretien programmé" text="Les demandes d’entretien enregistrées apparaîtront ici."/>;
  return <div className="divide-y divide-gray-200">{interviews.map(i=><div key={i.id} className="py-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold" style={{color:BLUE}}>{i.title}</p><p className="mt-1 text-sm text-gray-500">{i.talent?.full_name || 'Talent'} · {new Date(i.scheduled_at).toLocaleString('fr-FR')}</p></div><span className="rounded-full px-3 py-1 text-xs font-semibold" style={{background:'rgba(191,136,19,.12)',color:GOLD}}>{i.status}</span></div></div>)}</div>;
}

function ConversationsSection({conversations}:{conversations:TalentConversation[]}) {
  if (!conversations.length) return <EmptyState icon={MessageSquare} title="Aucun message" text="Vos conversations réelles avec les talents apparaîtront ici."/>;
  return <div className="divide-y divide-gray-200 border-y border-gray-200">{conversations.map(c=><div key={c.id} className="flex items-center gap-3 p-4"><Avatar talent={c.talent || {id:c.talent_user_id,full_name:'Talent'}}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" style={{color:BLUE}}>{c.talent?.full_name || 'Talent'}</p><p className="truncate text-xs text-gray-500">{c.last_message?.body || c.subject || 'Conversation'}</p></div><span className="text-xs text-gray-400">{new Date(c.last_message_at).toLocaleDateString('fr-FR')}</span></div>)}</div>;
}

function ContactModal({talent,message,setMessage,busy,close,submit}:any) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold" style={{color:BLUE}}>Contacter {talent.full_name}</h2><p className="mt-1 text-sm text-gray-500">Le contact sera enregistré et l’apprenant recevra une notification.</p></div><button onClick={close} className="rounded-lg p-2 text-gray-500"><X size={20}/></button></div><textarea value={message} onChange={e=>setMessage(e.target.value)} rows={6} className="mt-5 w-full rounded-xl border p-3 text-sm outline-none" style={{borderColor:BORDER}} placeholder="Présentez votre opportunité et expliquez pourquoi ce profil vous intéresse."/><div className="mt-5 flex justify-end gap-2"><button onClick={close} className="rounded-lg border px-4 py-2.5 text-sm font-semibold" style={{borderColor:BORDER,color:BLUE}}>Annuler</button><button onClick={submit} disabled={busy||message.trim().length<5} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{background:BLUE}}>{busy?'Envoi…':'Envoyer'}</button></div></div></div>; }

function ProfileSection({ user }: { user: User|null }) { return <div className="grid gap-6 lg:grid-cols-[1fr_.7fr]"><section className="border-y border-gray-200 py-6"><div className="flex items-center gap-3"><UserRound color={GOLD}/><h2 className="font-semibold" style={{ color:BLUE }}>Informations du recruteur</h2></div><dl className="mt-6 grid gap-5 sm:grid-cols-2"><div><dt className="text-xs text-gray-500">Nom complet</dt><dd className="mt-1 text-sm font-medium">{user?.full_name||'Non renseigné'}</dd></div><div><dt className="text-xs text-gray-500">Email</dt><dd className="mt-1 text-sm font-medium">{user?.email||'Non renseigné'}</dd></div><div><dt className="text-xs text-gray-500">Téléphone</dt><dd className="mt-1 text-sm font-medium">{user?.phone_number||'Non renseigné'}</dd></div><div><dt className="text-xs text-gray-500">Statut</dt><dd className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-green-700"><CheckCircle2 size={15}/>Compte connecté</dd></div></dl></section></div>; }
function SettingsSection() { return <div className="space-y-5"><section className="border-y border-gray-200 py-6"><div className="flex items-center gap-3"><Settings color={GOLD}/><h2 className="font-semibold" style={{ color:BLUE }}>Préférences recruteur</h2></div><div className="mt-5 space-y-4">{['Notifications de nouvelles candidatures','Rappels d’entretien','Alertes nouveaux talents correspondant à mes recherches'].map(label=><label key={label} className="flex items-center justify-between border-b border-gray-100 pb-4 text-sm"><span>{label}</span><input type="checkbox" className="h-4 w-4" defaultChecked/></label>)}</div></section></div>; }
