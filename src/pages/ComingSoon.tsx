import { useState, useEffect } from 'react';
import { Countdown } from '../components/Countdown';
import { WaitlistForm } from '../components/WaitlistForm';
import { SocialLinks } from '../components/SocialLinks';
import { useSiteMode } from '../context/SiteModeContext';
import {
  Award, Monitor, TrendingUp, Palette, Megaphone, Code, Globe, Check,
  Users,
} from 'lucide-react';
import { ENDPOINTS } from '../lib/config';

interface SiteSettings {
  coming_soon_enabled: boolean;
  coming_soon_title_fr: string;
  coming_soon_subtitle_fr: string;
  launch_date: string | null;
  social_networks: {
    facebook: string | null;
    instagram: string | null;
    youtube: string | null;
    linkedin: string | null;
    indeed: string | null;
    whatsapp: string | null;
  };
  app_downloads: {
    google_play: string | null;
    app_store: string | null;
  };
  collaborations_logos: Array<{
    name: string;
    file_url: string;
    link?: string | null;
  }>;
  follow_us_label_fr: string;
}

const defaultSettings: SiteSettings = {
  coming_soon_enabled: true,
  coming_soon_title_fr: "La plateforme africaine de formation en ligne arrive bientôt",
  coming_soon_subtitle_fr: "Omnia Global Academy réunit des enseignants et des apprenants du monde entier autour de formations certifiées, adaptées aux réalités africaines.",
  launch_date: null,
  social_networks: { facebook: null, instagram: null, youtube: null, linkedin: null, indeed: null, whatsapp: null },
  app_downloads: { google_play: null, app_store: null },
  collaborations_logos: [],
  follow_us_label_fr: "Suivez-nous",
};

const features = [
  { icon: Award,   title: "Certifications CPD internationales", desc: "Reconnues mondialement, valorisables sur LinkedIn en un clic" },
  { icon: Monitor, title: "Mode éco-data",                      desc: "Apprenez même avec une connexion limitée — optimisé pour l'Afrique de l'Ouest" },
  { icon: Globe,   title: "Paiement Mobile Money",              desc: "Wave, Orange Money, MTN, Moov et toutes les solutions locales africaines" },
];

const categories = [
  { icon: Monitor,    label: "Informatique" },
  { icon: TrendingUp, label: "Business" },
  { icon: Palette,    label: "Design" },
  { icon: Megaphone,  label: "Marketing" },
  { icon: Code,       label: "Développement" },
  { icon: Globe,      label: "Langues" },
];

const instructorBullets = [
  "Créez et publiez vos cours",
  "Touchez des apprenants du monde entier",
  "Gérez vos revenus facilement",
  "Bénéficiez d'un accompagnement",
];

// ── SVG COMPONENTS ───────────────────────────────────────────────────────────

function AfricaLogoIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 56 70" width={size} height={Math.round(size * 1.25)} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        fill="#BF8813"
        d="M28,2 C32,1 38,3 43,2 C48,1 52,6 54,13 C56,20 53,28 54,34
           C55,40 52,47 48,53 C44,59 39,65 34,68 C31,70 28,67 26,63
           C22,58 17,51 12,44 C7,37 3,30 2,23 C1,16 4,9 9,5
           C14,1 21,1 28,2 Z"
      />
      <path
        fill="#BF8813"
        d="M47,30 C50,29 53,31 54,35 C55,40 53,46 50,49
           C48,51 45,50 44,46 C43,42 44,37 45,33 Z"
      />
    </svg>
  );
}

// ── PAGE ─────────────────────────────────────────────────────────────────────

