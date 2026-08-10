import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  FolderKanban,
  GraduationCap,
  Heart,
  MessageCircle,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import UserAccountMenu from '../components/UserAccountMenu';
import OmniaBrandLockup from '../components/OmniaBrandLockup';
import type { CourseCardData } from '../components/CourseCard';
import { useAuth } from '../hooks/useAuth';
import { ENDPOINTS } from '../lib/config';
import { edgeAuthHeaders } from '../lib/edgeAuth';
import { getDashboardPathForRoles, normalizePlatformRoles, type CanonicalPlatformRole } from '../lib/session';

const BLUE = '#002050';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

type LearnerDashboardData = {
  courses_en_cours?: Array<{
    course_id: string;
    title: string;
    slug: string;
    progress_percent: number;
    lessons_completed: number;
    lessons_total: number;
  }>;
};

type LandingData = { featured_courses?: CourseCardData[] };

type SpaceLink = {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

type HomeTone = {
  accent: string;
  soft: string;
  mid: string;
  glow: string;
};

const SPACE_BY_ROLE: Partial<Record<CanonicalPlatformRole, SpaceLink>> = {
  super_admin: { key: 'admin', label: 'Administration', description: 'Piloter la plateforme, la gouvernance et les opérations.', href: '/admin/dashboard', icon: ShieldCheck },
  moderateur: { key: 'moderator', label: 'Espace Modération', description: 'Traiter les missions et contrôles qui vous sont attribués.', href: '/moderateur/dashboard', icon: UserCheck },
  structure: { key: 'structure', label: 'Espace Structure', description: 'Gérer l’organisation, les membres, les formations et les activités autorisées.', href: '/structure/dashboard', icon: Building2 },
  gestionnaire_structure: { key: 'structure-manager', label: 'Espace Structure', description: 'Accéder aux fonctions déléguées par votre Structure.', href: '/structure/dashboard', icon: Building2 },
  recruteur_structure: { key: 'structure-recruiter', label: 'Recrutement Structure', description: 'Accéder aux fonctions de recrutement déléguées.', href: '/structure/recrutement/dashboard', icon: Users },
  organisateur: { key: 'organizer', label: 'Espace Organisateur', description: 'Créer et gérer vos événements Omnia Live.', href: '/omnia-live/organisateur', icon: CalendarDays },
  recruteur: { key: 'recruiter', label: 'Espace Recruteur', description: 'Gérer offres, talents, candidatures et entretiens.', href: '/talent/recruteur/dashboard', icon: Briefcase },
  professeur: { key: 'professor', label: 'Espace Professeur', description: 'Créer vos formations, gérer les évaluations et suivre votre activité.', href: '/professeur/dashboard', icon: GraduationCap },
  coach: { key: 'coach', label: 'Espace Coach', description: 'Gérer votre activité de coaching et vos séances.', href: '/coach/dashboard', icon: Heart },
  apprenant: { key: 'learner', label: 'Mon apprentissage', description: 'Retrouver vos formations, évaluations, preuves et progression.', href: '/dashboard', icon: BookOpen },
};

const HOME_TONE_BY_ROLE: Partial<Record<CanonicalPlatformRole, HomeTone>> = {
  super_admin: { accent: '#BF8813', soft: '#FFF5DB', mid: '#DCA640', glow: 'rgba(191,136,19,0.34)' },
  moderateur: { accent: '#C66A22', soft: '#FFF0E4', mid: '#E18A43', glow: 'rgba(198,106,34,0.34)' },
  structure: { accent: '#087F79', soft: '#E7F6F3', mid: '#29A69E', glow: 'rgba(8,127,121,0.34)' },
  gestionnaire_structure: { accent: '#087F79', soft: '#E7F6F3', mid: '#29A69E', glow: 'rgba(8,127,121,0.34)' },
  recruteur_structure: { accent: '#315FA8', soft: '#EAF1FF', mid: '#6288C8', glow: 'rgba(49,95,168,0.34)' },
  organisateur: { accent: '#7A55B8', soft: '#F1EBFB', mid: '#9A78CF', glow: 'rgba(122,85,184,0.34)' },
  recruteur: { accent: '#9C436D', soft: '#F9EAF1', mid: '#BC678E', glow: 'rgba(156,67,109,0.34)' },
  professeur: { accent: '#3E63B8', soft: '#EAF0FF', mid: '#6F8ED2', glow: 'rgba(62,99,184,0.34)' },
  coach: { accent: '#A55A44', soft: '#FAEDE8', mid: '#C37B64', glow: 'rgba(165,90,68,0.34)' },
  apprenant: { accent: '#0F7699', soft: '#E8F5FA', mid: '#45A0BE', glow: 'rgba(15,118,153,0.34)' },
};

const DEFAULT_HOME_TONE: HomeTone = { accent: '#0F7699', soft: '#E8F5FA', mid: '#45A0BE', glow: 'rgba(15,118,153,0.34)' };

const GLOBAL_LINKS = [
  { label: 'Formations', href: '/catalogue' },
  { label: 'Omnia Live', href: '/omnia-live' },
  { label: 'Projets', href: '/projects' },
  { label: 'Coaching', href: '/coaching' },
  { label: 'Carrière', href: '/forum/emploi' },
  { label: 'Omnia Talent', href: '/talent' },
  { label: 'Communauté', href: '/forum' },
] as const;

const EXPLORE_LINKS: Array<{ label: string; description: string; href: string; icon: LucideIcon; accent: string; soft: string }> = [
  { label: 'Apprendre', description: 'Explorer les formations réellement publiées sur Omnia.', href: '/catalogue', icon: BookOpen, accent: '#315FA8', soft: '#EAF1FF' },
  { label: 'Pratiquer', description: 'Développer des preuves par les projets et missions.', href: '/projects', icon: FolderKanban, accent: '#087F79', soft: '#E7F6F3' },
  { label: 'Prouver', description: 'Retrouver certificats, badges et preuves vérifiables.', href: '/verify', icon: ShieldCheck, accent: '#BF8813', soft: '#FFF5DB' },
  { label: 'Se développer', description: 'Accéder au coaching et aux outils de carrière.', href: '/coaching', icon: Heart, accent: '#A55A44', soft: '#FAEDE8' },
  { label: 'Accéder aux opportunités', description: 'Explorer emplois, talents et communauté professionnelle.', href: '/forum/emploi', icon: Briefcase, accent: '#9C436D', soft: '#F9EAF1' },
  { label: 'Participer en direct', description: 'Découvrir ateliers, masterclass et événements Omnia Live.', href: '/omnia-live', icon: Video, accent: '#7A55B8', soft: '#F1EBFB' },
];

function firstName(fullName?: string) {
  return (fullName || '').trim().split(/\s+/)[0] || '';
}

function coursePath(course: CourseCardData) {
  return course.content_origin === 'external' ? `/formation-externe/${course.id}` : `/cours/${course.id}`;
}

export default function ConnectedHome() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [learnerData, setLearnerData] = useState<LearnerDashboardData | null>(null);
  const [featuredCourses, setFeaturedCourses] = useState<CourseCardData[]>([]);

  const roles = useMemo(() => normalizePlatformRoles(user?.roles || []), [user?.roles]);
  const dashboardPath = user ? getDashboardPathForRoles(user.roles || []) : '/accueil';
  const isLearner = roles.includes('apprenant');

  const spaces = useMemo(() => {
    const unique = new Map<string, SpaceLink>();
    roles.forEach(role => {
      const item = SPACE_BY_ROLE[role];
      if (item) unique.set(item.href, item);
    });
    return [...unique.values()];
  }, [roles]);

  const homeTone = HOME_TONE_BY_ROLE[roles[0]] || DEFAULT_HOME_TONE;
  const primarySpace = spaces[0] || null;

  useEffect(() => {
    let active = true;
    fetch(ENDPOINTS.landingData, { headers: ANON_KEY ? { Authorization: `Bearer ${ANON_KEY}` } : undefined })
      .then(response => response.ok ? response.json() as Promise<LandingData> : Promise.reject())
      .then(data => {
        if (active) setFeaturedCourses(Array.isArray(data.featured_courses) ? data.featured_courses.slice(0, 6) : []);
      })
      .catch(() => { if (active) setFeaturedCourses([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isLearner) {
      setLearnerData(null);
      return;
    }
    let active = true;
    fetch(ENDPOINTS.dashboardApprenant, { headers: edgeAuthHeaders() })
      .then(response => response.ok ? response.json() as Promise<LearnerDashboardData> : Promise.reject())
      .then(data => { if (active) setLearnerData(data); })
      .catch(() => { if (active) setLearnerData(null); });
    return () => { active = false; };
  }, [isLearner]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value) navigate(`/catalogue?q=${encodeURIComponent(value)}`);
  }

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-white"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#002050]" /></div>;
  }
  if (!user) return <Navigate to="/connexion?redirect=%2Fhome" replace />;

  const continueCourses = learnerData?.courses_en_cours || [];
  const featuredContinue = continueCourses[0] || null;
  const remainingContinue = continueCourses.slice(1, 4);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-[#DCE5F0] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center gap-5 px-5 sm:px-6">
          <OmniaBrandLockup href="/home" className="flex-none" />

          <form onSubmit={submitSearch} className="hidden min-w-0 flex-1 items-center overflow-hidden rounded-full border border-[#CCD8E6] bg-[#F7FAFE] shadow-[0_8px_24px_rgba(0,32,80,0.05)] lg:flex">
            <Search size={17} className="ml-4 shrink-0 text-[#55708F]" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une formation ou une compétence" className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-[#002050] outline-none placeholder:text-slate-400" />
            <button type="submit" className="min-h-11 bg-[#002050] px-5 text-sm font-bold text-white transition hover:bg-[#0B386D]">Rechercher</button>
          </form>

          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher compact />
            <UserAccountMenu dashboardPath={dashboardPath} />
          </div>
        </div>
        <nav className="border-t border-[#EDF2F7] bg-[#F8FBFF]" aria-label="Navigation Omnia">
          <div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-5 py-3 text-sm font-semibold text-slate-600 sm:px-6">
            <Link to="/home" className="whitespace-nowrap text-[#002050]">Accueil</Link>
            {GLOBAL_LINKS.map(item => <Link key={item.href} to={item.href} className="whitespace-nowrap transition hover:text-[#002050]">{item.label}</Link>)}
          </div>
        </nav>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-[#133F6D] text-white" style={{ background: `linear-gradient(118deg, ${BLUE} 0%, #073A70 52%, ${homeTone.accent} 145%)` }}>
          <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: `radial-gradient(circle at 78% 22%, ${homeTone.glow} 0%, transparent 34%), radial-gradient(circle at 56% 118%, rgba(191,136,19,0.26) 0%, transparent 40%)` }} />
          <div className="pointer-events-none absolute -right-24 top-7 h-64 w-64 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-6 top-24 h-40 w-40 rounded-full border border-[#E7BF66]/25" />
          <div className="pointer-events-none absolute bottom-0 left-[42%] h-px w-[52%] bg-gradient-to-r from-transparent via-[#E7BF66]/70 to-transparent" />

          <div className="relative mx-auto grid min-h-[360px] max-w-7xl items-center gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.16fr)_minmax(300px,0.84fr)] lg:px-8 lg:py-14">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E9C775]">Votre accueil Omnia</p>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                {firstName(user.full_name) ? `Bonjour ${firstName(user.full_name)}` : 'Bonjour'}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-blue-50/85 sm:text-lg">Retrouvez votre apprentissage, vos espaces professionnels et les services Omnia depuis un seul point de départ.</p>

              <form onSubmit={submitSearch} className="mt-7 flex max-w-2xl overflow-hidden rounded-2xl border border-white/18 bg-white/10 backdrop-blur lg:hidden">
                <Search size={17} className="ml-4 shrink-0 self-center text-blue-100" />
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une formation" className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-blue-100/65" />
                <button type="submit" className="bg-white px-4 text-sm font-bold text-[#002050]">Rechercher</button>
              </form>
            </div>

            {primarySpace && (() => {
              const PrimaryIcon = primarySpace.icon;
              return (
                <div className="relative border-l border-white/15 pl-6 lg:pl-9">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: homeTone.soft, color: homeTone.accent }}><PrimaryIcon size={21} /></span>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-blue-100/70">Votre espace principal</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">{primarySpace.label}</h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-blue-50/78">{primarySpace.description}</p>
                  <Link to={primarySpace.href} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#F3D590] hover:text-white">Ouvrir mon espace <ArrowRight size={16} /></Link>
                  {spaces.length > 1 && <p className="mt-4 text-xs text-blue-100/60">{spaces.length} espaces disponibles avec vos rôles actuels</p>}
                </div>
              );
            })()}
          </div>
        </section>

        {featuredContinue && (
          <section className="border-b border-[#D9E5F1] bg-[#F5F9FF] px-5 py-12 sm:px-6">
            <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: homeTone.accent }}>Apprentissage</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#002050]">Reprendre là où vous vous êtes arrêté</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">Votre progression reste visible dès l’accueil, sans remplacer votre espace d’apprentissage complet.</p>
                <Link to="/dashboard/mes-cours" className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#002050] hover:underline">Voir mes formations <ArrowRight size={15} /></Link>
              </div>

              <div className="border-l-4 pl-6 sm:pl-8" style={{ borderColor: homeTone.accent }}>
                <Link to={`/cours/${featuredContinue.slug}/apprendre`} className="group block">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">À continuer maintenant</p>
                  <h3 className="mt-2 text-xl font-black leading-7 text-[#002050] group-hover:underline sm:text-2xl">{featuredContinue.title}</h3>
                  <div className="mt-5 flex items-center gap-4">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white shadow-inner"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, featuredContinue.progress_percent))}%`, backgroundColor: homeTone.accent }} /></div>
                    <strong className="text-sm text-[#002050]">{featuredContinue.progress_percent}%</strong>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{featuredContinue.lessons_completed}/{featuredContinue.lessons_total} leçons terminées</p>
                </Link>

                {remainingContinue.length > 0 && (
                  <div className="mt-6 border-t border-[#D7E2EE]">
                    {remainingContinue.map(course => (
                      <Link key={course.course_id} to={`/cours/${course.slug}/apprendre`} className="group grid gap-3 border-b border-[#D7E2EE] py-4 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-center">
                        <div><h4 className="font-bold text-[#002050] group-hover:underline">{course.title}</h4><p className="mt-1 text-xs text-slate-500">{course.lessons_completed}/{course.lessons_total} leçons</p></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full" style={{ width: `${Math.max(0, Math.min(100, course.progress_percent))}%`, backgroundColor: homeTone.mid }} /></div>
                        <span className="flex items-center gap-2 text-xs font-bold text-slate-500">{course.progress_percent}% <ArrowRight size={14} /></span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {spaces.length > 0 && (
          <section className="border-b border-slate-200 px-5 py-12 sm:px-6">
            <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.62fr_1.38fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#BF8813]">Vos accès</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#002050]">Vos espaces de travail</h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">Les accès affichés correspondent uniquement aux rôles déjà associés à votre compte.</p>
              </div>

              <div className="border-t border-[#CBD8E6]">
                {spaces.map((space, index) => {
                  const Icon = space.icon;
                  return (
                    <Link key={space.href} to={space.href} className="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-4 border-b border-[#DCE5EF] py-5 transition hover:bg-[#F8FBFF] sm:px-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: index === 0 ? homeTone.soft : '#F3F6FA', color: index === 0 ? homeTone.accent : BLUE }}><Icon size={18} /></span>
                      <div><h3 className="font-black text-[#002050] group-hover:underline">{space.label}</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{space.description}</p></div>
                      <ArrowRight size={17} className="mt-2 text-slate-400 transition group-hover:translate-x-1 group-hover:text-[#002050]" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section className="relative overflow-hidden border-b border-[#D9E3ED] bg-[#F8FBFF] px-5 py-12 sm:px-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(90deg,rgba(49,95,168,0.08),rgba(8,127,121,0.06),rgba(191,136,19,0.08),rgba(156,67,109,0.06),rgba(122,85,184,0.08))]" />
          <div className="relative mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Explorer</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#002050]">Tout l’écosystème Omnia depuis un seul accueil</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Les mêmes services déjà présents dans la plateforme, organisés comme un parcours plutôt qu’une accumulation de blocs.</p>
            </div>

            <div className="relative mt-10">
              <div className="pointer-events-none absolute left-5 top-5 bottom-5 w-px bg-[linear-gradient(180deg,#315FA8,#087F79,#BF8813,#A55A44,#9C436D,#7A55B8)] md:left-0 md:right-0 md:top-5 md:h-px md:w-auto md:bg-[linear-gradient(90deg,#315FA8,#087F79,#BF8813,#A55A44,#9C436D,#7A55B8)]" />
              <div className="relative grid gap-7 md:grid-cols-3 lg:grid-cols-6 lg:gap-5">
                {EXPLORE_LINKS.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} to={item.href} className="group relative grid grid-cols-[40px_minmax(0,1fr)] gap-4 pl-0 md:block md:pt-0">
                      <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-[#F8FBFF] shadow-[0_5px_16px_rgba(0,32,80,0.08)]" style={{ backgroundColor: item.soft, color: item.accent }}><Icon size={17} /></span>
                      <div className="md:mt-5">
                        <span className="text-[10px] font-black tracking-[0.15em] text-slate-400">0{index + 1}</span>
                        <h3 className="mt-1 font-black text-[#002050] group-hover:underline">{item.label}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {featuredCourses.length > 0 && (
          <section className="border-b border-[#E7DDC8] bg-[#FFFDF8] px-5 py-12 sm:px-6">
            <div className="mx-auto max-w-7xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9A6B0F]">Catalogue réel</p><h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#002050]">Formations à découvrir</h2><p className="mt-3 text-sm leading-6 text-slate-600">Une sélection issue du catalogue réellement publié sur Omnia.</p></div>
                <Link to="/catalogue" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#002050] hover:underline">Voir le catalogue <ArrowRight size={15} /></Link>
              </div>

              <div className="mt-8 grid border-t border-[#DACFB9] lg:grid-cols-2">
                {featuredCourses.map((course, index) => (
                  <Link key={course.id} to={coursePath(course)} className={`group grid min-h-[132px] grid-cols-[minmax(0,1fr)_auto] gap-5 border-b border-[#E5DCCB] py-5 transition hover:bg-white/65 lg:px-5 ${index % 2 === 0 ? 'lg:border-r' : ''}`}>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#8B6A2A]">{course.category || course.level}</p>
                      <h3 className="mt-2 font-black leading-6 text-[#002050] group-hover:underline">{course.title}</h3>
                      {(course.creator_name || course.provider_name) && <p className="mt-2 text-xs text-slate-500">{course.provider_name || course.creator_name}</p>}
                    </div>
                    <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF3D7] text-[#9A6B0F]"><ArrowRight size={16} /></span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="px-5 py-8 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Omnia Global Academy</span>
            <div className="flex flex-wrap gap-5"><Link to="/mon-profil" className="hover:text-[#002050]">Mon profil</Link><Link to="/confidentialite" className="hover:text-[#002050]">Confidentialité</Link><Link to="/forum" className="inline-flex items-center gap-1 hover:text-[#002050]"><MessageCircle size={13} />Communauté</Link></div>
          </div>
        </section>
      </main>
    </div>
  );
}
