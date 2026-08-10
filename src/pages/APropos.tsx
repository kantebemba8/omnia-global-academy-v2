import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
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

const AUDIENCE_SECTIONS = [
  {
    id: 'apprenants',
    title: 'Pour les apprenants',
    purpose: 'Se former, progresser, prouver ses compétences et préparer la suite de son parcours professionnel dans un même écosystème.',
    benefits: [
      'Suivre des formations, évaluations et parcours structurés.',
      'Retrouver certificats, badges et preuves de compétences.',
      'Utiliser Omnia Career et Omnia Talent pour préparer et présenter son profil.',
      'Prolonger son parcours avec Omnia Live, Communauté, Coaching et Projects.',
    ],
    spaces: 'Formations · Career · Talent · Live · Communauté · Coaching · Projects',
    actionLabel: 'Créer un compte apprenant',
    actionUrl: '/inscription/apprenant',
  },
  {
    id: 'professeurs',
    title: 'Pour les professeurs',
    purpose: 'Créer et publier des formations structurées, organiser les évaluations et suivre les apprenants depuis les outils prévus pour l’enseignement.',
    benefits: [
      'Concevoir et organiser des formations dans le Studio.',
      'Gérer les évaluations et le suivi pédagogique.',
      'Suivre la progression des apprenants concernés.',
      'Compléter les formations avec les usages prévus dans Omnia Live.',
    ],
    spaces: 'Formations · Studio · Évaluations · Omnia Live',
    actionLabel: 'Devenir professeur',
    actionUrl: '/inscription/professeur',
  },
  {
    id: 'structures',
    title: 'Pour les structures',
    purpose: 'Former et piloter les compétences d’une organisation à partir d’un espace dédié aux membres, formations, compétences et obligations de suivi.',
    benefits: [
      'Gérer membres, groupes, départements et cohortes.',
      'Organiser des formations obligatoires et leurs échéances.',
      'Suivre progression, compétences, certificats et conformité.',
      'Accéder aux rapports et aux fonctions de gestion prévues pour la Structure.',
    ],
    spaces: 'Espace Structure · Formations · Suivi RH · Recrutement · Rapports',
    actionLabel: 'Inscrire une structure',
    actionUrl: '/inscription/structure',
  },
  {
    id: 'recruteurs',
    title: 'Pour les recruteurs',
    purpose: 'Rechercher des profils, consulter les compétences et preuves disponibles, publier des offres et suivre les candidatures.',
    benefits: [
      'Publier et gérer des offres.',
      'Explorer les profils disponibles dans Omnia Talent.',
      'Consulter les compétences et preuves accessibles.',
      'Suivre candidatures et entretiens depuis l’espace recruteur.',
    ],
    spaces: 'Omnia Talent · Offres · Profils · Compétences vérifiées · Candidatures',
    actionLabel: 'Créer un compte recruteur',
    actionUrl: '/inscription/recruteur',
  },
] as const;

export function APropos() {
  const [settings, setSettings] = useState<Settings>({});
  const location = useLocation();

  useEffect(() => {
    let active = true;
    getPublicSiteSettings()
      .then(d => { if (active) setSettings(d); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const timer = window.setTimeout(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  const content = settings.a_propos_content_fr ?? DEFAULT_CONTENT;

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#FFFFFF' }}>
      <Navbar showAudienceBar />

      <main className="pt-[116px]">
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


        <section className="border-t border-slate-200 bg-[#F5F8FC] px-6 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-black text-[#002050] sm:text-3xl">À qui s’adresse Omnia Global Academy ?</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">Chaque espace répond à un usage précis de la plateforme. Les accès ci-dessus permettent de comprendre rapidement ce qu’Omnia apporte à chaque profil principal.</p>
            </div>

            <div className="mt-9 space-y-5">
              {AUDIENCE_SECTIONS.map(section => (
                <article key={section.id} id={section.id} className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                  <div className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr]">
                    <div>
                      <h3 className="text-xl font-black text-[#002050]">{section.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{section.purpose}</p>
                      <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-[#76520A]">Espaces Omnia concernés</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#002050]">{section.spaces}</p>
                      <Link to={section.actionUrl} className="mt-5 inline-flex rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#00183E]">
                        {section.actionLabel}
                      </Link>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Utilité et bénéfices</p>
                      <ul className="mt-3 divide-y divide-slate-100 border-y border-slate-100">
                        {section.benefits.map(item => <li key={item} className="py-3 text-sm leading-6 text-slate-700">{item}</li>)}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
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
