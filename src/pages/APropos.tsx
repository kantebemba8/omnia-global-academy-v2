import { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import type { LandingFooterConfig, MobileAppItem, SocialNetworkItem } from '../types/landingCms';
import { getPublicSiteSettings } from '../lib/siteSettingsCache';

interface Settings {
  a_propos_content_fr?: string;
  social_networks_v2?: SocialNetworkItem[];
  mobile_apps_v2?: MobileAppItem[];
  landing_page?: { footer?: LandingFooterConfig };
  public_partners?: Array<{ id: string; name: string; logo_url?: string | null; website_url?: string | null; alt_text?: string | null; show_footer?: boolean }>;
}

const DEFAULT_CONTENT =
  "Omnia Global Academy est une plateforme internationale de formation, de compétences et d’opportunités. Elle connecte des apprenants, des formateurs, des Structures et des partenaires dans différents pays, avec une expérience accessible, flexible et reconnue.";

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
                Rendre la formation de qualité accessible, flexible et reconnue partout dans le monde.
              </p>
            </div>
          </div>
        </section>
      </main>

      <PageFooter
        socialNetworksV2={settings.social_networks_v2 || []}
        mobileAppsV2={settings.mobile_apps_v2 || []}
        partners={settings.public_partners || []}
        footerConfig={settings.landing_page?.footer}
        managedOnly
      />
    </div>
  );
}
