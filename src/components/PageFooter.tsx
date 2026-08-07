import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ExternalLink,
  Facebook,
  Globe2,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import {
  createDefaultLandingPage,
  type LandingFooterConfig,
  type MobileAppItem,
  type SocialNetworkItem,
} from '../types/landingCms';
import { ENDPOINTS } from '../lib/config';
import { edgeGatewayHeaders } from '../lib/edgeAuth';

type LegacySocialNetworks = Record<string, string | null | undefined>;
type LegacyAppDownloads = { google_play?: string | null; app_store?: string | null };
type PublicPartner = {
  id: string;
  name: string;
  logo_url?: string | null;
  website_url?: string | null;
  alt_text?: string | null;
  show_footer?: boolean;
};

interface FooterProps {
  socialNetworks?: LegacySocialNetworks;
  socialNetworksV2?: SocialNetworkItem[];
  appDownloads?: LegacyAppDownloads;
  mobileAppsV2?: MobileAppItem[];
  partners?: PublicPartner[];
  followUsLabel?: string;
  managedOnly?: boolean;
  footerConfig?: LandingFooterConfig;
}

const SOCIAL_ICON_MAP: Record<string, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
  other: Globe2,
};

function isSafeExternalUrl(value: string | null | undefined) {
  return typeof value === 'string' && /^https:\/\//i.test(value.trim());
}

function isSafeInternalUrl(value: string | null | undefined) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

function legacySocialItems(value: LegacySocialNetworks): SocialNetworkItem[] {
  return Object.entries(value)
    .filter(([, url]) => typeof url === 'string' && url.trim())
    .map(([key, url], index) => ({
      id: `legacy-${key}`,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      url: String(url),
      enabled: true,
      display_order: index + 1,
      show_homepage: false,
      show_footer: true,
      icon_key: SOCIAL_ICON_MAP[key] ? key : 'other',
      logo_url: '',
      alt_text: '',
    }));
}

function legacyApps(value: LegacyAppDownloads): MobileAppItem[] {
  return [
    value.app_store
      ? {
          id: 'legacy-ios',
          store: 'ios' as const,
          name: 'App Store',
          url: value.app_store,
          enabled: true,
          display_order: 1,
          show_homepage: false,
          show_footer: true,
        }
      : null,
    value.google_play
      ? {
          id: 'legacy-android',
          store: 'android' as const,
          name: 'Google Play',
          url: value.google_play,
          enabled: true,
          display_order: 2,
          show_homepage: false,
          show_footer: true,
        }
      : null,
  ].filter((item): item is MobileAppItem => item !== null);
}

const linkClass = 'block rounded-lg py-1.5 text-sm text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]';

