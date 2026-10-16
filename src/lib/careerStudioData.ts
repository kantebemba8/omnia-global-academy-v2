import type { DocData, DesignOptions } from '../components/career/CvTemplates';
import type { LmData, LmDesign } from '../components/career/LmTemplates';

export type CareerDocType = 'cv' | 'lm';

export type CareerTemplateMeta = {
  template_key: string;
  template_type: CareerDocType;
  name_fr: string;
  description_fr: string;
  category: string;
  is_free: boolean;
  is_ats_compatible: boolean;
  display_order: number;
  default_colors: {
    primary: string;
    accent: string;
    sidebar: string;
    text: string;
    background: string;
  };
  available_fonts?: string[];
  thumbnail_url?: string;
  layout_config?: Record<string, unknown>;
  is_custom?: boolean;
  is_active?: boolean;
  catalog_status?: 'official' | 'custom';
  canonical_template_key?: string | null;
};

export type CareerDocumentSummary = {
  id: string;
  title: string;
  doc_type: CareerDocType;
  template_key: string;
  language: string;
  status: string;
  ats_score: number | null;
  target_job: string | null;
  application_type: string | null;
  is_primary?: boolean;
  created_at: string;
  updated_at: string;
};

export type CareerDocumentFull = CareerDocumentSummary & {
  doc_data: DocData | LmData;
  design_options: DesignOptions | LmDesign;
  target_country?: string | null;
};

export const OMNIA_BLUE = '#002050';
export const OMNIA_GOLD = '#bf8813';

export const DEFAULT_COLORS = {
  primary: OMNIA_BLUE,
  accent: OMNIA_GOLD,
  sidebar: '#F8F9FA',
  text: '#374151',
  background: '#FFFFFF',
};

export const DEFAULT_CV_DESIGN: DesignOptions = {
  colors: DEFAULT_COLORS,
  font: 'inter',
  font_size_body: 9,
  font_size_title: 11,
  line_spacing: 1.5,
  photo_enabled: false,
  photo_shape: 'round',
  pages: 1,
  document_mode: 'balanced',
  page_format: 'a4',
  orientation: 'portrait',
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
  letter_spacing: 0,
  paragraph_spacing: 8,
  section_spacing: 14,
  density: 'balanced',
  page_numbers: false,
  footer_text: '',
  border_width: 0,
  border_color: '#e2e8f0',
  editor_mode: 'template',
};

export const DEFAULT_LM_DESIGN: LmDesign = {
  colors: DEFAULT_COLORS,
  font: 'inter',
  font_size_body: 10,
  line_spacing: 1.65,
  document_mode: 'balanced',
  page_format: 'a4',
  orientation: 'portrait',
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
  letter_spacing: 0,
  paragraph_spacing: 8,
  section_spacing: 14,
  density: 'balanced',
  page_numbers: false,
  footer_text: '',
  border_width: 0,
  border_color: '#e2e8f0',
  editor_mode: 'template',
};

