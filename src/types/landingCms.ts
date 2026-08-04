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

export type LandingContentItem = {
  id: string;
  label: string;
  title: string;
  description: string;
  action_label: string;
  action_url: string;
  icon_key: string;
  group: string;
  enabled: boolean;
  order: number;
};

export type LandingLinkItem = {
  id: string;
  label: string;
  href: string;
  description: string;
  enabled: boolean;
  order: number;
};

export type LandingNavigationConfig = {
  explore_label: string;
  professionals_label: string;
  login_label: string;
  register_label: string;
  direct_links: LandingLinkItem[];
  explore_links: LandingLinkItem[];
  professional_links: LandingLinkItem[];
};

export type LandingFooterColumn = {
  id: string;
  title: string;
  order: number;
  links: LandingLinkItem[];
};

export type LandingFooterConfig = {
  description: string;
  follow_us_label: string;
  partner_label: string;
  columns: LandingFooterColumn[];
};

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
  search_placeholder: string;
  search_button_label: string;
  items: LandingContentItem[];
};

export type LandingPageConfig = {
  version: number;
  updated_at: string | null;
  published_at: string | null;
  navigation: LandingNavigationConfig;
  footer: LandingFooterConfig;
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

function contentItem(
  id: string,
  order: number,
  values: Partial<Omit<LandingContentItem, 'id' | 'order'>>,
): LandingContentItem {
  return {
    id,
    order,
    label: '',
    title: '',
    description: '',
    action_label: '',
    action_url: '',
    icon_key: 'other',
    group: '',
    enabled: true,
    ...values,
  };
}

function linkItem(id: string, order: number, label: string, href: string, description = ''): LandingLinkItem {
  return { id, order, label, href, description, enabled: true };
}

const DEFAULT_NAVIGATION: LandingNavigationConfig = {
  explore_label: 'Explorer Omnia',
  professionals_label: 'Professionnels',
  login_label: 'Se connecter',
  register_label: 'Créer un compte',
  direct_links: [
    linkItem('nav-formations', 1, 'Formations', '/catalogue'),
    linkItem('nav-structures', 2, 'Structures', '/accueil#structures'),
    linkItem('nav-about', 3, 'À propos', '/a-propos'),
  ],
  explore_links: [
    linkItem('nav-live', 1, 'Omnia Live', '/omnia-live', 'Lives, ateliers, masterclass et replays'),
    linkItem('nav-projects', 2, 'Omnia Projects', '/projects', 'Projets, challenges, missions et portfolio'),
    linkItem('nav-coaching', 3, 'Omnia Coaching', '/coaching', 'Accompagnement individuel avec des coachs validés'),
    linkItem('nav-talent', 4, 'Omnia Talent', '/talent', 'Profils, offres et recrutement'),
    linkItem('nav-career', 5, 'Carrière et opportunités', '/emploi', 'Emploi, candidatures et développement professionnel'),
    linkItem('nav-verify', 6, 'Certificats et preuves', '/verify', 'Vérification publique des documents'),
    linkItem('nav-forum', 7, 'Omnia Communauté', '/forum', 'Échangez, apprenez et développez votre réseau'),
  ],
  professional_links: [
    linkItem('nav-professor', 1, 'Devenir professeur', '/inscription/professeur', 'Créer et publier des formations'),
    linkItem('nav-coach', 2, 'Devenir coach', '/coaching/devenir-coach', 'Proposer un accompagnement individuel'),
    linkItem('nav-organizer', 3, 'Devenir organisateur', '/inscription/organisateur', 'Créer des événements Omnia Live'),
    linkItem('nav-recruiter', 4, 'Devenir recruteur', '/inscription/recruteur', 'Publier des offres et gérer les candidatures'),
  ],
};

const DEFAULT_FOOTER: LandingFooterConfig = {
  description: 'Formation, compétences et opportunités professionnelles dans un même écosystème.',
  follow_us_label: 'Suivez-nous',
  partner_label: 'Partenaires',
  columns: [
    {
      id: 'footer-formations', title: 'Formations', order: 1,
      links: [
        linkItem('footer-catalogue', 1, 'Catalogue complet', '/catalogue'),
        linkItem('footer-free', 2, 'Formations gratuites', '/catalogue?prix=gratuit'),
        linkItem('footer-cpd', 3, 'Certifications et reconnaissances', '/cpd'),
        linkItem('footer-verify', 4, 'Vérifier un certificat', '/verify'),
      ],
    },
    {
      id: 'footer-ecosystem', title: 'Écosystème', order: 2,
      links: [
        linkItem('footer-live', 1, 'Omnia Live', '/omnia-live'),
        linkItem('footer-projects', 2, 'Omnia Projects', '/projects'),
        linkItem('footer-coaching', 3, 'Omnia Coaching', '/coaching'),
        linkItem('footer-talent', 4, 'Omnia Talent', '/talent'),
        linkItem('footer-career', 5, 'Carrière et opportunités', '/emploi'),
        linkItem('footer-forum', 6, 'Omnia Communauté', '/forum'),
      ],
    },
    {
      id: 'footer-join', title: 'Rejoindre Omnia', order: 3,
      links: [
        linkItem('footer-professor', 1, 'Devenir professeur', '/inscription/professeur'),
        linkItem('footer-coach', 2, 'Devenir coach', '/coaching/devenir-coach'),
        linkItem('footer-organizer', 3, 'Devenir organisateur', '/inscription/organisateur'),
        linkItem('footer-recruiter', 4, 'Devenir recruteur', '/inscription/recruteur'),
        linkItem('footer-structure', 5, 'Inscrire une structure', '/inscription/structure'),
        linkItem('footer-about', 6, 'À propos', '/a-propos'),
      ],
    },
    {
      id: 'footer-information', title: 'Informations', order: 4,
      links: [
        linkItem('footer-privacy', 1, 'Politique de confidentialité', '/confidentialite'),
        linkItem('footer-cgu', 2, 'CGU', '/cgu'),
        linkItem('footer-legal', 3, 'Mentions légales', '/mentions-legales'),
        linkItem('footer-cookies', 4, 'Politique cookies', '/cookies'),
        linkItem('footer-cgv', 5, 'CGV', '/cgv'),
        linkItem('footer-refunds', 6, 'Remboursements & annulations', '/remboursements'),
      ],
    },
  ],
};

const SECTION_DEFAULTS: Record<LandingSectionType, Omit<LandingSectionConfig, 'id' | 'order'>> = {
  hero: {
    type: 'hero', internal_name: 'Introduction principale', enabled: true,
    eyebrow: 'Formation, compétences et opportunités',
    title: 'Apprenez. Prouvez vos compétences. Avancez.',
    subtitle: 'Omnia réunit formations, projets, certifications vérifiables, coaching, événements en direct et opportunités professionnelles dans un même parcours.',
    body: '', primary_cta_label: 'Créer mon compte', primary_cta_url: '/inscription',
    secondary_cta_label: 'Explorer les formations', secondary_cta_url: '/catalogue',
    search_placeholder: 'Quelle compétence souhaitez-vous développer ?',
    search_button_label: 'Rechercher',
    items: [],
  },
  goal_selector: {
    type: 'goal_selector', internal_name: 'Choisir son objectif', enabled: true,
    eyebrow: '', title: 'Que souhaitez-vous accomplir ?',
    subtitle: 'Choisissez votre objectif pour découvrir les outils Omnia adaptés à votre parcours.',
    body: '', primary_cta_label: '', primary_cta_url: '', secondary_cta_label: '', secondary_cta_url: '',
    search_placeholder: '', search_button_label: '',
    items: [
      contentItem('goal-learn', 1, { label: 'Apprendre', title: 'Développer une compétence ou suivre une formation', description: 'Explorez les formations publiées, progressez à votre rythme et retrouvez vos évaluations et certificats dans un même espace.', action_label: 'Créer un compte apprenant', action_url: '/inscription/apprenant', icon_key: 'graduation' }),
      contentItem('goal-career', 2, { label: 'Développer ma carrière', title: 'Construire un profil professionnel complet', description: 'Rassemblez CV, preuves, portfolio, compétences, candidatures et accompagnement carrière dans votre parcours Omnia.', action_label: 'Découvrir les opportunités', action_url: '/emploi', icon_key: 'briefcase' }),
      contentItem('goal-teach', 3, { label: 'Enseigner', title: 'Créer et publier des formations structurées', description: 'Concevez vos contenus, organisez les évaluations, suivez vos apprenants et gérez votre activité depuis l’espace Professeur.', action_label: 'Devenir professeur', action_url: '/inscription/professeur', icon_key: 'book' }),
      contentItem('goal-coach', 4, { label: 'Devenir coach', title: 'Accompagner des personnes en séances individuelles', description: 'Présentez votre expertise, proposez vos disponibilités et accompagnez les utilisateurs avec Omnia Coaching.', action_label: 'Présenter ma candidature', action_url: '/coaching/devenir-coach', icon_key: 'heart' }),
      contentItem('goal-organize', 5, { label: 'Organiser un événement', title: 'Créer des Lives, ateliers et masterclass', description: 'Planifiez vos événements, gérez les participants, les médias, les documents et le suivi depuis Omnia Live.', action_label: 'Devenir organisateur', action_url: '/inscription/organisateur', icon_key: 'calendar' }),
      contentItem('goal-recruit', 6, { label: 'Recruter', title: 'Trouver des profils et suivre les candidatures', description: 'Publiez vos offres, consultez des profils professionnels et appuyez vos décisions sur les compétences et preuves disponibles.', action_label: 'Créer un compte recruteur', action_url: '/inscription/recruteur', icon_key: 'users' }),
      contentItem('goal-structure', 7, { label: 'Représenter une structure', title: 'Former et piloter les compétences d’une organisation', description: 'Gérez les membres, cohortes, obligations de formation, compétences, conformité et rapports dans un espace dédié.', action_label: 'Inscrire une structure', action_url: '/inscription/structure', icon_key: 'building' }),
    ],
  },
  omnia_journey: {
    type: 'omnia_journey', internal_name: 'Le parcours Omnia', enabled: true,
    eyebrow: 'Un parcours complet', title: 'De l’apprentissage aux opportunités',
    subtitle: 'Formez-vous, pratiquez, faites vérifier vos compétences et construisez votre avenir professionnel.',
    body: '', primary_cta_label: '', primary_cta_url: '', secondary_cta_label: '', secondary_cta_url: '',
    search_placeholder: '', search_button_label: '',
    items: [
      contentItem('journey-learn', 1, { title: 'Apprendre', description: 'Formations, parcours, évaluations et sessions en direct réunis dans un environnement adapté à la progression.', action_label: 'Explorer les formations', action_url: '/catalogue', icon_key: 'book' }),
      contentItem('journey-practice', 2, { title: 'Pratiquer', description: 'Projets, challenges, missions et livrables pour transformer les connaissances en expériences démontrables.', action_label: 'Découvrir Omnia Projects', action_url: '/projects', icon_key: 'projects' }),
      contentItem('journey-prove', 3, { title: 'Prouver', description: 'Certificats, badges, Learning Record et Skills Passport permettent de présenter des acquis vérifiables.', action_label: 'Vérifier un certificat', action_url: '/verify', icon_key: 'badge' }),
      contentItem('journey-grow', 4, { title: 'Se développer', description: 'CV, portfolio, coaching et préparation professionnelle structurent la prochaine étape du parcours.', action_label: 'Découvrir le coaching', action_url: '/coaching', icon_key: 'target' }),
      contentItem('journey-opportunities', 5, { title: 'Accéder aux opportunités', description: 'Talents, recruteurs, candidatures, offres et structures se rencontrent dans l’écosystème professionnel Omnia.', action_label: 'Accéder à Omnia Talent', action_url: '/talent', icon_key: 'network' }),
    ],
  },
  featured_courses: {
    type: 'featured_courses', internal_name: 'Formations disponibles', enabled: true,
    eyebrow: '', title: 'Formations disponibles', subtitle: 'Découvrez les formations réellement publiées sur Omnia.',
    body: '', primary_cta_label: 'Voir le catalogue', primary_cta_url: '/catalogue', secondary_cta_label: '', secondary_cta_url: '',
    search_placeholder: '', search_button_label: '', items: [],
  },
  ecosystem: {
    type: 'ecosystem', internal_name: 'Écosystème Omnia', enabled: true,
    eyebrow: '', title: 'Plus qu’une plateforme de cours',
    subtitle: 'Apprenez en direct, réalisez des projets, bénéficiez d’un accompagnement et développez votre carrière.',
    body: '', primary_cta_label: 'Explorer Omnia', primary_cta_url: '/accueil#ecosysteme', secondary_cta_label: '', secondary_cta_url: '',
    search_placeholder: '', search_button_label: '',
    items: [
      contentItem('ecosystem-live', 1, { title: 'Omnia Live', description: 'Lives, ateliers, masterclass, replays, documents et suivi des participants dans un espace événementiel complet.', action_label: 'Explorer Omnia Live', action_url: '/omnia-live', icon_key: 'monitor' }),
      contentItem('ecosystem-projects', 2, { title: 'Omnia Projects', description: 'Des projets et missions pour pratiquer, produire des livrables et enrichir son portfolio professionnel.', action_label: 'Explorer les projets', action_url: '/projects', icon_key: 'projects' }),
      contentItem('ecosystem-coaching', 3, { title: 'Omnia Coaching', description: 'Un accompagnement individuel avec des profils validés, des créneaux et des formats de séance adaptés.', action_label: 'Trouver un coach', action_url: '/coaching', icon_key: 'heart' }),
      contentItem('ecosystem-career', 4, { title: 'Omnia Career', description: 'CV, lettres, candidatures, préparation aux entretiens et outils de développement professionnel.', action_label: 'Découvrir l’espace carrière', action_url: '/emploi', icon_key: 'briefcase' }),
      contentItem('ecosystem-talent', 5, { title: 'Omnia Talent', description: 'Profils, compétences vérifiées, recruteurs, offres et outils de gestion du recrutement.', action_label: 'Accéder à Omnia Talent', action_url: '/talent', icon_key: 'users' }),
      contentItem('ecosystem-forum', 6, { title: 'Omnia Communauté', description: 'Un espace vivant pour échanger, obtenir de l’aide, suivre les discussions de vos formations et découvrir des opportunités professionnelles.', action_label: 'Rejoindre la communauté', action_url: '/forum', icon_key: 'message' }),
    ],
  },
  credentials: {
    type: 'credentials', internal_name: 'Certificats et preuves', enabled: true,
    eyebrow: '', title: 'Des compétences que vous pouvez prouver',
    subtitle: 'Présentez vos certificats, badges et preuves professionnelles dans un environnement vérifiable.',
    body: '', primary_cta_label: 'Vérifier un certificat', primary_cta_url: '/verify', secondary_cta_label: '', secondary_cta_url: '',
    search_placeholder: '', search_button_label: '',
    items: [
      contentItem('proof-certificates', 1, { title: 'Certificats vérifiables', description: 'Une page publique permet de contrôler l’authenticité des documents émis.', icon_key: 'certificate' }),
      contentItem('proof-badges', 2, { title: 'Badges de compétences', description: 'Les badges décrivent les acquis et peuvent compléter le profil professionnel.', icon_key: 'award' }),
      contentItem('proof-record', 3, { title: 'Learning Record', description: 'Les apprentissages, validations et expériences sont regroupés dans un historique structuré.', icon_key: 'clipboard' }),
      contentItem('proof-passport', 4, { title: 'Skills Passport', description: 'Les compétences et preuves peuvent être rassemblées dans un passeport professionnel.', icon_key: 'shield' }),
    ],
  },
  career_recruitment: {
    type: 'career_recruitment', internal_name: 'Carrière et recrutement', enabled: true,
    eyebrow: '', title: 'Construisez votre carrière. Trouvez les bons talents.',
    subtitle: 'Omnia relie profils, compétences vérifiées, candidatures et besoins de recrutement.',
    body: '', primary_cta_label: 'Découvrir Omnia Talent', primary_cta_url: '/talent', secondary_cta_label: 'Découvrir Omnia Career', secondary_cta_url: '/emploi',
    search_placeholder: '', search_button_label: '',
    items: [
      contentItem('career-talent-title', 1, { group: 'talent', label: 'Pour les talents', title: 'Présentez un parcours professionnel complet' }),
      contentItem('career-talent-cv', 2, { group: 'talent', title: 'Créer et actualiser son CV' }),
      contentItem('career-talent-projects', 3, { group: 'talent', title: 'Rassembler projets et preuves' }),
      contentItem('career-talent-skills', 4, { group: 'talent', title: 'Présenter ses compétences vérifiées' }),
      contentItem('career-talent-jobs', 5, { group: 'talent', title: 'Consulter les offres et suivre ses candidatures' }),
      contentItem('career-talent-coach', 6, { group: 'talent', title: 'Se préparer avec un coach' }),
      contentItem('career-recruiter-title', 7, { group: 'recruiter', label: 'Pour les recruteurs', title: 'Recrutez à partir de profils et de preuves' }),
      contentItem('career-recruiter-offers', 8, { group: 'recruiter', title: 'Publier et gérer des offres' }),
      contentItem('career-recruiter-profiles', 9, { group: 'recruiter', title: 'Explorer les profils disponibles' }),
      contentItem('career-recruiter-proof', 10, { group: 'recruiter', title: 'Consulter les compétences et preuves' }),
      contentItem('career-recruiter-applications', 11, { group: 'recruiter', title: 'Suivre les candidatures et entretiens' }),
      contentItem('career-recruiter-team', 12, { group: 'recruiter', title: 'Collaborer avec une équipe de recrutement' }),
    ],
  },
  structures: {
    type: 'structures', internal_name: 'Solutions pour les structures', enabled: true,
    eyebrow: '', title: 'Développez les compétences de votre organisation',
    subtitle: 'Gérez vos membres, formations obligatoires, cohortes, compétences, conformité et rapports.',
    body: '', primary_cta_label: 'Découvrir les solutions', primary_cta_url: '/inscription/structure', secondary_cta_label: '', secondary_cta_url: '',
    search_placeholder: '', search_button_label: '',
    items: [
      contentItem('structure-members', 1, { title: 'Membres, groupes, départements et cohortes' }),
      contentItem('structure-training', 2, { title: 'Formations obligatoires et dates limites' }),
      contentItem('structure-progress', 3, { title: 'Suivi de progression et compétences' }),
      contentItem('structure-compliance', 4, { title: 'Certificats, reconnaissances et conformité' }),
      contentItem('structure-reporting', 5, { title: 'Rapports et tableaux de bord RH' }),
      contentItem('structure-contracts', 6, { title: 'Commerce B2B, devis et contrats' }),
    ],
  },
  partners: {
    type: 'partners', internal_name: 'Partenaires', enabled: false,
    eyebrow: '', title: 'Ils accompagnent l’écosystème Omnia', subtitle: 'Cette section apparaît uniquement lorsqu’au moins un partenaire validé est actif.',
    body: '', primary_cta_label: '', primary_cta_url: '', secondary_cta_label: '', secondary_cta_url: '',
    search_placeholder: '', search_button_label: '', items: [],
  },
  mobile_apps: {
    type: 'mobile_apps', internal_name: 'Applications mobiles', enabled: false,
    eyebrow: '', title: 'Retrouvez Omnia sur mobile', subtitle: 'Cette section apparaîtra lorsque l’application Android ou iOS sera publiée et activée.',
    body: '', primary_cta_label: '', primary_cta_url: '', secondary_cta_label: '', secondary_cta_url: '',
    search_placeholder: '', search_button_label: '', items: [],
  },
  social_networks: {
    type: 'social_networks', internal_name: 'Réseaux sociaux', enabled: false,
    eyebrow: '', title: 'Suivez Omnia Global Academy', subtitle: 'Cette section apparaît uniquement avec des comptes officiels activés.',
    body: '', primary_cta_label: '', primary_cta_url: '', secondary_cta_label: '', secondary_cta_url: '',
    search_placeholder: '', search_button_label: '', items: [],
  },
  final_cta: {
    type: 'final_cta', internal_name: 'Inscription finale', enabled: true,
    eyebrow: '', title: 'Votre prochain objectif commence ici.',
    subtitle: 'Rejoignez Omnia selon votre projet professionnel ou organisationnel.',
    body: '', primary_cta_label: 'Créer un compte', primary_cta_url: '/inscription',
    secondary_cta_label: 'Découvrir les formations', secondary_cta_url: '/catalogue',
    search_placeholder: '', search_button_label: '', items: [],
  },
  custom_text: {
    type: 'custom_text', internal_name: 'Nouveau bloc éditorial', enabled: true,
    eyebrow: '', title: 'Nouveau titre', subtitle: '', body: '',
    primary_cta_label: '', primary_cta_url: '', secondary_cta_label: '', secondary_cta_url: '',
    search_placeholder: '', search_button_label: '', items: [],
  },
};

export function createLandingSection(type: LandingSectionType, order: number): LandingSectionConfig {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    order,
    ...SECTION_DEFAULTS[type],
    items: SECTION_DEFAULTS[type].items.map(item => ({ ...item })),
  };
}

