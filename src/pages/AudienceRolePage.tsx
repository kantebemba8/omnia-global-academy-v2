import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Briefcase, Building2, CheckCircle2, GraduationCap, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { getPublicSiteSettings } from '../lib/siteSettingsCache';
import {
  createDefaultLandingPage,
  normalizeLandingPage,
  type AudiencePageConfig,
  type AudiencePageKey,
  type LandingFooterConfig,
  type LandingPageConfig,
  type MobileAppItem,
  type SocialNetworkItem,
} from '../types/landingCms';

type Settings = {
  social_networks_v2?: SocialNetworkItem[];
  mobile_apps_v2?: MobileAppItem[];
  landing_page?: LandingPageConfig | unknown;
  public_partners?: Array<{ id: string; name: string; logo_url?: string | null; website_url?: string | null; alt_text?: string | null; show_footer?: boolean }>;
};

const ICONS = [GraduationCap, BookOpen, Briefcase, Building2, Users, ShieldCheck, Sparkles, CheckCircle2];

function audienceTone(key: AudiencePageKey) {
  switch (key) {
    case 'apprenants':
      return {
        badge: 'bg-[#FFF4D8] text-[#8A6413]',
        accent: 'from-[#0F61CF] via-[#3F87E6] to-[#9CC6FF]',
        soft: 'bg-[#F4F8FF]',
      };
    case 'professeurs':
      return {
        badge: 'bg-[#F0F5FF] text-[#244C9A]',
        accent: 'from-[#0A4EB4] via-[#2A79D9] to-[#8ABAF6]',
        soft: 'bg-[#F6F9FF]',
      };
    case 'structures':
      return {
        badge: 'bg-[#FFF1DB] text-[#8B5B08]',
        accent: 'from-[#0F56B8] via-[#2C72D7] to-[#7EB1F2]',
        soft: 'bg-[#F5F8FF]',
      };
    default:
      return {
        badge: 'bg-[#EEF6FF] text-[#225396]',
        accent: 'from-[#0D59C2] via-[#327BDE] to-[#8EC0FF]',
        soft: 'bg-[#F5F9FF]',
      };
  }
}

function RoleIllustration({ audienceKey }: { audienceKey: AudiencePageKey }) {
  return (
    <div className="relative h-[300px] w-full overflow-hidden rounded-[2rem] border border-white/30 bg-[linear-gradient(140deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04))] shadow-[0_24px_64px_rgba(0,32,80,0.18)] backdrop-blur-sm">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_22%,rgba(255,245,214,0.95),rgba(244,198,89,0.48)_18%,rgba(255,255,255,0)_36%),linear-gradient(130deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))]" />
      <div className="absolute -bottom-10 -right-6 h-40 w-40 rounded-full border border-[#E0B34F]/50" />
      <div className="absolute bottom-4 right-6 h-24 w-24 rounded-full border border-white/40" />
      <div className="absolute left-8 top-8 h-16 w-16 rounded-2xl bg-white/20" />
      <div className="absolute left-10 top-10 h-[88px] w-[144px] rounded-2xl border border-white/35 bg-white/15 shadow-lg backdrop-blur-sm" />
      <div className="absolute left-14 top-14 h-2 w-16 rounded-full bg-white/80" />
      <div className="absolute left-14 top-21 h-2 w-24 rounded-full bg-white/55" />
      <div className="absolute left-14 top-28 h-2 w-20 rounded-full bg-white/45" />
      <div className="absolute right-10 top-16 h-[128px] w-[168px] rounded-[1.6rem] border border-white/35 bg-[#0F4DA7]/35 shadow-lg backdrop-blur-sm" />
      <div className="absolute right-16 top-24 h-16 w-16 rounded-2xl bg-[#F8C95A]/40 blur-[1px]" />
      <div className="absolute right-16 top-24 h-16 w-16 rounded-2xl border border-[#FFE9A4]/50" />
      <div className="absolute right-28 top-32 h-2 w-14 rounded-full bg-white/80" />
      <div className="absolute right-28 top-39 h-2 w-20 rounded-full bg-white/55" />
      <div className="absolute left-12 bottom-12 right-14 h-[118px] rounded-[1.7rem] border border-white/30 bg-[#002050]/18 shadow-lg backdrop-blur-sm" />
      <div className="absolute left-16 bottom-24 h-3 w-28 rounded-full bg-white/78" />
      <div className="absolute left-16 bottom-16 h-14 w-14 rounded-full border border-[#F5CC73]/60 bg-[#E2B34A]/18" />
      <div className="absolute left-34 bottom-18 h-8 w-28 rounded-2xl border border-white/30 bg-white/12" />
      <div className="absolute right-20 bottom-18 h-2 w-20 rounded-full bg-white/60" />
      <div className="absolute left-[40%] top-0 h-px w-[52%] rotate-[22deg] bg-gradient-to-r from-transparent via-white/90 to-transparent" />
      {audienceKey === 'structures' && (
        <>
          <div className="absolute bottom-24 right-8 h-20 w-20 rounded-[1.4rem] border border-[#FFE8AC]/45 bg-[#F2C45D]/18" />
          <div className="absolute bottom-28 right-14 h-8 w-8 rounded-full bg-white/70" />
        </>
      )}
    </div>
  );
}