export const DEFAULT_CV_DATA: DocData = {
  name: 'Votre nom complet',
  title: 'Titre professionnel visé',
  objective: 'Construire une candidature claire, crédible et adaptée au poste recherché.',
  summary: 'Professionnel(le) motivé(e), organisé(e) et orienté(e) résultats, avec une expérience dans la coordination d’activités, le suivi des priorités et la collaboration avec différents interlocuteurs. Remplacez ce texte par un résumé de 40 à 90 mots décrivant votre expérience réelle, vos principales compétences et la valeur que vous pouvez apporter.',
  photo_url: '',
  contact: {
    email: 'prenom.nom@email.com',
    phone: '+[indicatif] [numéro]',
    location: 'Ville, Pays',
    linkedin: 'linkedin.com/in/votre-profil',
    portfolio: 'votre-portfolio.com',
  },
  experiences: [
    {
      id: 'example_exp_1',
      position: 'Intitulé du poste ou de la mission',
      company: 'Nom de l’entreprise ou de l’organisation',
      location: 'Ville, Pays',
      start_date: '2023-01',
      end_date: '',
      current: true,
      description: 'Décrivez 3 à 5 responsabilités et résultats réels. Exemple : coordination des activités, amélioration du suivi des dossiers et respect des délais. Ajoutez uniquement des chiffres que vous pouvez confirmer.',
    },
  ],
  education: [
    {
      id: 'example_edu_1',
      degree: 'Nom du diplôme ou de la formation',
      school: 'Établissement de formation',
      location: 'Ville, Pays',
      year: '2023',
    },
  ],
  omnia_formations: [],
  skills: [
    { id: 'example_skill_1', name: 'Organisation et gestion des priorités', level: 4 },
    { id: 'example_skill_2', name: 'Communication professionnelle', level: 4 },
    { id: 'example_skill_3', name: 'Travail en équipe', level: 4 },
    { id: 'example_skill_4', name: 'Outils numériques et bureautiques', level: 3 },
  ],
  languages: [
    { id: 'example_lang_1', name: 'Français', level: 'Courant' },
    { id: 'example_lang_2', name: 'Anglais', level: 'Intermédiaire' },
  ],
  certifications_external: [
    { id: 'example_cert_1', name: 'Nom de la certification', issuer: 'Organisme émetteur', year: '2024' },
  ],
  projects: [
    {
      id: 'example_project_1',
      name: 'Projet ou réalisation significative',
      description: 'Expliquez le contexte, votre contribution personnelle et le résultat obtenu.',
      technologies: 'Outils, méthodes ou compétences utilisés',
    },
  ],
  interests: ['Apprentissage continu', 'Innovation', 'Engagement associatif'],
  references: 'Références disponibles sur demande.',
  career_meta: { example_content: true, schema_version: 2 },
};

export const DEFAULT_LM_DATA: LmData = {
  sender: {
    name: 'Votre nom complet',
    address: 'Votre adresse',
    phone: '+[indicatif] [numéro]',
    email: 'prenom.nom@email.com',
    city: 'Ville, Pays',
    date: new Date().toISOString().slice(0, 10),
  },
  recipient: {
    name: 'Nom du recruteur ou responsable',
    company: 'Nom de l’entreprise',
    address: 'Adresse de l’entreprise',
  },
  subject: 'Candidature au poste de [intitulé du poste]',
  salutation: 'Madame, Monsieur,',
  intro: 'Je vous adresse ma candidature au poste de [intitulé du poste]. Mon parcours et mon intérêt pour [domaine ou secteur] correspondent aux principales attentes de cette opportunité.',
  motivation: 'Votre organisation retient particulièrement mon attention pour [raison précise liée à l’entreprise, au projet ou au secteur]. Je souhaite rejoindre une équipe dans laquelle je pourrai contribuer concrètement tout en poursuivant le développement de mes compétences.',
  skills_paragraph: 'Au cours de mes expériences, j’ai développé des compétences en [compétence 1], [compétence 2] et [compétence 3]. Remplacez cette phrase par deux ou trois exemples réels démontrant votre manière de travailler et les résultats obtenus.',
  company_link: 'Les missions proposées, notamment [mission ou priorité], rejoignent mon projet professionnel et les responsabilités que je souhaite assumer.',
  availability: 'Je suis disponible à partir de [date] et reste à votre disposition pour un entretien.',
  closing: 'Je vous remercie pour l’attention portée à ma candidature et vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.',
  signature: 'Votre nom complet',
  career_meta: { example_content: true, schema_version: 2 },
};

