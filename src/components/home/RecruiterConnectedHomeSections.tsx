import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Heart,
  Mail,
  MessageCircle,
  Plus,
  Radio,
  Search,
  Sparkles,
  Target,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import {
  loadRecruiterStatus,
  loadTalentConversations,
  loadTalentDashboard,
  loadTalentFavorites,
  loadTalentInterviews,
  type PublicTalent,
  type RecruiterStatus,
  type TalentConversation,
  type TalentInterview,
} from '../../pages/talent/talentApi';

type Props = {
  previewMode: boolean;
};

type RecruiterJob = {
  id: string;
  title: string;
  status?: string | null;
  location?: string | null;
  contract_type?: string | null;
  recruiter_company?: string | null;
  applications_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RecruiterApplication = {
  id: string;
  status?: string | null;
  tracking_status?: string | null;
  submitted_at?: string | null;
  users?: { full_name?: string | null } | null;
  job_offers?: { title?: string | null } | null;
};

type Snapshot = {
  jobs: RecruiterJob[];
  applications: RecruiterApplication[];
  favorites: PublicTalent[];
  interviews: TalentInterview[];
  conversations: TalentConversation[];
  metrics: { favorites: number; contacts: number; upcoming_interviews: number };
};

type Space = {
  label: string;
  caption: string;
  path: string;
  accent: string;
  soft: string;
  icon: LucideIcon;
};

type Suggestion = {
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
};

const BLUE = '#002050';
const GOLD = '#BF8813';
const PLUM = '#96466D';

const EMPTY_SNAPSHOT: Snapshot = {
  jobs: [],
  applications: [],
  favorites: [],
  interviews: [],
  conversations: [],
  metrics: { favorites: 0, contacts: 0, upcoming_interviews: 0 },
};

const SPACES: Space[] = [
  { label: 'Omnia Talent', caption: 'Explorer les profils et la visibilité professionnelle', path: '/talent', accent: '#8B4166', soft: '#FAEEF4', icon: Users },
  { label: 'Opportunités emploi', caption: 'Consulter l’espace emploi et les opportunités publiées', path: '/forum/emploi', accent: '#A56B12', soft: '#FFF7E6', icon: Briefcase },
  { label: 'Omnia Live', caption: 'Découvrir les événements et rencontres professionnelles', path: '/omnia-live', accent: '#5B56C8', soft: '#F1F0FF', icon: Radio },
  { label: 'Communauté', caption: 'Échanger dans les espaces de discussion Omnia', path: '/forum', accent: '#0F766E', soft: '#EAF8F6', icon: MessageCircle },
];

function withPreview(path: string, previewMode: boolean) {
  if (!previewMode) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true${hash ? `#${hash}` : ''}`;
}

function applicationState(application: RecruiterApplication) {
  return String(application.tracking_status || application.status || 'received').toLowerCase();
}

function jobStatus(status?: string | null) {
  const labels: Record<string, { label: string; accent: string; soft: string }> = {
    approved: { label: 'Publiée', accent: '#13795B', soft: '#EAF8F2' },
    pending_moderation: { label: 'En validation', accent: '#A56B12', soft: '#FFF7E6' },
    changes_requested: { label: 'À modifier', accent: '#C45B24', soft: '#FFF2E8' },
    rejected: { label: 'Refusée', accent: '#B23A48', soft: '#FDECEF' },
    suspended: { label: 'Suspendue', accent: '#B23A48', soft: '#FDECEF' },
    archived: { label: 'Archivée', accent: '#64748B', soft: '#F1F5F9' },
  };
  return labels[String(status || '')] || { label: status || 'Brouillon', accent: '#64748B', soft: '#F1F5F9' };
}

async function recruiterManage<T>(action: string): Promise<T> {
  const response = await fetch(ENDPOINTS.jobPlatformManage, {
    method: 'POST',
    headers: edgeAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ action }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.message || data?.error || 'Service recrutement indisponible.');
  return data as T;
}

function Hero({ profile, snapshot, previewMode, loading }: { profile: RecruiterStatus | null; snapshot: Snapshot; previewMode: boolean; loading: boolean }) {
  const newApplications = snapshot.applications.filter(item => ['received', 'submitted'].includes(applicationState(item))).length;
  const changesRequested = snapshot.jobs.filter(item => item.status === 'changes_requested').length;
  const upcoming = snapshot.interviews.filter(item => new Date(item.scheduled_at).getTime() > Date.now() && !['completed', 'cancelled', 'declined'].includes(item.status)).length;

  let priorityTitle = 'Votre recrutement est prêt à avancer';
  let priorityText = 'Utilisez Omnia Talent pour publier vos besoins, suivre vos candidatures et identifier les bons profils.';
  let priorityPath = '/talent/recruteur/talents';
  let priorityLabel = 'Explorer les talents';

  if (changesRequested > 0) {
    priorityTitle = `${changesRequested} offre${changesRequested > 1 ? 's' : ''} à corriger`;
    priorityText = 'Une modification a été demandée avant publication. Reprenez les offres concernées dans votre espace recrutement.';
    priorityPath = '/talent/recruteur/offres';
    priorityLabel = 'Voir les offres';
  } else if (newApplications > 0) {
    priorityTitle = `${newApplications} nouvelle${newApplications > 1 ? 's' : ''} candidature${newApplications > 1 ? 's' : ''}`;
    priorityText = 'De nouveaux profils attendent votre première lecture dans le pipeline de recrutement.';
    priorityPath = '/talent/recruteur/candidatures';
    priorityLabel = 'Examiner les candidatures';
  } else if (upcoming > 0) {
    priorityTitle = `${upcoming} entretien${upcoming > 1 ? 's' : ''} à venir`;
    priorityText = 'Votre prochaine étape se joue dans les entretiens déjà programmés.';
    priorityPath = '/talent/recruteur/entretiens';
    priorityLabel = 'Voir les entretiens';
  } else if (!snapshot.jobs.length && !previewMode && !loading) {
    priorityTitle = 'Publier votre premier besoin';
    priorityText = 'Créez une offre puis soumettez-la à l’Administration Omnia pour validation.';
    priorityPath = '/talent/recruteur/offres';
    priorityLabel = 'Créer une offre';
  }

  const company = profile?.company_name?.trim();

  return (
    <section className="relative overflow-hidden bg-[#241B32] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.09]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />
        <div className="absolute -left-40 bottom-[-300px] h-[620px] w-[620px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(150,70,109,.55), rgba(150,70,109,.12) 48%, transparent 70%)' }} />
        <div className="absolute -right-24 -top-40 h-[560px] w-[560px] rounded-full border border-white/10" />
        <div className="absolute -right-2 -top-8 h-[360px] w-[360px] rounded-full border border-[#C989A7]/20" />
      </div>

      <div className="relative mx-auto grid min-h-[500px] max-w-7xl gap-12 px-5 py-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#E4A9C4]"><span className="h-2 w-2 rounded-full bg-[#BF8813]" /> Recrutement & talents</span>
            {previewMode && <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black text-white/70">Aperçu du rôle Recruteur</span>}
          </div>
          <h1 className="mt-5 max-w-[780px] text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-[3.55rem]">Votre recrutement, en mouvement.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
            {company && !previewMode ? `${company} retrouve ici ses priorités, son pipeline et les espaces Omnia utiles au recrutement.` : 'Une vue personnelle pour passer du besoin au bon profil, sans transformer votre accueil en page d’administration.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={withPreview(priorityPath, previewMode)} className="inline-flex items-center gap-2 rounded-full bg-[#BF8813] px-5 py-3 text-sm font-black text-[#002050] transition hover:-translate-y-0.5">
              {previewMode ? 'Explorer l’espace Recruteur' : priorityLabel} <ArrowRight size={16} />
            </Link>
            <Link to={withPreview('/talent/recruteur/talents', previewMode)} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15">
              Rechercher des talents <Search size={16} />
            </Link>
          </div>
        </div>

        <div className="relative mx-auto h-[350px] w-full max-w-[520px]" aria-label="Illustration abstraite du pipeline de recrutement">
          <div className="absolute left-1/2 top-1/2 h-[260px] w-[405px] -translate-x-1/2 -translate-y-1/2 -rotate-6 rounded-[38px] border border-white/10 bg-white/[0.035] shadow-[0_35px_90px_rgba(0,0,0,.25)]" />
          <div className="absolute left-1/2 top-1/2 h-[248px] w-[390px] -translate-x-1/2 -translate-y-1/2 rotate-[4deg] rounded-[36px] border border-[#D89AB7]/20 bg-[#3B2339]/55" />
          <div className="absolute left-1/2 top-1/2 w-[355px] -translate-x-1/2 -translate-y-1/2 rounded-[30px] border border-white/15 bg-[#2B2037]/95 p-6 shadow-[0_30px_70px_rgba(0,0,0,.30)] backdrop-blur">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-white/40">Priorité du moment</p>
                <h2 className="mt-2 text-lg font-black tracking-[-0.02em]">{previewMode ? 'Pipeline Recruteur' : loading ? 'Chargement de votre activité…' : priorityTitle}</h2>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#96466D]/35 text-[#F0B7D1]"><Target size={21} /></span>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/58">{previewMode ? 'Les données privées du recruteur ne sont pas chargées pendant la prévisualisation Super-admin.' : priorityText}</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[{ icon: Briefcase, label: 'Besoin' }, { icon: Users, label: 'Talent' }, { icon: Mail, label: 'Échange' }].map(item => {
                const Icon = item.icon;
                return <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 text-center"><Icon size={17} className="mx-auto text-[#E4A9C4]" /><span className="mt-2 block text-[10px] font-bold text-white/55">{item.label}</span></div>;
              })}
            </div>
          </div>
          <span className="absolute left-5 top-9 h-12 w-12 rounded-2xl border border-white/15 bg-[#96466D]/45 shadow-[0_18px_40px_rgba(0,0,0,.22)]" />
          <span className="absolute bottom-10 right-6 h-9 w-9 rotate-12 rounded-xl border border-[#BF8813]/40 bg-[#BF8813]/25" />
        </div>
      </div>
    </section>
  );
}

function EcosystemStrip({ previewMode }: { previewMode: boolean }) {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#96466D]">Vos espaces Omnia</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Allez directement à l’univers dont vous avez besoin.</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-500">Cette bande sert uniquement de raccourci vers les écosystèmes. Les menus détaillés restent dans chaque espace.</p>
        </div>

        <div className="mt-6 flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SPACES.map(space => {
            const Icon = space.icon;
            return (
              <Link key={space.label} to={withPreview(space.path, previewMode)} className="group relative min-w-[245px] flex-1 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(0,32,80,.05)] transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(0,32,80,.09)]">
                <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-70" style={{ background: `radial-gradient(circle, ${space.soft}, transparent 70%)` }} />
                <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color: space.accent, background: space.soft }}><Icon size={20} /></span>
                <strong className="relative mt-5 block text-sm font-black text-[#002050]">{space.label}</strong>
                <span className="relative mt-1.5 block text-xs leading-5 text-slate-500">{space.caption}</span>
                <ArrowRight size={16} className="absolute bottom-5 right-5 text-slate-300 transition group-hover:translate-x-1" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AccessState({ status }: { status: Exclude<RecruiterStatus['status'], 'approved'> | 'denied' | 'checking' }) {
  const content = status === 'checking'
    ? { title: 'Vérification de votre accès Recruteur', text: 'Omnia vérifie votre statut avant de charger les données de recrutement.', icon: Clock3 }
    : status === 'pending'
      ? { title: 'Votre dossier Recruteur est en validation', text: 'La page d’accueil sera alimentée par vos offres, candidatures et entretiens après validation.', icon: Clock3 }
      : status === 'rejected'
        ? { title: 'Votre dossier Recruteur nécessite votre attention', text: 'Consultez le statut de votre demande pour connaître la décision enregistrée.', icon: FileText }
        : status === 'suspended'
          ? { title: 'Votre accès Recruteur est suspendu', text: 'Les données de recrutement ne sont pas chargées tant que l’accès reste suspendu.', icon: FileText }
          : { title: 'Espace Recruteur non activé', text: 'Consultez votre statut Recruteur avant d’accéder aux fonctions professionnelles.', icon: UserRound };
  const Icon = content.icon;
  return (
    <section className="bg-[#F8F6F8]">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 rounded-[26px] border border-[#E8DCE2] bg-white p-7 md:grid-cols-[auto_1fr_auto] md:items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FAEEF4] text-[#96466D]"><Icon size={21} /></span>
          <div><h2 className="text-lg font-black text-[#002050]">{content.title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{content.text}</p></div>
          {status !== 'checking' && <Link to="/talent/recruteurs" className="inline-flex items-center gap-2 text-sm font-black text-[#96466D]">Consulter mon statut <ArrowRight size={15} /></Link>}
        </div>
      </div>
    </section>
  );
}

function Activity({ snapshot, previewMode, loading, profile }: { snapshot: Snapshot; previewMode: boolean; loading: boolean; profile: RecruiterStatus | null }) {
  const now = Date.now();
  const publishedJobs = snapshot.jobs.filter(job => job.status === 'approved').length;
  const newApplications = snapshot.applications.filter(item => ['received', 'submitted'].includes(applicationState(item)));
  const upcomingInterviews = snapshot.interviews
    .filter(item => new Date(item.scheduled_at).getTime() > now && !['completed', 'cancelled', 'declined'].includes(item.status))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const favoriteCount = snapshot.metrics.favorites || snapshot.favorites.length;

  const pipeline = [
    { label: 'Nouvelles', states: ['received', 'submitted'], accent: '#96466D' },
    { label: 'En analyse', states: ['viewed', 'under_review'], accent: '#7650C5' },
    { label: 'Présélection', states: ['shortlisted'], accent: '#A56B12' },
    { label: 'Entretien', states: ['interview'], accent: '#2D6B9F' },
    { label: 'Retenues', states: ['accepted'], accent: '#13795B' },
  ].map(item => ({ ...item, value: snapshot.applications.filter(app => item.states.includes(applicationState(app))).length }));

  const todo: Array<{ title: string; text: string; path: string; icon: LucideIcon; accent: string }> = [];
  const changedJobs = snapshot.jobs.filter(job => job.status === 'changes_requested');
  if (changedJobs.length) todo.push({ title: `${changedJobs.length} offre${changedJobs.length > 1 ? 's' : ''} à reprendre`, text: 'Une correction est demandée avant validation.', path: '/talent/recruteur/offres', icon: Briefcase, accent: '#C45B24' });
  if (newApplications.length) todo.push({ title: `${newApplications.length} candidature${newApplications.length > 1 ? 's' : ''} à ouvrir`, text: 'Ces candidatures sont encore au début du pipeline.', path: '/talent/recruteur/candidatures', icon: FileText, accent: PLUM });
  if (upcomingInterviews.length) todo.push({ title: `${upcomingInterviews.length} entretien${upcomingInterviews.length > 1 ? 's' : ''} à venir`, text: 'Consultez le calendrier et les profils concernés.', path: '/talent/recruteur/entretiens', icon: CalendarDays, accent: '#2D6B9F' });
  if (!todo.length) todo.push({ title: 'Pipeline à jour', text: 'Aucune action prioritaire n’est détectée dans vos données actuelles.', path: '/talent/recruteur/dashboard', icon: CheckCircle2, accent: '#13795B' });

  const suggestions: Suggestion[] = [];
  const profileIncomplete = !profile?.company_name || !profile?.job_title || !profile?.professional_email;
  if (profileIncomplete && !previewMode) suggestions.push({ title: 'Compléter votre identité professionnelle', description: 'Un profil Recruteur complet facilite la lecture de votre activité et de vos contacts.', path: '/mon-profil', icon: UserRound });
  if (!snapshot.jobs.length && !previewMode && !loading) suggestions.push({ title: 'Créer votre première offre', description: 'Définissez un besoin réel puis soumettez-le au circuit de validation Omnia.', path: '/talent/recruteur/offres', icon: Plus });
  if (publishedJobs > 0 && !snapshot.applications.length) suggestions.push({ title: 'Élargir votre sourcing', description: 'Vos offres sont publiées : explorez Omnia Talent pour identifier des profils pertinents.', path: '/talent/recruteur/talents', icon: Search });
  if (snapshot.favorites.length > 0 && snapshot.metrics.contacts === 0) suggestions.push({ title: 'Passer des favoris au contact', description: 'Vous avez déjà présélectionné des talents ; ouvrez la conversation depuis votre liste.', path: '/talent/recruteur/favoris', icon: Mail });
  if (snapshot.applications.length > 0) suggestions.push({ title: 'Maintenir un pipeline lisible', description: 'Faites avancer les candidatures avec les statuts déjà prévus dans Omnia Talent.', path: '/talent/recruteur/candidatures', icon: Target });
  if (upcomingInterviews.length > 0) suggestions.push({ title: 'Préparer les prochains entretiens', description: 'Retrouvez les rendez-vous planifiés et les talents associés avant vos échanges.', path: '/talent/recruteur/entretiens', icon: CalendarDays });
  if (!suggestions.length) suggestions.push({ title: 'Explorer de nouveaux talents', description: 'Utilisez la recherche Omnia Talent pour enrichir votre prochain sourcing.', path: '/talent/recruteur/talents', icon: Users });

  const metrics = [
    { label: 'Offres publiées', value: publishedJobs, icon: Briefcase, accent: '#8B4166' },
    { label: 'Candidatures', value: snapshot.applications.length, icon: FileText, accent: '#7650C5' },
    { label: 'Talents suivis', value: favoriteCount, icon: Heart, accent: '#B86685' },
    { label: 'Entretiens à venir', value: upcomingInterviews.length, icon: CalendarDays, accent: GOLD },
  ];

  return (
    <section className="bg-[#F8F6F8]">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-[#E6DDE2] pb-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#96466D]">Votre recrutement aujourd’hui</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Besoin, sélection, échange : tout reste lisible.</h2>
          </div>
          <div className="flex overflow-x-auto rounded-2xl border border-[#E4D9DF] bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {metrics.map((metric, index) => {
              const Icon = metric.icon;
              return <div key={metric.label} className={`min-w-[125px] px-4 py-3 ${index ? 'border-l border-[#EEE6EA]' : ''}`}><div className="flex items-center gap-2 whitespace-nowrap text-[11px] font-bold text-slate-500"><Icon size={14} style={{ color: metric.accent }} />{metric.label}</div><div className="mt-1 text-xl font-black text-[#002050]">{previewMode || loading ? '—' : metric.value}</div></div>;
            })}
          </div>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#8B4166]">Pipeline</p><h3 className="mt-1 text-lg font-black text-[#002050]">État de vos candidatures</h3></div>
              <Link to={withPreview('/talent/recruteur/candidatures', previewMode)} className="text-xs font-black text-[#96466D] hover:underline">Voir toutes</Link>
            </div>
            <div className="mt-4 overflow-hidden rounded-[24px] border border-[#E6DDE2] bg-white">
              <div className="grid min-w-[640px] grid-cols-5">
                {pipeline.map((step, index) => (
                  <Link key={step.label} to={withPreview('/talent/recruteur/candidatures', previewMode)} className={`relative px-5 py-6 ${index ? 'border-l border-[#EEE6EA]' : ''}`}>
                    <span className="block h-1.5 w-10 rounded-full" style={{ backgroundColor: step.accent }} />
                    <strong className="mt-4 block text-sm font-black text-[#002050]">{step.label}</strong>
                    <span className="mt-1 block text-2xl font-black" style={{ color: step.accent }}>{previewMode || loading ? '—' : step.value}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <h3 className="text-lg font-black text-[#002050]">Offres récentes</h3>
              <Link to={withPreview('/talent/recruteur/offres', previewMode)} className="text-xs font-black text-[#96466D] hover:underline">Gérer les offres</Link>
            </div>
            <div className="mt-4 border-y border-[#E2DADF] bg-white px-5 sm:px-6">
              {previewMode ? (
                <div className="py-10 text-center text-sm text-slate-500">Les offres personnelles ne sont pas chargées dans l’aperçu Super-admin.</div>
              ) : loading ? (
                <div className="py-10 text-center text-sm text-slate-500">Chargement de vos offres…</div>
              ) : snapshot.jobs.length ? snapshot.jobs.slice(0, 4).map((job, index) => {
                const state = jobStatus(job.status);
                return (
                  <Link key={job.id} to="/talent/recruteur/offres" className={`group grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center ${index ? 'border-t border-[#EEE6EA]' : ''}`}>
                    <div className="min-w-0"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FAEEF4] text-[#96466D]"><Briefcase size={18} /></span><div className="min-w-0"><strong className="block truncate text-sm font-black text-[#002050]">{job.title}</strong><span className="mt-1 block truncate text-xs text-slate-500">{job.recruiter_company || 'Recruteur indépendant'}{job.location ? ` · ${job.location}` : ''}{typeof job.applications_count === 'number' ? ` · ${job.applications_count} candidature(s)` : ''}</span></div></div></div>
                    <div className="flex items-center gap-3"><span className="rounded-full px-3 py-1 text-[11px] font-black" style={{ backgroundColor: state.soft, color: state.accent }}>{state.label}</span><ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-1" /></div>
                  </Link>
                );
              }) : (
                <div className="grid gap-4 py-10 sm:grid-cols-[1fr_auto] sm:items-center"><div><strong className="text-sm font-black text-[#002050]">Aucune offre créée</strong><p className="mt-1 text-xs leading-5 text-slate-500">Votre espace Recruteur est prêt pour un premier besoin.</p></div><Link to="/talent/recruteur/offres" className="inline-flex items-center gap-2 text-sm font-black text-[#96466D]">Créer une offre <ArrowRight size={15} /></Link></div>
              )}
            </div>
          </div>

          <aside className="rounded-[26px] border border-[#E6D8DF] bg-[#F3E8EE] p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8B4166]">À traiter</p>
            <div className="mt-4 divide-y divide-[#E0CED7]">
              {todo.slice(0, 3).map(item => {
                const Icon = item.icon;
                return (
                  <Link key={item.title} to={withPreview(item.path, previewMode)} className="group flex gap-3 py-4 first:pt-0">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white" style={{ color: item.accent }}><Icon size={17} /></span>
                    <span className="min-w-0 flex-1"><strong className="block text-sm font-black text-[#002050]">{previewMode ? 'Donnée masquée en aperçu' : loading ? 'Chargement…' : item.title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{previewMode ? 'Connectez-vous avec le rôle concerné pour afficher son activité.' : item.text}</span></span>
                    <ArrowRight size={14} className="mt-2 text-slate-300 transition group-hover:translate-x-1" />
                  </Link>
                );
              })}
            </div>

            <div className="mt-7 border-t border-[#E0CED7] pt-6">
              <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.15em] text-[#8B4166]">Prochain entretien</p><CalendarDays size={16} className="text-[#8B4166]" /></div>
              {previewMode ? <p className="mt-4 text-sm leading-6 text-slate-500">Agenda masqué dans la prévisualisation.</p> : upcomingInterviews[0] ? <div className="mt-4"><strong className="block text-sm font-black text-[#002050]">{upcomingInterviews[0].title}</strong><p className="mt-1 text-xs leading-5 text-slate-500">{upcomingInterviews[0].talent?.full_name || 'Talent'} · {new Date(upcomingInterviews[0].scheduled_at).toLocaleString('fr-FR')}</p><Link to="/talent/recruteur/entretiens" className="mt-3 inline-flex items-center gap-2 text-xs font-black text-[#96466D]">Voir l’agenda <ArrowRight size={14} /></Link></div> : <p className="mt-4 text-sm leading-6 text-slate-500">Aucun entretien futur n’est actuellement programmé.</p>}
            </div>
          </aside>
        </div>

        <div className="mt-10 grid gap-8 border-t border-[#E4DADF] pt-8 lg:grid-cols-[0.55fr_1.45fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#BF8813]">Améliorer votre recrutement</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Des prochaines étapes basées sur votre activité réelle.</h3>
          </div>
          <div className="grid gap-x-8 border-t border-[#E4DADF] sm:grid-cols-2">
            {suggestions.slice(0, 4).map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.title} to={withPreview(item.path, previewMode)} className="group flex gap-3 border-b border-[#E4DADF] py-5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#96466D]"><Icon size={17} /></span>
                  <span className="min-w-0 flex-1"><strong className="block text-sm font-black text-[#002050]">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span></span>
                  <ArrowRight size={14} className="mt-2 text-slate-300 transition group-hover:translate-x-1" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-10 grid gap-8 border-t border-[#E4DADF] pt-8 lg:grid-cols-[0.62fr_1.38fr]">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#96466D]">Talents suivis</p><h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Vos profils présélectionnés restent accessibles sans transformer l’accueil en annuaire.</h3></div>
          <div className="border-y border-[#E4DADF] bg-white px-5 sm:px-6">
            {previewMode ? <div className="py-9 text-center text-sm text-slate-500">Les talents suivis ne sont pas affichés pendant la prévisualisation Super-admin.</div> : snapshot.favorites.length ? snapshot.favorites.slice(0, 4).map((talent, index) => (
              <Link key={talent.id} to={`/profil/${talent.id}`} className={`group flex items-center gap-4 py-4 ${index ? 'border-t border-[#EEE6EA]' : ''}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FAEEF4] text-xs font-black text-[#8B4166]">{talent.photo_url ? <img src={talent.photo_url} alt="" className="h-full w-full object-cover" /> : talent.full_name.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-black text-[#002050]">{talent.full_name}</strong><span className="mt-1 block truncate text-xs text-slate-500">{talent.professional_title || 'Profil professionnel'}{talent.location ? ` · ${talent.location}` : ''}</span></span>
                <ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-1" />
              </Link>
            )) : <div className="grid gap-4 py-9 sm:grid-cols-[1fr_auto] sm:items-center"><div><strong className="text-sm font-black text-[#002050]">Aucun talent favori</strong><p className="mt-1 text-xs leading-5 text-slate-500">Ajoutez des profils depuis Omnia Talent pour les retrouver ici.</p></div><Link to="/talent/recruteur/talents" className="inline-flex items-center gap-2 text-sm font-black text-[#96466D]">Rechercher <Search size={15} /></Link></div>}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function RecruiterConnectedHomeSections({ previewMode }: Props) {
  const [profile, setProfile] = useState<RecruiterStatus | null>(null);
  const [accessState, setAccessState] = useState<'checking' | 'approved' | 'pending' | 'rejected' | 'suspended' | 'denied'>(previewMode ? 'approved' : 'checking');
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(!previewMode);
  const [partialUnavailable, setPartialUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    if (previewMode) {
      setAccessState('approved');
      setLoading(false);
      setProfile(null);
      setSnapshot(EMPTY_SNAPSHOT);
      return () => { active = false; };
    }

    setAccessState('checking');
    setLoading(true);
    loadRecruiterStatus()
      .then(result => {
        if (!active) return;
        const next = result.profile || null;
        setProfile(next);
        if (!next) {
          setAccessState('denied');
          setLoading(false);
          return;
        }
        if (next.status !== 'approved' || next.recruiter_type !== 'independent') {
          setAccessState(next.status === 'approved' ? 'denied' : next.status);
          setLoading(false);
          return;
        }
        setAccessState('approved');

        return Promise.allSettled([
          recruiterManage<{ jobs?: RecruiterJob[] }>('list_my_jobs'),
          recruiterManage<{ applications?: RecruiterApplication[] }>('list_applications'),
          loadTalentFavorites(),
          loadTalentDashboard(),
          loadTalentInterviews(),
          loadTalentConversations(),
        ]).then(results => {
          if (!active) return;
          const nextSnapshot: Snapshot = { ...EMPTY_SNAPSHOT };
          if (results[0].status === 'fulfilled') nextSnapshot.jobs = results[0].value.jobs || [];
          if (results[1].status === 'fulfilled') nextSnapshot.applications = results[1].value.applications || [];
          if (results[2].status === 'fulfilled') nextSnapshot.favorites = results[2].value || [];
          if (results[3].status === 'fulfilled') nextSnapshot.metrics = results[3].value.metrics || EMPTY_SNAPSHOT.metrics;
          if (results[4].status === 'fulfilled') nextSnapshot.interviews = results[4].value || [];
          if (results[5].status === 'fulfilled') nextSnapshot.conversations = results[5].value || [];
          setPartialUnavailable(results.some(result => result.status === 'rejected'));
          setSnapshot(nextSnapshot);
          setLoading(false);
        });
      })
      .catch(() => {
        if (!active) return;
        setAccessState('denied');
        setLoading(false);
      });

    return () => { active = false; };
  }, [previewMode]);

  const latestConversationDate = useMemo(() => {
    if (!snapshot.conversations.length) return null;
    const dates = snapshot.conversations.map(item => new Date(item.last_message_at).getTime()).filter(Number.isFinite);
    return dates.length ? Math.max(...dates) : null;
  }, [snapshot.conversations]);

  return (
    <>
      <Hero profile={profile} snapshot={snapshot} previewMode={previewMode} loading={loading} />
      <EcosystemStrip previewMode={previewMode} />
      {!previewMode && accessState !== 'approved' ? <AccessState status={accessState} /> : <Activity snapshot={snapshot} previewMode={previewMode} loading={loading} profile={profile} />}
      {accessState === 'approved' && !previewMode && (partialUnavailable || latestConversationDate) && (
        <section className="border-t border-[#E6DDE2] bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 text-xs sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-2 font-bold text-slate-500"><Sparkles size={15} className="text-[#BF8813]" />{partialUnavailable ? 'Certaines données de recrutement sont momentanément indisponibles ; les autres informations restent affichées.' : `Dernière activité de messagerie détectée le ${new Date(latestConversationDate as number).toLocaleDateString('fr-FR')}.`}</span>
            <Link to="/talent/recruteur/messages" className="inline-flex items-center gap-2 font-black text-[#96466D]">Ouvrir les messages <ArrowRight size={14} /></Link>
          </div>
        </section>
      )}
    </>
  );
}
