export type LandingSectionType =
  | 'hero'
  | 'goal_selector'
  | 'omnia_journey'
  | 'featured_courses'
  | 'ecosystem'
  | 'credentials'
  | 'career_recruitment'
  | 'structures'
  | 'partners'
  | 'mobile_apps'
  | 'social_networks'
  | 'final_cta'
  | 'custom_text';

export type LandingSectionConfig = {
  id: string;
  type: LandingSectionType;
  internal_name: string;
  enabled: boolean;
  order: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  primary_cta_label: string;
  primary_cta_url: string;
  secondary_cta_label: string;
  secondary_cta_url: string;
};

export type LandingPageConfig = {
  version: number;
  updated_at: string | null;
  published_at: string | null;
  sections: LandingSectionConfig[];
};

export type SocialNetworkItem = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  display_order: number;
  show_homepage: boolean;
  show_footer: boolean;
  icon_key: string;
  logo_url: string;
  alt_text: string;
};

export type MobileAppItem = {
  id: string;
  store: 'ios' | 'android';
  name: string;
  url: string;
  enabled: boolean;
  display_order: number;
  show_homepage: boolean;
  show_footer: boolean;
};

export const LANDING_SECTION_LIBRARY: Array<{
  type: LandingSectionType;
  label: string;
  description: string;
  unique: boolean;
}> = [
  { type: 'hero', label: 'Introduction principale', description: 'Promesse, actions principales et recherche.', unique: true },
  { type: 'goal_selector', label: 'Choisir son objectif', description: 'Entrées adaptées aux différents visiteurs.', unique: true },
  { type: 'omnia_journey', label: 'Le parcours Omnia', description: 'Apprendre, pratiquer, prouver et accéder aux opportunités.', unique: true },
  { type: 'featured_courses', label: 'Formations disponibles', description: 'Formations publiées issues de la plateforme.', unique: true },
  { type: 'ecosystem', label: 'Écosystème Omnia', description: 'Live, Projects, Coaching, Career, Talent et communauté.', unique: true },
  { type: 'credentials', label: 'Certificats et preuves', description: 'Certificats, badges, Learning Record et Skills Passport.', unique: true },
  { type: 'career_recruitment', label: 'Carrière et recrutement', description: 'Parcours talents et recruteurs.', unique: true },
  { type: 'structures', label: 'Solutions pour les structures', description: 'Formation, membres, compétences, conformité et rapports.', unique: true },
  { type: 'partners', label: 'Partenaires', description: 'Partenaires actifs, autorisés et validés.', unique: true },
  { type: 'mobile_apps', label: 'Applications mobiles', description: 'Liens App Store et Google Play lorsqu’ils seront actifs.', unique: true },
  { type: 'social_networks', label: 'Réseaux sociaux', description: 'Comptes officiels activés dans le CMS.', unique: true },
  { type: 'final_cta', label: 'Inscription finale', description: 'Dernier appel à rejoindre Omnia.', unique: true },
  { type: 'custom_text', label: 'Bloc éditorial', description: 'Bloc de texte supplémentaire contrôlé par le CMS.', unique: false },
];

