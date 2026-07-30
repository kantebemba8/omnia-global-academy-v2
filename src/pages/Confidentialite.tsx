import { useState, useEffect } from 'react';
import { Mail } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { getPublicSiteSettings } from '../lib/siteSettingsCache';

interface Settings {
  legal?: {
    confidentialite?: string;
  };
  social_networks?: Record<string, string | null>;
  app_downloads?: { google_play?: string | null; app_store?: string | null };
  follow_us_label_fr?: string;
}

const DEFAULT_CONTENT =
  "Omnia Global Academy s'engage à protéger vos données personnelles. Les informations collectées lors de votre inscription (nom, email, téléphone) sont utilisées uniquement pour la gestion de votre compte et la communication pédagogique. Elles ne sont jamais revendues à des tiers. Vous pouvez à tout moment demander la modification ou la suppression de vos données en nous contactant.";

const SECTIONS = [
  { title: 'Données collectées',           body: "Nous collectons votre nom complet, adresse email, numéro de téléphone, date de naissance et pays de résidence lors de votre inscription." },
  { title: 'Utilisation des données',      body: "Vos données sont utilisées pour la gestion de votre compte, la personnalisation de votre expérience d'apprentissage et les communications pédagogiques." },
  { title: 'Sécurité',                     body: "Vos mots de passe sont protégés par un mécanisme de hachage. Nous utilisons des connexions sécurisées (HTTPS) et des contrôles d'accès côté serveur." },
  { title: 'Diagnostic technique',         body: "Des rapports techniques minimaux peuvent être transmis afin de diagnostiquer les erreurs. L'enregistrement des sessions, les médias et les données personnelles par défaut sont désactivés pendant la bêta." },
  { title: 'Vos droits',                   body: "Vous pouvez accéder, modifier ou supprimer vos données personnelles à tout moment en nous contactant via le formulaire de support." },
  { title: 'Cookies',                      body: "Nous utilisons des cookies techniques nécessaires au fonctionnement du service. Aucun cookie publicitaire tiers n'est installé sans votre consentement." },
];

export function Confidentialite() {
  const [settings, setSettings] = useState<Settings>({});

  useEffect(() => {
    let active = true;
    getPublicSiteSettings()
      .then(d => { if (active) setSettings(d); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const cmsContent = settings.legal?.confidentialite?.trim();
  const intro = cmsContent || DEFAULT_CONTENT;

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#FFFFFF' }}>
      <Navbar />

      <main className="pt-16">
        <div className="px-6 py-12 md:py-16" style={{ backgroundColor: '#F8F9FA', borderBottom: '1px solid #E4E7EC' }}>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-bold uppercase mb-3" style={{ color: '#BF8813', letterSpacing: '0.14em' }}>
              Vos droits &amp; notre engagement
            </p>
            <h1 className="font-bold" style={{ color: '#002050', fontSize: 'clamp(26px,4vw,42px)' }}>
              Politique de confidentialité
            </h1>
            <p className="mt-3 text-sm" style={{ color: '#6B7280' }}>
              Dernière mise à jour : juillet 2026
            </p>
          </div>
        </div>

        <section className="px-6 py-14">
          <div className="max-w-3xl mx-auto">
            <div className="w-12 h-1 rounded mb-8" style={{ backgroundColor: '#BF8813' }} />
            <p className="mb-10" style={{ color: '#374151', fontSize: '16px', lineHeight: 1.75 }}>{intro}</p>

            <div className="space-y-6">
              {SECTIONS.map(({ title, body }) => (
                <div
                  key={title}
                  className="rounded-xl p-6"
                  style={{ backgroundColor: '#F8F9FA', border: '1px solid #E4E7EC' }}
                >
                  <h2 className="font-bold mb-2" style={{ color: '#002050', fontSize: '15px' }}>{title}</h2>
                  <p className="text-sm" style={{ color: '#6B7280', lineHeight: 1.7 }}>{body}</p>
                </div>
              ))}
            </div>

            <div
              className="mt-10 rounded-xl p-6 flex items-start gap-4"
              style={{ backgroundColor: 'rgba(191,136,19,0.06)', border: '1px solid rgba(191,136,19,0.20)' }}
            >
              <Mail aria-hidden="true" className="mt-0.5 h-6 w-6 flex-shrink-0 text-[#BF8813]" />
              <div>
                <p className="font-semibold mb-1" style={{ color: '#002050', fontSize: '14px' }}>Contact DPO</p>
                <p className="text-sm" style={{ color: '#6B7280' }}>
                  Pour toute question relative à vos données personnelles : <br />
                  <span style={{ color: '#BF8813', fontWeight: 600 }}>privacy@omniaglobalacademy.com</span>
                </p>
              </div>
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
