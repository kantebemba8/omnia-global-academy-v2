import { Facebook, Instagram, Youtube, Linkedin, MessageCircle, ExternalLink } from 'lucide-react';

interface SocialNetworks {
  facebook?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
  indeed?: string | null;
  whatsapp?: string | null;
}

interface AppDownloads {
  google_play?: string | null;
  app_store?: string | null;
}

interface FooterProps {
  socialNetworks?: SocialNetworks;
  appDownloads?: AppDownloads;
  followUsLabel?: string;
}

const FOOTER_COLS = {
  formations: [
    { label: 'Catalogue complet',   href: '/catalogue' },
    { label: 'Formations gratuites', href: '/catalogue?prix=gratuit' },
    { label: 'Certifications CPD',  href: '/catalogue?type=cpd' },
    { label: 'Vérifier un certificat', href: '/verify' },
    { label: 'Nouveautés',          href: '/catalogue?tri=recent' },
  ],
  omnia: [
    { label: 'À propos',            href: '/a-propos' },
    { label: 'Devenir formateur',   href: '/inscription/professeur' },
    { label: 'Espace Carrière',     href: '/carrieres' },
    { label: 'Contact',             href: '/contact' },
  ],
  legal: [
    { label: 'Politique de confidentialité', href: '/confidentialite' },
    { label: 'CGU',                          href: '/cgu' },
    { label: 'Mentions légales',             href: '/mentions-legales' },
    { label: 'Politique cookies',              href: '/cookies' },
    { label: 'CGV',                            href: '/cgv' },
    { label: 'Remboursements & annulations',   href: '/remboursements' },
  ],
};

const linkCls = 'block text-sm transition-opacity hover:opacity-80 mb-2 last:mb-0';
const linkStyle = { color: 'rgba(255,255,255,0.65)' };

export function PageFooter({ socialNetworks = {}, appDownloads = {}, followUsLabel = 'Suivez-nous' }: FooterProps) {
  const socialItems = [
    { key: 'facebook',  icon: Facebook,       url: socialNetworks.facebook },
    { key: 'instagram', icon: Instagram,      url: socialNetworks.instagram },
    { key: 'youtube',   icon: Youtube,        url: socialNetworks.youtube },
    { key: 'linkedin',  icon: Linkedin,       url: socialNetworks.linkedin },
    { key: 'whatsapp',  icon: MessageCircle,  url: socialNetworks.whatsapp },
  ].filter(s => s.url);

  return (
    <footer style={{ backgroundColor: '#002050', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* Col 1 — Identité */}
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <img src="/IMG_0349.png" alt="Omnia" className="h-9 w-auto object-contain brightness-0 invert" />
            <div>
              <div className="font-bold leading-none text-white" style={{ fontSize: '14px', letterSpacing: '0.09em' }}>OMNIA</div>
              <div className="font-semibold" style={{ color: '#BF8813', fontSize: '8px', letterSpacing: '0.18em', marginTop: '2px' }}>GLOBAL ACADEMY</div>
            </div>
          </div>
          <p className="text-xs leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.55)' }}>
            La plateforme de formation certifiée pour l'Afrique de l'Ouest.
          </p>
          {socialItems.length > 0 && (
            <>
              <p className="text-sm font-semibold text-white mb-3">{followUsLabel}</p>
              <div className="flex gap-3 flex-wrap">
                {socialItems.map(({ key, icon: Icon, url }) => (
                  <a key={key} href={url!} target="_blank" rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-75"
                    style={{ backgroundColor: 'rgba(191,136,19,0.18)' }}>
                    <Icon size={15} style={{ color: '#BF8813' }} />
                  </a>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Col 2 — Formations */}
        <div>
          <p className="text-sm font-semibold text-white mb-4">Formations</p>
          {FOOTER_COLS.formations.map(({ label, href }) => (
            <a key={label} href={href} className={linkCls} style={linkStyle}>{label}</a>
          ))}
        </div>

        {/* Col 3 — Omnia */}
        <div>
          <p className="text-sm font-semibold text-white mb-4">Omnia Academy</p>
          {FOOTER_COLS.omnia.map(({ label, href }) => (
            <a key={label} href={href} className={linkCls} style={linkStyle}>{label}</a>
          ))}
        </div>

        {/* Col 4 — Légal + Apps */}
        <div>
          <p className="text-sm font-semibold text-white mb-4">Informations</p>
          {FOOTER_COLS.legal.map(({ label, href }) => (
            <a key={label} href={href} className={linkCls} style={linkStyle}>{label}</a>
          ))}

          {(appDownloads.app_store || appDownloads.google_play) && (
            <div className="mt-5 space-y-2">
              {appDownloads.app_store && (
                <a href={appDownloads.app_store} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-80"
                  style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
                  <ExternalLink size={13} /> App Store
                </a>
              )}
              {appDownloads.google_play && (
                <a href={appDownloads.google_play} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-80"
                  style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
                  <ExternalLink size={13} /> Google Play
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Copyright bar */}
      <div style={{ backgroundColor: '#001540', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="max-w-6xl mx-auto px-6 py-4 text-center text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          © 2026 Omnia Global Academy. Tous droits réservés. Bamako, Mali.
        </p>
      </div>
    </footer>
  );
}
