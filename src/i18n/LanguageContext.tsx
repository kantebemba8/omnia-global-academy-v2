import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type PlatformLanguage = 'fr' | 'en' | 'es' | 'pt' | 'ar' | 'zh' | 'ru' | 'de';

export const PLATFORM_LANGUAGES: ReadonlyArray<{ code: PlatformLanguage; shortLabel: string; label: string; locale: string; direction: 'ltr' | 'rtl' }> = [
  { code: 'fr', shortLabel: 'FR', label: 'Français', locale: 'fr-FR', direction: 'ltr' },
  { code: 'en', shortLabel: 'EN', label: 'English', locale: 'en-GB', direction: 'ltr' },
  { code: 'es', shortLabel: 'ES', label: 'Español', locale: 'es-ES', direction: 'ltr' },
  { code: 'pt', shortLabel: 'PT', label: 'Português', locale: 'pt-PT', direction: 'ltr' },
  { code: 'ar', shortLabel: 'AR', label: 'العربية', locale: 'ar', direction: 'rtl' },
  { code: 'zh', shortLabel: 'ZH', label: '中文', locale: 'zh-CN', direction: 'ltr' },
  { code: 'ru', shortLabel: 'RU', label: 'Русский', locale: 'ru-RU', direction: 'ltr' },
  { code: 'de', shortLabel: 'DE', label: 'Deutsch', locale: 'de-DE', direction: 'ltr' },
];

type LanguageContextValue = {
  language: PlatformLanguage;
  locale: string;
  setLanguage: (language: PlatformLanguage) => void;
  toggleLanguage: () => void;
  t: (french: string, english?: string) => string;
};

const STORAGE_KEY = 'omnia_platform_language';

const TRANSLATIONS: Record<string, string> = {
  'Accueil': 'Home', 'Formations': 'Courses', 'Formation': 'Course', 'Catalogue': 'Catalogue',
  'Certifications': 'Certificates', 'Certification': 'Certification', 'À propos': 'About', 'Contact': 'Contact',
  'Connexion': 'Sign in', 'Se connecter': 'Sign in', "S'inscrire": 'Sign up', 'Inscription': 'Sign up',
  'Créer un compte': 'Create an account', 'Créer un compte gratuit': 'Create a free account', 'Déconnexion': 'Sign out', 'Se déconnecter': 'Sign out',
  'Mon espace': 'My space', 'Mon profil': 'My profile', 'Utilisateur Omnia': 'Omnia user', 'Explorer Omnia': 'Explore Omnia', 'Professionnels': 'Professionals', 'Notifications': 'Notifications', 'Retour au Dashboard': 'Back to dashboard',
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
  'Écosystème connecté': 'Connected ecosystem', 'Explorer le parcours Omnia': 'Explore the Omnia journey',
  'Explorer cet espace': 'Explore this space', 'Identité Omnia': 'Omnia identity',
  'Une progression continue': 'Continuous progress', 'Des résultats professionnels': 'Professional outcomes',
  'Fonctions disponibles': 'Available features', 'Autres formations mises en avant': 'Other featured courses',
  'Voir la formation': 'View course', 'Un écosystème': 'One ecosystem',
  'Espace Omnia sélectionné': 'Selected Omnia space', 'Écosystème': 'Ecosystem',
  'Preuves': 'Evidence', 'Carrière': 'Career', 'Structures': 'Organisations',
  'Construire des compétences utiles': 'Build useful skills',
  'Transformer les acquis en réalisations': 'Turn learning into achievements',
  'Rendre les acquis vérifiables': 'Make achievements verifiable',
  'Préparer la prochaine étape professionnelle': 'Prepare the next career step',
  'Relier talents, recruteurs et structures': 'Connect talent, recruiters and organisations',
  'Pratiquer': 'Practise', 'Prouver': 'Prove', 'Se développer': 'Grow', 'Opportunités': 'Opportunities',
  'Reconnaissances professionnelles': 'Professional recognition',
  'Certifications et reconnaissances': 'Certifications and recognition',
  'Certification ou reconnaissance professionnelle': 'Professional certification or recognition',
  'Formation reconnue': 'Recognised course', 'Reconnaissance': 'Recognition',
  'Reconnaissance professionnelle': 'Professional recognition',
  'Organisme certificateur ou partenaire': 'Certification body or partner',
  'Crédits ou unités de développement professionnel': 'Professional development credits or units',
  'Crédits, heures ou points': 'Credits, hours or points',
  'Unité de reconnaissance': 'Recognition unit',
  'Reconnaissance / certification': 'Recognition / certification',
  'Reconnaissance non évaluée': 'Recognition not assessed',
  'Reconnaissance conforme': 'Recognition compliant',
  'Développement professionnel continu': 'Continuing professional development',
  'Développement professionnel continu (CPD)': 'Continuing professional development (CPD)',
};

