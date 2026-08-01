import { Link } from 'react-router-dom';
import {
  ExternalLink, Facebook, Globe2, Instagram, Linkedin, MessageCircle, Youtube,
  type LucideIcon,
} from 'lucide-react';
import {
  createDefaultLandingPage,
  type LandingFooterConfig,
  type MobileAppItem,
  type SocialNetworkItem,
} from '../types/landingCms';

type LegacySocialNetworks = Record<string, string | null | undefined>;
type LegacyAppDownloads = { google_play?: string | null; app_store?: string | null };
type PublicPartner = { id: string; name: string; logo_url?: string | null; website_url?: string | null; alt_text?: string | null; show_footer?: boolean };

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
  return Object.entries(value).filter(([, url]) => typeof url === 'string' && url.trim()).map(([key, url], index) => ({
    id: `legacy-${key}`, name: key.charAt(0).toUpperCase() + key.slice(1), url: String(url), enabled: true,
    display_order: index + 1, show_homepage: false, show_footer: true,
    icon_key: SOCIAL_ICON_MAP[key] ? key : 'other', logo_url: '', alt_text: '',
  }));
}

function legacyApps(value: LegacyAppDownloads): MobileAppItem[] {
  return [
    value.app_store ? { id: 'legacy-ios', store: 'ios' as const, name: 'App Store', url: value.app_store, enabled: true, display_order: 1, show_homepage: false, show_footer: true } : null,
    value.google_play ? { id: 'legacy-android', store: 'android' as const, name: 'Google Play', url: value.google_play, enabled: true, display_order: 2, show_homepage: false, show_footer: true } : null,
  ].filter((item): item is MobileAppItem => item !== null);
}

const linkCls = 'mb-2 block text-sm transition-opacity last:mb-0 hover:opacity-80';
const linkStyle = { color: 'rgba(255,255,255,0.65)' };

export function PageFooter({
  socialNetworks = {}, socialNetworksV2 = [], appDownloads = {}, mobileAppsV2 = [], partners = [],
  followUsLabel, managedOnly = false, footerConfig,
}: FooterProps) {
  const fallback = createDefaultLandingPage().footer;
  const config = footerConfig || fallback;
  const socialSource = managedOnly ? socialNetworksV2 : (socialNetworksV2.length > 0 ? socialNetworksV2 : legacySocialItems(socialNetworks));
  const appSource = managedOnly ? mobileAppsV2 : (mobileAppsV2.length > 0 ? mobileAppsV2 : legacyApps(appDownloads));
  const socialItems = socialSource.filter(item => item.enabled && item.show_footer && isSafeExternalUrl(item.url) && (item.logo_url || item.icon_key)).sort((a, b) => a.display_order - b.display_order);
  const appItems = appSource.filter(item => item.enabled && item.show_footer && isSafeExternalUrl(item.url)).sort((a, b) => a.display_order - b.display_order);
  const footerPartners = partners.filter(partner => partner.show_footer && partner.logo_url && (!partner.website_url || isSafeExternalUrl(partner.website_url)));
  const columns = (config.columns || fallback.columns).filter(column => column.title.trim()).sort((a, b) => a.order - b.order);

  return (
    <footer style={{ backgroundColor: '#002050', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div>
          <div className="mb-4 flex items-center gap-2.5"><img src="/IMG_0349.png" alt="" className="h-9 w-auto object-contain brightness-0 invert" /><div><div className="text-sm font-bold leading-none tracking-[0.09em] text-white">OMNIA</div><div className="mt-0.5 text-[8px] font-semibold tracking-[0.18em] text-[#BF8813]">GLOBAL ACADEMY</div></div></div>
          {config.description && <p className="mb-5 text-xs leading-relaxed text-white/55">{config.description}</p>}
          {socialItems.length > 0 && <><p className="mb-3 text-sm font-semibold text-white">{config.follow_us_label || followUsLabel || fallback.follow_us_label}</p><div className="flex flex-wrap gap-3">{socialItems.map(item => { const Icon = SOCIAL_ICON_MAP[item.icon_key] || Globe2; return <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" aria-label={item.alt_text || `${item.name} — Omnia Global Academy`} title={item.name} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#BF8813]/20 transition-opacity hover:opacity-75">{item.logo_url ? <img src={item.logo_url} alt="" loading="lazy" decoding="async" className="h-5 w-5 object-contain" /> : <Icon size={16} className="text-[#BF8813]" />}</a>; })}</div></>}
          {footerPartners.length > 0 && <div className="mt-6"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/70">{config.partner_label || fallback.partner_label}</p><div className="flex flex-wrap items-center gap-3">{footerPartners.map(partner => { const logo = <img src={partner.logo_url!} alt={partner.alt_text || `Logo ${partner.name}`} className="max-h-7 max-w-20 object-contain" />; return partner.website_url ? <a key={partner.id} href={partner.website_url} target="_blank" rel="noopener noreferrer" title={partner.name} className="rounded bg-white/95 px-2 py-1.5">{logo}</a> : <span key={partner.id} title={partner.name} className="rounded bg-white/95 px-2 py-1.5">{logo}</span>; })}</div></div>}
        </div>
        {columns.slice(0, 4).map(column => <div key={column.id}><p className="mb-4 text-sm font-semibold text-white">{column.title}</p>{column.links.filter(item => item.enabled && item.label.trim() && isSafeInternalUrl(item.href)).sort((a, b) => a.order - b.order).map(item => <Link key={item.id} to={item.href} className={linkCls} style={linkStyle}>{item.label}</Link>)}{column === columns[columns.length - 1] && appItems.length > 0 && <div className="mt-5 space-y-2">{appItems.map(app => <a key={app.id} href={app.url} target="_blank" rel="noopener noreferrer" className="mr-2 inline-flex items-center gap-2 rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-80"><ExternalLink size={13} /> {app.name}</a>)}</div>}</div>)}
      </div>
      <div className="border-t border-white/[0.06] bg-[#001540]"><p className="mx-auto max-w-7xl px-6 py-4 text-center text-xs text-white/45">© {new Date().getFullYear()} Omnia Global Academy. Tous droits réservés. Bamako, Mali.</p></div>
    </footer>
  );
}
