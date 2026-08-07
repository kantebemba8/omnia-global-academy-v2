import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileBadge2,
  FolderKanban,
  GraduationCap,
  Heart,
  MessageCircle,
  Search,
  ShieldCheck,
  Target,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { CourseCardData } from '../CourseCard';
import type {
  LandingContentItem,
  LandingPageConfig,
  LandingSectionConfig,
  MobileAppItem,
  SocialNetworkItem,
} from '../../types/landingCms';

export type LandingPublicPartner = {
  id: string;
  name: string;
  category?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  description?: string | null;
  is_featured?: boolean;
  show_homepage?: boolean;
  show_footer?: boolean;
  alt_text?: string | null;
};

export type LandingStats = {
  formations: string | null;
  apprenants: string | null;
  pays: string | null;
  formateurs: string | null;
  etablissements: string | null;
};

export type LandingStatsVisibility = Record<keyof LandingStats, boolean>;

export type LandingExperienceData = {
  landingPage: LandingPageConfig;
  featuredCourses: CourseCardData[];
  stats: LandingStats;
  statsVisibility: LandingStatsVisibility;
  partners: LandingPublicPartner[];
  mobileApps: MobileAppItem[];
  socialNetworks: SocialNetworkItem[];
};

type LandingExperienceProps = {
  data: LandingExperienceData;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
};

const BLUE = '#002050';
const GOLD = '#BF8813';

const ICONS: Record<string, LucideIcon> = {
  graduation: GraduationCap,
  briefcase: Briefcase,
  book: BookOpen,
  heart: Heart,
  calendar: CalendarDays,
  users: Users,
  building: Building2,
  projects: FolderKanban,
  badge: ShieldCheck,
  target: Target,
  network: Users,
  monitor: Video,
  message: MessageCircle,
  certificate: FileBadge2,
  award: ShieldCheck,
  clipboard: CheckCircle2,
  shield: ShieldCheck,
  other: ArrowRight,
};

function safeHref(value: string | null | undefined, fallback = '/accueil') {
  const href = String(value || '').trim();
  return href.startsWith('/') && !href.startsWith('//') ? href : fallback;
}

function visibleItems(section: LandingSectionConfig) {
  return (section.items || [])
    .filter(item => item.enabled !== false && (item.title.trim() || item.label.trim()))
    .sort((a, b) => a.order - b.order);
}