const CORE_TRANSLATIONS: Record<Exclude<PlatformLanguage, 'fr' | 'en'>, Record<string, string>> = {
  es: {
    'Accueil': 'Inicio', 'Formations': 'Formaciones', 'Certifications': 'Certificaciones', 'À propos': 'Acerca de',
    'Se connecter': 'Iniciar sesión', 'Créer un compte': 'Crear una cuenta', 'Créer un compte gratuit': 'Crear una cuenta gratis',
    'Déconnexion': 'Cerrar sesión', 'Se déconnecter': 'Cerrar sesión', 'Mon espace': 'Mi espacio', 'Mon profil': 'Mi perfil',
    'Paramètres': 'Configuración', 'Explorer Omnia': 'Explorar Omnia', 'Professionnels': 'Profesionales',
    'Tableau de bord': 'Panel', 'Retour au Dashboard': 'Volver al panel', 'Rechercher': 'Buscar',
    'Ouvrir le menu': 'Abrir el menú', 'Fermer le menu': 'Cerrar el menú', 'Langue': 'Idioma',
  },
  pt: {
    'Accueil': 'Início', 'Formations': 'Formações', 'Certifications': 'Certificações', 'À propos': 'Sobre',
    'Se connecter': 'Entrar', 'Créer un compte': 'Criar uma conta', 'Créer un compte gratuit': 'Criar uma conta grátis',
    'Déconnexion': 'Sair', 'Se déconnecter': 'Sair', 'Mon espace': 'Meu espaço', 'Mon profil': 'Meu perfil',
    'Paramètres': 'Definições', 'Explorer Omnia': 'Explorar Omnia', 'Professionnels': 'Profissionais',
    'Tableau de bord': 'Painel', 'Retour au Dashboard': 'Voltar ao painel', 'Rechercher': 'Pesquisar',
    'Ouvrir le menu': 'Abrir menu', 'Fermer le menu': 'Fechar menu', 'Langue': 'Idioma',
  },
  ar: {
    'Accueil': 'الرئيسية', 'Formations': 'الدورات', 'Certifications': 'الشهادات', 'À propos': 'من نحن',
    'Se connecter': 'تسجيل الدخول', 'Créer un compte': 'إنشاء حساب', 'Créer un compte gratuit': 'إنشاء حساب مجاني',
    'Déconnexion': 'تسجيل الخروج', 'Se déconnecter': 'تسجيل الخروج', 'Mon espace': 'مساحتي', 'Mon profil': 'ملفي الشخصي',
    'Paramètres': 'الإعدادات', 'Explorer Omnia': 'استكشاف أومنيا', 'Professionnels': 'المهنيون',
    'Tableau de bord': 'لوحة التحكم', 'Retour au Dashboard': 'العودة إلى لوحة التحكم', 'Rechercher': 'بحث',
    'Ouvrir le menu': 'فتح القائمة', 'Fermer le menu': 'إغلاق القائمة', 'Langue': 'اللغة',
  },
  zh: {
    'Accueil': '首页', 'Formations': '课程', 'Certifications': '认证', 'À propos': '关于我们',
    'Se connecter': '登录', 'Créer un compte': '创建账户', 'Créer un compte gratuit': '创建免费账户',
    'Déconnexion': '退出登录', 'Se déconnecter': '退出登录', 'Mon espace': '我的空间', 'Mon profil': '我的资料',
    'Paramètres': '设置', 'Explorer Omnia': '探索 Omnia', 'Professionnels': '专业人士',
    'Tableau de bord': '控制面板', 'Retour au Dashboard': '返回控制面板', 'Rechercher': '搜索',
    'Ouvrir le menu': '打开菜单', 'Fermer le menu': '关闭菜单', 'Langue': '语言',
  },
  ru: {
    'Accueil': 'Главная', 'Formations': 'Курсы', 'Certifications': 'Сертификаты', 'À propos': 'О нас',
    'Se connecter': 'Войти', 'Créer un compte': 'Создать аккаунт', 'Créer un compte gratuit': 'Создать бесплатный аккаунт',
    'Déconnexion': 'Выйти', 'Se déconnecter': 'Выйти', 'Mon espace': 'Моё пространство', 'Mon profil': 'Мой профиль',
    'Paramètres': 'Настройки', 'Explorer Omnia': 'Обзор Omnia', 'Professionnels': 'Профессионалам',
    'Tableau de bord': 'Панель управления', 'Retour au Dashboard': 'Вернуться в панель', 'Rechercher': 'Поиск',
    'Ouvrir le menu': 'Открыть меню', 'Fermer le menu': 'Закрыть меню', 'Langue': 'Язык',
  },
  de: {
    'Accueil': 'Startseite', 'Formations': 'Kurse', 'Certifications': 'Zertifikate', 'À propos': 'Über uns',
    'Se connecter': 'Anmelden', 'Créer un compte': 'Konto erstellen', 'Créer un compte gratuit': 'Kostenloses Konto erstellen',
    'Déconnexion': 'Abmelden', 'Se déconnecter': 'Abmelden', 'Mon espace': 'Mein Bereich', 'Mon profil': 'Mein Profil',
    'Paramètres': 'Einstellungen', 'Explorer Omnia': 'Omnia entdecken', 'Professionnels': 'Für Fachkräfte',
    'Tableau de bord': 'Dashboard', 'Retour au Dashboard': 'Zurück zum Dashboard', 'Rechercher': 'Suchen',
    'Ouvrir le menu': 'Menü öffnen', 'Fermer le menu': 'Menü schließen', 'Langue': 'Sprache',
  },
};