export const CV_TEMPLATES_META: CareerTemplateMeta[] = [
  { template_key:'cv_horizon', template_type:'cv', name_fr:'Horizon Pro', description_fr:'Deux colonnes élégantes, lisibles et professionnelles.', category:'professional', is_free:true, is_ats_compatible:true, display_order:1, default_colors:{...DEFAULT_COLORS,primary:'#002050',accent:'#bf8813',sidebar:'#eef3f8'} },
  { template_key:'cv_sahara', template_type:'cv', name_fr:'Sahara Élégant', description_fr:'Style chaleureux et premium aux accents dorés.', category:'africa_premium', is_free:true, is_ats_compatible:true, display_order:2, default_colors:{...DEFAULT_COLORS,primary:'#7a3e16',accent:'#d7a64a',sidebar:'#fbf4e8'} },
  { template_key:'cv_atlas', template_type:'cv', name_fr:'Atlas ATS', description_fr:'Modèle sans photo, optimisé pour les recruteurs et ATS.', category:'professional', is_free:true, is_ats_compatible:true, display_order:3, default_colors:{...DEFAULT_COLORS,primary:'#16213e',accent:'#4b79a1'} },
  { template_key:'cv_kora', template_type:'cv', name_fr:'Kora Créatif', description_fr:'Présentation moderne avec chronologie et identité forte.', category:'creative', is_free:true, is_ats_compatible:false, display_order:4, default_colors:{...DEFAULT_COLORS,primary:'#3b235f',accent:'#d2a8ff',sidebar:'#f6f0ff'} },
  { template_key:'cv_nile', template_type:'cv', name_fr:'Nile Impact', description_fr:'Blocs dynamiques pour profils polyvalents et projets.', category:'professional', is_free:true, is_ats_compatible:true, display_order:5, default_colors:{...DEFAULT_COLORS,primary:'#064e3b',accent:'#22c55e',sidebar:'#ecfdf5'} },
  { template_key:'cv_executive', template_type:'cv', name_fr:'Executive Noir & Or', description_fr:'Une page premium pour cadres et fonctions de direction.', category:'professional', is_free:true, is_ats_compatible:true, display_order:6, default_colors:{...DEFAULT_COLORS,primary:'#111827',accent:'#b88746'} },
  { template_key:'cv_baobab', template_type:'cv', name_fr:'Baobab Créatif', description_fr:'Design visuel pour communication, marketing et création.', category:'creative', is_free:true, is_ats_compatible:false, display_order:7, default_colors:{...DEFAULT_COLORS,primary:'#7c2d12',accent:'#f59e0b',sidebar:'#fff7ed'} },
  { template_key:'cv_digital', template_type:'cv', name_fr:'Digital Tech', description_fr:'Interface sombre et moderne pour tech, data et cybersécurité.', category:'tech', is_free:true, is_ats_compatible:true, display_order:8, default_colors:{...DEFAULT_COLORS,primary:'#071a2f',accent:'#00b8d9',sidebar:'#0d2944'} },
  { template_key:'cv_academia', template_type:'cv', name_fr:'Academia', description_fr:'Structure détaillée pour enseignement, recherche et publications.', category:'specialized', is_free:true, is_ats_compatible:true, display_order:9, default_colors:{...DEFAULT_COLORS,primary:'#334155',accent:'#64748b'} },
  { template_key:'cv_hospitality', template_type:'cv', name_fr:'Hospitality Signature', description_fr:'Élégant et orienté service, hôtellerie et restauration.', category:'specialized', is_free:true, is_ats_compatible:true, display_order:10, default_colors:{...DEFAULT_COLORS,primary:'#123b55',accent:'#c6a15b',sidebar:'#edf4f7'} },
  { template_key:'cv_qhse', template_type:'cv', name_fr:'QHSE Green', description_fr:'Conçu pour QSE, HSE, RSE, conformité et audit.', category:'specialized', is_free:true, is_ats_compatible:true, display_order:11, default_colors:{...DEFAULT_COLORS,primary:'#0f4c3a',accent:'#84cc16',sidebar:'#f1f8f4'} },
  { template_key:'cv_impact', template_type:'cv', name_fr:'Impact One Page', description_fr:'Compact et percutant pour candidature rapide.', category:'professional', is_free:true, is_ats_compatible:true, display_order:12, default_colors:{...DEFAULT_COLORS,primary:'#1e3a8a',accent:'#f59e0b'} },
];

