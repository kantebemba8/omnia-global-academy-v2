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
  FolderKanban,
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_45%,rgba(191,136,19,0.13),transparent_22%),radial-gradient(circle_at_72%_52%,rgba(0,32,80,0.08),transparent_32%),linear-gradient(110deg,#fffdfa_0%,#ffffff_46%,#f7f9fd_100%)]" />
      <div className="absolute inset-0 opacity-[0.38]" style={{ backgroundImage: 'linear-gradient(rgba(0,32,80,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(0,32,80,.055) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <svg className="absolute -right-[5%] top-0 h-full w-[72%] min-w-[720px]" viewBox="0 0 1000 520" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="omniaGlobeGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(720 275) rotate(90) scale(210)">
            <stop stopColor="#BF8813" stopOpacity="0.13" />
            <stop offset="1" stopColor="#BF8813" stopOpacity="0" />
          </radialGradient>
          <pattern id="omniaDots" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.35" fill="#002050" fillOpacity="0.17" />
          </pattern>
          <clipPath id="omniaGlobeClip"><circle cx="735" cy="270" r="174" /></clipPath>
        </defs>
        <circle cx="735" cy="270" r="215" fill="url(#omniaGlobeGlow)" />
        <circle cx="735" cy="270" r="174" fill="url(#omniaDots)" opacity="0.85" />
        <g clipPath="url(#omniaGlobeClip)" opacity="0.55">
          <ellipse cx="735" cy="270" rx="174" ry="62" stroke="#002050" strokeOpacity="0.17" />
          <ellipse cx="735" cy="270" rx="174" ry="112" stroke="#BF8813" strokeOpacity="0.18" />
          <ellipse cx="735" cy="270" rx="70" ry="174" stroke="#002050" strokeOpacity="0.13" />
          <ellipse cx="735" cy="270" rx="124" ry="174" stroke="#002050" strokeOpacity="0.10" />
        </g>
        <path d="M120 392C298 274 377 424 527 324C647 244 689 154 831 163C901 168 956 203 1030 170" stroke="#002050" strokeOpacity="0.75" strokeWidth="2" />
        <path d="M64 356C240 248 361 359 500 285C650 205 696 112 858 121C929 125 978 151 1040 135" stroke="#BF8813" strokeOpacity="0.78" strokeWidth="2" />
        <path d="M178 430C347 319 429 449 579 355C704 276 754 226 873 229C937 231 980 250 1033 240" stroke="#BF8813" strokeOpacity="0.24" strokeWidth="1.5" />
        {[260, 420, 592, 810, 930].map((x, index) => (
          <circle key={x} cx={x} cy={[326, 274, 250, 168, 222][index]} r="5" fill="white" stroke={index % 2 === 0 ? '#BF8813' : '#002050'} strokeWidth="2" />
        ))}
      </svg>
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
      <section id="contenu-principal" className="relative isolate overflow-hidden border-b border-slate-200 pt-20">
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
          <div className="hidden min-h-[330px] lg:block" />
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
  const items = visibleItems(section);
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
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:mt-0 lg:grid-cols-5 lg:gap-0">
          {items.map((item, index) => {
            const Icon = ICONS[item.icon_key] || ArrowRight;
            return (
              <div key={item.id} className="relative text-center">
                {index < items.length - 1 && <span className="absolute left-[60%] right-[-40%] top-6 hidden h-px bg-gradient-to-r from-[#BF8813]/70 to-[#BF8813]/20 lg:block" />}
                <span className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-[#002050] shadow-sm"><Icon size={20} /></span>
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
  const community = items.find(item => safeHref(item.action_url) === '/forum' || item.title.toLowerCase().includes('communauté'));
  const projects = items.find(item => safeHref(item.action_url) === '/projects' || item.title.toLowerCase().includes('project'));

  return (
    <>
      <section id="ecosysteme" className="bg-[#002050] px-5 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-7 lg:grid-cols-[240px_1fr] lg:items-start">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">{section.title}</h2>
              {section.subtitle && <p className="mt-3 text-sm leading-6 text-white/65">{section.subtitle}</p>}
              {section.primary_cta_label && <Link to={safeHref(section.primary_cta_url)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#BF8813] px-4 py-2.5 text-sm font-black text-white">{section.primary_cta_label}<ArrowRight size={15} /></Link>}
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-3">
              {items.map(item => {
                const Icon = ICONS[item.icon_key] || ArrowRight;
                return (
                  <Link key={item.id} to={safeHref(item.action_url)} className="group min-h-40 bg-[#002050] p-5 transition hover:bg-[#062B63]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#BF8813]/50 bg-[#BF8813]/10 text-[#E2B550]"><Icon size={19} /></span>
                    <h3 className="mt-4 text-sm font-black text-white">{item.title}</h3>
                    {item.description && <p className="mt-2 text-xs leading-5 text-white/60">{item.description}</p>}
                    {item.action_label && <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#E2B550]">{item.action_label}<ArrowRight size={13} /></span>}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {(community || projects) && (
        <section className="border-b border-slate-200 bg-white px-5 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
            {[community, projects].filter((item): item is LandingContentItem => Boolean(item)).map(item => {
              const Icon = ICONS[item.icon_key] || ArrowRight;
              return (
                <article key={item.id} className="rounded-2xl border border-[#E8DDBF] bg-[#FFFCF6] p-6 sm:flex sm:gap-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#D8B65D] text-[#BF8813]"><Icon size={22} /></span>
                  <div className="mt-4 sm:mt-0">
                    <h3 className="text-lg font-black text-[#002050]">{item.title}</h3>
                    {item.description && <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>}
                    {actionFor(item)}
                  </div>
                </article>
              );
            })}
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
  return (
    <section id="rejoindre-omnia" className="border-b border-slate-200 bg-[#002050] px-5 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {section.eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E6BE63]">{section.eyebrow}</p>}
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">{section.title}</h2>
          {section.subtitle && <p className="mt-3 text-base leading-7 text-blue-100">{section.subtitle}</p>}
          {section.body && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-white/65">{section.body}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
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
        if (section.type === 'credentials') return <EditorialSection key={section.id} section={section} id="preuves" />;
        if (section.type === 'career_recruitment') return <EditorialSection key={section.id} section={section} id="carriere" muted />;
        if (section.type === 'structures') return <EditorialSection key={section.id} section={section} id="structures" />;
        if (section.type === 'partners') return <PartnersSection key={section.id} section={section} partners={data.partners} />;
        if (section.type === 'mobile_apps' || section.type === 'social_networks') return <ConnectionsSection key={section.id} section={section} apps={data.mobileApps} networks={data.socialNetworks} />;
        if (section.type === 'final_cta') return <FinalCta key={section.id} section={section} />;
        return <EditorialSection key={section.id} section={section} muted={section.order % 2 === 0} />;
      })}
    </main>
  );
}