export function ComingSoon() {
  const { waitlistCount, launchDate } = useSiteMode();
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(ENDPOINTS.siteSettings);
        if (res.ok) {
          const data = await res.json();
          setSettings({ ...defaultSettings, ...data });
        }
      } catch {
        console.error('Failed to fetch site settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div style={{ color: '#002050' }} className="text-base font-medium">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <header
        className="px-6 py-4 sticky top-0 z-10 bg-white"
        style={{ borderBottom: '1px solid #E4E7EC' }}
      >
        <div className="max-w-6xl mx-auto flex justify-start">
          <div className="flex items-center gap-3">
            <img
              src="/IMG_0349.png"
              alt="Omnia Global Academy"
              className="h-12 w-auto object-contain"
            />
            <div>
              <div className="font-bold leading-none" style={{ color: '#002050', fontSize: '18px', letterSpacing: '0.09em' }}>
                OMNIA
              </div>
              <div className="font-semibold" style={{ color: '#BF8813', fontSize: '9px', letterSpacing: '0.18em', marginTop: '3px' }}>
                GLOBAL ACADEMY
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="px-6 pt-14 pb-10 md:pt-20 md:pb-16" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-10 md:gap-0">

          {/* Left */}
          <div className="flex-1 md:pr-12">
            <div
              className="inline-block text-xs font-bold uppercase px-3 py-1 rounded-full mb-6"
              style={{ backgroundColor: 'rgba(191,136,19,0.12)', color: '#BF8813', letterSpacing: '0.11em' }}
            >
              Bientôt disponible
            </div>

            <h1
              className="font-bold leading-tight mb-4"
              style={{ color: '#002050', fontSize: 'clamp(28px, 4vw, 52px)', lineHeight: 1.12 }}
            >
              {settings.coming_soon_title_fr}
            </h1>

            <p
              className="font-semibold mb-5"
              style={{ color: '#BF8813', fontSize: 'clamp(15px, 1.8vw, 18px)', lineHeight: 1.5 }}
            >
              Apprenez. Enseignez. Inspirez le monde.
            </p>

            <p className="mb-8 max-w-md" style={{ color: '#6B7280', fontSize: '15px', lineHeight: '1.65' }}>
              {settings.coming_soon_subtitle_fr}
            </p>

            {waitlistCount > 0 && (
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full"
                style={{ backgroundColor: 'rgba(0,32,80,0.06)', border: '1px solid rgba(0,32,80,0.12)' }}>
                <Users className="w-4 h-4 flex-shrink-0" style={{ color: '#002050' }} />
                <p className="text-sm font-semibold" style={{ color: '#002050' }}>
                  Rejoignez les <span style={{ color: '#BF8813' }}>{waitlistCount.toLocaleString('fr-FR')}</span> personnes déjà inscrites
                </p>
              </div>
            )}

            {(settings.launch_date || launchDate) && (
              <div className="mb-8">
                <Countdown targetDate={(settings.launch_date || launchDate)!} variant="light" />
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <a
                href="#inscription"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-opacity hover:opacity-85"
                style={{ backgroundColor: '#002050', color: '#FFFFFF', fontSize: '15px' }}
              >
                Explorer les cours
              </a>
              <a
                href="#inscription"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors hover:bg-gray-100"
                style={{ border: '1.5px solid #002050', color: '#002050', fontSize: '15px' }}
              >
                Devenir formateur
              </a>
            </div>
          </div>

          {/* Right: globe image */}
          <div className="flex-shrink-0 w-full md:w-1/2 flex justify-center">
            <div className="bg-white rounded-2xl overflow-hidden w-full max-w-[480px]">
              <img
                src="/ChatGPT_Image_1_jul_2026,_21_21_28.png"
                alt="Globe doré centré sur l'Afrique"
                className="w-full object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── PILIERS ─────────────────────────────────────────────────── */}
      <section className="px-6 py-16" style={{ backgroundColor: '#002050' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-xs font-bold uppercase tracking-widest mb-10"
            style={{ color: '#BF8813', letterSpacing: '0.15em' }}>
            Pourquoi Omnia Global Academy ?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex flex-col gap-3 items-center md:items-start text-center md:text-left p-8 rounded-2xl transition-transform hover:-translate-y-1"
                style={{
                  border: '1px solid rgba(191,136,19,0.25)',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto md:mx-0 flex-shrink-0"
                  style={{ backgroundColor: 'rgba(191,136,19,0.18)' }}
                >
                  <f.icon className="w-5 h-5" style={{ color: '#BF8813' }} />
                </div>
                <p className="font-bold text-sm mt-1 leading-snug" style={{ color: '#FFFFFF' }}>{f.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.60)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATÉGORIES ──────────────────────────────────────────────── */}
      <section className="px-6 py-12 md:py-16 bg-white" style={{ borderTop: '1px solid #E4E7EC' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-bold" style={{ color: '#002050', fontSize: '22px' }}>
              Catégories populaires
            </h2>
            <span className="text-sm font-semibold cursor-pointer transition-opacity hover:opacity-70" style={{ color: '#BF8813' }}>
              Voir tout
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.label}
                className="flex flex-col items-center gap-3 p-5 rounded-xl cursor-default transition-shadow hover:shadow-md"
                style={{ border: '1px solid #E4E7EC', backgroundColor: '#FFFFFF' }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(191,136,19,0.08)' }}
                >
                  <cat.icon className="w-6 h-6" style={{ color: '#BF8813' }} />
                </div>
                <p className="font-semibold text-sm text-center" style={{ color: '#002050' }}>{cat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORMULAIRE D'INSCRIPTION ────────────────────────────────── */}
      <section
        id="inscription"
        className="px-6 py-14 md:py-20"
        style={{ backgroundColor: '#002050' }}
      >
        <div className="max-w-2xl mx-auto">
          <div
            className="bg-white rounded-2xl p-8 md:p-10"
            style={{ border: '1px solid rgba(191,136,19,0.25)', boxShadow: '0 4px 32px rgba(0,0,0,0.18)' }}
          >
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* ── DEVENIR FORMATEUR ───────────────────────────────────────── */}
      <section
        id="formateur"
        className="px-6 py-14 md:py-20"
        style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E4E7EC' }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          {/* Text */}
          <div className="flex-1">
            <div
              className="inline-block text-xs font-bold uppercase px-3 py-1 rounded-full mb-5"
              style={{ backgroundColor: 'rgba(191,136,19,0.10)', color: '#BF8813', letterSpacing: '0.11em' }}
            >
              Pour les formateurs
            </div>
            <h2
              className="font-bold mb-3"
              style={{ color: '#002050', fontSize: 'clamp(22px, 3vw, 34px)' }}
            >
              Devenir formateur
            </h2>
            <p className="mb-8" style={{ color: '#6B7280', fontSize: '16px', lineHeight: '1.65' }}>
              Partagez vos connaissances avec des millions d'apprenants à travers le monde et générez des revenus.
            </p>
            <ul className="space-y-3 mb-10">
              {instructorBullets.map((b) => (
                <li key={b} className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(191,136,19,0.14)' }}
                  >
                    <Check className="w-3 h-3" style={{ color: '#BF8813' }} />
                  </div>
                  <span style={{ color: '#374151', fontSize: '15px' }}>{b}</span>
                </li>
              ))}
            </ul>
            <a
              href="#inscription"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#002050', color: '#FFFFFF', fontSize: '15px' }}
            >
              Commencer maintenant
            </a>
          </div>

          {/* Instructor visual */}
          <div className="flex-shrink-0 w-full md:w-[48%] flex justify-center">
            <img
              src="/ChatGPT_Image_1_jul_2026,_21_19_05.png"
              alt="Formateur travaillant sur un ordinateur portable"
              className="w-full max-w-[520px] object-contain"
              style={{ mixBlendMode: 'multiply' }}
            />
          </div>
        </div>
      </section>

      {/* ── COLLABORATIONS PARTENAIRES ──────────────────────────────── */}
      {settings.collaborations_logos?.length > 0 && (
        <section className="px-6 py-12 bg-white" style={{ borderTop: '1px solid #E4E7EC' }}>
          <div className="max-w-6xl mx-auto">
            <h2 className="text-center font-bold mb-10" style={{ color: '#002050', fontSize: '22px' }}>
              Nos partenaires &amp; collaborations
            </h2>
            <div className="flex flex-wrap justify-center items-center gap-8">
              {settings.collaborations_logos.map((logo, i) =>
                logo.link ? (
                  <a key={i} href={logo.link} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-75">
                    <img src={logo.file_url} alt={logo.name} style={{ height: '48px', objectFit: 'contain' }} />
                  </a>
                ) : (
                  <img key={i} src={logo.file_url} alt={logo.name} style={{ height: '48px', objectFit: 'contain' }} />
                )
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── RÉSEAUX SOCIAUX ─────────────────────────────────────────── */}
      {Object.values(settings.social_networks).some(Boolean) && (
        <section
          className="px-6 py-10"
          style={{ backgroundColor: '#F8F9FA', borderTop: '1px solid #E4E7EC' }}
        >
          <div className="max-w-4xl mx-auto text-center">
            <p className="font-semibold mb-6" style={{ color: '#002050', fontSize: '18px' }}>
              {settings.follow_us_label_fr}
            </p>
            <SocialLinks networks={settings.social_networks} />
          </div>
        </section>
      )}

      {/* ── TÉLÉCHARGEMENT APPLICATION ──────────────────────────────── */}
      {(settings.app_downloads?.google_play || settings.app_downloads?.app_store) && (
        <section className="px-6 py-10 bg-white" style={{ borderTop: '1px solid #E4E7EC' }}>
          <div className="max-w-4xl mx-auto text-center">
            <p className="font-semibold mb-6" style={{ color: '#002050', fontSize: '18px' }}>
              Téléchargez l'application
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              {settings.app_downloads?.app_store && (
                <a
                  href={settings.app_downloads.app_store}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-opacity hover:opacity-85"
                  style={{ backgroundColor: '#002050', color: '#FFFFFF', fontSize: '14px' }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.19 1.28-2.17 3.83.02 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.65M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  App Store
                </a>
              )}
              {settings.app_downloads?.google_play && (
                <a
                  href={settings.app_downloads.google_play}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-opacity hover:opacity-85"
                  style={{ backgroundColor: '#002050', color: '#FFFFFF', fontSize: '14px' }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M3.18 23.76c.3.17.65.19.97.07l.07-.04 11.16-6.4-2.42-2.42-9.78 8.79zm-1.12-20.9A1.5 1.5 0 002 3.9v16.2c0 .44.17.83.43 1.12l.06.06 9.07-9.07v-.22L2.06 2.86zm15.5 8.72l-2.37-2.37-9.97 5.72 2.42 2.42 9.92-5.77zm1.44-7.82l-9.92 5.77 2.42 2.42 9.97-5.72a1.5 1.5 0 00-.47-2.47z"/>
                  </svg>
                  Google Play
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── FOOTER (seule section navy) ──────────────────────────────── */}
      <footer className="px-6 py-8" style={{ backgroundColor: '#002050' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/IMG_0349.png"
              alt="Omnia Global Academy"
              className="h-9 w-auto object-contain brightness-0 invert"
            />
            <div>
              <div className="font-bold leading-none text-white" style={{ fontSize: '14px', letterSpacing: '0.09em' }}>
                OMNIA
              </div>
              <div className="font-semibold" style={{ color: '#BF8813', fontSize: '8px', letterSpacing: '0.18em', marginTop: '2px' }}>
                GLOBAL ACADEMY
              </div>
            </div>
          </div>

          {/* Copyright */}
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>
            © 2026 Omnia Global Academy — Tous droits réservés
          </p>

          {/* Links */}
          <div className="flex gap-5">
            <a href="#" className="underline transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>
              À propos
            </a>
            <a href="#" className="underline transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>
              Confidentialité
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
