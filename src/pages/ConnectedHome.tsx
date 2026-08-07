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
import type { CourseCardData } from '../components/CourseCard';
import { useAuth } from '../hooks/useAuth';
import { ENDPOINTS } from '../lib/config';
import { edgeAuthHeaders } from '../lib/edgeAuth';
import { getDashboardPathForRoles, normalizePlatformRoles, type CanonicalPlatformRole } from '../lib/session';

const BLUE = '#002050';
const GOLD = '#BF8813';
const OFFICIAL_SLOGAN = 'EMPOWER SKILLS. TRANSFORM AFRICA. IMPACT THE WORLD.';
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

const GLOBAL_LINKS = [
  { label: 'Formations', href: '/catalogue' },
  { label: 'Omnia Live', href: '/omnia-live' },
  { label: 'Projets', href: '/projects' },
  { label: 'Coaching', href: '/coaching' },
  { label: 'Carrière', href: '/forum/emploi' },
  { label: 'Omnia Talent', href: '/talent' },
  { label: 'Communauté', href: '/forum' },
] as const;

const EXPLORE_LINKS: Array<{ label: string; description: string; href: string; icon: LucideIcon }> = [
  { label: 'Apprendre', description: 'Explorer les formations réellement publiées sur Omnia.', href: '/catalogue', icon: BookOpen },
  { label: 'Pratiquer', description: 'Développer des preuves par les projets et missions.', href: '/projects', icon: FolderKanban },
  { label: 'Prouver', description: 'Retrouver certificats, badges et preuves vérifiables.', href: '/verify', icon: ShieldCheck },
  { label: 'Se développer', description: 'Accéder au coaching et aux outils de carrière.', href: '/coaching', icon: Heart },
  { label: 'Accéder aux opportunités', description: 'Explorer emplois, talents et communauté professionnelle.', href: '/forum/emploi', icon: Briefcase },
  { label: 'Participer en direct', description: 'Découvrir ateliers, masterclass et événements Omnia Live.', href: '/omnia-live', icon: Video },
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

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center gap-5 px-5 sm:px-6">
          <Link to="/home" className="flex min-w-0 flex-none items-center gap-2.5" aria-label="Accueil connecté Omnia Global Academy">
            <img src="/IMG_0349.png" alt="" className="h-10 w-auto object-contain" />
            <div className="min-w-0">
              <div className="text-sm font-black leading-none tracking-[0.09em] text-[#002050]">OMNIA</div>
              <div className="mt-1 text-[8px] font-bold tracking-[0.18em] text-[#BF8813]">GLOBAL ACADEMY</div>
              <div className="mt-1 hidden text-[7px] font-bold tracking-[0.08em] text-slate-500 sm:block">{OFFICIAL_SLOGAN}</div>
            </div>
          </Link>

          <form onSubmit={submitSearch} className="hidden min-w-0 flex-1 items-center border border-slate-300 bg-white lg:flex">
            <Search size={17} className="ml-4 shrink-0 text-slate-400" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une formation ou une compétence" className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
            <button type="submit" className="min-h-11 bg-[#002050] px-5 text-sm font-bold text-white">Rechercher</button>
          </form>

          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher compact />
            <UserAccountMenu dashboardPath={dashboardPath} />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-6 overflow-x-auto border-t border-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 sm:px-6" aria-label="Navigation Omnia">
          <Link to="/home" className="whitespace-nowrap text-[#002050]">Accueil</Link>
          {GLOBAL_LINKS.map(item => <Link key={item.href} to={item.href} className="whitespace-nowrap hover:text-[#002050]">{item.label}</Link>)}
        </nav>
      </header>

      <main>
        <section className="border-b border-slate-200 px-5 py-9 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#BF8813]">Votre accueil Omnia</p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#002050] sm:text-3xl">
              {firstName(user.full_name) ? `Bonjour ${firstName(user.full_name)}` : 'Bonjour'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Retrouvez votre apprentissage, vos espaces professionnels et les services Omnia sans passer par une sidebar permanente.</p>
            <form onSubmit={submitSearch} className="mt-6 flex border border-slate-300 lg:hidden">
              <Search size={17} className="ml-4 shrink-0 self-center text-slate-400" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une formation" className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
              <button type="submit" className="bg-[#002050] px-4 text-sm font-bold text-white">Rechercher</button>
            </form>
          </div>
        </section>

        {continueCourses.length > 0 && (
          <section className="border-b border-slate-200 px-5 py-10 sm:px-6">
            <div className="mx-auto max-w-7xl">
              <div className="flex items-end justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Apprentissage</p><h2 className="mt-1 text-xl font-bold text-[#002050]">Reprendre là où vous vous êtes arrêté</h2></div>
                <Link to="/dashboard/mes-cours" className="hidden items-center gap-1 text-sm font-bold text-[#002050] hover:underline sm:inline-flex">Mes formations<ArrowRight size={15} /></Link>
              </div>
              <div className="mt-6 border-t border-slate-300">
                {continueCourses.slice(0, 4).map(course => (
                  <Link key={course.course_id} to={`/cours/${course.slug}/apprendre`} className="group grid gap-3 border-b border-slate-200 py-5 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-center">
                    <div><h3 className="font-bold text-[#002050] group-hover:underline">{course.title}</h3><p className="mt-1 text-xs text-slate-500">{course.lessons_completed}/{course.lessons_total} leçons terminées</p></div>
                    <div><div className="h-1.5 overflow-hidden bg-slate-100"><div className="h-full bg-[#BF8813]" style={{ width: `${Math.max(0, Math.min(100, course.progress_percent))}%` }} /></div><p className="mt-1 text-xs font-semibold text-slate-500">{course.progress_percent}%</p></div>
                    <ArrowRight size={17} className="text-slate-400 group-hover:text-[#002050]" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {spaces.length > 0 && (
          <section className="border-b border-slate-200 bg-[#F8FAFC] px-5 py-10 sm:px-6">
            <div className="mx-auto max-w-7xl">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Vos accès</p>
              <h2 className="mt-1 text-xl font-bold text-[#002050]">Vos espaces de travail</h2>
              <div className="mt-6 grid border-t border-slate-300 lg:grid-cols-2">
                {spaces.map((space, index) => {
                  const Icon = space.icon;
                  return <Link key={space.href} to={space.href} className={`group grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3 border-b border-slate-200 py-5 lg:px-5 ${index % 2 === 0 ? 'lg:border-r' : ''}`}><Icon size={18} className="mt-0.5 text-[#BF8813]" /><div><h3 className="font-bold text-[#002050] group-hover:underline">{space.label}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{space.description}</p></div><ArrowRight size={17} className="mt-0.5 text-slate-400 group-hover:text-[#002050]" /></Link>;
                })}
              </div>
            </div>
          </section>
        )}

        <section className="border-b border-slate-200 px-5 py-10 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Explorer</p>
            <h2 className="mt-1 text-xl font-bold text-[#002050]">Tout l’écosystème Omnia depuis un seul accueil</h2>
            <div className="mt-6 grid border-t border-slate-300 md:grid-cols-2 lg:grid-cols-3">
              {EXPLORE_LINKS.map((item, index) => {
                const Icon = item.icon;
                return <Link key={item.href} to={item.href} className={`group border-b border-slate-200 py-5 md:px-5 ${index % 2 === 0 ? 'md:border-r' : ''}`}><div className="flex items-center gap-2"><Icon size={17} className="text-[#BF8813]" /><h3 className="font-bold text-[#002050] group-hover:underline">{item.label}</h3></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p></Link>;
              })}
            </div>
          </div>
        </section>

        {featuredCourses.length > 0 && (
          <section className="border-b border-slate-200 bg-[#F8FAFC] px-5 py-10 sm:px-6">
            <div className="mx-auto max-w-7xl">
              <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Catalogue réel</p><h2 className="mt-1 text-xl font-bold text-[#002050]">Formations à découvrir</h2></div><Link to="/catalogue" className="hidden items-center gap-1 text-sm font-bold text-[#002050] hover:underline sm:inline-flex">Voir le catalogue<ArrowRight size={15} /></Link></div>
              <div className="mt-6 grid border-t border-slate-300 lg:grid-cols-2">
                {featuredCourses.map((course, index) => <Link key={course.id} to={coursePath(course)} className={`group grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-slate-200 py-5 lg:px-5 ${index % 2 === 0 ? 'lg:border-r' : ''}`}><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{course.category || course.level}</p><h3 className="mt-1 font-bold leading-6 text-[#002050] group-hover:underline">{course.title}</h3>{(course.creator_name || course.provider_name) && <p className="mt-1 text-xs text-slate-500">{course.provider_name || course.creator_name}</p>}</div><ArrowRight size={17} className="text-slate-400 group-hover:text-[#002050]" /></Link>)}
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