export function createDefaultLandingPage(): LandingPageConfig {
  const orderedTypes: LandingSectionType[] = [
    'hero', 'goal_selector', 'omnia_journey', 'featured_courses', 'ecosystem',
    'credentials', 'career_recruitment', 'structures', 'partners', 'mobile_apps',
    'social_networks', 'final_cta',
  ];
  return {
    version: 2,
    updated_at: null,
    published_at: null,
    navigation: {
      ...DEFAULT_NAVIGATION,
      direct_links: DEFAULT_NAVIGATION.direct_links.map(item => ({ ...item })),
      explore_links: DEFAULT_NAVIGATION.explore_links.map(item => ({ ...item })),
      professional_links: DEFAULT_NAVIGATION.professional_links.map(item => ({ ...item })),
    },
    footer: {
      ...DEFAULT_FOOTER,
      columns: DEFAULT_FOOTER.columns.map(column => ({
        ...column,
        links: column.links.map(item => ({ ...item })),
      })),
    },
    sections: orderedTypes.map((type, index) => createLandingSection(type, index + 1)),
  };
}

function normalizeLinkCollection(value: unknown, fallback: LandingLinkItem[]): LandingLinkItem[] {
  if (!Array.isArray(value)) return fallback.map(item => ({ ...item }));
  return value
    .filter(item => item && typeof item === 'object')
    .map((item, index) => {
      const source = item as Partial<LandingLinkItem>;
      const base = fallback[index] || linkItem(`link-${Date.now()}-${index}`, index + 1, '', '');
      return {
        ...base,
        ...source,
        id: String(source.id || base.id),
        label: String(source.label || ''),
        href: String(source.href || ''),
        description: String(source.description || ''),
        enabled: source.enabled !== false,
        order: Number.isFinite(Number(source.order)) ? Number(source.order) : index + 1,
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index + 1 }));
}