export const LM_TEMPLATES_META: CareerTemplateMeta[] = [
  { template_key:'lm_horizon', template_type:'lm', name_fr:'Horizon Pro', description_fr:'Lettre assortie au CV Horizon Pro.', category:'classic_lm', is_free:true, is_ats_compatible:true, display_order:1, default_colors:{...DEFAULT_COLORS,primary:'#002050',accent:'#bf8813'} },
  { template_key:'lm_sahara', template_type:'lm', name_fr:'Sahara Élégant', description_fr:'Lettre premium aux accents chauds et dorés.', category:'classic_lm', is_free:true, is_ats_compatible:true, display_order:2, default_colors:{...DEFAULT_COLORS,primary:'#7a3e16',accent:'#d7a64a'} },
  { template_key:'lm_atlas', template_type:'lm', name_fr:'Atlas ATS', description_fr:'Lettre simple, claire et très lisible.', category:'classic_lm', is_free:true, is_ats_compatible:true, display_order:3, default_colors:{...DEFAULT_COLORS,primary:'#16213e',accent:'#4b79a1'} },
  { template_key:'lm_kora', template_type:'lm', name_fr:'Kora Créative', description_fr:'Lettre moderne pour communication et métiers créatifs.', category:'classic_lm', is_free:true, is_ats_compatible:false, display_order:4, default_colors:{...DEFAULT_COLORS,primary:'#3b235f',accent:'#d2a8ff'} },
  { template_key:'lm_digital', template_type:'lm', name_fr:'Digital Tech', description_fr:'Lettre pour tech, data, produit et cybersécurité.', category:'classic_lm', is_free:true, is_ats_compatible:true, display_order:5, default_colors:{...DEFAULT_COLORS,primary:'#071a2f',accent:'#00b8d9'} },
  { template_key:'lm_executive', template_type:'lm', name_fr:'Executive Noir & Or', description_fr:'Lettre premium pour profils expérimentés.', category:'classic_lm', is_free:true, is_ats_compatible:true, display_order:6, default_colors:{...DEFAULT_COLORS,primary:'#111827',accent:'#b88746'} },
];

export const CAREER_TEMPLATES_META = [...CV_TEMPLATES_META, ...LM_TEMPLATES_META];
export const OFFICIAL_CAREER_TEMPLATE_KEYS = new Set(CAREER_TEMPLATES_META.map(template => template.template_key));

export const LEGACY_CV_TEMPLATE_ALIASES: Record<string, string> = {
  classic_pro: 'cv_horizon',
  modern_student: 'cv_nile',
  corporate_blue: 'cv_horizon',
  minimal_luxe: 'cv_impact',
  africa_gold: 'cv_sahara',
  tech_future: 'cv_digital',
  cyber_security: 'cv_digital',
  data_analyst: 'cv_digital',
  creative_digital: 'cv_baobab',
  no_photo_ats: 'cv_atlas',
  photo_elegant: 'cv_horizon',
  young_graduate: 'cv_nile',
  internship_ready: 'cv_nile',
  international_cv: 'cv_atlas',
  qhse_professional: 'cv_qhse',
  business_manager: 'cv_executive',
  hospitality: 'cv_hospitality',
  hospitality_premium: 'cv_hospitality',
  academic_cv: 'cv_academia',
  academic: 'cv_academia',
  freelancer: 'cv_kora',
  freelancer_portfolio: 'cv_kora',
  executive_one_page: 'cv_executive',
  cyber_security_cv: 'cv_digital',
  data_analyst_cv: 'cv_digital',
  modern: 'cv_horizon',
  professional: 'cv_horizon',
  classic: 'cv_horizon',
  creative: 'cv_baobab',
  simple: 'cv_atlas',
  student: 'cv_nile',
  qhse: 'cv_qhse',
};