const TRANSLATIONS_BY_LANGUAGE: Record<PlatformLanguage, Record<string, string>> = {
  fr: {},
  en: TRANSLATIONS,
  ...CORE_TRANSLATIONS,
};

const LANGUAGE_CODES = new Set<PlatformLanguage>(PLATFORM_LANGUAGES.map(item => item.code));
function isPlatformLanguage(value: string | null): value is PlatformLanguage {
  return Boolean(value && LANGUAGE_CODES.has(value as PlatformLanguage));
}
function getLanguageDefinition(language: PlatformLanguage) {
  return PLATFORM_LANGUAGES.find(item => item.code === language) || PLATFORM_LANGUAGES[0];
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function translateExact(value: string, language: PlatformLanguage): string {
  if (language === 'fr') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const translated = TRANSLATIONS_BY_LANGUAGE[language][trimmed];
  if (!translated) return value;
  const startIndex = value.indexOf(trimmed);
  return `${value.slice(0, startIndex)}${translated}${value.slice(startIndex + trimmed.length)}`;
}
function isKnownTranslation(original: string, current: string): boolean {
  if (current === original) return true;
  return PLATFORM_LANGUAGES.some(({ code }) => translateExact(original, code) === current);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<PlatformLanguage>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPlatformLanguage(stored) ? stored : 'fr';
  });
  const originals = useRef(new WeakMap<Node, string>());
  const attributeOriginals = useRef(new WeakMap<Element, Map<string, string>>());

  const setLanguage = useCallback((next: PlatformLanguage) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLanguageState(next);
  }, []);
  const toggleLanguage = useCallback(() => setLanguage(language === 'fr' ? 'en' : 'fr'), [language, setLanguage]);
  const t = useCallback((french: string, english?: string) => {
    if (language === 'fr') return french;
    if (language === 'en' && english) return english;
    return TRANSLATIONS_BY_LANGUAGE[language][french] || (language === 'en' ? TRANSLATIONS[french] : undefined) || french;
  }, [language]);

  useEffect(() => {
    const definition = getLanguageDefinition(language);
    document.documentElement.lang = definition.locale;
    document.documentElement.dir = definition.direction;
    const attributes = ['placeholder', 'title', 'aria-label'];
    const applyNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (parent?.closest('[data-no-auto-translate="true"]')) return;
        const current = node.textContent || '';
        const knownOriginal = originals.current.get(node);
        if (!knownOriginal || !isKnownTranslation(knownOriginal, current)) originals.current.set(node, current);
        const original = originals.current.get(node) || current;
        const next = translateExact(original, language);
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
        if (!knownOriginal || !isKnownTranslation(knownOriginal, current)) stored.set(attribute, current);
        const original = stored.get(attribute) || current;
        const next = translateExact(original, language);
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

  const definition = getLanguageDefinition(language);
  const value = useMemo<LanguageContextValue>(() => ({ language, locale: definition.locale, setLanguage, toggleLanguage, t }), [definition.locale, language, setLanguage, t, toggleLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
