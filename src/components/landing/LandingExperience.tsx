import {
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
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
  ClipboardCheck,
  Facebook,
  FileBadge2,
  FolderKanban,
  Globe2,
  GraduationCap,
  Heart,
  Instagram,
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
  type LucideIcon,
} from 'lucide-react';
import { CourseCard, type CourseCardData } from '../CourseCard';
import { OmniaHeroDepthStage, OmniaJourneyDepthStage } from './OmniaDepthExperience';
import { useEnhancedLandingMotion, useLandingReveals } from '../../hooks/useLandingMotion';
import type {
  LandingContentItem,
  LandingPageConfig,
  LandingSectionConfig,
  LandingSectionType,
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

const SECTION_IDS: Partial<Record<LandingSectionType, string>> = {
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

const IMPACT_TYPES: LandingSectionType[] = [
  'ecosystem',
  'credentials',
  'career_recruitment',
  'structures',
];

const CONNECTION_TYPES: LandingSectionType[] = [
  'partners',
  'mobile_apps',
  'social_networks',
  'final_cta',
];

function visibleContentItems(section: LandingSectionConfig | undefined): LandingContentItem[] {
  if (!section) return [];
  return (section.items || [])
    .filter(item => item.enabled !== false && (item.title || item.label))
    .sort((a, b) => a.order - b.order);
}

function contentIcon(item: LandingContentItem): LucideIcon {
  return CONTENT_ICON_MAP[item.icon_key] || Globe2;
}

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
  variant?: 'primary' | 'secondary' | 'light' | 'gold';
  className?: string;
}) {
  if (!href || !children || !isSafePublicHref(href)) return null;

  const base = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] focus-visible:ring-offset-2';
  const variants = {
    primary: 'bg-[#002050] text-white hover:-translate-y-0.5 hover:bg-[#00183e] hover:shadow-lg',
    secondary: 'border border-[#CBD5E1] bg-white text-[#002050] hover:-translate-y-0.5 hover:border-[#BF8813] hover:shadow-md',
    light: 'border border-white/30 bg-white/10 text-white hover:-translate-y-0.5 hover:bg-white/15',
    gold: 'bg-[#BF8813] text-white hover:-translate-y-0.5 hover:bg-[#A8730F] hover:shadow-lg',
  };
  const classes = `${base} ${variants[variant]} ${className}`;
  const content = <>{children}<ArrowRight className="h-4 w-4" aria-hidden="true" /></>;

  return isExternalHref(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>{content}</a>
  ) : (
    <Link to={href} className={classes}>{content}</Link>
  );
}