const SECTION_DEFAULTS: Record<LandingSectionType, Omit<LandingSectionConfig, 'id' | 'order'>> = {
  hero: {
    type: 'hero', internal_name: 'Introduction principale', enabled: true,
    eyebrow: 'Formation, compétences et opportunités',
    title: 'Apprenez. Prouvez vos compétences. Avancez.',
    subtitle: 'Omnia réunit formations, projets, certifications vérifiables, coaching, événements en direct et opportunités professionnelles dans un même parcours.',
    body: '', primary_cta_label: 'Créer mon compte', primary_cta_url: '/inscription',
    secondary_cta_label: 'Explorer les formations', secondary_cta_url: '/catalogue',
  },
  goal_selector: {
    type: 'goal_selector', internal_name: 'Choisir son objectif', enabled: true,
    eyebrow: '', title: 'Que souhaitez-vous accomplir ?',
    subtitle: 'Choisissez votre objectif pour découvrir les outils Omnia adaptés à votre parcours.',
    body: '', primary_cta_label: '', primary_cta_url: '', secondary_cta_label: '', secondary_cta_url: '',
  },
  omnia_journey: {
    type: 'omnia_journey', internal_name: 'Le parcours Omnia', enabled: true,
    eyebrow: 'Un parcours complet', title: 'De l’apprentissage aux opportunités',
    subtitle: 'Formez-vous, pratiquez, faites vérifier vos compétences et construisez votre avenir professionnel.',
    body: '', primary_cta_label: '', primary_cta_url: '', secondary_cta_label: '', secondary_cta_url: '',
  },
  featured_courses: {
    type: 'featured_courses', internal_name: 'Formations disponibles', enabled: true,
    eyebrow: '', title: 'Formations disponibles', subtitle: 'Découvrez les formations réellement publiées sur Omnia.',
    body: '', primary_cta_label: 'Voir le catalogue', primary_cta_url: '/catalogue', secondary_cta_label: '', secondary_cta_url: '',
  },
  ecosystem: {
    type: 'ecosystem', internal_name: 'Écosystème Omnia', enabled: true,
    eyebrow: '', title: 'Plus qu’une plateforme de cours',
    subtitle: 'Apprenez en direct, réalisez des projets, bénéficiez d’un accompagnement et développez votre carrière.',
    body: '', primary_cta_label: 'Explorer Omnia', primary_cta_url: '/accueil#ecosysteme', secondary_cta_label: '', secondary_cta_url: '',
  },
  credentials: {
    type: 'credentials', internal_name: 'Certificats et preuves', enabled: true,
    eyebrow: '', title: 'Des compétences que vous pouvez prouver',
    subtitle: 'Présentez vos certificats, badges et preuves professionnelles dans un environnement vérifiable.',
    body: '', primary_cta_label: 'Vérifier un certificat', primary_cta_url: '/verify', secondary_cta_label: '', secondary_cta_url: '',
  },
  career_recruitment: {
    type: 'career_recruitment', internal_name: 'Carrière et recrutement', enabled: true,
    eyebrow: '', title: 'Construisez votre carrière. Trouvez les bons talents.',
    subtitle: 'Omnia relie profils, compétences vérifiées, candidatures et besoins de recrutement.',
    body: '', primary_cta_label: 'Découvrir Omnia Talent', primary_cta_url: '/talent', secondary_cta_label: 'Découvrir Omnia Career', secondary_cta_url: '/emploi',
  },
  structures: {
    type: 'structures', internal_name: 'Solutions pour les structures', enabled: true,
    eyebrow: '', title: 'Développez les compétences de votre organisation',
    subtitle: 'Gérez vos membres, formations obligatoires, cohortes, compétences, conformité et rapports.',
    body: '', primary_cta_label: 'Découvrir les solutions', primary_cta_url: '/inscription/structure', secondary_cta_label: '', secondary_cta_url: '',
  },
  partners: {
    type: 'partners', internal_name: 'Partenaires', enabled: false,
    eyebrow: '', title: 'Ils accompagnent l’écosystème Omnia', subtitle: 'Cette section apparaît uniquement lorsqu’au moins un partenaire validé est actif.',
    body: '', primary_cta_label: '', primary_cta_url: '', secondary_cta_label: '', secondary_cta_url: '',
  },
  mobile_apps: {
    type: 'mobile_apps', internal_name: 'Applications mobiles', enabled: false,
    eyebrow: '', title: 'Retrouvez Omnia sur mobile', subtitle: 'Cette section apparaîtra lorsque l’application Android ou iOS sera publiée et activée.',
    body: '', primary_cta_label: '', primary_cta_url: '', secondary_cta_label: '', secondary_cta_url: '',
  },
  social_networks: {
    type: 'social_networks', internal_name: 'Réseaux sociaux', enabled: false,
    eyebrow: '', title: 'Suivez Omnia Global Academy', subtitle: 'Cette section apparaît uniquement avec des comptes officiels activés.',
    body: '', primary_cta_label: '', primary_cta_url: '', secondary_cta_label: '', secondary_cta_url: '',
  },
  final_cta: {
    type: 'final_cta', internal_name: 'Inscription finale', enabled: true,
    eyebrow: '', title: 'Votre prochain objectif commence ici.',
    subtitle: 'Rejoignez Omnia selon votre projet professionnel ou organisationnel.',
    body: '', primary_cta_label: 'Créer un compte', primary_cta_url: '/inscription', secondary_cta_label: 'Découvrir les formations', secondary_cta_url: '/catalogue',
  },
  custom_text: {
    type: 'custom_text', internal_name: 'Nouveau bloc éditorial', enabled: true,
    eyebrow: '', title: 'Nouveau titre', subtitle: '', body: '',
    primary_cta_label: '', primary_cta_url: '', secondary_cta_label: '', secondary_cta_url: '',
  },
};

export function createLandingSection(type: LandingSectionType, order: number): LandingSectionConfig {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    order,
    ...SECTION_DEFAULTS[type],
  };
}

export function createDefaultLandingPage(): LandingPageConfig {
  const orderedTypes: LandingSectionType[] = [
    'hero', 'goal_selector', 'omnia_journey', 'featured_courses', 'ecosystem',
    'credentials', 'career_recruitment', 'structures', 'partners', 'mobile_apps',
    'social_networks', 'final_cta',
  ];
  return {
    version: 1,
    updated_at: null,
    published_at: null,
    sections: orderedTypes.map((type, index) => createLandingSection(type, index + 1)),
  };
}

export function normalizeLandingPage(value: unknown): LandingPageConfig {
  const fallback = createDefaultLandingPage();
  if (!value || typeof value !== 'object') return fallback;
  const source = value as Partial<LandingPageConfig>;
  const sections = Array.isArray(source.sections)
    ? source.sections
        .filter(section => section && typeof section === 'object')
        .map((section, index) => {
          const candidate = section as Partial<LandingSectionConfig>;
          const type = LANDING_SECTION_LIBRARY.some(item => item.type === candidate.type)
            ? candidate.type as LandingSectionType
            : 'custom_text';
          const base = createLandingSection(type, index + 1);
          return {
            ...base,
            ...candidate,
            id: String(candidate.id || base.id),
            type,
            order: Number.isFinite(Number(candidate.order)) ? Number(candidate.order) : index + 1,
            enabled: candidate.enabled !== false,
          };
        })
        .sort((a, b) => a.order - b.order)
        .map((section, index) => ({ ...section, order: index + 1 }))
    : fallback.sections;
  return {
    version: Number(source.version || 1),
    updated_at: source.updated_at || null,
    published_at: source.published_at || null,
    sections,
  };
}