function ActionLink({ href, children, primary = false }: { href?: string; children?: ReactNode; primary?: boolean }) {
  if (!href || !children) return null;
  return (
    <Link
      to={safeHref(href)}
      className={primary
        ? 'inline-flex min-h-11 items-center justify-center gap-2 border border-[#BF8813] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#A8730F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] focus-visible:ring-offset-2'
        : 'inline-flex min-h-11 items-center justify-center gap-2 border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002050] transition hover:border-[#002050] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] focus-visible:ring-offset-2'}
      style={primary ? { backgroundColor: GOLD } : undefined}
    >
      {children}<ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}

function SectionHeading({ section }: { section: LandingSectionConfig }) {
  return (
    <div className="max-w-3xl">
      {section.eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9A6A08]">{section.eyebrow}</p>}
      <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#002050] sm:text-3xl">{section.title}</h2>
      {section.subtitle && <p className="mt-3 text-base leading-7 text-slate-600">{section.subtitle}</p>}
      {section.body && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-500">{section.body}</p>}
    </div>
  );
}

function HeroSection({
  section,
  stats,
  statsVisibility,
  searchQuery,
  onSearchQueryChange,
  onSearch,
}: {
  section: LandingSectionConfig;
  stats: LandingStats;
  statsVisibility: LandingStatsVisibility;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const visibleStats = ([
    ['formations', 'Formations'],
    ['apprenants', 'Apprenants'],
    ['pays', 'Pays'],
    ['formateurs', 'Professeurs'],
    ['etablissements', 'Structures'],
  ] as Array<[keyof LandingStats, string]>).filter(([key]) => statsVisibility[key] && stats[key]);

  return (
    <section id="accueil" className="border-b border-slate-200 bg-white px-5 pb-12 pt-28 sm:px-6 sm:pb-14 sm:pt-32">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-4xl">
          {section.eyebrow && <p className="text-sm font-semibold text-slate-500">{section.eyebrow}</p>}
          <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-[1.08] tracking-[-0.04em] text-[#002050] sm:text-4xl lg:text-5xl">
            {section.title}
          </h1>
          {section.subtitle && <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">{section.subtitle}</p>}
          {section.body && <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-slate-500">{section.body}</p>}
        </div>

        <form onSubmit={onSearch} className="mt-8 flex max-w-4xl flex-col border border-slate-300 bg-white sm:flex-row">
          <label className="flex min-w-0 flex-1 items-center gap-3 px-4">
            <Search size={20} className="shrink-0 text-slate-400" aria-hidden="true" />
            <span className="sr-only">Rechercher une formation</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchQueryChange(event.target.value)}
              placeholder={section.search_placeholder || 'Quelle compétence souhaitez-vous développer ?'}
              className="min-h-12 min-w-0 flex-1 bg-transparent py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>
          <button type="submit" className="min-h-12 bg-[#002050] px-7 text-sm font-bold text-white transition hover:bg-[#00183E]">
            {section.search_button_label || 'Rechercher'}
          </button>
        </form>

        <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-[#002050]">
          <Link to="/catalogue" className="hover:underline">Formations</Link>
          <Link to="/omnia-live" className="hover:underline">Omnia Live</Link>
          <Link to="/projects" className="hover:underline">Omnia Projects</Link>
          <Link to="/coaching" className="hover:underline">Coaching</Link>
          <Link to="/forum/emploi" className="hover:underline">Carrière</Link>
          <Link to="/talent" className="hover:underline">Omnia Talent</Link>
          <Link to="/forum" className="hover:underline">Communauté</Link>
        </div>

        {(section.primary_cta_label || section.secondary_cta_label) && (
          <div className="mt-8 flex flex-wrap gap-3">
            <ActionLink href={section.primary_cta_url} primary>{section.primary_cta_label}</ActionLink>
            <ActionLink href={section.secondary_cta_url}>{section.secondary_cta_label}</ActionLink>
          </div>
        )}

        {visibleStats.length > 0 && (
          <dl className="mt-10 grid max-w-4xl grid-cols-2 border-y border-slate-200 sm:grid-cols-3 lg:grid-cols-5">
            {visibleStats.map(([key, label]) => (
              <div key={key} className="border-b border-slate-100 py-4 pr-4 sm:border-b-0 sm:border-r sm:last:border-r-0">
                <dd className="text-lg font-bold text-[#002050]">{stats[key]}</dd>
                <dt className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

function GoalsSection({ section }: { section: LandingSectionConfig }) {
  const items = visibleItems(section);
  if (items.length === 0) return null;
  return (
    <section id="objectifs" className="border-b border-slate-200 bg-[#F8FAFC] px-5 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeading section={section} />
        <div className="mt-8 grid border-t border-slate-300 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => {
            const Icon = ICONS[item.icon_key] || ArrowRight;
            return (
              <div key={item.id} className={`border-b border-slate-200 py-6 md:px-6 ${index % 2 === 0 ? 'md:border-r' : ''} xl:border-r`}>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#9A6A08]">
                  <Icon size={16} aria-hidden="true" />{item.label || `Objectif ${index + 1}`}
                </div>
                <h3 className="mt-3 text-lg font-bold text-[#002050]">{item.title}</h3>
                {item.description && <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>}
                {item.action_url && item.action_label && <Link to={safeHref(item.action_url)} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#002050] hover:underline">{item.action_label}<ArrowRight size={15} /></Link>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CourseList({ section, courses }: { section: LandingSectionConfig; courses: CourseCardData[] }) {
  if (courses.length === 0) return null;
  const displayed = courses.slice(0, 8);
  return (
    <section id="formations" className="border-b border-slate-200 bg-white px-5 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading section={section} />
          {section.primary_cta_url && section.primary_cta_label && <Link to={safeHref(section.primary_cta_url)} className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-[#002050] hover:underline">{section.primary_cta_label}<ArrowRight size={16} /></Link>}
        </div>
        <div className="mt-8 grid border-t border-slate-300 lg:grid-cols-2">
          {displayed.map((course, index) => {
            const external = course.content_origin === 'external';
            const href = external ? `/formation-externe/${course.id}` : `/cours/${course.id}`;
            const price = external
              ? (course.access_mode === 'premium' ? 'Accès Premium' : course.access_mode === 'registered' ? 'Après inscription' : 'Accès public')
              : course.is_free ? 'Gratuit' : `${course.price_xof.toLocaleString('fr-FR')} XOF`;
            return (
              <Link key={course.id} to={href} className={`group flex min-h-32 gap-4 border-b border-slate-200 py-5 lg:px-5 ${index % 2 === 0 ? 'lg:border-r' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{course.category || course.level}</p>
                  <h3 className="mt-1 text-base font-bold leading-6 text-[#002050] group-hover:underline">{course.title}</h3>
                  {(course.creator_name || course.provider_name) && <p className="mt-1 text-xs text-slate-500">{external ? 'Source' : 'Par'} {course.provider_name || course.creator_name}</p>}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
                    <span>{price}</span>
                    {course.duration_label && <span>{course.duration_label}</span>}
                    {course.certificate_available && <span>Certificat disponible</span>}
                  </div>
                </div>
                <ArrowRight size={17} className="mt-1 flex-none text-slate-400 transition group-hover:translate-x-1 group-hover:text-[#002050]" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function EditorialSection({ section, id }: { section: LandingSectionConfig; id?: string }) {
  const items = visibleItems(section);
  return (
    <section id={id} className="border-b border-slate-200 bg-white px-5 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <SectionHeading section={section} />
            {(section.primary_cta_label || section.secondary_cta_label) && (
              <div className="mt-6 flex flex-wrap gap-3">
                <ActionLink href={section.primary_cta_url} primary>{section.primary_cta_label}</ActionLink>
                <ActionLink href={section.secondary_cta_url}>{section.secondary_cta_label}</ActionLink>
              </div>
            )}
          </div>
          {items.length > 0 && (
            <div className="border-t border-slate-300">
              {items.map(item => {
                const Icon = ICONS[item.icon_key] || ArrowRight;
                return (
                  <div key={item.id} className="grid gap-2 border-b border-slate-200 py-5 sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:items-start">
                    <Icon size={18} className="mt-0.5 text-[#BF8813]" aria-hidden="true" />
                    <div>
                      {item.label && <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p>}
                      <h3 className="text-base font-bold text-[#002050]">{item.title}</h3>
                      {item.description && <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>}
                    </div>
                    {item.action_url && item.action_label && <Link to={safeHref(item.action_url)} className="inline-flex items-center gap-1 text-sm font-bold text-[#002050] hover:underline">{item.action_label}<ArrowRight size={14} /></Link>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PartnersSection({ section, partners }: { section: LandingSectionConfig; partners: LandingPublicPartner[] }) {
  const visible = partners.filter(partner => partner.show_homepage !== false && partner.name && partner.logo_url);
  if (visible.length === 0) return null;
  return (
    <section id="partenaires" className="border-b border-slate-200 bg-[#F8FAFC] px-5 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeading section={section} />
        <div className="mt-7 flex flex-wrap items-center gap-x-10 gap-y-6 border-y border-slate-200 py-7">
          {visible.map(partner => {
            const content = <img src={partner.logo_url || ''} alt={partner.alt_text || partner.name} loading="lazy" className="h-9 max-w-36 object-contain" />;
            return partner.website_url ? <a key={partner.id} href={partner.website_url} target="_blank" rel="noreferrer" aria-label={partner.name}>{content}</a> : <span key={partner.id}>{content}</span>;
          })}
        </div>
      </div>
    </section>
  );
}

function ConnectionsSection({ section, apps, networks }: { section: LandingSectionConfig; apps: MobileAppItem[]; networks: SocialNetworkItem[] }) {
  if (section.type === 'mobile_apps') {
    const visible = apps.filter(item => item.enabled && item.show_homepage && item.url);
    if (visible.length === 0) return null;
    return (
      <section className="border-b border-slate-200 bg-white px-5 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <SectionHeading section={section} />
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-slate-200 pt-5">
            {visible.map(item => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[#002050] hover:underline">{item.name || (item.store === 'ios' ? 'App Store' : 'Google Play')}</a>)}
          </div>
        </div>
      </section>
    );
  }

  const visible = networks.filter(item => item.enabled && item.show_homepage && item.url);
  if (visible.length === 0) return null;
  return (
    <section className="border-b border-slate-200 bg-white px-5 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeading section={section} />
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-slate-200 pt-5">
          {visible.map(item => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[#002050] hover:underline">{item.name}</a>)}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ section }: { section: LandingSectionConfig }) {
  return (
    <section id="rejoindre-omnia" className="bg-[#002050] px-5 py-12 text-white sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {section.eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E6BE63]">{section.eyebrow}</p>}
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] sm:text-3xl">{section.title}</h2>
          {section.subtitle && <p className="mt-3 text-base leading-7 text-blue-100">{section.subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          {section.primary_cta_label && <Link to={safeHref(section.primary_cta_url, '/inscription')} className="inline-flex min-h-11 items-center gap-2 bg-[#BF8813] px-5 py-3 text-sm font-bold text-white hover:bg-[#A8730F]">{section.primary_cta_label}<ArrowRight size={16} /></Link>}
          {section.secondary_cta_label && <Link to={safeHref(section.secondary_cta_url)} className="inline-flex min-h-11 items-center gap-2 border border-white/35 px-5 py-3 text-sm font-bold text-white hover:border-white">{section.secondary_cta_label}<ArrowRight size={16} /></Link>}
        </div>
      </div>
    </section>
  );
}

export function LandingExperience({ data, searchQuery, onSearchQueryChange, onSearch }: LandingExperienceProps) {
  const sections = [...data.landingPage.sections].filter(section => section.enabled).sort((a, b) => a.order - b.order);

  return (
    <main id="contenu-principal" tabIndex={-1} className="bg-white" aria-label="Contenu principal de la page d’accueil">
      {sections.map(section => {
        if (section.type === 'hero') return <HeroSection key={section.id} section={section} stats={data.stats} statsVisibility={data.statsVisibility} searchQuery={searchQuery} onSearchQueryChange={onSearchQueryChange} onSearch={onSearch} />;
        if (section.type === 'goal_selector') return <GoalsSection key={section.id} section={section} />;
        if (section.type === 'featured_courses') return <CourseList key={section.id} section={section} courses={data.featuredCourses} />;
        if (section.type === 'partners') return <PartnersSection key={section.id} section={section} partners={data.partners} />;
        if (section.type === 'mobile_apps' || section.type === 'social_networks') return <ConnectionsSection key={section.id} section={section} apps={data.mobileApps} networks={data.socialNetworks} />;
        if (section.type === 'final_cta') return <FinalCta key={section.id} section={section} />;
        if (section.type === 'omnia_journey') return <EditorialSection key={section.id} section={section} id="parcours-omnia" />;
        if (section.type === 'ecosystem') return <EditorialSection key={section.id} section={section} id="ecosysteme" />;
        if (section.type === 'credentials') return <EditorialSection key={section.id} section={section} id="preuves" />;
        if (section.type === 'career_recruitment') return <EditorialSection key={section.id} section={section} id="carriere" />;
        if (section.type === 'structures') return <EditorialSection key={section.id} section={section} id="structures" />;
        return <EditorialSection key={section.id} section={section} />;
      })}
    </main>
  );
}