export const LEGACY_LM_TEMPLATE_ALIASES: Record<string, string> = {
  lm_classic_pro: 'lm_horizon',
  lm_modern_student: 'lm_atlas',
  lm_corporate_blue: 'lm_horizon',
  lm_minimal_luxe: 'lm_atlas',
  lm_africa_gold: 'lm_sahara',
  lm_tech_future: 'lm_digital',
  lm_cyber_security: 'lm_digital',
  lm_data_analyst: 'lm_digital',
  lm_creative_digital: 'lm_kora',
  lm_no_photo_ats: 'lm_atlas',
  lm_photo_elegant: 'lm_horizon',
  lm_young_graduate: 'lm_atlas',
  lm_internship_ready: 'lm_atlas',
  lm_international: 'lm_horizon',
  lm_qhse: 'lm_horizon',
  lm_business_manager: 'lm_executive',
  lm_hospitality: 'lm_sahara',
  lm_academic: 'lm_atlas',
  lm_freelancer: 'lm_kora',
  lm_stage_simple: 'lm_atlas',
  lm_premier_emploi: 'lm_atlas',
  lm_alternance: 'lm_atlas',
  lm_spontanee: 'lm_horizon',
  lm_qhse_rse: 'lm_horizon',
  lm_tech_data: 'lm_digital',
  lm_hotellerie: 'lm_sahara',
  lm_administration: 'lm_horizon',
  lm_finance_banque: 'lm_executive',
  lm_internationale: 'lm_horizon',
  lm_courte_premium: 'lm_executive',
  lm_pro_classique: 'lm_horizon',
  classic_lm: 'lm_horizon',
  dynamic_lm: 'lm_kora',
  academic_lm: 'lm_atlas',
  modern_lm: 'lm_horizon',
  professional_lm: 'lm_horizon',
  creative_lm: 'lm_kora',
  simple_lm: 'lm_atlas',
};

export const LEGACY_CAREER_TEMPLATE_KEYS = new Set(
  [
    ...Object.keys(LEGACY_CV_TEMPLATE_ALIASES),
    ...Object.keys(LEGACY_LM_TEMPLATE_ALIASES),
  ].filter(templateKey => !OFFICIAL_CAREER_TEMPLATE_KEYS.has(templateKey)),
);

const CV_TO_LM_TEMPLATE: Record<string, string> = {
  cv_horizon: 'lm_horizon',
  cv_sahara: 'lm_sahara',
  cv_atlas: 'lm_atlas',
  cv_kora: 'lm_kora',
  cv_nile: 'lm_horizon',
  cv_executive: 'lm_executive',
  cv_baobab: 'lm_kora',
  cv_digital: 'lm_digital',
  cv_academia: 'lm_atlas',
  cv_hospitality: 'lm_sahara',
  cv_qhse: 'lm_horizon',
  cv_impact: 'lm_atlas',
};

export function isOfficialCareerTemplateKey(templateKey?: string | null) {
  return OFFICIAL_CAREER_TEMPLATE_KEYS.has(String(templateKey || '').trim().toLowerCase());
}

export function isLegacyCareerTemplateKey(templateKey?: string | null) {
  return LEGACY_CAREER_TEMPLATE_KEYS.has(String(templateKey || '').trim().toLowerCase());
}

export const CAREER_PALETTES = [
  { key: 'omnia', name: 'Omnia', colors: DEFAULT_COLORS },
  { key: 'green', name: 'Vert', colors: { ...DEFAULT_COLORS, primary: '#064E3B', accent: '#16A34A', sidebar: '#ECFDF5' } },
  { key: 'charcoal', name: 'Charbon', colors: { ...DEFAULT_COLORS, primary: '#1F2937', accent: '#6B7280', sidebar: '#F3F4F6' } },
  { key: 'purple', name: 'Violet', colors: { ...DEFAULT_COLORS, primary: '#4C1D95', accent: '#7C3AED', sidebar: '#F5F3FF' } },
  { key: 'red', name: 'Bordeaux', colors: { ...DEFAULT_COLORS, primary: '#7F1D1D', accent: '#B91C1C', sidebar: '#FEF2F2' } },
];

