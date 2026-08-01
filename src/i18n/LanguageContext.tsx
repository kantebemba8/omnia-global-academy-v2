import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type PlatformLanguage = 'fr' | 'en';

type LanguageContextValue = {
  language: PlatformLanguage;
  locale: 'fr-FR' | 'en-GB';
  setLanguage: (language: PlatformLanguage) => void;
  toggleLanguage: () => void;
  t: (french: string, english?: string) => string;
};

const STORAGE_KEY = 'omnia_platform_language';

const TRANSLATIONS: Record<string, string> = {
  'Accueil': 'Home', 'Formations': 'Courses', 'Formation': 'Course', 'Catalogue': 'Catalogue',
  'Certifications': 'Certificates', 'Certification': 'Certification', 'À propos': 'About', 'Contact': 'Contact',
  'Connexion': 'Sign in', 'Se connecter': 'Sign in', "S'inscrire": 'Sign up', 'Inscription': 'Sign up',
  'Créer un compte': 'Create an account', 'Déconnexion': 'Sign out', 'Se déconnecter': 'Sign out',
  'Mon profil': 'My profile', 'Notifications': 'Notifications', 'Retour au Dashboard': 'Back to dashboard',
  'Retour à Omnia Global Academy': 'Back to Omnia Global Academy', 'Ouvrir le menu': 'Open menu',
  'Fermer le menu': 'Close menu', 'Navigation principale': 'Main navigation', 'Navigation mobile': 'Mobile navigation',
  'Rechercher': 'Search', 'Rechercher…': 'Search…', 'Actualiser': 'Refresh', 'Chargement…': 'Loading…',
  'Chargement...': 'Loading...', 'Enregistrer': 'Save', 'Enregistrement…': 'Saving…', 'Modifier': 'Edit',
  'Supprimer': 'Delete', 'Annuler': 'Cancel', 'Valider': 'Approve', 'Refuser': 'Reject', 'Publier': 'Publish',
  'Archiver': 'Archive', 'Suspendre': 'Suspend', 'Continuer': 'Continue', 'Retour': 'Back', 'Suivant': 'Next',
  'Précédent': 'Previous', 'Terminer': 'Finish', 'Voir': 'View', 'Examiner': 'Review', 'Télécharger': 'Download',
  'Importer': 'Import', 'Ajouter': 'Add', 'Créer': 'Create', 'Fermer': 'Close', 'Statut': 'Status', 'Version': 'Version',
  'Brouillon': 'Draft', 'En attente': 'Pending', 'Publiée': 'Published', 'Publiées': 'Published',
  'Refusée': 'Rejected', 'Refusées': 'Rejected', 'Suspendue': 'Suspended', 'Suspendues': 'Suspended',
  'Archivée': 'Archived', 'Toutes': 'All', 'Tous les statuts': 'All statuses',
  'Aucune formation dans cette vue.': 'No course in this view.', 'Aucune offre.': 'No job offer.',
  'Aucun résultat.': 'No result.', 'Gratuit': 'Free', 'GRATUIT': 'FREE', 'Payant': 'Paid', 'Premium': 'Premium',
  'Accessible': 'Available', 'Débutant': 'Beginner', 'Intermédiaire': 'Intermediate', 'Avancé': 'Advanced',
  'Expert': 'Expert', 'Français': 'French', 'Anglais': 'English', 'Langue': 'Language', 'Niveau': 'Level',
  'Catégorie': 'Category', 'Durée': 'Duration', 'Prix': 'Price', 'Objectifs pédagogiques': 'Learning objectives',
  'Objectifs pédagogiques *': 'Learning objectives *', 'Prérequis': 'Prerequisites', 'Public cible': 'Target audience',
  'Description': 'Description', 'Titre': 'Title', 'Sous-titre': 'Subtitle', 'Texte': 'Text',
  'Introduction': 'Introduction', 'Conclusion': 'Conclusion', 'Examen final': 'Final exam',
  'Évaluations': 'Assessments', 'Évaluation': 'Assessment', 'Leçon': 'Lesson', 'Leçons': 'Lessons',
  'Module': 'Module', 'Modules': 'Modules', 'Ressources': 'Resources', 'Progression': 'Progress',
  'Résultats': 'Results', 'Compétences': 'Skills', 'Certificat': 'Certificate', 'Certificats': 'Certificates',
  'Vérifier un certificat': 'Verify a certificate', 'Vérification de certificat': 'Certificate verification',
  'Identifiant du certificat': 'Certificate ID', 'Vérifier': 'Verify', 'Certificat valide': 'Valid certificate',
  'Certificat expiré': 'Expired certificate', 'Certificat révoqué': 'Revoked certificate',
  'Certificat introuvable': 'Certificate not found', 'Date de délivrance': 'Issue date',
  "Date d'expiration": 'Expiry date', 'Délivré à': 'Issued to', 'Délivré par': 'Issued by',
  'Tous droits réservés.': 'All rights reserved.', 'Plateforme': 'Platform', 'Informations': 'Information',
  'Sécurité': 'Security', 'Confidentialité': 'Privacy', "Conditions d’utilisation": 'Terms of use',
  'Devenir formateur': 'Become an instructor', 'Aide & support': 'Help & support', 'Communauté': 'Community',
  'Tableau de bord': 'Dashboard', 'Mes formations': 'My courses', 'Mes cours': 'My courses',
  'Mes certificats': 'My certificates', 'Offres d’emploi': 'Job offers', "Offres d'emploi": 'Job offers',
  'Nouvelle offre': 'New job offer', 'Créer une offre': 'Create a job offer', 'Candidatures': 'Applications',
  'Lieu': 'Location', 'Type de contrat': 'Contract type', 'Entreprise': 'Company', 'Date limite': 'Deadline',
  'Lien externe': 'External link', 'Email externe': 'External email', 'Candidature Omnia': 'Omnia application',
  'Formations externes': 'External courses', 'Fournisseur': 'Provider', "Mode d’accès": 'Access mode',
  'Accès public': 'Public access', 'Après inscription': 'After registration', 'Accès Premium': 'Premium access',
  'Ouvrir la formation': 'Open course', 'Accéder à la formation': 'Access course',
  'Vous allez être redirigé vers le site du fournisseur.': "You will be redirected to the provider's website.",
  'Validation tarifaire': 'Pricing approval', 'Prix automatique': 'Automatic price',
  'Prix souhaité par le professeur': 'Instructor proposed price', 'Prix personnalisé Omnia': 'Custom Omnia price',
  'Score final': 'Final score', 'Proposition du professeur': 'Instructor proposal',
  'Décision du Super-admin': 'Super-admin decision', 'Accepter le prix': 'Accept price',
  'Demander une révision': 'Request a revision', 'Seuil de réussite': 'Pass threshold',
  'Seuil leçon': 'Lesson threshold', 'Seuil module': 'Module threshold', 'Seuil examen final': 'Final exam threshold',
  'Paramètres pédagogiques': 'Learning settings', 'Conception pédagogique avancée': 'Advanced learning design',
  'Rythme de diffusion': 'Release schedule', 'Libre accès': 'Self-paced', 'Par cohorte': 'Cohort-based',
  'Hybride': 'Blended', 'Déblocage progressif': 'Drip release', 'Accessibilité': 'Accessibility',
  'Sous-titres': 'Captions', 'Transcription': 'Transcript', 'Navigation clavier': 'Keyboard navigation',
  'Contraste vérifié': 'Contrast checked', 'Contrôle qualité': 'Quality check',
  'Soumettre la formation': 'Submit course', 'Finalisation avant soumission': 'Final steps before submission',
  'En validation': 'Under review', 'Modifications demandées': 'Changes requested', 'Validée': 'Approved',
  'À publier': 'Ready to publish', 'Saisie assistée / certifications': 'Assisted entry / certifications',
  'Sans catégorie': 'Uncategorised', 'Niveau non renseigné': 'Level not specified',
  'Formation externe': 'External course', 'Formation Omnia': 'Omnia course', 'Fourni par': 'Provided by', 'Source :': 'Source:',
  'Inscription requise': 'Registration required', 'Abonnement requis': 'Subscription required',
  'Cette formation est proposée par un fournisseur externe.': 'This course is offered by an external provider.',
  'Votre compte est requis pour accéder à cette formation.': 'Your account is required to access this course.',
  'Une offre Premium active est requise pour accéder à cette formation.': 'An active Premium plan is required to access this course.',
  'Connexion requise': 'Sign-in required', 'Voir les offres Premium': 'View Premium plans', 'Gratuit chez le fournisseur': 'Free on the provider website', 'visites': 'visits',
  'Erreur serveur': 'Server error', 'Une erreur est survenue.': 'An error occurred.', 'Réessayer': 'Try again',
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function translateExact(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const translated = TRANSLATIONS[trimmed];
  if (!translated) return value;
  const startIndex = value.indexOf(trimmed);
  return `${value.slice(0, startIndex)}${translated}${value.slice(startIndex + trimmed.length)}`;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<PlatformLanguage>(() => localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'fr');
  const originals = useRef(new WeakMap<Node, string>());
  const attributeOriginals = useRef(new WeakMap<Element, Map<string, string>>());

  const setLanguage = useCallback((next: PlatformLanguage) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLanguageState(next);
  }, []);
  const toggleLanguage = useCallback(() => setLanguage(language === 'fr' ? 'en' : 'fr'), [language, setLanguage]);
  const t = useCallback((french: string, english?: string) => language === 'fr' ? french : (english || TRANSLATIONS[french] || french), [language]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
    const attributes = ['placeholder', 'title', 'aria-label'];
    const applyNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (parent?.closest('[data-no-auto-translate="true"]')) return;
        const current = node.textContent || '';
        const knownOriginal = originals.current.get(node);
        if (!knownOriginal || (current !== knownOriginal && current !== translateExact(knownOriginal))) {
          originals.current.set(node, current);
        }
        const original = originals.current.get(node) || current;
        const next = language === 'en' ? translateExact(original) : original;
        if (current !== next) node.textContent = next;
        return;
      }
      if (!(node instanceof Element) || node.closest('[data-no-auto-translate="true"]')) return;
      let stored = attributeOriginals.current.get(node);
      if (!stored) { stored = new Map<string, string>(); attributeOriginals.current.set(node, stored); }
      for (const attribute of attributes) {
        const current = node.getAttribute(attribute);
        if (current == null) continue;
        const knownOriginal = stored.get(attribute);
        if (!knownOriginal || (current !== knownOriginal && current !== translateExact(knownOriginal))) {
          stored.set(attribute, current);
        }
        const original = stored.get(attribute) || current;
        const next = language === 'en' ? translateExact(original) : original;
        if (current !== next) node.setAttribute(attribute, next);
      }
      Array.from(node.childNodes).forEach(applyNode);
    };
    const root = document.getElementById('root');
    if (!root) return;
    applyNode(root);
    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') applyNode(mutation.target);
        Array.from(mutation.addedNodes).forEach(applyNode);
      }
      observer.observe(root, { childList: true, subtree: true, characterData: true });
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({ language, locale: language === 'en' ? 'en-GB' : 'fr-FR', setLanguage, toggleLanguage, t }), [language, setLanguage, t, toggleLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
