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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_48%,rgba(41,112,221,0.18),transparent_30%),radial-gradient(circle_at_72%_58%,rgba(191,136,19,0.10),transparent_22%),linear-gradient(112deg,#ffffff_0%,#f8fbff_44%,#eaf3ff_100%)]" />
      <div className="absolute inset-0 opacity-[0.34]" style={{ backgroundImage: 'linear-gradient(rgba(0,32,80,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0,32,80,.045) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
      <svg className="absolute inset-y-0 right-0 h-full w-[68%] min-w-[680px] opacity-60" viewBox="0 0 1000 520" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M118 410C296 292 389 416 538 322C674 236 720 153 862 161C925 165 972 190 1036 164" stroke="#002050" strokeOpacity="0.34" strokeWidth="1.5" />
        <path d="M55 372C238 255 357 367 512 284C658 206 717 118 873 127C938 131 987 153 1048 136" stroke="#BF8813" strokeOpacity="0.46" strokeWidth="1.5" />
        <path d="M182 444C355 326 438 448 593 353C718 276 768 230 885 232C943 233 985 250 1042 240" stroke="#BF8813" strokeOpacity="0.18" strokeWidth="1.25" />
      </svg>
    </div>
  );
}

function HeroOrbitalVisual() {
  return (
    <div className="relative h-[360px] w-full max-w-[560px]" style={{ perspective: '1400px' }} aria-hidden="true">
      <div className="absolute inset-[10%_4%_6%_8%] rounded-[44%] bg-[radial-gradient(circle_at_56%_54%,rgba(21,103,220,0.30),rgba(16,69,154,0.10)_46%,transparent_72%)] blur-2xl" />
      <div className="absolute left-[52%] top-[52%] h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#7BAAF0]/30" style={{ transform: 'translate(-50%, -50%) rotateX(68deg) rotateZ(-12deg)', boxShadow: '0 0 80px rgba(33,106,222,0.16)' }} />
      <div className="absolute left-[52%] top-[52%] h-[246px] w-[246px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#BF8813]/45" style={{ transform: 'translate(-50%, -50%) rotateX(68deg) rotateZ(26deg)' }} />
      <div className="absolute left-[52%] top-[52%] h-[188px] w-[188px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{
        background: 'radial-gradient(circle at 31% 24%, #5D91DC 0%, #1F5AAB 18%, #0A356F 45%, #032452 68%, #001631 100%)',
        boxShadow: 'inset -28px -34px 52px rgba(0,12,35,.55), inset 18px 14px 34px rgba(97,157,241,.18), 0 34px 74px rgba(0,32,80,.25)',
        transform: 'translate(-50%, -50%) translateZ(72px)',
      }}>
        <div className="absolute left-[18%] top-[12%] h-[26%] w-[28%] rounded-full bg-white/20 blur-xl" />
        <div className="absolute bottom-[11%] right-[8%] h-[44%] w-[44%] rounded-full bg-[#BF8813]/30 blur-2xl" />
      </div>
      <div className="absolute left-[52%] top-[52%] h-[286px] w-[164px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-white/55" style={{ transform: 'translate(-50%, -50%) rotate(64deg) rotateX(62deg) translateZ(82px)', boxShadow: '0 0 22px rgba(255,255,255,.22)' }} />
      <div className="absolute left-[52%] top-[52%] h-[316px] w-[190px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#E0B34F]/70" style={{ transform: 'translate(-50%, -50%) rotate(64deg) rotateX(62deg) translateZ(80px)', boxShadow: '0 0 18px rgba(191,136,19,.16)' }} />
      <div className="absolute left-[71%] top-[31%] h-3.5 w-3.5 rounded-full bg-[#E4B84E] shadow-[0_0_18px_rgba(228,184,78,0.9)]" style={{ transform: 'translateZ(96px)' }} />
      <div className="absolute left-[35%] top-[69%] h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.95)]" style={{ transform: 'translateZ(96px)' }} />
      <div className="absolute left-[15%] top-[22%] h-px w-[70%] origin-left rotate-[18deg] bg-gradient-to-r from-transparent via-white/80 to-transparent blur-[0.4px]" />
      <div className="absolute bottom-[7%] left-[22%] right-[15%] h-8 rounded-[50%] bg-[#002050]/20 blur-xl" />
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
        <div className="relative mx-auto grid min-h-[470px] max-w-7xl items-center px-5 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:px-8 lg:py-20">
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
          <div className="relative hidden min-h-[360px] lg:flex lg:items-center lg:justify-center">
            <HeroOrbitalVisual />
          </div>
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
        <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(115deg,#F7FAFF_0%,#FFFFFF_45%,#FFF8EB_100%)] px-5 py-11 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(rgba(0,32,80,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,32,80,.035) 1px, transparent 1px)', backgroundSize: '32px 32px', maskImage: 'linear-gradient(90deg, transparent, black 42%, black 90%, transparent)' }} />
          <div className="relative mx-auto grid max-w-7xl items-center gap-8 rounded-[26px] border border-[#C9D8EC] bg-white/85 px-6 py-7 shadow-[0_18px_55px_rgba(0,32,80,0.08)] backdrop-blur-sm lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9A6A08]">Omnia Projects</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.025em] text-[#002050]">{projects.title}</h3>
              {projects.description && <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{projects.description}</p>}
              {projects.action_url && projects.action_label && (
                <Link to={safeHref(projects.action_url)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#00183E]">
                  {projects.action_label}<ArrowRight size={15} />
                </Link>
              )}
            </div>

            <div className="relative hidden h-[180px] lg:block" aria-hidden="true" style={{ perspective: '1000px' }}>
              <div className="absolute bottom-3 left-1/2 h-12 w-[250px] -translate-x-1/2 rounded-[50%] bg-[#002050]/15 blur-lg" />
              <div className="absolute bottom-6 left-1/2 h-[92px] w-[260px] rounded-[50%] border border-[#BF8813]/55 bg-[radial-gradient(ellipse_at_center,rgba(191,136,19,0.19),rgba(0,32,80,0.05)_54%,transparent_70%)]" style={{ transform: 'translateX(-50%) rotateX(68deg)' }} />
              <div className="absolute bottom-[46px] left-1/2 h-[74px] w-[150px] rounded-[18px] border border-[#144A86] bg-[linear-gradient(145deg,#0C4A8F,#002050)] shadow-[0_24px_34px_rgba(0,32,80,0.25)]" style={{ transform: 'translateX(-50%) rotateY(-12deg) rotateX(5deg) translateZ(40px)' }}>
                <div className="absolute -top-5 left-4 h-7 w-16 rounded-t-xl border border-b-0 border-[#144A86] bg-[#0C4A8F]" />
                <div className="absolute inset-x-4 top-5 h-px bg-white/20" />
                <div className="absolute bottom-4 left-4 h-2 w-14 rounded-full bg-[#BF8813]/80" />
              </div>
              <div className="absolute left-[76%] top-[20%] h-3 w-3 rounded-full bg-[#D9A22B] shadow-[0_0_20px_rgba(217,162,43,0.9)]" />
              <div className="absolute left-[20%] top-[52%] h-2 w-2 rounded-full bg-[#245EA5] shadow-[0_0_16px_rgba(36,94,165,0.7)]" />
              <div className="absolute left-[25%] top-[28%] h-[90px] w-[220px] rounded-[50%] border border-[#BF8813]/30" style={{ transform: 'rotate(-12deg) rotateX(64deg)' }} />
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
    <section id="rejoindre-omnia" className="relative overflow-hidden border-b border-slate-200 bg-[#002050] px-5 py-12 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-24 top-1/2 h-72 w-72 rounded-full border border-[#BF8813]/20" style={{ transform: 'translateY(-50%) rotateX(70deg)' }} />
        <div className="absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" />
      </div>
      <div className="relative mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div className="max-w-3xl">
          {section.eyebrow && !isLegacyDuplicate && <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E6BE63]">{section.eyebrow}</p>}
          <h2 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-3 text-base leading-7 text-blue-100">{subtitle}</p>}
          {section.body && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-white/65">{section.body}</p>}
          {!isLegacyDuplicate && (section.primary_cta_label || section.secondary_cta_label) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {section.primary_cta_label && (
                <Link to={safeHref(section.primary_cta_url, '/inscription')} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#BF8813] px-5 py-3 text-sm font-black text-white transition hover:bg-[#A8730F]">
                  {section.primary_cta_label}<ArrowRight size={16} />
                </Link>
              )}
              {section.secondary_cta_label && (
                <Link to={safeHref(section.secondary_cta_url)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/35 px-5 py-3 text-sm font-black text-white transition hover:border-white">
                  {section.secondary_cta_label}<ArrowRight size={16} />
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/10 sm:grid-cols-3" style={{ perspective: '1000px' }}>
          {steps.map(([number, label, copy], index) => (
            <div key={number} className="relative bg-[#05265A]/90 px-5 py-5" style={{ transform: `translateZ(${index === 1 ? 24 : 10}px)` }}>
              <span className="text-xs font-black tracking-[0.16em] text-[#E6BE63]">{number}</span>
              <h3 className="mt-2 text-sm font-black text-white">{label}</h3>
              <p className="mt-2 text-xs leading-5 text-blue-100/70">{copy}</p>
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