function stableTemplateSort(a: CareerTemplateMeta, b: CareerTemplateMeta) {
  return Number(a.display_order || 0) - Number(b.display_order || 0)
    || a.name_fr.localeCompare(b.name_fr, 'fr')
    || a.template_key.localeCompare(b.template_key);
}

const CAREER_TEMPLATE_CATALOG_CACHE_KEY = 'omnia_career_template_catalog_v2';
const CAREER_CUSTOM_TEMPLATE_CACHE_KEY = 'omnia_career_custom_templates';
const CAREER_TEMPLATE_CATALOG_LOADED_KEY = 'omnia_career_template_catalog_loaded_v2';

type MergeCareerTemplateOptions = {
  /**
   * Quand true, la liste distante est la source de vérité: un modèle officiel absent
   * n'est pas réinjecté par le fallback statique. C'est indispensable pour que la
   * désactivation Super-admin soit réellement respectée dans le catalogue apprenant.
   */
  authoritative?: boolean;
  /** Affiche aussi les modèles désactivés, uniquement dans l'administration. */
  includeInactive?: boolean;
};

function readCachedCatalog(docType: CareerDocType): { loaded: boolean; templates: CareerTemplateMeta[] } {
  if (typeof window === 'undefined') return { loaded: false, templates: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(CAREER_TEMPLATE_CATALOG_CACHE_KEY) || '[]');
    const loadedTypes = JSON.parse(localStorage.getItem(CAREER_TEMPLATE_CATALOG_LOADED_KEY) || '[]');
    return {
      loaded: Array.isArray(loadedTypes) && loadedTypes.includes(docType),
      templates: Array.isArray(parsed)
        ? parsed.filter((template: CareerTemplateMeta) =>
            template.template_type === docType
            && !isLegacyCareerTemplateKey(template.template_key))
        : [],
    };
  } catch {
    return { loaded: false, templates: [] };
  }
}

export function cacheCareerTemplates(templates: CareerTemplateMeta[], docType?: CareerDocType) {
  if (typeof window === 'undefined') return;
  const clean = templates.filter(template =>
    ['cv', 'lm'].includes(template.template_type)
    && !isLegacyCareerTemplateKey(template.template_key)
  );
  const typesToReplace = new Set<CareerDocType>(
    docType ? [docType] : clean.map(template => template.template_type),
  );

  let previous: CareerTemplateMeta[] = [];
  let loadedTypes: CareerDocType[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CAREER_TEMPLATE_CATALOG_CACHE_KEY) || '[]');
    if (Array.isArray(parsed)) previous = parsed;
    const parsedLoaded = JSON.parse(localStorage.getItem(CAREER_TEMPLATE_CATALOG_LOADED_KEY) || '[]');
    if (Array.isArray(parsedLoaded)) loadedTypes = parsedLoaded.filter(type => type === 'cv' || type === 'lm');
  } catch {
    previous = [];
    loadedTypes = [];
  }

  const merged = [
    ...previous.filter(template => !typesToReplace.has(template.template_type)),
    ...clean,
  ];
  localStorage.setItem(CAREER_TEMPLATE_CATALOG_CACHE_KEY, JSON.stringify(merged));
  localStorage.setItem(
    CAREER_TEMPLATE_CATALOG_LOADED_KEY,
    JSON.stringify([...new Set([...loadedTypes, ...typesToReplace])]),
  );

  // Conservé pour le renderer configurable des modèles personnalisés existants.
  const custom = merged.filter(template => template.is_custom === true);
  localStorage.setItem(CAREER_CUSTOM_TEMPLATE_CACHE_KEY, JSON.stringify(custom));
}