function SectionHeading({
  section,
  align = 'left',
  compact = false,
}: {
  section: LandingSectionConfig;
  align?: 'left' | 'center';
  compact?: boolean;
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {section.eyebrow && (
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#9A6A08]">{section.eyebrow}</p>
      )}
      <h2 className={`${compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'} font-bold tracking-[-0.035em] text-[#002050]`}>
        {section.title}
      </h2>
      {section.subtitle && (
        <p className={`${compact ? 'mt-3 text-sm leading-6' : 'mt-4 text-base leading-7 sm:text-lg'} text-slate-600`}>
          {section.subtitle}
        </p>
      )}
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
      ['formations', 'Formations'],
      ['apprenants', 'Apprenants'],
      ['pays', 'Pays'],
      ['formateurs', 'Professeurs'],
      ['etablissements', 'Structures'],
    ] as Array<[keyof LandingStats, string]>
  ).filter(([key]) => statsVisibility[key] && stats[key]);

  return (
    <section
      id={SECTION_IDS.hero}
      aria-labelledby="oga-hero-title"
      data-oga-reveal
      className="oga-reveal oga-premium-hero relative overflow-hidden bg-[#002050] px-5 pb-14 pt-24 sm:px-6 sm:pb-16 sm:pt-28"
    >
      <div aria-hidden="true" className="oga-premium-hero__backdrop">
        <span className="oga-premium-hero__aurora oga-premium-hero__aurora--one" />
        <span className="oga-premium-hero__aurora oga-premium-hero__aurora--two" />
        <span className="oga-premium-hero__line" />
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,0.94fr)_minmax(440px,1.06fr)] lg:items-center">
        <div className="relative z-10">
          {section.eyebrow && (
            <div className="oga-hero-kicker">
              <span className="oga-hero-kicker__pulse" aria-hidden="true" />
              <span>{section.eyebrow}</span>
            </div>
          )}

          <h1 id="oga-hero-title" className="mt-5 max-w-4xl text-4xl font-bold leading-[1.04] tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl xl:text-[4.5rem]">
            {section.title}
          </h1>

          {section.subtitle && (
            <p className="mt-5 max-w-3xl text-base leading-7 text-blue-100 sm:text-lg sm:leading-8">
              {section.subtitle}
            </p>
          )}

          {section.body && (
            <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-blue-100/80">{section.body}</p>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <ActionLink href={section.primary_cta_url} variant="gold">{section.primary_cta_label}</ActionLink>
            <ActionLink href={section.secondary_cta_url} variant="light">{section.secondary_cta_label}</ActionLink>
          </div>

          <form onSubmit={onSearch} className="oga-premium-search mt-7 flex max-w-3xl flex-col gap-2 rounded-2xl border border-white/15 bg-white/10 p-2 backdrop-blur-md sm:flex-row">
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
            <button
              type="submit"
              className="min-h-11 rounded-xl bg-[#BF8813] px-6 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#A8730F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#002050]"
            >
              {section.search_button_label || 'Rechercher'}
            </button>
          </form>

          <div className="oga-learning-signals mt-7" aria-label="Le parcours Omnia">
            <span><BookOpen className="h-4 w-4" aria-hidden="true" />Apprendre</span>
            <span><FolderKanban className="h-4 w-4" aria-hidden="true" />Pratiquer</span>
            <span><BadgeCheck className="h-4 w-4" aria-hidden="true" />Prouver</span>
            <span><Briefcase className="h-4 w-4" aria-hidden="true" />Avancer</span>
          </div>

          {visibleStats.length > 0 && (
            <dl className="oga-premium-stats mt-7">
              {visibleStats.map(([key, label]) => (
                <div key={key}>
                  <dd>{stats[key]}</dd>
                  <dt>{label}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
          <OmniaHeroDepthStage course={featuredCourses[0]} />
        </div>
      </div>
    </section>
  );
}

function LearningCompassSection({
  goalSection,
  journeySection,
}: {
  goalSection?: LandingSectionConfig;
  journeySection?: LandingSectionConfig;
}) {
  const goals = visibleContentItems(goalSection);
  const steps = visibleContentItems(journeySection);
  const [selectedGoal, setSelectedGoal] = useState(goals[0]?.id || '');
  const [activeStep, setActiveStep] = useState(0);
  const goalRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const enhancedMotion = useEnhancedLandingMotion();

  useEffect(() => {
    if (!goals.some(goal => goal.id === selectedGoal)) setSelectedGoal(goals[0]?.id || '');
  }, [goals, selectedGoal]);

  useEffect(() => {
    if (activeStep >= Math.max(steps.length, 1)) setActiveStep(0);
  }, [activeStep, steps.length]);

  useEffect(() => {
    if (!enhancedMotion || steps.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setActiveStep(current => (current + 1) % steps.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [enhancedMotion, steps.length]);

  const activeGoalIndex = Math.max(0, goals.findIndex(goal => goal.id === selectedGoal));
  const activeGoal = goals[activeGoalIndex] || goals[0];
  const activeJourney = steps[activeStep] || steps[0];
  const ActiveGoalIcon = activeGoal ? contentIcon(activeGoal) : GraduationCap;
  const ActiveStepIcon = activeJourney ? contentIcon(activeJourney) : BookOpen;

  const activateGoal = (index: number, focus = false) => {
    if (goals.length === 0) return;
    const nextIndex = (index + goals.length) % goals.length;
    setSelectedGoal(goals[nextIndex].id);
    if (focus) goalRefs.current[nextIndex]?.focus();
  };

  const handleGoalKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') activateGoal(0, true);
    else if (event.key === 'End') activateGoal(goals.length - 1, true);
    else activateGoal(index + (event.key === 'ArrowRight' ? 1 : -1), true);
  };

  if (!goalSection && !journeySection) return null;

  const headingSection = goalSection || journeySection!;

  return (
    <section
      id={SECTION_IDS.goal_selector}
      data-oga-reveal
      className="oga-reveal oga-learning-compass relative scroll-mt-20 overflow-hidden bg-[#F5F7FB] px-5 py-14 sm:px-6 lg:py-16"
    >
      <span id={SECTION_IDS.omnia_journey} className="absolute left-0 top-0 scroll-mt-20" aria-hidden="true" />
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(420px,1.18fr)] lg:items-end">
          <div>
            <SectionHeading section={headingSection} />
            {goals.length > 0 && (
              <div
                role="tablist"
                aria-label={goalSection?.title || 'Choisir son objectif'}
                className="oga-goal-pills mt-7"
              >
                {goals.map((goal, index) => {
                  const Icon = contentIcon(goal);
                  const active = goal.id === activeGoal?.id;
                  return (
                    <button
                      key={goal.id}
                      ref={(element: HTMLButtonElement | null) => { goalRefs.current[index] = element; }}
                      id={`goal-tab-${goal.id}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls={`goal-panel-${goal.id}`}
                      tabIndex={active ? 0 : -1}
                      onClick={() => activateGoal(index)}
                      onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => handleGoalKeyDown(event, index)}
                      className={active ? 'is-active' : ''}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{goal.label || goal.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {steps.length > 0 && (
            <div className="oga-journey-rail" aria-label={journeySection?.title || 'Parcours Omnia'}>
              {steps.slice(0, 5).map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={index === activeStep ? 'is-active' : ''}
                  aria-current={index === activeStep ? 'step' : undefined}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{step.title || step.label}</strong>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="oga-compass-panel mt-8">
          <div className="oga-compass-panel__copy">
            {activeGoal && (
              <div
                id={`goal-panel-${activeGoal.id}`}
                role="tabpanel"
                aria-labelledby={`goal-tab-${activeGoal.id}`}
                tabIndex={0}
                className="focus-visible:outline-none"
              >
                <span className="oga-compass-icon"><ActiveGoalIcon className="h-6 w-6" aria-hidden="true" /></span>
                {activeGoal.label && <p className="oga-compass-eyebrow">{activeGoal.label}</p>}
                <h3>{activeGoal.title}</h3>
                {activeGoal.description && <p className="oga-compass-description">{activeGoal.description}</p>}
                <ActionLink href={activeGoal.action_url} className="mt-6">{activeGoal.action_label}</ActionLink>
              </div>
            )}

            {activeJourney && (
              <div className="oga-active-milestone">
                <span><ActiveStepIcon className="h-4 w-4" aria-hidden="true" />Étape {activeStep + 1}</span>
                <strong>{activeJourney.title || activeJourney.label}</strong>
                {activeJourney.description && <p>{activeJourney.description}</p>}
                <ActionLink href={activeJourney.action_url} variant="secondary" className="mt-4">
                  {activeJourney.action_label}
                </ActionLink>
              </div>
            )}
          </div>

          {steps.length > 0 && (
            <div className="oga-compass-panel__stage">
              <OmniaJourneyDepthStage activeIndex={Math.min(activeStep, 4)} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FeaturedCoursesSection({
  section,
  courses,
}: {
  section: LandingSectionConfig;
  courses: CourseCardData[];
}) {
  if (courses.length === 0) return null;

  return (
    <section
      id={SECTION_IDS.featured_courses}
      data-oga-reveal
      className="oga-reveal scroll-mt-20 bg-white px-5 py-14 sm:px-6 lg:py-16"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading section={section} compact />
          <ActionLink href={section.primary_cta_url} variant="secondary">{section.primary_cta_label}</ActionLink>
        </div>

        <div className="oga-course-rail mt-8">
          {courses.slice(0, 4).map(course => (
            <div key={course.id} className="oga-course-rail__item">
              <CourseCard course={course} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EcosystemPanel({ section }: { section: LandingSectionConfig }) {
  const items = visibleContentItems(section);
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(0);
  }, [activeIndex, items.length]);

  if (items.length === 0) return null;
  const active = items[activeIndex] || items[0];
  const ActiveIcon = contentIcon(active);

  const activate = (index: number, focus = false) => {
    const next = (index + items.length) % items.length;
    setActiveIndex(next);
    if (focus) tabRefs.current[next]?.focus();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') activate(0, true);
    else if (event.key === 'End') activate(items.length - 1, true);
    else activate(index + (event.key === 'ArrowRight' ? 1 : -1), true);
  };

  return (
    <div className="oga-impact-ecosystem">
      <div role="tablist" aria-label={section.title} className="oga-module-tabs">
        {items.map((item, index) => {
          const Icon = contentIcon(item);
          return (
            <button
              key={item.id}
              ref={(element: HTMLButtonElement | null) => { tabRefs.current[index] = element; }}
              id={`module-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-controls={`module-panel-${item.id}`}
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => activate(index)}
              onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => handleKeyDown(event, index)}
              className={index === activeIndex ? 'is-active' : ''}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.title || item.label}</span>
            </button>
          );
        })}
      </div>

      <div
        id={`module-panel-${active.id}`}
        role="tabpanel"
        aria-labelledby={`module-tab-${active.id}`}
        tabIndex={0}
        className="oga-module-panel focus-visible:outline-none"
      >
        <div>
          <span className="oga-module-panel__icon"><ActiveIcon className="h-7 w-7" aria-hidden="true" /></span>
          <h3>{active.title || active.label}</h3>
          {active.description && <p>{active.description}</p>}
          <ActionLink href={active.action_url} variant="light" className="mt-6">{active.action_label}</ActionLink>
        </div>
        <div className="oga-module-orbit" aria-hidden="true">
          <span className="oga-module-orbit__core"><ActiveIcon className="h-8 w-8" /></span>
          {items.slice(0, 6).map((item, index) => {
            const Icon = contentIcon(item);
            return <span key={item.id} className={`oga-module-orbit__node oga-module-orbit__node--${index + 1}`}><Icon className="h-4 w-4" /></span>;
          })}
        </div>
      </div>
    </div>
  );
}

function CredentialsPanel({ section }: { section: LandingSectionConfig }) {
  const items = visibleContentItems(section);
  return (
    <div className="oga-proof-grid">
      {items.slice(0, 4).map(item => {
        const Icon = contentIcon(item);
        return (
          <article key={item.id} className="oga-proof-card">
            <span><Icon className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <h3>{item.title || item.label}</h3>
              {item.description && <p>{item.description}</p>}
            </div>
          </article>
        );
      })}
      <div className="oga-proof-action">
        <ActionLink href={section.primary_cta_url}>{section.primary_cta_label}</ActionLink>
        <ActionLink href={section.secondary_cta_url} variant="secondary">{section.secondary_cta_label}</ActionLink>
      </div>
    </div>
  );
}

function CareerPanel({ section }: { section: LandingSectionConfig }) {
  const items = visibleContentItems(section);
  const talent = items.filter(item => item.group === 'talent');
  const recruiter = items.filter(item => item.group === 'recruiter');
  const talentHeader = talent[0];
  const recruiterHeader = recruiter[0];

  return (
    <div className="oga-career-split">
      {talent.length > 0 && (
        <article className="oga-career-card oga-career-card--light">
          <span>{talentHeader?.label || 'Pour les talents'}</span>
          <h3>{talentHeader?.title}</h3>
          {talentHeader?.description && <p>{talentHeader.description}</p>}
          <ul>
            {talent.slice(1, 5).map(item => <li key={item.id}><Check className="h-4 w-4" aria-hidden="true" />{item.title || item.label}</li>)}
          </ul>
          <ActionLink href={section.secondary_cta_url || '/emploi'} variant="secondary" className="mt-5">
            {section.secondary_cta_label || 'Découvrir Omnia Career'}
          </ActionLink>
        </article>
      )}

      {recruiter.length > 0 && (
        <article className="oga-career-card oga-career-card--dark">
          <span>{recruiterHeader?.label || 'Pour les recruteurs'}</span>
          <h3>{recruiterHeader?.title}</h3>
          {recruiterHeader?.description && <p>{recruiterHeader.description}</p>}
          <ul>
            {recruiter.slice(1, 5).map(item => <li key={item.id}><Check className="h-4 w-4" aria-hidden="true" />{item.title || item.label}</li>)}
          </ul>
          <ActionLink href={section.primary_cta_url || '/talent'} variant="light" className="mt-5">
            {section.primary_cta_label || 'Découvrir Omnia Talent'}
          </ActionLink>
        </article>
      )}
    </div>
  );
}

function StructuresPanel({ section }: { section: LandingSectionConfig }) {
  const items = visibleContentItems(section);
  return (
    <div className="oga-structure-panel">
      <div className="oga-structure-panel__visual" aria-hidden="true">
        <span className="oga-structure-building"><Building2 className="h-9 w-9" /></span>
        <span className="oga-structure-node oga-structure-node--one"><Users className="h-4 w-4" /></span>
        <span className="oga-structure-node oga-structure-node--two"><BookOpen className="h-4 w-4" /></span>
        <span className="oga-structure-node oga-structure-node--three"><ShieldCheck className="h-4 w-4" /></span>
      </div>
      <div>
        <div className="oga-structure-list">
          {items.slice(0, 6).map(item => (
            <span key={item.id}><Check className="h-4 w-4" aria-hidden="true" />{item.title || item.label}</span>
          ))}
        </div>
        <ActionLink href={section.primary_cta_url} variant="light" className="mt-6">{section.primary_cta_label}</ActionLink>
      </div>
    </div>
  );
}

function ImpactHubSection({ sections }: { sections: LandingSectionConfig[] }) {
  const ordered = useMemo(() => sections.slice().sort((a, b) => a.order - b.order), [sections]);
  const [activeType, setActiveType] = useState<LandingSectionType>(ordered[0]?.type || 'ecosystem');

  useEffect(() => {
    if (!ordered.some(section => section.type === activeType)) setActiveType(ordered[0]?.type || 'ecosystem');
  }, [activeType, ordered]);

  useEffect(() => {
    const activateFromHash = () => {
      const hash = window.location.hash.slice(1);
      const matched = ordered.find(section => SECTION_IDS[section.type] === hash);
      if (matched) setActiveType(matched.type);
    };
    activateFromHash();
    window.addEventListener('hashchange', activateFromHash);
    return () => window.removeEventListener('hashchange', activateFromHash);
  }, [ordered]);

  if (ordered.length === 0) return null;
  const active = ordered.find(section => section.type === activeType) || ordered[0];

  return (
    <section data-oga-reveal className="oga-reveal oga-impact-hub relative overflow-hidden bg-[#071B3D] px-5 py-14 sm:px-6 lg:py-16">
      {ordered.map(section => (
        <span key={section.type} id={SECTION_IDS[section.type]} className="absolute left-0 top-0 scroll-mt-20" aria-hidden="true" />
      ))}

      <div className="mx-auto max-w-7xl">
        <div className="oga-impact-hub__header">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E6BE58]">L’écosystème Omnia</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl">
              Apprendre devient une expérience complète.
            </h2>
          </div>

          <div role="tablist" aria-label="Explorer l’écosystème Omnia" className="oga-impact-tabs">
            {ordered.map(section => (
              <button
                key={section.type}
                type="button"
                role="tab"
                aria-selected={section.type === active.type}
                onClick={() => setActiveType(section.type)}
                className={section.type === active.type ? 'is-active' : ''}
              >
                {section.internal_name || section.title}
              </button>
            ))}
          </div>
        </div>

        <div className="oga-impact-panel mt-7" role="tabpanel" tabIndex={0}>
          <div className="oga-impact-panel__heading">
            {active.eyebrow && <p>{active.eyebrow}</p>}
            <h3>{active.title}</h3>
            {active.subtitle && <span>{active.subtitle}</span>}
            {active.body && <span>{active.body}</span>}
          </div>

          <div className="oga-impact-panel__content">
            {active.type === 'ecosystem' && <EcosystemPanel section={active} />}
            {active.type === 'credentials' && <CredentialsPanel section={active} />}
            {active.type === 'career_recruitment' && <CareerPanel section={active} />}
            {active.type === 'structures' && <StructuresPanel section={active} />}
          </div>
        </div>
      </div>
    </section>
  );
}

function ConnectionsDockSection({
  sections,
  partners,
  apps,
  networks,
}: {
  sections: LandingSectionConfig[];
  partners: LandingPublicPartner[];
  apps: MobileAppItem[];
  networks: SocialNetworkItem[];
}) {
  const byType = new Map(sections.map(section => [section.type, section]));
  const partnerSection = byType.get('partners');
  const appSection = byType.get('mobile_apps');
  const socialSection = byType.get('social_networks');
  const ctaSection = byType.get('final_cta');

  const visiblePartners = partnerSection
    ? partners
        .filter(partner => partner.show_homepage && partner.logo_url && (!partner.website_url || isExternalHref(partner.website_url)))
        .sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)))
    : [];

  const visibleApps = appSection
    ? apps
        .filter(app => app.enabled && app.show_homepage && isExternalHref(app.url))
        .sort((a, b) => a.display_order - b.display_order)
    : [];

  const visibleNetworks = socialSection
    ? networks
        .filter(item => item.enabled && item.show_homepage && isExternalHref(item.url) && (item.logo_url || item.icon_key))
        .sort((a, b) => a.display_order - b.display_order)
    : [];

  if (!ctaSection && visiblePartners.length === 0 && visibleApps.length === 0 && visibleNetworks.length === 0) return null;

  return (
    <section data-oga-reveal className="oga-reveal oga-connections-dock relative bg-white px-5 py-14 sm:px-6 lg:py-16">
      {sections.map(section => (
        <span key={section.type} id={SECTION_IDS[section.type]} className="absolute left-0 top-0 scroll-mt-20" aria-hidden="true" />
      ))}

      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#002050] shadow-[0_30px_80px_rgba(0,32,80,0.18)]">
        {ctaSection && (
          <div className="oga-connections-dock__cta">
            <div>
              {ctaSection.eyebrow && <p>{ctaSection.eyebrow}</p>}
              <h2>{ctaSection.title}</h2>
              {ctaSection.subtitle && <span>{ctaSection.subtitle}</span>}
              {ctaSection.body && <span>{ctaSection.body}</span>}
            </div>
            <div className="flex flex-wrap gap-3">
              <ActionLink href={ctaSection.primary_cta_url} variant="gold">{ctaSection.primary_cta_label}</ActionLink>
              <ActionLink href={ctaSection.secondary_cta_url} variant="light">{ctaSection.secondary_cta_label}</ActionLink>
            </div>
          </div>
        )}

        {(visiblePartners.length > 0 || visibleApps.length > 0 || visibleNetworks.length > 0) && (
          <div className="oga-connections-dock__resources">
            {visiblePartners.length > 0 && (
              <div className="oga-compact-resource oga-compact-resource--partners">
                <div>
                  <p>{partnerSection?.eyebrow || 'Partenaires'}</p>
                  <h3>{partnerSection?.title}</h3>
                </div>
                <div className="oga-partner-strip">
                  {visiblePartners.map(partner => {
                    const logo = (
                      <span title={partner.name}>
                        <img
                          src={partner.logo_url!}
                          alt={partner.alt_text || `Logo ${partner.name}`}
                          loading="lazy"
                          decoding="async"
                        />
                      </span>
                    );
                    return partner.website_url ? (
                      <a key={partner.id} href={partner.website_url} target="_blank" rel="noopener noreferrer">{logo}</a>
                    ) : <span key={partner.id}>{logo}</span>;
                  })}
                </div>
              </div>
            )}

            {(visibleApps.length > 0 || visibleNetworks.length > 0) && (
              <div className="oga-channel-row">
                {visibleApps.length > 0 && (
                  <div className="oga-compact-resource">
                    <div>
                      <p>{appSection?.eyebrow || 'Applications'}</p>
                      <h3>{appSection?.title}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {visibleApps.map(app => (
                        <a key={app.id} href={app.url} target="_blank" rel="noopener noreferrer" className="oga-app-button">
                          <Smartphone className="h-5 w-5" aria-hidden="true" />
                          <span><small>Télécharger</small><strong>{app.name}</strong></span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {visibleNetworks.length > 0 && (
                  <div className="oga-compact-resource">
                    <div>
                      <p>{socialSection?.eyebrow || 'Réseaux officiels'}</p>
                      <h3>{socialSection?.title}</h3>
                    </div>
                    <div className="oga-social-strip">
                      {visibleNetworks.map(item => {
                        const Icon = SOCIAL_ICON_MAP[item.icon_key] || Globe2;
                        return (
                          <a
                            key={item.id}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={item.alt_text || `${item.name} — Omnia Global Academy`}
                            title={item.name}
                          >
                            {item.logo_url
                              ? <img src={item.logo_url} alt="" loading="lazy" decoding="async" />
                              : <Icon className="h-5 w-5" aria-hidden="true" />}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function CustomTextSection({ section }: { section: LandingSectionConfig }) {
  return (
    <section data-oga-reveal className="oga-reveal bg-white px-5 py-10 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-[#F7F8FA] p-7 sm:p-9">
        <SectionHeading section={section} compact />
        <div className="mt-6 flex flex-wrap gap-3">
          <ActionLink href={section.primary_cta_url}>{section.primary_cta_label}</ActionLink>
          <ActionLink href={section.secondary_cta_url} variant="secondary">{section.secondary_cta_label}</ActionLink>
        </div>
      </div>
    </section>
  );
}

type RenderGroup = {
  key: string;
  order: number;
  element: ReactNode;
};

export function LandingExperience({
  data,
  searchQuery,
  onSearchQueryChange,
  onSearch,
}: LandingExperienceProps) {
  const sections = useMemo(
    () => data.landingPage.sections.filter(section => section.enabled).sort((a, b) => a.order - b.order),
    [data.landingPage.sections],
  );

  const sectionByType = useMemo(
    () => new Map(sections.map(section => [section.type, section])),
    [sections],
  );

  const groups = useMemo<RenderGroup[]>(() => {
    const result: RenderGroup[] = [];
    const hero = sectionByType.get('hero');
    const goal = sectionByType.get('goal_selector');
    const journey = sectionByType.get('omnia_journey');
    const courses = sectionByType.get('featured_courses');
    const impactSections = sections.filter(section => IMPACT_TYPES.includes(section.type));
    const connectionSections = sections.filter(section => CONNECTION_TYPES.includes(section.type));
    const customSections = sections.filter(section => section.type === 'custom_text');

    if (hero) {
      result.push({
        key: 'hero',
        order: hero.order,
        element: (
          <HeroSection
            section={hero}
            stats={data.stats}
            statsVisibility={data.statsVisibility}
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            onSearch={onSearch}
            featuredCourses={data.featuredCourses}
          />
        ),
      });
    }

    if (goal || journey) {
      result.push({
        key: 'learning-compass',
        order: Math.min(goal?.order ?? Number.MAX_SAFE_INTEGER, journey?.order ?? Number.MAX_SAFE_INTEGER),
        element: <LearningCompassSection goalSection={goal} journeySection={journey} />,
      });
    }

    if (courses) {
      result.push({
        key: 'courses',
        order: courses.order,
        element: <FeaturedCoursesSection section={courses} courses={data.featuredCourses} />,
      });
    }

    if (impactSections.length > 0) {
      result.push({
        key: 'impact-hub',
        order: Math.min(...impactSections.map(section => section.order)),
        element: <ImpactHubSection sections={impactSections} />,
      });
    }

    customSections.forEach(section => {
      result.push({
        key: section.id,
        order: section.order,
        element: <CustomTextSection section={section} />,
      });
    });

    if (connectionSections.length > 0) {
      result.push({
        key: 'connections',
        order: Math.min(...connectionSections.map(section => section.order)),
        element: (
          <ConnectionsDockSection
            sections={connectionSections}
            partners={data.partners}
            apps={data.mobileApps}
            networks={data.socialNetworks}
          />
        ),
      });
    }

    return result.sort((a, b) => a.order - b.order);
  }, [
    data.featuredCourses,
    data.mobileApps,
    data.partners,
    data.socialNetworks,
    data.stats,
    data.statsVisibility,
    onSearch,
    onSearchQueryChange,
    searchQuery,
    sectionByType,
    sections,
  ]);

  const mainRef = useRef<HTMLElement>(null);
  const revealKey = `${groups.map(group => group.key).join('|')}|${data.featuredCourses.length}|${data.partners.length}|${data.mobileApps.length}|${data.socialNetworks.length}`;
  useLandingReveals(mainRef, revealKey);

  return (
    <main id="contenu-principal" ref={mainRef} tabIndex={-1} aria-label="Contenu principal de la page d’accueil">
      {groups.map(group => <Fragment key={group.key}>{group.element}</Fragment>)}
    </main>
  );
}