export function PageFooter({
  socialNetworks = {},
  socialNetworksV2 = [],
  appDownloads = {},
  mobileAppsV2 = [],
  partners = [],
  followUsLabel,
  managedOnly = false,
  footerConfig,
}: FooterProps) {
  const fallback = createDefaultLandingPage().footer;
  const config = footerConfig || fallback;
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [newsletterWebsite, setNewsletterWebsite] = useState('');
  const [newsletterState, setNewsletterState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [newsletterMessage, setNewsletterMessage] = useState('');

  async function subscribeNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newsletterEmail.trim() || !newsletterConsent || newsletterState === 'loading') return;
    setNewsletterState('loading');
    setNewsletterMessage('');
    try {
      const response = await fetch(ENDPOINTS.newsletterSend, {
        method: 'POST',
        headers: edgeGatewayHeaders(),
        body: JSON.stringify({
          action: 'subscribe',
          email: newsletterEmail.trim(),
          consent: true,
          source: 'public_footer',
          locale: document.documentElement.lang || navigator.language?.slice(0, 2) || 'fr',
          website: newsletterWebsite,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || 'Inscription impossible.');
      setNewsletterState('success');
      setNewsletterMessage(data.message || 'Inscription enregistrée.');
      setNewsletterEmail('');
      setNewsletterConsent(false);
    } catch (error) {
      setNewsletterState('error');
      setNewsletterMessage(error instanceof Error ? error.message : 'Inscription impossible.');
    }
  }
  const socialSource = managedOnly
    ? socialNetworksV2
    : (socialNetworksV2.length > 0 ? socialNetworksV2 : legacySocialItems(socialNetworks));
  const appSource = managedOnly
    ? mobileAppsV2
    : (mobileAppsV2.length > 0 ? mobileAppsV2 : legacyApps(appDownloads));

  const socialItems = socialSource
    .filter(item => item.enabled && item.show_footer && isSafeExternalUrl(item.url) && (item.logo_url || item.icon_key))
    .sort((a, b) => a.display_order - b.display_order);

  const appItems = appSource
    .filter(item => item.enabled && item.show_footer && isSafeExternalUrl(item.url))
    .sort((a, b) => a.display_order - b.display_order);

  const footerPartners = partners.filter(
    partner => partner.show_footer && partner.logo_url && (!partner.website_url || isSafeExternalUrl(partner.website_url)),
  );

  const columns = (config.columns || fallback.columns)
    .filter(column => column.title.trim())
    .sort((a, b) => a.order - b.order);

  const visibleLinks = (column: (typeof columns)[number]) => (
    column.links
      .filter(item => item.enabled && item.label.trim() && isSafeInternalUrl(item.href))
      .sort((a, b) => a.order - b.order)
  );

  return (
    <footer className="bg-[#002050] font-sans">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:py-12">
        <section aria-labelledby="omnia-newsletter-title" className="relative mb-10 overflow-hidden rounded-3xl border-2 border-[#BF8813]/70 bg-white/[0.10] p-5 shadow-2xl shadow-black/20 ring-1 ring-white/10 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#BF8813]/20 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(240px,0.85fr)_minmax(0,1.15fr)] lg:items-center">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#BF8813] text-[#002050] shadow-lg shadow-black/20">
                <Mail className="h-6 w-6" />
              </div>
              <h2 id="omnia-newsletter-title" className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">Omnia Newsletter</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">Recevez les actualités, nouvelles formations, ressources et opportunités importantes d’Omnia Global Academy.</p>
            </div>

            <form onSubmit={subscribeNewsletter} className="rounded-2xl border border-white/20 bg-[#00183D]/70 p-4 backdrop-blur-sm sm:p-5">
              <label className="sr-only" htmlFor="footer-newsletter-email">Adresse e-mail</label>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  id="footer-newsletter-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={newsletterEmail}
                  onChange={event => setNewsletterEmail(event.target.value)}
                  placeholder="votre@email.com"
                  className="h-12 min-w-0 rounded-xl border border-white/20 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#BF8813] focus:ring-4 focus:ring-[#BF8813]/20"
                />
                <button type="submit" disabled={!newsletterConsent || newsletterState === 'loading'} className="h-12 rounded-xl bg-[#BF8813] px-6 text-sm font-black text-[#002050] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#D29A21] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
                  {newsletterState === 'loading' ? 'Envoi…' : 'S’inscrire'}
                </button>
              </div>
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={newsletterWebsite} onChange={event => setNewsletterWebsite(event.target.value)} className="hidden" />
              <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-white/80">
                <input type="checkbox" checked={newsletterConsent} onChange={event => setNewsletterConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-[#BF8813]" />
                <span>J’accepte de recevoir Omnia Newsletter. Je peux me désinscrire à tout moment.</span>
              </label>
              {newsletterMessage && <p className={`mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${newsletterState === 'success' ? 'bg-green-400/15 text-green-200' : 'bg-amber-300/15 text-amber-100'}`}>{newsletterState === 'success' && <CheckCircle2 className="h-3.5 w-3.5" />}{newsletterMessage}</p>}
              <Link to="/newsletter" className="mt-3 inline-flex text-xs font-bold text-[#F4C45E] underline decoration-[#BF8813]/60 underline-offset-4 transition hover:text-white">Gérer mon abonnement</Link>
            </form>
          </div>
        </section>

        <div className="grid gap-9 lg:grid-cols-[minmax(230px,0.75fr)_minmax(0,1.25fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/IMG_0349.png" alt="" className="h-9 w-auto object-contain brightness-0 invert" />
              <div>
                <div className="text-sm font-bold leading-none tracking-[0.09em] text-white">OMNIA</div>
                <div className="mt-0.5 text-[8px] font-semibold tracking-[0.18em] text-[#BF8813]">GLOBAL ACADEMY</div>
                <div className="mt-1 text-[7px] font-bold tracking-[0.06em] text-white/55">EMPOWER SKILLS. TRANSFORM AFRICA. IMPACT THE WORLD.</div>
              </div>
            </div>

            {config.description && (
              <p className="mt-4 max-w-sm text-xs leading-6 text-white/55">{config.description}</p>
            )}

            {socialItems.length > 0 && (
              <div className="mt-5">
                <p className="mb-3 text-xs font-semibold text-white/80">
                  {config.follow_us_label || followUsLabel || fallback.follow_us_label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {socialItems.map(item => {
                    const Icon = SOCIAL_ICON_MAP[item.icon_key] || Globe2;
                    return (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={item.alt_text || `${item.name} — Omnia Global Academy`}
                        title={item.name}
                        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] transition-all hover:-translate-y-0.5 hover:bg-white/10"
                      >
                        {item.logo_url
                          ? <img src={item.logo_url} alt="" loading="lazy" decoding="async" className="h-5 w-5 object-contain" />
                          : <Icon size={16} className="text-[#BF8813]" />}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {appItems.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {appItems.map(app => (
                  <a
                    key={app.id}
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.07] hover:text-white"
                  >
                    <ExternalLink size={13} />{app.name}
                  </a>
                ))}
              </div>
            )}

            {footerPartners.length > 0 && (
              <div className="mt-5">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  {config.partner_label || fallback.partner_label}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {footerPartners.map(partner => {
                    const logo = (
                      <img
                        src={partner.logo_url!}
                        alt={partner.alt_text || `Logo ${partner.name}`}
                        className="max-h-6 max-w-16 object-contain"
                      />
                    );
                    return partner.website_url ? (
                      <a
                        key={partner.id}
                        href={partner.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={partner.name}
                        className="rounded-lg bg-white/95 px-2 py-1.5"
                      >
                        {logo}
                      </a>
                    ) : (
                      <span key={partner.id} title={partner.name} className="rounded-lg bg-white/95 px-2 py-1.5">
                        {logo}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="hidden grid-cols-2 gap-x-8 gap-y-8 sm:grid lg:grid-cols-4">
              {columns.slice(0, 4).map(column => (
                <div key={column.id}>
                  <p className="mb-3 text-sm font-semibold text-white">{column.title}</p>
                  <nav aria-label={column.title}>
                    {visibleLinks(column).map(item => (
                      <Link key={item.id} to={item.href} className={linkClass}>{item.label}</Link>
                    ))}
                  </nav>
                </div>
              ))}
            </div>

            <div className="divide-y divide-white/10 rounded-2xl border border-white/10 sm:hidden">
              {columns.slice(0, 4).map(column => (
                <details key={column.id} className="group">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#BF8813]">
                    <span>{column.title}</span>
                    <span aria-hidden="true" className="text-[#BF8813] transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <nav aria-label={column.title} className="px-4 pb-4">
                    {visibleLinks(column).map(item => (
                      <Link key={item.id} to={item.href} className={linkClass}>{item.label}</Link>
                    ))}
                  </nav>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.06] bg-[#001540]">
        <p className="mx-auto max-w-7xl px-6 py-4 text-center text-xs text-white/45">
          © {new Date().getFullYear()} Omnia Global Academy. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