export function mergeCareerTemplateCatalog(
  docType: CareerDocType,
  remoteTemplates: CareerTemplateMeta[] = [],
  options: MergeCareerTemplateOptions = {},
): CareerTemplateMeta[] {
  const officialBase = (docType === 'cv' ? CV_TEMPLATES_META : LM_TEMPLATES_META).map(template => ({
    ...template,
    is_active: true,
    is_custom: false,
    catalog_status: 'official' as const,
    canonical_template_key: template.template_key,
  }));
  const officialByKey = new Map(officialBase.map(template => [template.template_key, template]));

  const cleanRemote = remoteTemplates
    .filter(template => template.template_type === docType)
    .filter(template => !isLegacyCareerTemplateKey(template.template_key));

  const remoteByKey = new Map<string, CareerTemplateMeta>();
  for (const template of cleanRemote) {
    const key = String(template.template_key || '').trim().toLowerCase();
    if (!key) continue;
    remoteByKey.set(key, { ...template, template_key: key });
  }

  const result: CareerTemplateMeta[] = [];

  if (!options.authoritative) {
    for (const template of officialBase) {
      const remote = remoteByKey.get(template.template_key);
      remoteByKey.delete(template.template_key);
      const merged = {
        ...template,
        ...(remote || {}),
        template_key: template.template_key,
        template_type: docType,
        is_custom: false,
        catalog_status: 'official' as const,
        canonical_template_key: template.template_key,
        is_active: remote?.is_active !== false,
        is_free: remote?.is_free ?? true,
        default_colors: remote?.default_colors && Object.keys(remote.default_colors).length
          ? remote.default_colors
          : template.default_colors,
        display_order: Number(remote?.display_order ?? template.display_order),
      };
      if (options.includeInactive || merged.is_active !== false) result.push(merged);
    }
  }

  for (const [key, remote] of remoteByKey) {
    const official = officialByKey.get(key);
    if (official) {
      const merged: CareerTemplateMeta = {
        ...official,
        ...remote,
        template_key: key,
        template_type: docType,
        is_custom: false,
        catalog_status: 'official',
        canonical_template_key: key,
        is_active: remote.is_active !== false,
        is_free: remote.is_free ?? true,
        default_colors: remote.default_colors && Object.keys(remote.default_colors).length
          ? remote.default_colors
          : official.default_colors,
        display_order: Number(remote.display_order ?? official.display_order),
      };
      if (options.includeInactive || merged.is_active !== false) result.push(merged);
      continue;
    }

    if (remote.is_custom !== true && remote.catalog_status !== 'custom') continue;
    const custom: CareerTemplateMeta = {
      ...remote,
      template_key: key,
      template_type: docType,
      is_custom: true,
      catalog_status: 'custom',
      canonical_template_key: key,
      is_active: remote.is_active !== false,
      is_free: remote.is_free ?? true,
      display_order: Number(remote.display_order || 999),
      // Older Super-admin templates sometimes have an empty default_colors JSON.
      // Their layout_config must still color the gallery, Builder and exports identically.
      default_colors: {
        ...DEFAULT_COLORS,
        ...((remote.layout_config && typeof remote.layout_config === 'object') ? {
          primary: typeof remote.layout_config.primary === 'string' && /^#[0-9a-f]{6}$/i.test(remote.layout_config.primary) ? remote.layout_config.primary : DEFAULT_COLORS.primary,
          accent: typeof remote.layout_config.accent === 'string' && /^#[0-9a-f]{6}$/i.test(remote.layout_config.accent) ? remote.layout_config.accent : DEFAULT_COLORS.accent,
          sidebar: typeof remote.layout_config.sidebar === 'string' && /^#[0-9a-f]{6}$/i.test(remote.layout_config.sidebar) ? remote.layout_config.sidebar : DEFAULT_COLORS.sidebar,
        } : {}),
        ...(remote.default_colors || {}),
      },
    };
    if (options.includeInactive || custom.is_active !== false) result.push(custom);
  }

  const deduped = new Map<string, CareerTemplateMeta>();
  for (const template of result) deduped.set(template.template_key, template);
  return [...deduped.values()].sort(stableTemplateSort);
}

export function getCareerTemplates(docType: CareerDocType) {
  const cached = readCachedCatalog(docType);
  if (cached.loaded) {
    return mergeCareerTemplateCatalog(docType, cached.templates, { authoritative: true });
  }
  return mergeCareerTemplateCatalog(docType);
}

