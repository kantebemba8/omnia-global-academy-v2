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
  Globe2,
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
import { resolvePublicHomeHero } from '../../types/landingCms';

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

function HeroJourneyBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(105deg,#00132F_0%,#002050_43%,#063A76_72%,#0B3764_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_56%,rgba(255,193,74,0.30),rgba(255,193,74,0.08)_19%,transparent_42%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,18,48,0.98)_0%,rgba(0,32,80,0.92)_39%,rgba(0,32,80,0.48)_61%,rgba(0,32,80,0.06)_100%)]" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 760"
        fill="none"
        preserveAspectRatio="xMaxYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ogaGoldTrail" x1="790" y1="740" x2="1525" y2="250" gradientUnits="userSpaceOnUse">
            <stop stopColor="#BF8813" stopOpacity="0" />
            <stop offset="0.32" stopColor="#E8B84F" stopOpacity="0.75" />
            <stop offset="0.72" stopColor="#FFE5A1" stopOpacity="1" />
            <stop offset="1" stopColor="#BF8813" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="ogaBlueTrail" x1="820" y1="690" x2="1540" y2="270" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2E6CC7" stopOpacity="0" />
            <stop offset="0.55" stopColor="#7FB9FF" stopOpacity="0.46" />
            <stop offset="1" stopColor="#D8ECFF" stopOpacity="0.18" />
          </linearGradient>
          <radialGradient id="ogaSun" cx="0" cy="0" r="1" gradientTransform="translate(1258 476) rotate(90) scale(154 198)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF3C7" stopOpacity="0.98" />
            <stop offset="0.2" stopColor="#F5C35C" stopOpacity="0.68" />
            <stop offset="0.58" stopColor="#D69419" stopOpacity="0.18" />
            <stop offset="1" stopColor="#D69419" stopOpacity="0" />
          </radialGradient>
          <filter id="ogaGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="ogaSoftGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <circle cx="1258" cy="476" r="190" fill="url(#ogaSun)" />

        <g opacity="0.28" stroke="#E9BD62">
          <ellipse cx="1160" cy="370" rx="360" ry="154" transform="rotate(-16 1160 370)" />
          <ellipse cx="1160" cy="370" rx="290" ry="120" transform="rotate(16 1160 370)" />
          <ellipse cx="1160" cy="370" rx="228" ry="92" transform="rotate(-31 1160 370)" />
          <circle cx="992" cy="219" r="52" opacity="0.55" />
        </g>

        <g opacity="0.22" stroke="#8FC0FF">
          <ellipse cx="1118" cy="365" rx="425" ry="186" transform="rotate(-8 1118 365)" />
          <ellipse cx="1130" cy="372" rx="328" ry="147" transform="rotate(24 1130 372)" />
        </g>

        <path d="M0 604C180 560 345 578 505 592C697 610 838 576 986 542C1095 517 1174 506 1281 520C1398 536 1500 569 1600 570V760H0V604Z" fill="#001B3E" fillOpacity="0.68" />
        <path d="M0 627C182 588 358 604 510 620C706 640 830 605 972 578C1119 551 1235 565 1351 596C1456 624 1531 638 1600 638V760H0V627Z" fill="#001329" fillOpacity="0.78" />

        <g filter="url(#ogaGlow)">
          <path d="M662 786C862 738 1040 691 1192 604C1292 547 1370 494 1435 408C1482 346 1515 289 1568 174" stroke="url(#ogaGoldTrail)" strokeWidth="17" strokeLinecap="round" />
          <path d="M716 790C917 736 1060 690 1211 612C1322 555 1412 492 1478 398C1515 346 1544 298 1588 205" stroke="#FFF1BF" strokeOpacity="0.74" strokeWidth="4.5" strokeLinecap="round" />
        </g>

        <g opacity="0.74">
          <path d="M620 752C815 710 998 664 1144 590C1257 532 1342 480 1419 393C1485 318 1515 250 1560 139" stroke="url(#ogaBlueTrail)" strokeWidth="3" strokeLinecap="round" />
          <path d="M565 748C776 707 959 668 1114 603C1241 550 1358 483 1433 392C1491 321 1528 248 1584 116" stroke="#E5B95F" strokeOpacity="0.54" strokeWidth="1.4" strokeDasharray="3 8" />
          <path d="M732 730C900 691 1040 644 1162 580C1280 517 1362 457 1423 372" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="1.2" />
        </g>

        <g fill="#F3C466" filter="url(#ogaSoftGlow)">
          <circle cx="910" cy="235" r="3.6" />
          <circle cx="1018" cy="336" r="4.2" />
          <circle cx="1142" cy="212" r="3" />
          <circle cx="1202" cy="472" r="4.8" />
          <circle cx="1320" cy="330" r="3.8" />
          <circle cx="1436" cy="224" r="3.2" />
          <circle cx="1495" cy="388" r="4" />
          <circle cx="1550" cy="274" r="3.1" />
        </g>

        <g fill="#8DC1FF" opacity="0.72">
          <circle cx="842" cy="322" r="2.7" />
          <circle cx="1065" cy="176" r="2.4" />
          <circle cx="1276" cy="231" r="2.8" />
          <circle cx="1511" cy="491" r="2.5" />
        </g>
      </svg>

      <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,transparent,rgba(0,18,45,0.50))]" />
    </div>
  );
}

