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

export type AudiencePageKey = 'apprenants' | 'professeurs' | 'structures' | 'recruteurs';

export type AudiencePageConfig = {
  key: AudiencePageKey;
  route: string;
  nav_label: string;
  enabled: boolean;
  hero_eyebrow: string;
  hero_title: string;
  hero_subtitle: string;
  hero_body: string;
  primary_cta_label: string;
  primary_cta_url: string;
  secondary_cta_label: string;
  secondary_cta_url: string;
  highlight_label: string;
  highlight_title: string;
  highlight_body: string;
  items_title: string;
  items_subtitle: string;
  items: LandingContentItem[];
  segments_title: string;
  segments_subtitle: string;
  segments: LandingContentItem[];
  steps_title: string;
  steps_subtitle: string;
  steps: LandingContentItem[];
};

export type LandingPageConfig = {
  version: number;
  updated_at: string | null;
  published_at: string | null;
  navigation: LandingNavigationConfig;
  footer: LandingFooterConfig;
  sections: LandingSectionConfig[];
  audience_pages: Record<AudiencePageKey, AudiencePageConfig>;
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

const AUDIENCE_PAGE_ORDER: AudiencePageKey[] = ['apprenants', 'professeurs', 'structures', 'recruteurs'];

function audiencePage(key: AudiencePageKey, values: Omit<AudiencePageConfig, 'key'>): AudiencePageConfig {
  return { key, ...values };
}

const DEFAULT_AUDIENCE_PAGES: Record<AudiencePageKey, AudiencePageConfig> = {
  apprenants: audiencePage('apprenants', {
    route: '/pour-les-apprenants',
    nav_label: 'Pour les apprenants',
    enabled: true,
    hero_eyebrow: 'Apprendre · pratiquer · prouver · avancer',
    hero_title: 'Un parcours qui ne s’arrête pas à la dernière leçon.',
    hero_subtitle: 'Omnia relie formation, pratique, preuves de compétences, carrière et opportunités dans un même environnement.',
    hero_body: 'Vous pouvez apprendre à votre rythme, suivre vos évaluations, constituer des preuves vérifiables, travailler sur des projets et préparer votre évolution professionnelle sans disperser votre parcours entre plusieurs outils.',
    primary_cta_label: 'Créer un compte apprenant',
    primary_cta_url: '/inscription/apprenant',
    secondary_cta_label: 'Explorer les formations',
    secondary_cta_url: '/catalogue',
    highlight_label: 'Votre trajectoire Omnia',
    highlight_title: 'Des compétences jusqu’aux opportunités, avec des preuves à chaque étape.',
    highlight_body: 'Omnia a été pensé comme un parcours continu : vous apprenez, vous mettez en pratique, vous conservez vos résultats et vous utilisez ensuite Career, Talent, Projects, Live, Coaching et la Communauté pour donner une suite concrète à vos acquis.',
    items_title: 'Ce que votre espace apprenant réunit',
    items_subtitle: 'Les principaux leviers disponibles dans la plateforme, sans quitter votre parcours.',
    items: [
      contentItem('aud-learner-1', 1, { label: 'Formation', title: 'Parcours, modules et évaluations', description: 'Accédez au catalogue, suivez vos formations, retrouvez vos évaluations, vos résultats et votre progression.', action_label: 'Voir le catalogue', action_url: '/catalogue', icon_key: 'graduation' }),
      contentItem('aud-learner-2', 2, { label: 'Preuves', title: 'Certificats, badges et Skills Passport', description: 'Conservez des preuves vérifiables de vos acquis et rassemblez-les dans votre Learning Record et votre passeport de compétences.', action_label: 'Découvrir les preuves', action_url: '/verify', icon_key: 'badge' }),
      contentItem('aud-learner-3', 3, { label: 'Pratique', title: 'Omnia Projects et portfolio', description: 'Transformez des compétences en livrables, projets et preuves visibles dans votre portfolio.', action_label: 'Explorer Projects', action_url: '/projects', icon_key: 'projects' }),
      contentItem('aud-learner-4', 4, { label: 'Carrière', title: 'Career, Talent et coaching', description: 'Préparez votre CV, vos candidatures, votre positionnement professionnel et votre accès aux opportunités.', action_label: 'Voir les opportunités', action_url: '/forum/emploi', icon_key: 'briefcase' }),
    ],
    segments_title: 'Les opportunités disponibles autour de votre apprentissage',
    segments_subtitle: 'Omnia ne vous demande pas de choisir entre apprendre, pratiquer et préparer votre carrière : ces espaces sont reliés.',
    segments: [
      contentItem('aud-learner-seg-1', 1, { label: 'Omnia Live', title: 'Apprendre aussi en direct', description: 'Lives, ateliers, masterclass, replays et ressources complètent les formations.', action_label: 'Explorer Live', action_url: '/omnia-live', icon_key: 'monitor' }),
      contentItem('aud-learner-seg-2', 2, { label: 'Omnia Communauté', title: 'Échanger et rester connecté', description: 'Posez des questions, suivez les discussions et développez votre réseau au sein de la communauté.', action_label: 'Rejoindre la communauté', action_url: '/forum', icon_key: 'message' }),
      contentItem('aud-learner-seg-3', 3, { label: 'Omnia Coaching', title: 'Être accompagné sur une étape précise', description: 'Réservez un accompagnement individuel lorsque vous avez besoin d’un regard extérieur ou d’un plan d’action.', action_label: 'Découvrir le coaching', action_url: '/coaching', icon_key: 'heart' }),
      contentItem('aud-learner-seg-4', 4, { label: 'Omnia Talent', title: 'Rendre votre profil visible', description: 'Présentez vos compétences, preuves et portfolio dans l’écosystème professionnel Omnia.', action_label: 'Accéder à Talent', action_url: '/talent', icon_key: 'users' }),
    ],
    steps_title: 'Votre progression reste lisible',
    steps_subtitle: 'Chaque étape prépare la suivante sans casser la continuité du parcours.',
    steps: [
      contentItem('aud-learner-step-1', 1, { label: '01', title: 'Apprendre', description: 'Choisissez une formation et progressez avec des objectifs et évaluations structurés.' }),
      contentItem('aud-learner-step-2', 2, { label: '02', title: 'Pratiquer', description: 'Utilisez Projects, Live et les activités complémentaires pour transformer les acquis en expérience.' }),
      contentItem('aud-learner-step-3', 3, { label: '03', title: 'Prouver', description: 'Conservez certificats, badges, résultats et éléments de portfolio.' }),
      contentItem('aud-learner-step-4', 4, { label: '04', title: 'Avancer', description: 'Utilisez Career, Talent, Coaching et les offres pour préparer la prochaine opportunité.' }),
    ],
  }),
  professeurs: audiencePage('professeurs', {
    route: '/pour-les-professeurs',
    nav_label: 'Pour les professeurs',
    enabled: true,
    hero_eyebrow: 'Concevoir · enseigner · suivre',
    hero_title: 'Un vrai espace de production pédagogique, pas un simple formulaire de cours.',
    hero_subtitle: 'Le rôle Professeur réunit conception de formation, évaluations, suivi des apprenants, Live, analytics et gestion de votre activité.',
    hero_body: 'Vous disposez d’un Studio pour construire des parcours complets, organiser les évaluations, gérer les jurys lorsque nécessaire et suivre ce qui se passe après la publication.',
    primary_cta_label: 'Devenir professeur',
    primary_cta_url: '/inscription/professeur',
    secondary_cta_label: 'Voir les formations publiées',
    secondary_cta_url: '/catalogue',
    highlight_label: 'Votre environnement de travail',
    highlight_title: 'Du plan de cours au suivi des apprenants, tout reste relié.',
    highlight_body: 'Le Studio Omnia permet de structurer le contenu, les modules, les évaluations et la publication. Votre tableau de bord complète ce travail avec le suivi pédagogique, les analytics, les certificats et les éléments nécessaires à la gestion de votre activité.',
    items_title: 'Ce que vous pilotez réellement',
    items_subtitle: 'Des fonctions conçues pour couvrir le cycle complet d’une formation.',
    items: [
      contentItem('aud-prof-1', 1, { label: 'Studio', title: 'Concevoir des formations structurées', description: 'Créez les objectifs, modules, leçons, ressources, évaluations, tarification et éléments de présentation.', action_label: 'Découvrir le rôle professeur', action_url: '/inscription/professeur', icon_key: 'book' }),
      contentItem('aud-prof-2', 2, { label: 'Évaluation', title: 'Organiser les validations et jurys', description: 'Utilisez le centre d’évaluation, les règles de validation et les jurys prévus dans la plateforme.', icon_key: 'clipboard' }),
      contentItem('aud-prof-3', 3, { label: 'Suivi', title: 'Observer la progression et les résultats', description: 'Retrouvez les données utiles au suivi pédagogique et à l’amélioration de vos formations.', icon_key: 'target' }),
      contentItem('aud-prof-4', 4, { label: 'Activité', title: 'Analytics, portefeuille et certificats', description: 'Suivez votre activité depuis les espaces dédiés au professeur, y compris les analytics et éléments de portefeuille lorsque applicables.', icon_key: 'briefcase' }),
    ],
    segments_title: 'Au-delà des cours enregistrés',
    segments_subtitle: 'Votre enseignement peut combiner plusieurs formats et points de contact.',
    segments: [
      contentItem('aud-prof-seg-1', 1, { label: 'Omnia Live', title: 'Animer des sessions en direct', description: 'Ateliers, masterclass, événements, documents et suivi des participants peuvent prolonger vos formations.', action_label: 'Explorer Live', action_url: '/omnia-live', icon_key: 'monitor' }),
      contentItem('aud-prof-seg-2', 2, { label: 'Projects', title: 'Relier apprentissage et production', description: 'Associez la pratique et les livrables aux compétences développées lorsque le contexte pédagogique s’y prête.', action_label: 'Explorer Projects', action_url: '/projects', icon_key: 'projects' }),
      contentItem('aud-prof-seg-3', 3, { label: 'Communauté', title: 'Faire vivre les échanges', description: 'Les espaces de discussion permettent de prolonger les questions et interactions autour des apprentissages.', action_label: 'Voir la communauté', action_url: '/forum', icon_key: 'message' }),
    ],
    steps_title: 'Votre cycle de publication',
    steps_subtitle: 'Une logique de production claire de la conception à l’amélioration continue.',
    steps: [
      contentItem('aud-prof-step-1', 1, { label: '01', title: 'Concevoir', description: 'Définissez la promesse, les modules, les contenus et les règles d’évaluation.' }),
      contentItem('aud-prof-step-2', 2, { label: '02', title: 'Prévisualiser et publier', description: 'Contrôlez le rendu avant de rendre la formation disponible.' }),
      contentItem('aud-prof-step-3', 3, { label: '03', title: 'Animer', description: 'Accompagnez le parcours avec suivi pédagogique, Live ou interactions complémentaires.' }),
      contentItem('aud-prof-step-4', 4, { label: '04', title: 'Mesurer et améliorer', description: 'Utilisez les résultats et analytics disponibles pour faire évoluer le parcours.' }),
    ],
  }),
  structures: audiencePage('structures', {
    route: '/pour-les-structures',
    nav_label: 'Pour les structures',
    enabled: true,
    hero_eyebrow: 'Entreprises · écoles · ONG · institutions · associations',
    hero_title: 'Une structure Omnia peut représenter bien plus qu’une entreprise.',
    hero_subtitle: 'Le même espace peut servir à former des équipes, gérer des cohortes, suivre des obligations, organiser des membres, recruter et produire des rapports adaptés à votre organisation.',
    hero_body: 'Le rôle Structure a été conçu pour plusieurs réalités : entreprise, établissement ou centre de formation, ONG, association, institution, réseau ou organisation partenaire. Les permissions et usages s’adaptent à la manière dont votre structure fonctionne.',
    primary_cta_label: 'Inscrire une structure',
    primary_cta_url: '/inscription/structure',
    secondary_cta_label: 'Parler à Omnia',
    secondary_cta_url: '/contact',
    highlight_label: 'Un espace organisationnel complet',
    highlight_title: 'Former, organiser, suivre et recruter depuis une même structure.',
    highlight_body: 'Vous pouvez rattacher des membres, organiser des équipes et cohortes, attribuer ou créer des formations, suivre les progressions, gérer des obligations de conformité, accéder aux statistiques, utiliser les fonctions B2B et activer un espace de recrutement selon vos besoins.',
    items_title: 'Ce que votre structure peut administrer',
    items_subtitle: 'Les fonctions sont regroupées autour de la gestion des personnes, de la formation et du pilotage.',
    items: [
      contentItem('aud-struct-1', 1, { label: 'Organisation', title: 'Membres, équipes, rattachements et cohortes', description: 'Structurez vos membres, équipes, groupes et rattachements selon votre organisation réelle.', action_label: 'Inscrire une structure', action_url: '/inscription/structure', icon_key: 'building' }),
      contentItem('aud-struct-2', 2, { label: 'Formation', title: 'Créer, attribuer et suivre des parcours', description: 'Utilisez les espaces Formation et Studio pour organiser la montée en compétences et les obligations de suivi.', icon_key: 'graduation' }),
      contentItem('aud-struct-3', 3, { label: 'Pilotage', title: 'Suivi RH, statistiques et conformité', description: 'Suivez progression, compétences, certificats, obligations et indicateurs utiles à votre organisation.', icon_key: 'clipboard' }),
      contentItem('aud-struct-4', 4, { label: 'Recrutement', title: 'Offres, talents, compétences vérifiées et entretiens', description: 'Lorsque votre structure recrute, elle dispose d’un espace dédié aux offres, talents, favoris, candidatures, entretiens, messages et statistiques.', icon_key: 'users' }),
    ],
    segments_title: 'Plusieurs types de structures, plusieurs usages',
    segments_subtitle: 'La plateforme n’impose pas un modèle unique : elle organise les fonctionnalités autour du contexte de votre organisation.',
    segments: [
      contentItem('aud-struct-seg-1', 1, { label: 'Entreprise & employeur', title: 'Développer les compétences internes', description: 'Organisez les équipes, attribuez des parcours, suivez la progression et activez le recrutement lorsque nécessaire.' }),
      contentItem('aud-struct-seg-2', 2, { label: 'École, centre & académie', title: 'Piloter des cohortes et des programmes', description: 'Gérez des membres, des formations, des évaluations, des jurys et le suivi pédagogique à l’échelle de la structure.' }),
      contentItem('aud-struct-seg-3', 3, { label: 'ONG, association & institution', title: 'Former des bénéficiaires, membres ou équipes', description: 'Structurez les groupes, suivez des obligations, conservez des preuves et préparez les rapports utiles aux programmes.' }),
      contentItem('aud-struct-seg-4', 4, { label: 'Organisation partenaire', title: 'Rattacher et suivre des membres', description: 'Utilisez les mécanismes de rattachement et les fonctions organisationnelles prévues pour travailler avec vos membres dans Omnia.' }),
    ],
    steps_title: 'Comment Omnia s’intègre à votre organisation',
    steps_subtitle: 'Une logique proche d’un programme de transformation : cadrer, organiser, déployer, mesurer.',
    steps: [
      contentItem('aud-struct-step-1', 1, { label: '01', title: 'Cadrer', description: 'Définissez le type de structure, les responsabilités et les objectifs de formation ou de recrutement.' }),
      contentItem('aud-struct-step-2', 2, { label: '02', title: 'Organiser', description: 'Ajoutez les membres, équipes, cohortes, rattachements et permissions nécessaires.' }),
      contentItem('aud-struct-step-3', 3, { label: '03', title: 'Déployer', description: 'Lancez formations, obligations, suivi RH, campagnes ou activités de recrutement.' }),
      contentItem('aud-struct-step-4', 4, { label: '04', title: 'Mesurer', description: 'Utilisez statistiques, compétences, certificats et rapports pour suivre les résultats.' }),
    ],
  }),
  recruteurs: audiencePage('recruteurs', {
    route: '/pour-les-recruteurs',
    nav_label: 'Pour les recruteurs',
    enabled: true,
    hero_eyebrow: 'Sourcing · preuves · candidatures',
    hero_title: 'Recrutez à partir de profils enrichis, pas seulement d’un CV.',
    hero_subtitle: 'Omnia Talent relie offres, profils professionnels, compétences vérifiées, projets, favoris, candidatures, entretiens et messages.',
    hero_body: 'Le rôle Recruteur existe en espace indépendant et peut aussi être utilisé dans le contexte d’une Structure. L’objectif est de donner plus de contexte aux décisions de recrutement tout en centralisant le suivi.',
    primary_cta_label: 'Créer un compte recruteur',
    primary_cta_url: '/inscription/recruteur',
    secondary_cta_label: 'Explorer Omnia Talent',
    secondary_cta_url: '/talent',
    highlight_label: 'Un recrutement plus documenté',
    highlight_title: 'Des compétences, projets et preuves autour du profil professionnel.',
    highlight_body: 'Lorsque les candidats rendent ces éléments disponibles, le recruteur peut consulter davantage qu’une candidature : compétences vérifiées, portfolio, projets, certificats et informations professionnelles peuvent compléter l’analyse du profil.',
    items_title: 'Votre espace de recrutement',
    items_subtitle: 'Les étapes clés du processus sont déjà prévues dans Omnia Talent.',
    items: [
      contentItem('aud-rec-1', 1, { label: 'Offres', title: 'Publier et gérer les opportunités', description: 'Créez vos offres et suivez leur cycle de vie depuis votre espace recruteur.', action_label: 'Voir les offres', action_url: '/talent/recruteur/offres', icon_key: 'briefcase' }),
      contentItem('aud-rec-2', 2, { label: 'Talents', title: 'Explorer les profils disponibles', description: 'Recherchez des talents et conservez les profils pertinents dans vos favoris.', action_label: 'Explorer Talent', action_url: '/talent', icon_key: 'users' }),
      contentItem('aud-rec-3', 3, { label: 'Preuves', title: 'Consulter les compétences vérifiées', description: 'Accédez aux éléments de preuve et compétences disponibles pour enrichir l’analyse d’un profil.', icon_key: 'shield' }),
      contentItem('aud-rec-4', 4, { label: 'Suivi', title: 'Candidatures, entretiens et messages', description: 'Centralisez les candidatures, organisez les entretiens et gardez le fil des échanges.', icon_key: 'message' }),
    ],
    segments_title: 'Deux contextes de recrutement',
    segments_subtitle: 'Le recrutement peut être mené de façon indépendante ou au sein d’une Structure Omnia.',
    segments: [
      contentItem('aud-rec-seg-1', 1, { label: 'Recruteur indépendant', title: 'Un espace dédié à votre activité', description: 'Gérez offres, talents, compétences vérifiées, favoris, candidatures, entretiens, messages, profil et paramètres.' }),
      contentItem('aud-rec-seg-2', 2, { label: 'Recruteur de structure', title: 'Recruter au nom de votre organisation', description: 'Travaillez dans l’espace recrutement de la Structure avec les outils dédiés à l’équipe et aux statistiques.' }),
      contentItem('aud-rec-seg-3', 3, { label: 'Omnia Talent', title: 'Relier sourcing et profils professionnels', description: 'Accédez à l’écosystème Talent pour explorer les profils et opportunités disponibles.', action_label: 'Accéder à Talent', action_url: '/talent', icon_key: 'network' }),
    ],
    steps_title: 'Du besoin au suivi candidat',
    steps_subtitle: 'Un parcours lisible qui garde le contexte du profil à chaque étape.',
    steps: [
      contentItem('aud-rec-step-1', 1, { label: '01', title: 'Définir le besoin', description: 'Publiez une offre ou commencez directement par l’exploration des talents.' }),
      contentItem('aud-rec-step-2', 2, { label: '02', title: 'Explorer', description: 'Identifiez les profils pertinents et consultez les éléments professionnels disponibles.' }),
      contentItem('aud-rec-step-3', 3, { label: '03', title: 'Comparer', description: 'Appuyez votre analyse sur candidatures, compétences, preuves et favoris.' }),
      contentItem('aud-rec-step-4', 4, { label: '04', title: 'Suivre', description: 'Gérez entretiens, messages, candidatures et statistiques depuis le même environnement.' }),
    ],
  }),
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
    linkItem('nav-career', 5, 'Carrière et opportunités', '/forum/emploi', 'Emploi, candidatures et développement professionnel'),
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
        linkItem('footer-career', 5, 'Carrière et opportunités', '/forum/emploi'),
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
      contentItem('goal-career', 2, { label: 'Développer ma carrière', title: 'Construire un profil professionnel complet', description: 'Rassemblez CV, preuves, portfolio, compétences, candidatures et accompagnement carrière dans votre parcours Omnia.', action_label: 'Découvrir les opportunités', action_url: '/forum/emploi', icon_key: 'briefcase' }),
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
      contentItem('ecosystem-career', 4, { title: 'Omnia Career', description: 'CV, lettres, candidatures, préparation aux entretiens et outils de développement professionnel.', action_label: 'Découvrir l’espace carrière', action_url: '/forum/emploi', icon_key: 'briefcase' }),
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
    body: '', primary_cta_label: 'Découvrir Omnia Talent', primary_cta_url: '/talent', secondary_cta_label: 'Découvrir Omnia Career', secondary_cta_url: '/forum/emploi',
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
    type: 'final_cta', internal_name: 'Continuité du parcours', enabled: true,
    eyebrow: '', title: 'Composez la suite de votre parcours.',
    subtitle: 'Approfondissez vos compétences, transformez-les en réalisations concrètes et rendez-les visibles dans l’écosystème Omnia.',
    body: '', primary_cta_label: '', primary_cta_url: '',
    secondary_cta_label: '', secondary_cta_url: '',
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
    audience_pages: AUDIENCE_PAGE_ORDER.reduce((acc, key) => ({
      ...acc,
      [key]: {
        ...DEFAULT_AUDIENCE_PAGES[key],
        items: DEFAULT_AUDIENCE_PAGES[key].items.map(item => ({ ...item })),
        segments: DEFAULT_AUDIENCE_PAGES[key].segments.map(item => ({ ...item })),
        steps: DEFAULT_AUDIENCE_PAGES[key].steps.map(item => ({ ...item })),
      },
    }), {} as Record<AudiencePageKey, AudiencePageConfig>),
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


function normalizeAudiencePage(value: unknown, fallback: AudiencePageConfig): AudiencePageConfig {
  if (!value || typeof value !== 'object') {
    return {
      ...fallback,
      items: fallback.items.map(item => ({ ...item })),
      segments: fallback.segments.map(item => ({ ...item })),
      steps: fallback.steps.map(item => ({ ...item })),
    };
  }
  const source = value as Partial<AudiencePageConfig>;
  return {
    ...fallback,
    ...source,
    key: fallback.key,
    route: String(source.route || fallback.route),
    nav_label: String(source.nav_label || fallback.nav_label),
    enabled: source.enabled !== false,
    hero_eyebrow: String(source.hero_eyebrow || fallback.hero_eyebrow),
    hero_title: String(source.hero_title || fallback.hero_title),
    hero_subtitle: String(source.hero_subtitle || fallback.hero_subtitle),
    hero_body: String(source.hero_body || fallback.hero_body),
    primary_cta_label: String(source.primary_cta_label || fallback.primary_cta_label),
    primary_cta_url: String(source.primary_cta_url || fallback.primary_cta_url),
    secondary_cta_label: String(source.secondary_cta_label || fallback.secondary_cta_label),
    secondary_cta_url: String(source.secondary_cta_url || fallback.secondary_cta_url),
    highlight_label: String(source.highlight_label || fallback.highlight_label),
    highlight_title: String(source.highlight_title || fallback.highlight_title),
    highlight_body: String(source.highlight_body || fallback.highlight_body),
    items_title: String(source.items_title || fallback.items_title),
    items_subtitle: String(source.items_subtitle || fallback.items_subtitle),
    items: normalizeContentItems(source.items, fallback.items),
    segments_title: String(source.segments_title || fallback.segments_title),
    segments_subtitle: String(source.segments_subtitle || fallback.segments_subtitle),
    segments: normalizeContentItems(source.segments, fallback.segments),
    steps_title: String(source.steps_title || fallback.steps_title),
    steps_subtitle: String(source.steps_subtitle || fallback.steps_subtitle),
    steps: normalizeContentItems(source.steps, fallback.steps),
  };
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
    audience_pages: AUDIENCE_PAGE_ORDER.reduce((acc, key) => ({
      ...acc,
      [key]: normalizeAudiencePage((source as { audience_pages?: Partial<Record<AudiencePageKey, unknown>> }).audience_pages?.[key], fallback.audience_pages[key]),
    }), {} as Record<AudiencePageKey, AudiencePageConfig>),
  };
}