export function normalizeTemplateKey(docType: CareerDocType, templateKey?: string | null) {
  const raw = String(templateKey || '').trim().toLowerCase();
  if (!raw) return getDefaultTemplateKey(docType);
  const aliases = docType === 'cv' ? LEGACY_CV_TEMPLATE_ALIASES : LEGACY_LM_TEMPLATE_ALIASES;
  const mapped = aliases[raw] || raw;

  if (isOfficialCareerTemplateKey(mapped)) {
    const expectedType = mapped.startsWith('lm_') ? 'lm' : 'cv';
    return expectedType === docType ? mapped : getDefaultTemplateKey(docType);
  }

  return mapped;
}

export function getPairedLmTemplateKey(cvTemplateKey?: string | null) {
  const canonicalCv = normalizeTemplateKey('cv', cvTemplateKey);
  return CV_TO_LM_TEMPLATE[canonicalCv] || getDefaultTemplateKey('lm');
}

export function getTemplateMeta(docType: CareerDocType, templateKey?: string | null) {
  const list = getCareerTemplates(docType);
  const normalizedKey = normalizeTemplateKey(docType, templateKey);
  return list.find(template => template.template_key === normalizedKey)
    || list.find(template => template.template_key === getDefaultTemplateKey(docType))
    || list[0];
}

export function getDefaultDocTitle(docType: CareerDocType) {
  return docType === 'cv' ? 'Mon CV' : 'Ma lettre de motivation';
}

export function getDefaultTemplateKey(docType: CareerDocType) {
  return docType === 'cv' ? 'cv_horizon' : 'lm_horizon';
}

export function createDefaultData(docType: CareerDocType): DocData | LmData {
  return docType === 'cv'
    ? JSON.parse(JSON.stringify(DEFAULT_CV_DATA))
    : JSON.parse(JSON.stringify(DEFAULT_LM_DATA));
}

export function createDefaultDesign(docType: CareerDocType): DesignOptions | LmDesign {
  return docType === 'cv'
    ? JSON.parse(JSON.stringify(DEFAULT_CV_DESIGN))
    : JSON.parse(JSON.stringify(DEFAULT_LM_DESIGN));
}

export function calculateBasicScore(docType: CareerDocType, data: DocData | LmData): number {
  const text = (value: unknown) => String(value || '').trim();
  if (docType === 'lm') {
    const lm = data as LmData;
    let score = 0;
    if (text(lm.sender?.name) && text(lm.sender?.email)) score += 12;
    if (text(lm.recipient?.company)) score += 10;
    if (text(lm.subject)) score += 8;
    if (text(lm.intro).length >= 30) score += 15;
    if (text(lm.motivation).length >= 80) score += 25;
    if (text(lm.skills_paragraph).length >= 50) score += 15;
    if (text(lm.company_link).length >= 30) score += 5;
    if (text(lm.closing).length >= 20) score += 10;
    return Math.min(100, score);
  }
  const cv = data as DocData;
  let score = 0;
  if (text(cv.name) && text(cv.contact?.email)) score += 12;
  if (text(cv.title)) score += 8;
  if (text(cv.summary).length >= 60) score += 12;
  if (text(cv.contact?.phone)) score += 4;
  if ((cv.skills || []).filter(x => text(typeof x === 'string' ? x : (x as any)?.name)).length >= 4) score += 12;
  if ((cv.experiences || []).some(x => text(x?.position) && text(x?.company) && text(x?.description).length >= 30)) score += 22;
  if ((cv.education || []).some(x => text(x?.degree) && text(x?.school))) score += 12;
  if ((cv.languages || []).some(x => text(x?.name) && text(x?.level))) score += 6;
  if ((cv.certifications_external || []).some(x => text(x?.name)) || (cv.omnia_formations || []).some((x:any) => text(x?.name || x?.title))) score += 6;
  if ((cv.projects || []).some(x => text(x?.name) && text(x?.description).length >= 20)) score += 6;
  return Math.min(100, score);
}
