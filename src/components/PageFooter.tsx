import { Link } from 'react-router-dom';
import {
  ExternalLink, Facebook, Globe2, Instagram, Linkedin, MessageCircle, Youtube,
  type LucideIcon,
} from 'lucide-react';
import type { MobileAppItem, SocialNetworkItem } from '../types/landingCms';

type LegacySocialNetworks = {
  facebook?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
  indeed?: string | null;
  whatsapp?: string | null;
};

type LegacyAppDownloads = {
  google_play?: string | null;
  app_store?: string | null;
};

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
}

const FOOTER_COLS = {
  formations: [
    { label: 'Catalogue complet', href: '/catalogue' },
    { label: 'Formations gratuites', href: '/catalogue?prix=gratuit' },
    { label: 'Certifications CPD', href: '/catalogue?type=cpd' },
    { label: 'Vérifier un certificat', href: '/verify' },
  ],
  ecosysteme: [
    { label: 'Omnia Live', href: '/omnia-live' },
    { label: 'Omnia Projects', href: '/projects' },
    { label: 'Omnia Coaching', href: '/coaching' },
    { label: 'Omnia Talent', href: '/talent' },
    { label: 'Carrière et opportunités', href: '/emploi' },
    { label: 'Forum', href: '/forum' },
  ],
  rejoindre: [
    { label: 'Devenir professeur', href: '/inscription/professeur' },
    { label: 'Devenir coach', href: '/coaching/devenir-coach' },
    { label: 'Devenir organisateur', href: '/inscription/organisateur' },
    { label: 'Devenir recruteur', href: '/inscription/recruteur' },
    { label: 'Inscrire une structure', href: '/inscription/structure' },
    { label: 'À propos', href: '/a-propos' },
  ],
  legal: [
    { label: 'Politique de confidentialité', href: '/confidentialite' },
    { label: 'CGU', href: '/cgu' },
    { label: 'Mentions légales', href: '/mentions-legales' },
    { label: 'Politique cookies', href: '/cookies' },
    { label: 'CGV', href: '/cgv' },
    { label: 'Remboursements & annulations', href: '/remboursements' },
  ],
};

const SOCIAL_ICON_MAP: Record<string, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
  other: Globe2,
};


function isSafeExternalUrl(value: string | null | undefined) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

const linkCls = 'mb-2 block text-sm transition-opacity last:mb-0 hover:opacity-80';
const linkStyle = { color: 'rgba(255,255,255,0.65)' };

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
    value.app_store ? { id: 'legacy-ios', store: 'ios' as const, name: 'App Store', url: value.app_store, enabled: true, display_order: 1, show_homepage: false, show_footer: true } : null,
    value.google_play ? { id: 'legacy-android', store: 'android' as const, name: 'Google Play', url: value.google_play, enabled: true, display_order: 2, show_homepage: false, show_footer: true } : null,
  ].filter((item): item is MobileAppItem => item !== null);
}

export function PageFooter({
  socialNetworks = {},
  socialNetworksV2 = [],
  appDownloads = {},
  mobileAppsV2 = [],
  partners = [],
  followUsLabel = 'Suivez-nous',
  managedOnly = false,
}: FooterProps) {
  const socialSource = managedOnly ? socialNetworksV2 : (socialNetworksV2.length > 0 ? socialNetworksV2 : legacySocialItems(socialNetworks));
  const appSource = managedOnly ? mobileAppsV2 : (mobileAppsV2.length > 0 ? mobileAppsV2 : legacyApps(appDownloads));
  const socialItems = socialSource
    .filter(item => item.enabled && item.show_footer && isSafeExternalUrl(item.url) && (item.logo_url || item.icon_key))
    .sort((a, b) => a.display_order - b.display_order);
  const appItems = appSource
    .filter(item => item.enabled && item.show_footer && isSafeExternalUrl(item.url))
    .sort((a, b) => a.display_order - b.display_order);
  const footerPartners = partners.filter(partner => partner.show_footer && partner.logo_url && (!partner.website_url || isSafeExternalUrl(partner.website_url)));

  return (
    <footer style={{ backgroundColor: '#002050', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div>
          <div className="mb-4 flex items-center gap-2.5">
            <img src="/IMG_0349.png" alt="" className="h-9 w-auto object-contain brightness-0 invert" />
            <div>
              <div className="font-bold leading-none text-white" style={{ fontSize: '14px', letterSpacing: '0.09em' }}>OMNIA</div>
              <div className="font-semibold" style={{ color: '#BF8813', fontSize: '8px', letterSpacing: '0.18em', marginTop: '2px' }}>GLOBAL ACADEMY</div>
            </div>
          </div>
          <p className="mb-5 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Formation, compétences et opportunités professionnelles dans un même écosystème.
          </p>
          {socialItems.length > 0 && (
            <>
              <p className="mb-3 text-sm font-semibold text-white">{followUsLabel}</p>
              <div className="flex flex-wrap gap-3">
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
                      className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full transition-opacity hover:opacity-75"
                      style={{ backgroundColor: 'rgba(191,136,19,0.18)' }}
                    >
                      {item.logo_url
                        ? <img src={item.logo_url} alt="" loading="lazy" decoding="async" className="h-5 w-5 object-contain" />
                        : <Icon size={16} style={{ color: '#BF8813' }} />}
                    </a>
                  );
                })}
              </div>
            </>
          )}
          {footerPartners.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/70">Partenaires</p>
              <div className="flex flex-wrap items-center gap-3">
                {footerPartners.map(partner => {
                  const logo = <img src={partner.logo_url!} alt={partner.alt_text || `Logo ${partner.name}`} className="max-h-7 max-w-20 object-contain" />;
                  return partner.website_url ? (
                    <a key={partner.id} href={partner.website_url} target="_blank" rel="noopener noreferrer" title={partner.name} className="rounded bg-white/95 px-2 py-1.5">{logo}</a>
                  ) : (
                    <span key={partner.id} title={partner.name} className="rounded bg-white/95 px-2 py-1.5">{logo}</span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold text-white">Formations</p>
          {FOOTER_COLS.formations.map(({ label, href }) => <Link key={label} to={href} className={linkCls} style={linkStyle}>{label}</Link>)}
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold text-white">Écosystème</p>
          {FOOTER_COLS.ecosysteme.map(({ label, href }) => <Link key={label} to={href} className={linkCls} style={linkStyle}>{label}</Link>)}
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold text-white">Rejoindre Omnia</p>
          {FOOTER_COLS.rejoindre.map(({ label, href }) => <Link key={label} to={href} className={linkCls} style={linkStyle}>{label}</Link>)}
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold text-white">Informations</p>
          {FOOTER_COLS.legal.map(({ label, href }) => <Link key={label} to={href} className={linkCls} style={linkStyle}>{label}</Link>)}
          {appItems.length > 0 && (
            <div className="mt-5 space-y-2">
              {appItems.map(app => (
                <a
                  key={app.id}
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mr-2 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-80"
                  style={{ border: '1px solid rgba(255,255,255,0.25)' }}
                >
                  <ExternalLink size={13} /> {app.name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ backgroundColor: '#001540', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="mx-auto max-w-7xl px-6 py-4 text-center text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          © {new Date().getFullYear()} Omnia Global Academy. Tous droits réservés. Bamako, Mali.
        </p>
      </div>
    </footer>
  );
}
