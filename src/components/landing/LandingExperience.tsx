import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileBadge2,
  GraduationCap,
  Heart,
  MessageCircle,
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


const ICONS: Record<string, LucideIcon> = {
  graduation: GraduationCap,
  briefcase: Briefcase,
  book: BookOpen,
  heart: Heart,
  calendar: CalendarDays,
  users: Users,
  building: Building2,
  projects: Target,
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

function actionFor(item: LandingContentItem) {
  if (!item.action_url || !item.action_label) return null;
  return (
    <Link to={safeHref(item.action_url)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#002050] hover:underline">
      {item.action_label}<ArrowRight size={15} />
    </Link>
  );
}

function FuturisticHeroArt() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#ffffff_0%,#fcfdff_34%,#f5f9ff_48%,#e7f0fd_61%,#d2e3fb_72%,#a8c6f2_84%,#5F97E2_100%)]" />
      <div className="absolute inset-y-0 right-0 w-[63%] bg-[radial-gradient(circle_at_76%_52%,rgba(23,91,195,0.88)_0%,rgba(39,108,211,0.72)_24%,rgba(108,160,233,0.50)_50%,rgba(205,225,250,0.24)_70%,transparent_86%)]" />
      <div className="absolute inset-y-0 right-0 w-[67%] opacity-[0.26]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.13) 1px, transparent 1px)', backgroundSize: '34px 34px', maskImage: 'radial-gradient(circle at 78% 53%, black 0%, rgba(0,0,0,.92) 42%, transparent 81%)' }} />
      <div className="absolute right-[-12%] top-[24%] h-[320px] w-[320px] rounded-full border border-white/22 bg-[radial-gradient(circle_at_34%_32%,rgba(100,162,246,0.92),rgba(31,95,194,0.90)_32%,rgba(11,63,149,0.96)_58%,#093985_74%,#0B3F95_100%)] shadow-[inset_-32px_-42px_66px_rgba(2,20,59,0.34),inset_24px_18px_40px_rgba(194,221,255,0.20),0_0_88px_rgba(66,125,220,0.22)] lg:h-[400px] lg:w-[400px]" />
      <div className="absolute right-[-5%] top-[27%] h-[276px] w-[276px] rounded-full border border-[#E9C164]/70 shadow-[0_0_18px_rgba(233,193,100,0.18)] lg:h-[344px] lg:w-[344px]" />
      <div className="absolute right-[19%] top-[45%] h-4 w-4 rounded-full bg-[#FAD26D] shadow-[0_0_24px_7px_rgba(250,210,109,0.82)]" />
      <div className="absolute right-[23%] top-[40%] h-20 w-20 rounded-full bg-[#F8D279]/24 blur-3xl" />
      <svg className="absolute inset-y-0 right-0 h-full w-[76%] min-w-[740px]" viewBox="0 0 1120 560" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ogaHeroGold" x1="88" y1="132" x2="1060" y2="354" gradientUnits="userSpaceOnUse">
            <stop stopColor="#BF8813" stopOpacity="0" />
            <stop offset="0.34" stopColor="#D9A646" stopOpacity="0.52" />
            <stop offset="0.53" stopColor="#FFF2C1" stopOpacity="0.96" />
            <stop offset="0.72" stopColor="#DDAA3E" stopOpacity="0.58" />
            <stop offset="1" stopColor="#BF8813" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="ogaHeroWhite" x1="184" y1="376" x2="1022" y2="144" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" stopOpacity="0" />
            <stop offset="0.46" stopColor="white" stopOpacity="0.82" />
            <stop offset="1" stopColor="white" stopOpacity="0.10" />
          </linearGradient>
          <filter id="ogaHeroGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <path d="M62 424C240 332 333 321 486 266C622 216 677 128 844 138C945 145 1011 184 1110 174" stroke="url(#ogaHeroGold)" strokeWidth="1.95" />
        <path d="M14 388C220 297 347 309 511 230C643 167 706 90 859 106C955 116 1020 149 1126 134" stroke="url(#ogaHeroWhite)" strokeWidth="1.92" />
        <path d="M120 472C300 382 406 394 571 308C693 245 751 214 871 221C955 226 1024 251 1123 238" stroke="#D7A33D" strokeOpacity="0.34" strokeWidth="1.3" />
        <path d="M154 132C328 186 401 195 527 235C658 276 725 330 852 343C944 353 1020 342 1110 315" stroke="white" strokeOpacity="0.32" strokeWidth="1.05" />
        <ellipse cx="863" cy="296" rx="262" ry="97" transform="rotate(-15 863 296)" stroke="#D8A84A" strokeOpacity="0.34" strokeWidth="1.35" />
        <ellipse cx="862" cy="296" rx="222" ry="82" transform="rotate(18 862 296)" stroke="white" strokeOpacity="0.28" strokeWidth="1.1" />
        <circle cx="674" cy="234" r="4.8" fill="#FFF4C7" filter="url(#ogaHeroGlow)" />
        <circle cx="930" cy="182" r="3.2" fill="#E3B247" />
        <circle cx="1005" cy="334" r="2.7" fill="white" fillOpacity="0.76" />
        <circle cx="790" cy="376" r="2.4" fill="#E3B247" />
      </svg>
      <div className="absolute inset-y-0 left-0 w-[57%] bg-[linear-gradient(90deg,rgba(255,255,255,1)_0%,rgba(255,255,255,0.98)_58%,rgba(255,255,255,0.55)_82%,transparent_100%)]" />
    </div>
  );
}

function HeroSection({ section, stats, statsVisibility }: { section: LandingSectionConfig; stats: LandingStats; statsVisibility: LandingStatsVisibility }) {
  const visibleStats = ([
    ['formations', 'Formations'],
    ['apprenants', 'Apprenants'],
    ['pays', 'Pays'],
    ['formateurs', 'Professeurs'],
    ['etablissements', 'Structures'],
  ] as Array<[keyof LandingStats, string]>).filter(([key]) => statsVisibility[key] && stats[key]);

  return (
    <>
      <section id="contenu-principal" className="relative isolate overflow-hidden border-b border-slate-200 pt-[116px]">
        <FuturisticHeroArt />
        <div className="relative mx-auto grid min-h-[470px] max-w-7xl items-center px-5 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(430px,1.12fr)] lg:px-8 lg:py-16">
          <div className="max-w-2xl">
            <h1 className="text-[2.25rem] font-black leading-[1.08] tracking-[-0.045em] text-[#002050] sm:text-[2.8rem] lg:text-[3.15rem]">
              {section.title}
            </h1>
            {section.subtitle && <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">{section.subtitle}</p>}
            {section.body && <p className="mt-3 max-w-xl whitespace-pre-line text-sm leading-7 text-slate-500">{section.body}</p>}
            {(section.primary_cta_label || section.secondary_cta_label) && (
              <div className="mt-7 flex flex-wrap gap-3">
                {section.secondary_cta_label && (
                  <Link to={safeHref(section.secondary_cta_url)} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#002050] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#002050]/10 transition hover:-translate-y-0.5 hover:bg-[#00183E]">
                    {section.secondary_cta_label}
                  </Link>
                )}
                {section.primary_cta_label && (
                  <Link to={safeHref(section.primary_cta_url)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002050] shadow-sm transition hover:border-[#002050]">
                    {section.primary_cta_label}
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="relative hidden min-h-[360px] lg:block" aria-hidden="true" />
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-px px-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            ['Parcours structurés', 'Objectifs, modules et évaluations clairs', Target],
            ['Formats flexibles', 'Web, mobile, live et autonomie', BookOpen],
            ['Carrière intégrée', 'Career, Talent, coaching et opportunités', Briefcase],
            ['Certificats vérifiables', 'Preuves de compétences partageables', ShieldCheck],
          ].map(([title, description, Icon]) => {
            const CapabilityIcon = Icon as LucideIcon;
            return (
              <div key={String(title)} className="flex items-center gap-3 py-5 sm:px-4 first:pl-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF7E7] text-[#BF8813]"><CapabilityIcon size={20} /></span>
                <div><strong className="block text-sm font-bold text-[#002050]">{String(title)}</strong><span className="mt-0.5 block text-xs leading-5 text-slate-500">{String(description)}</span></div>
              </div>
            );
          })}
        </div>
      </section>

      {visibleStats.length > 0 && (
        <section className="border-b border-slate-200 bg-[#F8FAFC]">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 px-5 sm:px-6 md:grid-cols-3 lg:grid-cols-5 lg:px-8">
            {visibleStats.map(([key, label]) => (
              <div key={key} className="border-b border-slate-200 py-5 pr-4 sm:border-r md:border-b-0">
                <dd className="text-xl font-black text-[#002050]">{stats[key]}</dd>
                <dt className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}

function SectionHeading({ section }: { section: LandingSectionConfig }) {
  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-black tracking-[-0.03em] text-[#002050] sm:text-3xl">{section.title}</h2>
      {section.subtitle && <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">{section.subtitle}</p>}
      {section.body && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-500">{section.body}</p>}
    </div>
  );
}

function GoalsSection({ section }: { section: LandingSectionConfig }) {
  const items = visibleItems(section).slice(0, 4);
  if (items.length === 0) return null;
  return (
    <section id="objectifs" className="border-b border-slate-200 bg-[#F6F8FB] px-5 py-14 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <SectionHeading section={section} />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item, index) => {
            const Icon = ICONS[item.icon_key] || ArrowRight;
            return (
              <article key={item.id} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_25px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#E1C783] hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-[#FBFCFE] text-[#002050]"><Icon size={19} /></span>
                  <span className="text-xs font-black text-[#BF8813]">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-4 text-lg font-black leading-6 text-[#002050]">{item.title}</h3>
                {item.description && <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>}
                {actionFor(item)}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CourseList({ section, courses }: { section: LandingSectionConfig; courses: CourseCardData[] }) {
  if (courses.length === 0) return null;
  const displayed = courses.slice(0, 3);
  const tones = [
    'linear-gradient(135deg,#063B79,#002050)',
    'linear-gradient(135deg,#A56F06,#765007)',
    'linear-gradient(135deg,#17624F,#0A493B)',
  ];
  return (
    <section id="formations" className="border-b border-slate-200 bg-white px-5 py-14 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading section={section} />
          {section.primary_cta_url && section.primary_cta_label && (
            <Link to={safeHref(section.primary_cta_url)} className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-[#002050] hover:underline">
              {section.primary_cta_label}<ArrowRight size={16} />
            </Link>
          )}
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {displayed.map((course, index) => {
            const external = course.content_origin === 'external';
            const href = external ? `/formation-externe/${course.id}` : `/cours/${course.id}`;
            const price = external
              ? (course.access_mode === 'premium' ? 'Accès Premium' : course.access_mode === 'registered' ? 'Après inscription' : 'Accès public')
              : course.is_free ? 'Gratuit' : `${course.price_xof.toLocaleString('fr-FR')} XOF`;
            return (
              <Link key={course.id} to={href} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(15,23,42,0.09)]">
                <div className="relative h-36 overflow-hidden" style={{ background: tones[index % tones.length] }}>
                  {course.cover_image_url ? <img src={course.cover_image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : (
                    <div className="absolute inset-0">
                      <div className="absolute right-7 top-7 h-20 w-20 rounded-full border-[10px] border-white/15" />
                      <div className="absolute right-[54px] top-[54px] h-7 w-7 rounded-full bg-white/90 shadow-lg" />
                    </div>
                  )}
                  {(course.category || course.level) && <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#002050] shadow-sm">{course.category || course.level}</span>}
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-black leading-6 text-[#002050] group-hover:underline">{course.title}</h3>
                  {course.short_description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{course.short_description}</p>}
                  {(course.creator_name || course.provider_name) && <p className="mt-2 text-xs font-semibold text-slate-500">{external ? 'Source' : 'Par'} {course.provider_name || course.creator_name}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                    <span>{price}</span>
                    {course.duration_label && <span>{course.duration_label}</span>}
                    {course.certificate_available && <span>Certificat</span>}
                    {course.total_reviews > 0 && <span>{course.average_rating.toFixed(1)} / 5 · {course.total_reviews} avis</span>}
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-[#002050]">Voir le programme <ArrowRight size={15} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function JourneySection({ section }: { section: LandingSectionConfig }) {
  const items = visibleItems(section);
  if (items.length === 0) return null;
  return (
    <section id="parcours-omnia" className="border-b border-slate-200 bg-[#FFFCF6] px-5 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[0.7fr_1.3fr] lg:items-center lg:gap-12">
        <SectionHeading section={section} />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:mt-0 lg:grid-cols-5 lg:gap-0" style={{ perspective: '1100px' }}>
          {items.map((item, index) => {
            const Icon = ICONS[item.icon_key] || ArrowRight;
            return (
              <div key={item.id} className="relative text-center" style={{ transformStyle: 'preserve-3d' }}>
                {index < items.length - 1 && <span className="absolute left-[60%] right-[-40%] top-6 hidden h-px bg-gradient-to-r from-[#BF8813]/70 to-[#BF8813]/20 lg:block" />}
                <span className="relative mx-auto block h-14 w-14" style={{ transformStyle: 'preserve-3d' }}>
                  <span className="absolute inset-[6px] rounded-full bg-[#002050]/10 blur-md" style={{ transform: 'translateY(13px) translateZ(-28px) scaleX(1.25)' }} />
                  <span className="absolute inset-1 flex items-center justify-center rounded-full border border-[#E4D5AF] bg-white text-[#002050] shadow-[0_10px_25px_rgba(0,32,80,0.12),inset_0_1px_0_rgba(255,255,255,0.95)]" style={{ transform: 'translateZ(22px)' }}><Icon size={20} /></span>
                  <span className="absolute inset-[10px] -z-10 rounded-full border border-[#BF8813]/25 bg-[#FFF4D9]" style={{ transform: 'translateZ(-10px)' }} />
                </span>
                <h3 className="mt-3 text-sm font-black text-[#002050]">{item.title}</h3>
                {item.description && <p className="mx-auto mt-2 max-w-[170px] text-xs leading-5 text-slate-500">{item.description}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function EcosystemSection({ section }: { section: LandingSectionConfig }) {
  const items = visibleItems(section);
  if (items.length === 0) return null;
  const projects = items.find(item => safeHref(item.action_url) === '/projects' || item.title.toLowerCase().includes('project'));

  return (
    <>
      <section id="ecosysteme" className="relative overflow-hidden bg-[#001B46] px-5 py-14 text-white sm:px-6 lg:px-8 lg:py-16">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute left-1/2 top-[62%] h-[420px] w-[900px] rounded-[50%] border border-[#3B78CB]/20" style={{ transform: 'translate(-50%, -50%) rotateX(72deg)', boxShadow: '0 0 90px rgba(22,91,183,0.14)' }} />
          <div className="absolute left-1/2 top-[63%] h-[300px] w-[720px] rounded-[50%] border border-[#BF8813]/25" style={{ transform: 'translate(-50%, -50%) rotateX(72deg)' }} />
          <div className="absolute -left-28 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -right-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-[#BF8813]/10 blur-3xl" />
          <div className="absolute inset-0 opacity-35" style={{ backgroundImage: 'radial-gradient(circle at center, rgba(92,153,238,.18) 0 1px, transparent 1.5px)', backgroundSize: '23px 23px', maskImage: 'linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)' }} />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#073C7F]/35 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">{section.title}</h2>
            {section.subtitle && <p className="mt-3 text-sm leading-6 text-blue-100/75">{section.subtitle}</p>}
          </div>

          <div className="relative mt-11" style={{ perspective: '1500px' }}>
            <div className="absolute left-[6%] right-[6%] top-9 hidden h-px bg-gradient-to-r from-transparent via-[#D9A22B]/75 to-transparent xl:block" aria-hidden="true" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {items.map((item, index) => {
                const Icon = ICONS[item.icon_key] || ArrowRight;
                const depth = index % 2 === 0 ? 18 : 30;
                return (
                  <Link
                    key={item.id}
                    to={safeHref(item.action_url)}
                    className="group relative flex min-w-0 flex-col items-center rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-5 text-center shadow-[0_18px_44px_rgba(0,10,32,0.18)] transition duration-300 hover:-translate-y-2 hover:border-[#BF8813]/45 hover:bg-white/[0.065]"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <span className="relative z-10 block h-16 w-16" style={{ transformStyle: 'preserve-3d' }}>
                      <span className="absolute inset-[7px] rounded-full bg-[#061D43] shadow-[0_18px_24px_rgba(0,0,0,0.32)]" style={{ transform: 'translateY(12px) translateZ(-24px) scaleX(1.25)' }} />
                      <span className="absolute inset-1 rounded-full border border-[#BF8813]/35 bg-[#07326E]" style={{ transform: `translateZ(${depth - 14}px)` }} />
                      <span className="absolute inset-0 flex items-center justify-center rounded-full border border-[#D7A63A] bg-[radial-gradient(circle_at_36%_28%,#0E4D9A,#002050_62%)] text-[#F0C15A] shadow-[0_0_0_6px_rgba(0,32,80,0.72),0_0_28px_rgba(57,128,232,0.30),inset_0_1px_0_rgba(255,255,255,0.12)] transition group-hover:border-white group-hover:text-white" style={{ transform: `translateZ(${depth}px)` }}>
                        <Icon size={21} />
                      </span>
                    </span>
                    <h3 className="mt-4 text-sm font-black text-white">{item.title}</h3>
                    {item.description && <p className="mt-2 max-w-[190px] text-xs leading-5 text-blue-100/65">{item.description}</p>}
                    {item.action_label && <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#E8B94E]">{item.action_label}<ArrowRight size={13} /></span>}
                  </Link>
                );
              })}
            </div>
          </div>

          {section.primary_cta_label && (
            <div className="mt-9 text-center">
              <Link to={safeHref(section.primary_cta_url)} className="inline-flex items-center gap-2 rounded-lg border border-[#BF8813]/70 bg-[#BF8813]/10 px-4 py-2.5 text-sm font-black text-[#F1C568] transition hover:bg-[#BF8813]/20">
                {section.primary_cta_label}<ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {projects && (
        <section className="relative overflow-hidden border-b border-slate-200 bg-white px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute right-[-8%] top-[-20%] h-[440px] w-[440px] rounded-full bg-[#EAF3FF] blur-3xl" />
            <div className="absolute bottom-[-30%] left-[42%] h-[360px] w-[360px] rounded-full bg-[#FFF3D5] blur-3xl" />
          </div>
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,0.86fr)_minmax(470px,1.14fr)] lg:gap-16">
            <div className="max-w-xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9A6A08]">Omnia Projects</p>
              <h3 className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#002050] sm:text-4xl">{projects.title}</h3>
              {projects.description && <p className="mt-5 text-base leading-8 text-slate-600">{projects.description}</p>}
              <div className="mt-7 h-px w-24 bg-[#BF8813]" />
              <p className="mt-5 text-sm leading-7 text-slate-500">Travaillez sur des briefs, produisez des livrables, recevez du feedback et construisez progressivement des preuves concrètes de vos compétences.</p>
              {projects.action_url && projects.action_label && (
                <Link to={safeHref(projects.action_url)} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#002050] px-5 py-3 text-sm font-black text-white transition hover:bg-[#00183E]">
                  {projects.action_label}<ArrowRight size={15} />
                </Link>
              )}
            </div>

            <div className="relative min-h-[360px] lg:min-h-[410px]" aria-hidden="true" style={{ perspective: '1400px' }}>
              <div className="absolute left-[8%] top-[10%] h-[76%] w-[84%] rounded-[50%] bg-[radial-gradient(circle,rgba(71,134,222,0.18),rgba(71,134,222,0.04)_54%,transparent_72%)] blur-xl" />
              <div className="absolute bottom-[8%] left-[14%] h-[56px] w-[72%] rounded-[50%] bg-[#002050]/15 blur-xl" />
              <div className="absolute left-[18%] top-[17%] h-[245px] w-[335px] rounded-[26px] border border-[#BFD0E7] bg-white shadow-[0_32px_70px_rgba(0,32,80,0.16)]" style={{ transform: 'rotateY(-10deg) rotateX(5deg) translateZ(42px)' }}>
                <div className="absolute inset-x-0 top-0 flex h-12 items-center justify-between rounded-t-[26px] border-b border-[#DCE6F2] bg-[#F7FAFE] px-5">
                  <span className="h-2.5 w-24 rounded-full bg-[#002050]/80" />
                  <span className="h-7 w-7 rounded-full border border-[#D6E1EF] bg-white" />
                </div>
                <div className="absolute left-6 top-[74px] right-6">
                  <div className="h-3 w-[58%] rounded-full bg-[#002050]/85" />
                  <div className="mt-3 h-2 w-[84%] rounded-full bg-slate-200" />
                  <div className="mt-2 h-2 w-[69%] rounded-full bg-slate-200" />
                  <div className="mt-7 grid grid-cols-[1fr_0.76fr] gap-4">
                    <div className="space-y-3">
                      <div className="h-10 rounded-xl border border-[#DCE6F2] bg-[#F8FAFD]" />
                      <div className="h-10 rounded-xl border border-[#DCE6F2] bg-[#F8FAFD]" />
                      <div className="h-10 rounded-xl border border-[#DCE6F2] bg-[#F8FAFD]" />
                    </div>
                    <div className="rounded-2xl bg-[#002050] p-4 shadow-[0_16px_32px_rgba(0,32,80,0.18)]">
                      <div className="h-2 w-14 rounded-full bg-[#E8BC5B]" />
                      <div className="mt-4 h-2 w-full rounded-full bg-white/20" />
                      <div className="mt-2 h-2 w-[76%] rounded-full bg-white/20" />
                      <div className="mt-7 h-8 rounded-lg bg-white/10" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute right-[7%] top-[9%] h-[150px] w-[122px] rounded-[18px] border border-[#E1C67F] bg-[#FFFDF7] shadow-[0_22px_50px_rgba(0,32,80,0.12)]" style={{ transform: 'rotate(8deg) translateZ(78px)' }}>
                <div className="mx-auto mt-5 h-12 w-12 rounded-full border-[5px] border-[#BF8813]/65 bg-[#FFF7E5]" />
                <div className="mx-auto mt-4 h-2 w-16 rounded-full bg-[#002050]/75" />
                <div className="mx-auto mt-2 h-2 w-11 rounded-full bg-slate-200" />
              </div>
              <div className="absolute bottom-[12%] left-[7%] h-[112px] w-[156px] rounded-[18px] border border-[#C5D5E9] bg-[#EEF5FD] shadow-[0_20px_42px_rgba(0,32,80,0.12)]" style={{ transform: 'rotate(-8deg) translateZ(62px)' }}>
                <div className="absolute left-5 top-5 h-3 w-20 rounded-full bg-[#1E5FAE]/75" />
                <div className="absolute left-5 top-11 h-2 w-[74%] rounded-full bg-[#AFC5E0]" />
                <div className="absolute bottom-5 left-5 right-5 flex items-end gap-2">
                  <span className="h-5 flex-1 rounded-t bg-[#89ACD8]" />
                  <span className="h-9 flex-1 rounded-t bg-[#3778C6]" />
                  <span className="h-12 flex-1 rounded-t bg-[#BF8813]" />
                </div>
              </div>
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 560 410" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M46 313C130 221 222 261 305 196C375 141 420 72 523 87" stroke="#BF8813" strokeOpacity="0.52" strokeWidth="1.4" />
                <path d="M76 338C170 255 259 294 350 231C420 181 459 139 542 150" stroke="#2F6EBB" strokeOpacity="0.32" strokeWidth="1.2" />
                <circle cx="305" cy="196" r="4" fill="#BF8813" />
                <circle cx="523" cy="87" r="4" fill="#2F6EBB" />
              </svg>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function EditorialSection({ section, id, muted = false }: { section: LandingSectionConfig; id?: string; muted?: boolean }) {
  const items = visibleItems(section);
  return (
    <section id={id} className={`border-b border-slate-200 px-5 py-12 sm:px-6 lg:px-8 ${muted ? 'bg-[#F8FAFC]' : 'bg-white'}`}>
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
          <div>
            <SectionHeading section={section} />
            {(section.primary_cta_label || section.secondary_cta_label) && (
              <div className="mt-6 flex flex-wrap gap-3">
                {section.primary_cta_label && (
                  <Link to={safeHref(section.primary_cta_url)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#002050] px-5 py-3 text-sm font-black text-white transition hover:bg-[#00183E]">
                    {section.primary_cta_label}<ArrowRight size={15} />
                  </Link>
                )}
                {section.secondary_cta_label && (
                  <Link to={safeHref(section.secondary_cta_url)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-black text-[#002050] transition hover:border-[#002050]">
                    {section.secondary_cta_label}<ArrowRight size={15} />
                  </Link>
                )}
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
                      <h3 className="text-base font-black text-[#002050]">{item.title}</h3>
                      {item.description && <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>}
                    </div>
                    {item.action_url && item.action_label && (
                      <Link to={safeHref(item.action_url)} className="inline-flex items-center gap-1 text-sm font-bold text-[#002050] hover:underline">
                        {item.action_label}<ArrowRight size={14} />
                      </Link>
                    )}
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
  const visible = partners.filter(partner => partner.show_homepage && partner.logo_url);
  if (visible.length === 0) return null;
  return (
    <section id="partenaires" className="border-b border-slate-200 bg-[#F8FAFC] px-5 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading section={section} />
        <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-6">
          {visible.map(partner => {
            const logo = <img src={partner.logo_url!} alt={partner.alt_text || `Logo ${partner.name}`} loading="lazy" decoding="async" className="max-h-10 max-w-32 object-contain grayscale transition hover:grayscale-0" />;
            return partner.website_url ? <a key={partner.id} href={partner.website_url} target="_blank" rel="noopener noreferrer" title={partner.name}>{logo}</a> : <span key={partner.id} title={partner.name}>{logo}</span>;
          })}
        </div>
      </div>
    </section>
  );
}

function ConnectionsSection({ section, apps, networks }: { section: LandingSectionConfig; apps: MobileAppItem[]; networks: SocialNetworkItem[] }) {
  if (section.type === 'mobile_apps') {
    const visibleApps = apps
      .filter(item => item.enabled && item.show_homepage && /^https:\/\//i.test(item.url || ''))
      .sort((a, b) => a.display_order - b.display_order);
    if (visibleApps.length === 0) return null;
    return (
      <section className="border-b border-slate-200 bg-white px-5 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading section={section} />
          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
            {visibleApps.map(item => (
              <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#00183E]">
                {item.name || (item.store === 'ios' ? 'App Store' : 'Google Play')}
              </a>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const visibleNetworks = networks
    .filter(item => item.enabled && item.show_homepage && /^https:\/\//i.test(item.url || ''))
    .sort((a, b) => a.display_order - b.display_order);
  if (visibleNetworks.length === 0) return null;
  return (
    <section className="border-b border-slate-200 bg-[#F8FAFC] px-5 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading section={section} />
        <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
          {visibleNetworks.map(item => (
            <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#002050] transition hover:border-[#BF8813]">
              {item.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ section }: { section: LandingSectionConfig }) {
  const isLegacyDuplicate = section.title.trim() === 'Votre prochain objectif commence ici.'
    || (section.primary_cta_label === 'Créer un compte' && section.secondary_cta_label === 'Découvrir les formations');
  const title = isLegacyDuplicate ? 'Composez la suite de votre parcours.' : section.title;
  const subtitle = isLegacyDuplicate
    ? 'Approfondissez vos compétences, transformez-les en réalisations concrètes et rendez-les visibles dans l’écosystème Omnia.'
    : section.subtitle;

  const steps = [
    ['01', 'Approfondir', 'Formations, Live et accompagnement pour continuer à progresser.'],
    ['02', 'Mettre en pratique', 'Projets et livrables pour transformer les acquis en expérience.'],
    ['03', 'Se rendre visible', 'Career, Talent et preuves vérifiables pour valoriser votre parcours.'],
  ];

  return (
    <section id="rejoindre-omnia" className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(180deg,#F8FBFF_0%,#FFFFFF_78%)] px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-[58%] h-64 w-[78%] -translate-x-1/2 rounded-[50%] bg-[#EAF3FF]/70 blur-3xl" />
        <svg className="absolute left-1/2 top-[44%] h-[240px] w-[min(1120px,96%)] -translate-x-1/2" viewBox="0 0 1120 240" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 142C165 56 276 91 390 135C510 181 613 183 730 122C844 63 948 67 1102 145" stroke="#BF8813" strokeOpacity="0.62" strokeWidth="1.5" />
          <path d="M18 160C173 84 273 112 395 153C514 193 625 195 739 140C855 84 958 91 1102 162" stroke="#2F6EBB" strokeOpacity="0.24" strokeWidth="1.2" />
          <circle cx="191" cy="88" r="5" fill="#2F6EBB" />
          <circle cx="555" cy="177" r="4" fill="#BF8813" />
          <circle cx="902" cy="83" r="5" fill="#DCA332" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9A6A08]">Votre parcours, à votre rythme</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#002050] sm:text-4xl">{title}</h2>
          {subtitle && <p className="mt-4 text-base leading-7 text-slate-600">{subtitle}</p>}
          {section.body && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-500">{section.body}</p>}
          {!isLegacyDuplicate && (section.primary_cta_label || section.secondary_cta_label) && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {section.primary_cta_label && (
                <Link to={safeHref(section.primary_cta_url, '/inscription')} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#002050] px-5 py-3 text-sm font-black text-white transition hover:bg-[#00183E]">
                  {section.primary_cta_label}<ArrowRight size={16} />
                </Link>
              )}
              {section.secondary_cta_label && (
                <Link to={safeHref(section.secondary_cta_url)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-black text-[#002050] transition hover:border-[#002050]">
                  {section.secondary_cta_label}<ArrowRight size={16} />
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8 lg:mt-16 lg:gap-12">
          {steps.map(([number, label, copy], index) => (
            <div key={number} className="relative px-2 text-center md:text-left">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-[6px] border-[#E7EFFA] bg-[linear-gradient(145deg,#4B88D6,#0B4B9E)] text-sm font-black text-white shadow-[0_12px_30px_rgba(31,99,181,0.26)] md:mx-0">
                {number}
              </div>
              <h3 className="mt-5 text-xl font-black text-[#002050]">{label}</h3>
              <p className="mt-3 max-w-sm text-sm leading-7 text-slate-600">{copy}</p>
              {index < steps.length - 1 && <div className="absolute right-[-26px] top-7 hidden h-px w-14 bg-gradient-to-r from-[#BF8813]/70 to-transparent md:block lg:right-[-34px] lg:w-20" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingExperience({ data }: LandingExperienceProps) {
  const sections = [...data.landingPage.sections]
    .filter(section => section.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <main aria-label="Contenu principal de la page d’accueil">
      {sections.map(section => {
        if (section.type === 'hero') return <HeroSection key={section.id} section={section} stats={data.stats} statsVisibility={data.statsVisibility} />;
        if (section.type === 'goal_selector') return <GoalsSection key={section.id} section={section} />;
        if (section.type === 'featured_courses') return <CourseList key={section.id} section={section} courses={data.featuredCourses} />;
        if (section.type === 'omnia_journey') return <JourneySection key={section.id} section={section} />;
        if (section.type === 'ecosystem') return <EcosystemSection key={section.id} section={section} />;
        if (section.type === 'credentials' || section.type === 'career_recruitment' || section.type === 'structures') return null;
        if (section.type === 'partners') return <PartnersSection key={section.id} section={section} partners={data.partners} />;
        if (section.type === 'mobile_apps' || section.type === 'social_networks') return <ConnectionsSection key={section.id} section={section} apps={data.mobileApps} networks={data.socialNetworks} />;
        if (section.type === 'final_cta') return <FinalCta key={section.id} section={section} />;
        return <EditorialSection key={section.id} section={section} muted={section.order % 2 === 0} />;
      })}
    </main>
  );
}
