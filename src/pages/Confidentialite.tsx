import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import type { LandingFooterConfig, MobileAppItem, SocialNetworkItem } from '../types/landingCms';
import { getPublicSiteSettings } from '../lib/siteSettingsCache';

interface Settings {
  legal?: {
    confidentialite?: string;
  };
  social_networks_v2?: SocialNetworkItem[];
  mobile_apps_v2?: MobileAppItem[];
  landing_page?: { footer?: LandingFooterConfig };
  public_partners?: Array<{ id: string; name: string; logo_url?: string | null; website_url?: string | null; alt_text?: string | null; show_footer?: boolean }>;
}

const DEFAULT_CONTENT =
  "Omnia Global Academy protège les données nécessaires à l'authentification, à l'apprentissage, aux paiements, aux certifications, à l'employabilité et aux services choisis par l'utilisateur. Ces données ne sont pas revendues. Les traitements, durées de conservation et droits applicables sont présentés ci-dessous pour le web et les applications mobiles.";

const SECTIONS = [
  { title: 'Données de compte', body: "Nom, email, téléphone, date de naissance, pays, rôles et préférences sont utilisés pour créer, sécuriser et administrer le compte." },
  { title: 'Apprentissage et certifications', body: "Les inscriptions, progressions, évaluations, certificats, badges, Learning Records et Skills Passports sont traités pour fournir les services pédagogiques demandés." },
  { title: 'Career, Talent, coaching et projets', body: "Les CV, lettres, candidatures, profils professionnels, réservations, échanges et preuves de projet sont traités uniquement lorsque vous utilisez ces espaces." },
  { title: 'Paiements et achats stores', body: "Les références de commande, montants, statuts de paiement et preuves de transaction sont conservés pour attribuer les droits, prévenir la fraude, traiter les remboursements et respecter les obligations comptables. Les jetons bruts Google Play ou Apple ne sont pas stockés." },
  { title: 'Caméra, microphone, photos et fichiers', body: "Ces accès sont demandés au moment où vous choisissez de scanner un QR code, joindre un fichier, prendre une photo, participer à une activité surveillée ou enregistrer une simulation. Aucun accès permanent n'est requis." },
  { title: 'Notifications et identifiants d’appareil', body: "Avec votre accord, un identifiant technique d'installation et un jeton push peuvent être enregistrés pour envoyer les notifications Omnia. Vous pouvez désactiver cette autorisation dans l'application ou dans les réglages du téléphone." },
  { title: 'Diagnostic technique', body: "Des rapports d'erreur minimaux peuvent être transmis pour corriger les incidents. Les mots de passe, jetons de session, contenus saisis, enregistrements audio/vidéo et paramètres d'URL sont exclus ou masqués autant que possible." },
  { title: 'Communauté, signalement et blocage', body: "Les publications et réponses de la communauté peuvent être signalées pour modération. Vous pouvez également bloquer un utilisateur afin de masquer ses contenus communautaires, puis le débloquer depuis les paramètres de sécurité." },
  { title: 'Sécurité et conservation', body: "Les mots de passe sont hachés, les sessions mobiles sont stockées dans le Keychain iOS ou un stockage protégé par Android Keystore, et les communications utilisent HTTPS. Les durées dépendent du service et des obligations légales applicables." },
  { title: 'Suspension volontaire', body: "Vous pouvez suspendre temporairement votre compte depuis Mon profil. Toutes les sessions sont alors révoquées et le profil public devient indisponible, sans suppression des données. La réactivation autonome exige une nouvelle vérification du mot de passe et n’est possible que pour une suspension demandée par le titulaire." },
  { title: 'Suppression du compte', body: "La suppression révoque immédiatement les sessions et efface ou anonymise les données personnelles non soumises à une obligation de conservation. Les factures, paiements, preuves antifraude et journaux réglementaires indispensables peuvent être conservés sous un identifiant pseudonymisé. Le questionnaire facultatif d’amélioration est conservé séparément sans coordonnées directes et n’est pas affiché dans les journaux administratifs." },
  { title: 'Cookies et stockage local', body: "Le web utilise uniquement les mécanismes techniques nécessaires au service et à la session. L'application mobile utilise un stockage local sécurisé et des caches pédagogiques chiffrés pour la résilience hors connexion." },
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
              Dernière mise à jour : 5 août 2026
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

            <div className="mt-10 rounded-xl border border-red-200 bg-red-50 p-6">
              <h2 className="font-bold text-red-900">Supprimer votre compte et vos données</h2>
              <p className="mt-2 text-sm leading-6 text-red-800">La suppression peut être initiée directement depuis l’application ou depuis le web après authentification.</p>
              <Link to="/supprimer-compte" className="mt-4 inline-flex rounded-lg bg-red-700 px-4 py-2.5 text-sm font-bold text-white">Accéder à la suppression du compte</Link>
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
        socialNetworksV2={settings.social_networks_v2 || []}
        mobileAppsV2={settings.mobile_apps_v2 || []}
        partners={settings.public_partners || []}
        footerConfig={settings.landing_page?.footer}
        managedOnly
      />
    </div>
  );
}
