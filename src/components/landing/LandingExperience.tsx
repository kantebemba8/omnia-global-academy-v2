import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileBadge2,
  FolderKanban,
  Globe2,
  GraduationCap,
  Heart,
  Linkedin,
  MessageCircle,
  Monitor,
  Network,
  Search,
  ShieldCheck,
  Smartphone,
  Target,
  Users,
  Youtube,
  Facebook,
  Instagram,
  type LucideIcon,
} from 'lucide-react';
import { CourseCard, type CourseCardData } from '../CourseCard';
import { OmniaHeroDepthStage, OmniaJourneyDepthStage } from './OmniaDepthExperience';
import { useLandingReveals } from '../../hooks/useLandingMotion';
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

const SOCIAL_ICON_MAP: Record<string, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
  other: Globe2,
};

const CONTENT_ICON_MAP: Record<string, LucideIcon> = {
  graduation: GraduationCap,
  briefcase: Briefcase,
  book: BookOpen,
  heart: Heart,
  calendar: CalendarDays,
  users: Users,
  building: Building2,
  projects: FolderKanban,
  badge: BadgeCheck,
  target: Target,
  network: Network,
  monitor: Monitor,
  message: MessageCircle,
  certificate: FileBadge2,
  award: Award,
  clipboard: ClipboardCheck,
  shield: ShieldCheck,
  other: Globe2,
};

function visibleContentItems(section: LandingSectionConfig): LandingContentItem[] {
  return (section.items || [])
    .filter(item => item.enabled !== false && (item.title || item.label))
    .sort((a, b) => a.order - b.order);
}

function contentIcon(item: LandingContentItem): LucideIcon {
  return CONTENT_ICON_MAP[item.icon_key] || Globe2;
}


const SECTION_IDS: Partial<Record<LandingSectionConfig['type'], string>> = {
  hero: 'accueil',
  goal_selector: 'objectifs',
  omnia_journey: 'parcours-omnia',
  featured_courses: 'formations',
  ecosystem: 'ecosysteme',
  credentials: 'preuves',
  career_recruitment: 'carriere',
  structures: 'structures',
  partners: 'partenaires',
  mobile_apps: 'applications',
  social_networks: 'reseaux-sociaux',
  final_cta: 'rejoindre-omnia',
};

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function isSafePublicHref(href: string) {
  return href.startsWith('/') || href.startsWith('#') || isExternalHref(href);
}

function ActionLink({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'light';
  className?: string;
}) {
  if (!href || !children || !isSafePublicHref(href)) return null;

  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] focus-visible:ring-offset-2';
  const variants = {
    primary: 'bg-[#002050] text-white hover:bg-[#00183e]',
    secondary: 'border border-[#CBD5E1] bg-white text-[#002050] hover:border-[#BF8813]',
    light: 'border border-white/30 bg-white/10 text-white hover:bg-white/15',
  };
  const classes = `${base} ${variants[variant]} ${className}`;
  const content = <>{children}<ArrowRight className="h-4 w-4" aria-hidden="true" /></>;

  return isExternalHref(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>{content}</a>
  ) : (
    <Link to={href} className={classes}>{content}</Link>
  );
}