function normalizeContentItems(value: unknown, fallback: LandingContentItem[]): LandingContentItem[] {
  if (!Array.isArray(value)) return fallback.map(item => ({ ...item }));
  return value
    .filter(item => item && typeof item === 'object')
    .map((item, index) => {
      const source = item as Partial<LandingContentItem>;
      const base = fallback[index] || contentItem(`item-${Date.now()}-${index}`, index + 1, {});
      return {
        ...base,
        ...source,
        id: String(source.id || base.id),
        label: String(source.label || ''),
        title: String(source.title || ''),
        description: String(source.description || ''),
        action_label: String(source.action_label || ''),
        action_url: String(source.action_url || ''),
        icon_key: String(source.icon_key || 'other'),
        group: String(source.group || ''),
        enabled: source.enabled !== false,
        order: Number.isFinite(Number(source.order)) ? Number(source.order) : index + 1,
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index + 1 }));
}

export function normalizeLandingPage(value: unknown): LandingPageConfig {
  const fallback = createDefaultLandingPage();
  if (!value || typeof value !== 'object') return fallback;
  const source = value as Partial<LandingPageConfig>;

  const navigationSource = source.navigation && typeof source.navigation === 'object'
    ? source.navigation as Partial<LandingNavigationConfig>
    : {};
  const footerSource = source.footer && typeof source.footer === 'object'
    ? source.footer as Partial<LandingFooterConfig>
    : {};

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
            search_placeholder: String(candidate.search_placeholder || base.search_placeholder || ''),
            search_button_label: String(candidate.search_button_label || base.search_button_label || ''),
            items: normalizeContentItems(candidate.items, base.items),
          };
        })
        .sort((a, b) => a.order - b.order)
        .map((section, index) => ({ ...section, order: index + 1 }))
    : fallback.sections;

  const footerColumns = Array.isArray(footerSource.columns)
    ? footerSource.columns
        .filter(column => column && typeof column === 'object')
        .map((column, index) => {
          const sourceColumn = column as Partial<LandingFooterColumn>;
          const base = fallback.footer.columns[index] || { id: `footer-${index}`, title: '', order: index + 1, links: [] };
          return {
            id: String(sourceColumn.id || base.id),
            title: String(sourceColumn.title || base.title),
            order: Number.isFinite(Number(sourceColumn.order)) ? Number(sourceColumn.order) : index + 1,
            links: normalizeLinkCollection(sourceColumn.links, base.links),
          };
        })
        .sort((a, b) => a.order - b.order)
        .map((column, index) => ({ ...column, order: index + 1 }))
    : fallback.footer.columns;

  return {
    version: Math.max(2, Number(source.version || 2)),
    updated_at: source.updated_at || null,
    published_at: source.published_at || null,
    navigation: {
      explore_label: String(navigationSource.explore_label || fallback.navigation.explore_label),
      professionals_label: String(navigationSource.professionals_label || fallback.navigation.professionals_label),
      login_label: String(navigationSource.login_label || fallback.navigation.login_label),
      register_label: String(navigationSource.register_label || fallback.navigation.register_label),
      direct_links: normalizeLinkCollection(navigationSource.direct_links, fallback.navigation.direct_links),
      explore_links: normalizeLinkCollection(navigationSource.explore_links, fallback.navigation.explore_links),
      professional_links: normalizeLinkCollection(navigationSource.professional_links, fallback.navigation.professional_links),
    },
    footer: {
      description: String(footerSource.description || fallback.footer.description),
      follow_us_label: String(footerSource.follow_us_label || fallback.footer.follow_us_label),
      partner_label: String(footerSource.partner_label || fallback.footer.partner_label),
      columns: footerColumns,
    },
    sections,
  };
}