function sectionItems(items: AudiencePageConfig['items']) {
  return items
    .filter(item => item.enabled !== false && (item.title.trim() || item.description.trim() || item.label.trim()))
    .sort((a, b) => a.order - b.order);
}

export function AudienceRolePage({ audienceKey }: { audienceKey: AudiencePageKey }) {
  const [settings, setSettings] = useState<Settings>({});

  useEffect(() => {
    let active = true;
    getPublicSiteSettings()
      .then(data => {
        if (active) setSettings(data);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const landingPage = useMemo(() => normalizeLandingPage(settings.landing_page), [settings.landing_page]);
  const page = landingPage.audience_pages[audienceKey] || createDefaultLandingPage().audience_pages[audienceKey];
  const tones = audienceTone(audienceKey);
  const audienceLinks = Object.values(landingPage.audience_pages)
    .filter(entry => entry.enabled)
    .map(entry => ({ label: entry.nav_label, href: entry.route }));

  const benefits = sectionItems(page.items);
  const segments = sectionItems(page.segments);
  const steps = sectionItems(page.steps);

  return (
    <div className="bg-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Navbar showAudienceBar audienceLinks={audienceLinks} />

      <main className="pt-[116px]">
        <section className={`overflow-hidden bg-gradient-to-br ${tones.accent} text-white`}>
          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.88fr)] lg:px-8 lg:py-20">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white/90">
                {page.hero_eyebrow}
              </span>
              <h1 className="mt-5 text-[2.2rem] font-black leading-[1.05] tracking-[-0.05em] sm:text-[2.8rem] lg:text-[3.2rem]">
                {page.hero_title}
              </h1>
              {page.hero_subtitle && <p className="mt-5 max-w-xl text-base leading-7 text-white/90 sm:text-lg">{page.hero_subtitle}</p>}
              {page.hero_body && <p className="mt-3 max-w-xl whitespace-pre-line text-sm leading-7 text-white/75">{page.hero_body}</p>}
              <div className="mt-7 flex flex-wrap gap-3">
                {page.primary_cta_label && (
                  <Link to={page.primary_cta_url} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#002050] shadow-lg shadow-[#001A43]/15 transition hover:-translate-y-0.5">
                    {page.primary_cta_label} <ArrowRight size={16} />
                  </Link>
                )}
                {page.secondary_cta_label && (
                  <Link to={page.secondary_cta_url} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/16">
                    {page.secondary_cta_label}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center justify-center lg:justify-end">
              <RoleIllustration audienceKey={audienceKey} />
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-6 py-14 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${tones.badge}`}>{page.highlight_label}</span>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.highlight_title}</h2>
            </div>
            <p className="max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">{page.highlight_body}</p>
          </div>
        </section>

        <section className={`border-b border-slate-200 ${tones.soft} px-6 py-14 lg:px-8`}>
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.items_title}</h2>
              {page.items_subtitle && <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{page.items_subtitle}</p>}
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {benefits.map((item, index) => {
                const Icon = ICONS[index % ICONS.length];
                return (
                  <article key={item.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex gap-4">
                      <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F6E6B7] text-[#8A6516]"><Icon size={22} /></span>
                      <div>
                        <h3 className="text-lg font-black text-[#002050]">{item.title || item.label}</h3>
                        {item.description && <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-6 py-14 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.segments_title}</h2>
              {page.segments_subtitle && <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{page.segments_subtitle}</p>}
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {segments.map((item) => (
                <article key={item.id} className="rounded-[1.6rem] border border-slate-200 bg-[#FBFCFF] p-6">
                  {item.label && <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#BF8813]">{item.label}</p>}
                  <h3 className="mt-3 text-xl font-black text-[#002050]">{item.title}</h3>
                  {item.description && <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-[#F8FAFD] px-6 py-14 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.steps_title}</h2>
              {page.steps_subtitle && <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{page.steps_subtitle}</p>}
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {steps.map((item) => (
                <article key={item.id} className="relative rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="inline-flex rounded-full bg-[#002050] px-3 py-1 text-xs font-bold text-white">{item.label || String(item.order).padStart(2, '0')}</span>
                  <h3 className="mt-4 text-xl font-black text-[#002050]">{item.title}</h3>
                  {item.description && <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#002050] px-6 py-14 text-white lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-black tracking-[-0.04em]">Prêt à aller plus loin ?</h2>
              <p className="mt-3 text-sm leading-7 text-white/75 sm:text-base">Choisissez le rôle qui correspond à votre usage et découvrez une expérience Omnia adaptée.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {page.primary_cta_label && (
                <Link to={page.primary_cta_url} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#002050]">
                  {page.primary_cta_label} <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <PageFooter
        socialNetworksV2={settings.social_networks_v2 || []}
        mobileAppsV2={settings.mobile_apps_v2 || []}
        partners={settings.public_partners || []}
        footerConfig={(landingPage as LandingPageConfig).footer as LandingFooterConfig}
        managedOnly
      />
    </div>
  );
}