function SectionHeading({ section, align = 'left' }: { section: LandingSectionConfig; align?: 'left' | 'center' }) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {section.eyebrow && (
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#9A6A08]">{section.eyebrow}</p>
      )}
      <h2 className="text-3xl font-bold tracking-[-0.03em] text-[#002050] sm:text-4xl">{section.title}</h2>
      {section.subtitle && <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{section.subtitle}</p>}
      {section.body && <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{section.body}</p>}
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
  featuredCourses,
}: {
  section: LandingSectionConfig;
  stats: LandingStats;
  statsVisibility: LandingStatsVisibility;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  featuredCourses: CourseCardData[];
}) {
  const visibleStats = (
    [
      ['formations', 'Formations publiées'],
      ['apprenants', 'Apprenants'],
      ['pays', 'Pays représentés'],
      ['formateurs', 'Professeurs'],
      ['etablissements', 'Structures'],
    ] as Array<[keyof LandingStats, string]>
  ).filter(([key]) => statsVisibility[key] && stats[key]);

  return (
    <section id={SECTION_IDS.hero} aria-labelledby="oga-hero-title" data-oga-reveal className="oga-reveal relative overflow-hidden bg-[#002050] px-5 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:pb-24">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-36 top-20 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -right-16 top-40 h-72 w-72 rounded-full border border-[#BF8813]/30" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[#BF8813]/70 to-transparent" />
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-center">
        <div>
          {section.eyebrow && (
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E6BE58]">{section.eyebrow}</p>
          )}
          <h1 id="oga-hero-title" className="mt-5 max-w-4xl text-4xl font-bold leading-[1.06] tracking-[-0.045em] text-white sm:text-5xl lg:text-7xl">
            {section.title}
          </h1>
          {section.subtitle && (
            <p className="mt-6 max-w-3xl text-base leading-8 text-blue-100 sm:text-lg">{section.subtitle}</p>
          )}
          {section.body && <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-7 text-blue-100/85">{section.body}</p>}

          <div className="mt-8 flex flex-wrap gap-3">
            <ActionLink href={section.primary_cta_url} variant="secondary">{section.primary_cta_label}</ActionLink>
            <ActionLink href={section.secondary_cta_url} variant="light">{section.secondary_cta_label}</ActionLink>
          </div>

          <form onSubmit={onSearch} className="mt-8 flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm sm:flex-row">
            <label className="flex flex-1 items-center gap-3 rounded-xl bg-white px-4">
              <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="sr-only">Rechercher une formation</span>
              <input
                type="search"
                name="q"
                value={searchQuery}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchQueryChange(event.target.value)}
                placeholder={section.search_placeholder || 'Quelle compétence souhaitez-vous développer ?'}
                autoComplete="off"
                enterKeyHint="search"
                className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
            <button type="submit" className="min-h-11 rounded-xl bg-[#BF8813] px-6 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#002050]">
              {section.search_button_label || 'Rechercher'}
            </button>
          </form>

          {visibleStats.length > 0 && (
            <dl className="mt-9 flex flex-wrap gap-x-9 gap-y-5">
              {visibleStats.map(([key, label]) => (
                <div key={key}>
                  <dt className="text-xs text-blue-200">{label}</dt>
                  <dd className="mt-1 text-2xl font-bold text-white">{stats[key]}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <OmniaHeroDepthStage course={featuredCourses[0]} />
        </div>
      </div>
    </section>
  );
}

function GoalSelectorSection({ section }: { section: LandingSectionConfig }) {
  const items = visibleContentItems(section);
  const [selectedGoal, setSelectedGoal] = useState(items[0]?.id || '');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!items.some(item => item.id === selectedGoal)) setSelectedGoal(items[0]?.id || '');
  }, [items, selectedGoal]);

  if (items.length === 0) return null;
  const activeIndex = Math.max(0, items.findIndex(item => item.id === selectedGoal));
  const activeGoal = items[activeIndex] || items[0];
  const ActiveIcon = contentIcon(activeGoal);

  const activateGoal = (index: number, focus = false) => {
    const nextIndex = (index + items.length) % items.length;
    setSelectedGoal(items[nextIndex].id);
    if (focus) tabRefs.current[nextIndex]?.focus();
  };

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') activateGoal(0, true);
    else if (event.key === 'End') activateGoal(items.length - 1, true);
    else activateGoal(index + (event.key === 'ArrowDown' ? 1 : -1), true);
  };

  return (
    <section id={SECTION_IDS.goal_selector} aria-label={section.title} data-oga-reveal className="oga-reveal scroll-mt-20 bg-white px-5 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionHeading section={section} />
        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
          <div role="tablist" aria-label={section.title || 'Choisir son objectif'} aria-orientation="vertical" className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
            {items.map((goal, index) => {
              const Icon = contentIcon(goal);
              const active = goal.id === activeGoal.id;
              return (
                <button key={goal.id} ref={element => { tabRefs.current[index] = element; }} id={`goal-tab-${goal.id}`} type="button" role="tab" aria-selected={active} aria-controls={`goal-panel-${goal.id}`} tabIndex={active ? 0 : -1} onClick={() => activateGoal(index)} onKeyDown={event => handleTabKeyDown(event, index)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] focus-visible:ring-offset-2" style={{ backgroundColor: active ? '#002050' : 'transparent', color: active ? '#FFFFFF' : '#334155' }}>
                  <Icon className="h-5 w-5 shrink-0" style={{ color: active ? '#E6BE58' : '#BF8813' }} aria-hidden="true" />
                  <span className="text-sm font-semibold">{goal.label || goal.title}</span>
                  <ChevronRight className="ml-auto h-4 w-4 opacity-60" aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <div id={`goal-panel-${activeGoal.id}`} role="tabpanel" aria-labelledby={`goal-tab-${activeGoal.id}`} tabIndex={0} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] sm:p-10">
            <div aria-hidden="true" className="absolute right-0 top-0 h-40 w-40 translate-x-1/3 -translate-y-1/3 rounded-full border-[28px] border-[#BF8813]/10" />
            <div className="relative max-w-2xl">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F8F2E4] text-[#9A6A08]"><ActiveIcon className="h-6 w-6" aria-hidden="true" /></span>
              {activeGoal.label && <p className="mt-6 text-sm font-semibold text-[#9A6A08]">{activeGoal.label}</p>}
              <h3 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#002050] sm:text-3xl">{activeGoal.title}</h3>
              {activeGoal.description && <p className="mt-4 text-base leading-7 text-slate-600">{activeGoal.description}</p>}
              <ActionLink href={activeGoal.action_url} className="mt-7">{activeGoal.action_label}</ActionLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function JourneySection({ section }: { section: LandingSectionConfig }) {
  const items = visibleContentItems(section);
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(0);
  }, [activeIndex, items.length]);

  useEffect(() => {
    if (!('IntersectionObserver' in window) || items.length === 0) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      setActiveIndex(Number((visible.target as HTMLElement).dataset.journeyIndex || 0));
    }, { threshold: [0.25, 0.45, 0.65], rootMargin: '-18% 0px -34% 0px' });
    stepRefs.current.forEach(element => element && observer.observe(element));
    return () => observer.disconnect();
  }, [items.length]);

  if (items.length === 0) return null;
  const goToStep = (index: number) => {
    setActiveIndex(index);
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    stepRefs.current[index]?.scrollIntoView({ behavior, block: 'center' });
  };

  return (
    <section id={SECTION_IDS.omnia_journey} data-oga-reveal className="oga-reveal scroll-mt-20 overflow-hidden bg-[#F7F8FA] px-5 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionHeading section={section} align="center" />
        <div className="oga-journey-scroll-layout mt-14">
          <div className="oga-journey-scroll-copy">
            <nav className="oga-journey-step-nav" aria-label={section.title || 'Étapes du parcours Omnia'}>
              {items.map((step, index) => (
                <button key={step.id} type="button" onClick={() => goToStep(index)} className={index === activeIndex ? 'is-active' : ''} aria-current={index === activeIndex ? 'step' : undefined} aria-controls={`journey-step-${step.id}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span><span>{step.title || step.label}</span>
                </button>
              ))}
            </nav>
            <div className="oga-journey-step-list">
              {items.map((step, index) => {
                const Icon = contentIcon(step);
                return (
                  <article key={step.id} id={`journey-step-${step.id}`} ref={element => { stepRefs.current[index] = element; }} data-journey-index={index} aria-current={index === activeIndex ? 'step' : undefined} className={`oga-journey-step ${index === activeIndex ? 'is-active' : ''}`}>
                    <div className="oga-journey-step__number">{String(index + 1).padStart(2, '0')}</div>
                    <span className="oga-journey-step__icon"><Icon className="h-6 w-6" aria-hidden="true" /></span>
                    <p className="oga-journey-step__eyebrow">Étape {index + 1} sur {items.length}</p>
                    <h3>{step.title || step.label}</h3>
                    {step.description && <p>{step.description}</p>}
                    <ActionLink href={step.action_url} variant="secondary" className="mt-7">{step.action_label}</ActionLink>
                  </article>
                );
              })}
            </div>
          </div>
          <div className="oga-journey-scroll-stage"><div className="oga-journey-scroll-stage__sticky"><OmniaJourneyDepthStage activeIndex={Math.min(activeIndex, 4)} /></div></div>
        </div>
      </div>
    </section>
  );
}

function FeaturedCoursesSection({ section, courses }: { section: LandingSectionConfig; courses: CourseCardData[] }) {
  if (courses.length === 0) return null;

  return (
    <section id={SECTION_IDS.featured_courses} data-oga-reveal className="oga-reveal scroll-mt-20 bg-white px-5 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading section={section} />
          <ActionLink href={section.primary_cta_url} variant="secondary">{section.primary_cta_label}</ActionLink>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {courses.slice(0, 8).map(course => <CourseCard key={course.id} course={course} />)}
        </div>
      </div>
    </section>
  );
}

function EcosystemSection({ section }: { section: LandingSectionConfig }) {
  const items = visibleContentItems(section);
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => { if (activeIndex >= items.length) setActiveIndex(0); }, [activeIndex, items.length]);
  if (items.length === 0) return null;
  const active = items[activeIndex] || items[0];
  const ActiveIcon = contentIcon(active);
  const activateTab = (index: number, focus = false) => {
    const nextIndex = (index + items.length) % items.length; setActiveIndex(nextIndex); if (focus) tabRefs.current[nextIndex]?.focus();
  };
  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return; event.preventDefault();
    if (event.key === 'Home') activateTab(0, true); else if (event.key === 'End') activateTab(items.length - 1, true); else activateTab(index + (event.key === 'ArrowRight' ? 1 : -1), true);
  };
  return (
    <section id={SECTION_IDS.ecosystem} aria-label={section.title} data-oga-reveal className="oga-reveal scroll-mt-20 bg-[#F7F8FA] px-5 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-7xl"><SectionHeading section={section} />
        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label={section.title}>
            {items.map((item, index) => <button key={item.id} ref={element => { tabRefs.current[index] = element; }} id={`ecosystem-tab-${item.id}`} type="button" role="tab" aria-selected={index === activeIndex} aria-controls={`ecosystem-panel-${item.id}`} tabIndex={index === activeIndex ? 0 : -1} onClick={() => activateTab(index)} onKeyDown={event => handleTabKeyDown(event, index)} className="min-h-11 shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] focus-visible:ring-offset-2" style={{ backgroundColor: index === activeIndex ? '#002050' : '#F1F5F9', color: index === activeIndex ? '#FFFFFF' : '#475569' }}>{item.title || item.label}</button>)}
          </div>
          <div id={`ecosystem-panel-${active.id}`} role="tabpanel" aria-labelledby={`ecosystem-tab-${active.id}`} tabIndex={0} className="mt-4 grid min-h-[330px] overflow-hidden rounded-2xl bg-[#002050] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-7 sm:p-10"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#BF8813] text-white"><ActiveIcon className="h-7 w-7" aria-hidden="true" /></span><h3 className="mt-7 text-3xl font-bold text-white">{active.title || active.label}</h3>{active.description && <p className="mt-4 max-w-2xl text-base leading-8 text-blue-100">{active.description}</p>}<ActionLink href={active.action_url} variant="light" className="mt-8">{active.action_label}</ActionLink></div>
            <div className="relative hidden border-l border-white/10 lg:block" aria-hidden="true"><div className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#BF8813]/50" /><div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" /><div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#002050]"><ActiveIcon className="h-9 w-9" /></div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CredentialsSection({ section }: { section: LandingSectionConfig }) {
  const proofItems = visibleContentItems(section);
  if (proofItems.length === 0) return null;
  return (
    <section id={SECTION_IDS.credentials} data-oga-reveal className="oga-reveal scroll-mt-20 bg-white px-5 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
        <div><SectionHeading section={section} /><div className="mt-8 flex flex-wrap gap-3"><ActionLink href={section.primary_cta_url}>{section.primary_cta_label}</ActionLink><ActionLink href={section.secondary_cta_url} variant="secondary">{section.secondary_cta_label}</ActionLink></div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {proofItems.map(item => { const Icon = contentIcon(item); return <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F8F2E4] text-[#9A6A08]"><Icon className="h-5 w-5" aria-hidden="true" /></span><h3 className="mt-5 text-lg font-bold text-[#002050]">{item.title || item.label}</h3>{item.description && <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>}</article>; })}
        </div>
      </div>
    </section>
  );
}

function CareerRecruitmentSection({ section }: { section: LandingSectionConfig }) {
  const items = visibleContentItems(section);
  const group = (name: string) => items.filter(item => item.group === name);
  const talent = group('talent'); const recruiter = group('recruiter');
  if (talent.length === 0 && recruiter.length === 0) return null;
  const talentHeader = talent[0]; const recruiterHeader = recruiter[0];
  return (
    <section id={SECTION_IDS.career_recruitment} data-oga-reveal className="oga-reveal scroll-mt-20 bg-[#F7F8FA] px-5 py-20 sm:px-6 lg:py-24"><div className="mx-auto max-w-7xl"><SectionHeading section={section} align="center" /><div className="mt-10 grid gap-5 lg:grid-cols-2">
      {talent.length > 0 && <article className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9"><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#9A6A08]">{talentHeader.label || 'Pour les talents'}</span><h3 className="mt-3 text-2xl font-bold text-[#002050]">{talentHeader.title}</h3>{talentHeader.description && <p className="mt-3 text-sm leading-6 text-slate-600">{talentHeader.description}</p>}<ul className="mt-6 space-y-3">{talent.slice(1).map(item => <li key={item.id} className="flex gap-3 text-sm text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#BF8813]" aria-hidden="true" />{item.title || item.label}</li>)}</ul><ActionLink href={section.secondary_cta_url || '/emploi'} variant="secondary" className="mt-7">{section.secondary_cta_label || 'Développer ma carrière'}</ActionLink></article>}
      {recruiter.length > 0 && <article className="rounded-3xl bg-[#002050] p-7 text-white sm:p-9"><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#E6BE58]">{recruiterHeader.label || 'Pour les recruteurs'}</span><h3 className="mt-3 text-2xl font-bold">{recruiterHeader.title}</h3>{recruiterHeader.description && <p className="mt-3 text-sm leading-6 text-blue-100">{recruiterHeader.description}</p>}<ul className="mt-6 space-y-3">{recruiter.slice(1).map(item => <li key={item.id} className="flex gap-3 text-sm text-blue-100"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#E6BE58]" aria-hidden="true" />{item.title || item.label}</li>)}</ul><ActionLink href={section.primary_cta_url || '/talent'} variant="light" className="mt-7">{section.primary_cta_label || 'Découvrir Omnia Talent'}</ActionLink></article>}
    </div></div></section>
  );
}

function StructuresSection({ section }: { section: LandingSectionConfig }) {
  const features = visibleContentItems(section);
  return (
    <section id={SECTION_IDS.structures} data-oga-reveal className="oga-reveal scroll-mt-20 bg-white px-5 py-20 sm:px-6 lg:py-24"><div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-slate-200 bg-[#002050]"><div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]"><div className="p-8 sm:p-10 lg:p-12">{section.eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E6BE58]">{section.eyebrow}</p>}<h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">{section.title}</h2>{section.subtitle && <p className="mt-5 max-w-3xl text-base leading-8 text-blue-100">{section.subtitle}</p>}{section.body && <p className="mt-4 whitespace-pre-line text-sm leading-7 text-blue-100/85">{section.body}</p>}<ActionLink href={section.primary_cta_url} variant="light" className="mt-8">{section.primary_cta_label}</ActionLink></div>
      {features.length > 0 && <div className="border-t border-white/10 bg-white/[0.06] p-8 sm:p-10 lg:border-l lg:border-t-0"><ul className="space-y-4">{features.map(feature => <li key={feature.id} className="flex items-start gap-3 text-sm leading-6 text-blue-100"><Check className="mt-1 h-4 w-4 shrink-0 text-[#E6BE58]" aria-hidden="true" />{feature.title || feature.label}</li>)}</ul></div>}
    </div></div></section>
  );
}

function PartnersSection({ section, partners }: { section: LandingSectionConfig; partners: LandingPublicPartner[] }) {
  const visiblePartners = partners
    .filter(partner => partner.show_homepage && partner.logo_url && (!partner.website_url || isExternalHref(partner.website_url)))
    .sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)));

  if (visiblePartners.length === 0) return null;

  return (
    <section id={SECTION_IDS.partners} data-oga-reveal className="oga-reveal scroll-mt-20 bg-[#F7F8FA] px-5 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading section={section} align="center" />
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          {visiblePartners.map(partner => {
            const content = (
              <span className="flex min-h-24 min-w-44 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-5" title={partner.name}>
                <img src={partner.logo_url!} alt={partner.alt_text || `Logo ${partner.name}`} loading="lazy" decoding="async" className="max-h-12 max-w-40 object-contain" />
              </span>
            );
            return partner.website_url ? (
              <a key={partner.id} href={partner.website_url} target="_blank" rel="noopener noreferrer" className="transition-transform hover:-translate-y-0.5">{content}</a>
            ) : <span key={partner.id}>{content}</span>;
          })}
        </div>
      </div>
    </section>
  );
}

function MobileAppsSection({ section, apps }: { section: LandingSectionConfig; apps: MobileAppItem[] }) {
  const visibleApps = apps.filter(app => app.enabled && app.show_homepage && isExternalHref(app.url)).sort((a, b) => a.display_order - b.display_order);
  if (visibleApps.length === 0) return null;

  return (
    <section id={SECTION_IDS.mobile_apps} data-oga-reveal className="oga-reveal scroll-mt-20 bg-white px-5 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 rounded-3xl border border-slate-200 bg-[#F7F8FA] p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
        <SectionHeading section={section} />
        <div className="flex flex-wrap gap-3">
          {visibleApps.map(app => (
            <a
              key={app.id}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-52 items-center gap-3 rounded-2xl bg-[#002050] px-5 py-3.5 text-white transition-opacity hover:opacity-90"
            >
              <Smartphone className="h-6 w-6 text-[#E6BE58]" aria-hidden="true" />
              <span>
                <span className="block text-[11px] text-blue-200">Télécharger sur</span>
                <span className="block text-sm font-bold">{app.name}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function SocialNetworksSection({ section, networks }: { section: LandingSectionConfig; networks: SocialNetworkItem[] }) {
  const visibleNetworks = networks
    .filter(item => item.enabled && item.show_homepage && isExternalHref(item.url) && (item.logo_url || item.icon_key))
    .sort((a, b) => a.display_order - b.display_order);
  if (visibleNetworks.length === 0) return null;

  return (
    <section id={SECTION_IDS.social_networks} data-oga-reveal className="oga-reveal scroll-mt-20 bg-white px-5 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading section={section} align="center" />
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          {visibleNetworks.map(item => {
            const Icon = SOCIAL_ICON_MAP[item.icon_key] || Globe2;
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#002050] transition-all hover:border-[#BF8813] hover:shadow-sm"
                aria-label={item.alt_text || `${item.name} — Omnia Global Academy`}
              >
                <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-[#F8F2E4] text-[#9A6A08]">
                  {item.logo_url ? <img src={item.logo_url} alt="" loading="lazy" decoding="async" className="h-5 w-5 object-contain" /> : <Icon className="h-5 w-5" aria-hidden="true" />}
                </span>
                {item.name}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection({ section }: { section: LandingSectionConfig }) {
  return (
    <section id={SECTION_IDS.final_cta} data-oga-reveal className="oga-reveal scroll-mt-20 bg-white px-5 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#BF8813] px-7 py-12 text-center sm:px-12 sm:py-16">
        {section.eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#002050]">{section.eyebrow}</p>}
        <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">{section.title}</h2>
        {section.subtitle && <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/90">{section.subtitle}</p>}
        {section.body && <p className="mx-auto mt-4 max-w-2xl whitespace-pre-line text-sm leading-7 text-white/85">{section.body}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ActionLink href={section.primary_cta_url} variant="primary">{section.primary_cta_label}</ActionLink>
          <ActionLink href={section.secondary_cta_url} variant="secondary">{section.secondary_cta_label}</ActionLink>
        </div>
      </div>
    </section>
  );
}

function CustomTextSection({ section }: { section: LandingSectionConfig }) {
  return (
    <section data-oga-reveal className="oga-reveal bg-white px-5 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-[#F7F8FA] p-8 sm:p-10">
        <SectionHeading section={section} />
        <div className="mt-7 flex flex-wrap gap-3">
          <ActionLink href={section.primary_cta_url}>{section.primary_cta_label}</ActionLink>
          <ActionLink href={section.secondary_cta_url} variant="secondary">{section.secondary_cta_label}</ActionLink>
        </div>
      </div>
    </section>
  );
}

export function LandingExperience({ data, searchQuery, onSearchQueryChange, onSearch }: LandingExperienceProps) {
  const sections = useMemo(
    () => data.landingPage.sections.filter(section => section.enabled).sort((a, b) => a.order - b.order),
    [data.landingPage.sections],
  );
  const mainRef = useRef<HTMLElement>(null);
  const revealKey = `${sections.map(section => section.id).join('|')}|${data.featuredCourses.length}|${data.partners.length}|${data.mobileApps.length}|${data.socialNetworks.length}`;
  useLandingReveals(mainRef, revealKey);

  return (
    <main id="contenu-principal" ref={mainRef} tabIndex={-1} aria-label="Contenu principal de la page d’accueil">
      {sections.map(section => {
        switch (section.type) {
          case 'hero':
            return <HeroSection key={section.id} section={section} stats={data.stats} statsVisibility={data.statsVisibility} searchQuery={searchQuery} onSearchQueryChange={onSearchQueryChange} onSearch={onSearch} featuredCourses={data.featuredCourses} />;
          case 'goal_selector':
            return <GoalSelectorSection key={section.id} section={section} />;
          case 'omnia_journey':
            return <JourneySection key={section.id} section={section} />;
          case 'featured_courses':
            return <FeaturedCoursesSection key={section.id} section={section} courses={data.featuredCourses} />;
          case 'ecosystem':
            return <EcosystemSection key={section.id} section={section} />;
          case 'credentials':
            return <CredentialsSection key={section.id} section={section} />;
          case 'career_recruitment':
            return <CareerRecruitmentSection key={section.id} section={section} />;
          case 'structures':
            return <StructuresSection key={section.id} section={section} />;
          case 'partners':
            return <PartnersSection key={section.id} section={section} partners={data.partners} />;
          case 'mobile_apps':
            return <MobileAppsSection key={section.id} section={section} apps={data.mobileApps} />;
          case 'social_networks':
            return <SocialNetworksSection key={section.id} section={section} networks={data.socialNetworks} />;
          case 'final_cta':
            return <FinalCtaSection key={section.id} section={section} />;
          case 'custom_text':
            return <CustomTextSection key={section.id} section={section} />;
          default:
            return null;
        }
      })}
    </main>
  );
}