type HeroStatConfig = {
  key: keyof LandingStats;
  label: string;
  Icon: LucideIcon;
};

const HERO_STATS: HeroStatConfig[] = [
  { key: 'apprenants', label: 'Apprenants', Icon: Users },
  { key: 'formations', label: 'Formations', Icon: BookOpen },
  { key: 'formateurs', label: 'Professeurs', Icon: GraduationCap },
  { key: 'etablissements', label: 'Structures', Icon: Building2 },
  { key: 'pays', label: 'Pays', Icon: Globe2 },
];

function HeroSection({ section, stats, statsVisibility }: { section: LandingSectionConfig; stats: LandingStats; statsVisibility: LandingStatsVisibility }) {
  const hero = resolvePublicHomeHero(section);
  const visibleStats = HERO_STATS.filter(({ key }) => statsVisibility[key] && Boolean(stats[key]));
  const primaryLabel = hero.primary_cta_label?.trim() || 'Créer mon compte';
  const primaryHref = safeHref(hero.primary_cta_url, '/inscription');
  const secondaryLabel = hero.secondary_cta_label?.trim() || 'Explorer les formations';
  const secondaryHref = safeHref(hero.secondary_cta_url, '/catalogue');
  const heroDescription = hero.subtitle?.trim() || hero.body?.trim();

  return (
    <section id="contenu-principal" className="relative isolate overflow-hidden bg-[#002050] pt-[112px] text-white sm:pt-[118px]">
      <HeroJourneyBackground />

      <div className={`relative mx-auto flex min-h-[620px] max-w-7xl flex-col px-5 pb-8 pt-12 sm:px-6 sm:pb-10 sm:pt-14 lg:min-h-[650px] lg:px-8 lg:pb-10 lg:pt-16 ${visibleStats.length ? 'justify-between' : 'justify-center'}`}>
        <div className="max-w-[720px] py-4 sm:py-6 lg:py-8">
          {hero.eyebrow && (
            <p className="mb-5 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.28em] text-[#E9B84E] sm:text-xs">
              <span className="h-px w-8 bg-[#BF8813]" />
              {hero.eyebrow}
            </p>
          )}

          <h1 className="max-w-[720px] text-[2.65rem] font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-[3.55rem] lg:text-[4.45rem]">
            {hero.title === 'Transformez vos compétences en preuves et en opportunités.' ? (
              <>
                Transformez vos compétences en <span className="text-[#D59A20]">preuves et en opportunités.</span>
              </>
            ) : hero.title}
          </h1>

          {heroDescription && (
            <p className="mt-6 max-w-[610px] text-[0.98rem] leading-7 text-white/80 sm:text-[1.05rem] sm:leading-8">
              {heroDescription}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to={primaryHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#BF8813] px-6 py-3 text-sm font-black text-white shadow-[0_14px_36px_rgba(191,136,19,0.28)] transition hover:-translate-y-0.5 hover:bg-[#D09A24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#002050]"
            >
              {primaryLabel}<ArrowRight size={17} />
            </Link>
            <Link
              to={secondaryHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/50 bg-[#001A42]/40 px-6 py-3 text-sm font-black text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#E2B451] hover:bg-[#00245A]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#002050]"
            >
              {secondaryLabel}<ArrowRight size={17} />
            </Link>
          </div>
        </div>

        {visibleStats.length > 0 && (
          <dl className="mt-8 grid grid-cols-1 overflow-hidden rounded-2xl border border-white/20 bg-[#00152F]/60 shadow-[0_20px_55px_rgba(0,0,0,0.18)] backdrop-blur-md min-[460px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {visibleStats.map(({ key, label, Icon }, index) => (
              <div key={key} className={`flex min-h-[112px] items-center gap-3 px-4 py-5 sm:px-5 ${index > 0 ? 'border-l border-white/10' : ''} ${index >= 2 ? 'border-t border-white/10 sm:border-t-0' : ''}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D7A23C]/50 bg-[#BF8813]/10 text-[#E7B956]">
                  <Icon size={22} strokeWidth={1.8} />
                </span>
                <div>
                  <dd className="text-lg font-black text-white sm:text-xl">{stats[key]}</dd>
                  <dt className="mt-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/60">{label}</dt>
                </div>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
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
