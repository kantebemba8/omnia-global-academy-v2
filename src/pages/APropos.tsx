import { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { getPublicSiteSettings } from '../lib/siteSettingsCache';

interface Settings {
  a_propos_content_fr?: string;
  social_networks?: Record<string, string | null>;
  app_downloads?: { google_play?: string | null; app_store?: string | null };
  follow_us_label_fr?: string;
}

const DEFAULT_CONTENT =
  "Omnia Global Academy est une plateforme de formation en ligne fondée au Mali, avec l'ambition de connecter les meilleurs formateurs et les apprenants les plus motivés, partout en Afrique de l'Ouest puis sur tout le continent. Notre mission est de rendre l'éducation de qualité accessible, flexible et reconnue, en combinant une pédagogie rigoureuse, des technologies adaptées aux réalités locales et un accompagnement humain à chaque étape.";

export function APropos() {
  const [settings, setSettings] = useState<Settings>({});

  useEffect(() => {
    let active = true;
    getPublicSiteSettings()
      .then(d => { if (active) setSettings(d); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const content = settings.a_propos_content_fr ?? DEFAULT_CONTENT;

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#FFFFFF' }}>
      <Navbar />

      <main className="pt-16">
        {/* Hero band */}
        <div className="px-6 py-12 md:py-16" style={{ backgroundColor: '#F8F9FA', borderBottom: '1px solid #E4E7EC' }}>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-bold uppercase mb-3" style={{ color: '#BF8813', letterSpacing: '0.14em' }}>
              Notre histoire
            </p>
            <h1 className="font-bold" style={{ color: '#002050', fontSize: 'clamp(26px,4vw,42px)' }}>
              À propos d'Omnia Global Academy
            </h1>
          </div>
        </div>

        {/* Content */}
        <section className="px-6 py-14">
          <div className="max-w-3xl mx-auto">
            <div
              className="w-12 h-1 rounded mb-8"
              style={{ backgroundColor: '#BF8813' }}
            />
            {content.split('\n').map((para, i) => (
              <p key={i} className="mb-5" style={{ color: '#374151', fontSize: '16px', lineHeight: 1.75 }}>
                {para}
              </p>
            ))}

            {/* Mission card */}
            <div
              className="mt-10 rounded-2xl p-8"
              style={{ backgroundColor: '#002050' }}
            >
              <p className="text-sm font-bold uppercase mb-3" style={{ color: '#BF8813', letterSpacing: '0.12em' }}>
                Notre mission
              </p>
              <p className="text-white" style={{ fontSize: '16px', lineHeight: 1.7 }}>
                Rendre l'éducation de qualité accessible, flexible et reconnue à travers toute l'Afrique.
              </p>
            </div>
          </div>
        </section>
      </main>

      <PageFooter
        socialNetworks={settings.social_networks}
        appDownloads={settings.app_downloads}
        followUsLabel={settings.follow_us_label_fr}
      />
    </div>
  );
}
