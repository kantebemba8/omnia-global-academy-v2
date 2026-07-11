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
};

export const DEFAULT_LM_DESIGN: LmDesign = {
  colors: DEFAULT_COLORS,
  font: 'inter',
  font_size_body: 10,
  line_spacing: 1.65,
};

export const DEFAULT_CV_DATA: DocData = {
  name: '',
  title: '',
  objective: '',
  summary: '',
  contact: {
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    portfolio: '',
  },
  experiences: [],
  education: [],
  omnia_formations: [],
  skills: [],
  languages: [],
  certifications_external: [],
  projects: [],
  interests: [],
  references: '',
};

export const DEFAULT_LM_DATA: LmData = {
  sender: {
    name: '',
    address: '',
    phone: '',
    email: '',
    city: '',
    date: new Date().toISOString().slice(0, 10),
  },
  recipient: {
    name: '',
    company: '',
    address: '',
  },
  subject: '',
  salutation: 'Madame, Monsieur,',
  intro: '',
  motivation: '',
  skills_paragraph: '',
  company_link: '',
  availability: '',
  closing: '',
  signature: '',
};

export const CV_TEMPLATES_META: CareerTemplateMeta[] = [
  { template_key: 'classic_pro', template_type: 'cv', name_fr: 'Classique Pro', description_fr: 'Sobre, lisible et adapté aux candidatures professionnelles.', category: 'professional', is_free: true, is_ats_compatible: true, display_order: 1, default_colors: DEFAULT_COLORS },
  { template_key: 'modern_student', template_type: 'cv', name_fr: 'Étudiant Moderne', description_fr: 'Idéal stage, alternance et premier emploi.', category: 'student', is_free: true, is_ats_compatible: true, display_order: 2, default_colors: DEFAULT_COLORS },
  { template_key: 'corporate_blue', template_type: 'cv', name_fr: 'Corporate Bleu', description_fr: 'Très professionnel, parfait pour banque, gestion et administration.', category: 'professional', is_free: true, is_ats_compatible: true, display_order: 3, default_colors: DEFAULT_COLORS },
  { template_key: 'minimal_luxe', template_type: 'cv', name_fr: 'Minimal Luxe', description_fr: 'Design premium, élégant et très lisible.', category: 'africa_premium', is_free: false, is_ats_compatible: true, display_order: 4, default_colors: DEFAULT_COLORS },
  { template_key: 'africa_gold', template_type: 'cv', name_fr: 'Africa Gold', description_fr: 'Identité premium bleu et or, inspirée d’Omnia.', category: 'africa_premium', is_free: false, is_ats_compatible: true, display_order: 5, default_colors: DEFAULT_COLORS },
  { template_key: 'tech_future', template_type: 'cv', name_fr: 'Tech Future', description_fr: 'Pensé pour développeurs, data, cloud et métiers numériques.', category: 'tech', is_free: false, is_ats_compatible: true, display_order: 6, default_colors: DEFAULT_COLORS },
  { template_key: 'cyber_security', template_type: 'cv', name_fr: 'Cyber Security', description_fr: 'Design adapté cybersécurité, audit et systèmes.', category: 'tech', is_free: false, is_ats_compatible: true, display_order: 7, default_colors: DEFAULT_COLORS },
  { template_key: 'data_analyst', template_type: 'cv', name_fr: 'Data Analyst', description_fr: 'CV orienté données, KPI, reporting et analyse.', category: 'tech', is_free: false, is_ats_compatible: true, display_order: 8, default_colors: DEFAULT_COLORS },
  { template_key: 'creative_digital', template_type: 'cv', name_fr: 'Créatif Digital', description_fr: 'Pour design, marketing digital et communication.', category: 'creative', is_free: false, is_ats_compatible: false, display_order: 9, default_colors: DEFAULT_COLORS },
  { template_key: 'no_photo_ats', template_type: 'cv', name_fr: 'ATS Sans Photo', description_fr: 'Optimisé ATS, sans photo, très simple à lire.', category: 'professional', is_free: true, is_ats_compatible: true, display_order: 10, default_colors: DEFAULT_COLORS },
  { template_key: 'photo_elegant', template_type: 'cv', name_fr: 'Photo Élégant', description_fr: 'Modèle avec photo optionnelle et style soigné.', category: 'professional', is_free: false, is_ats_compatible: false, display_order: 11, default_colors: DEFAULT_COLORS },
  { template_key: 'young_graduate', template_type: 'cv', name_fr: 'Jeune Diplômé', description_fr: 'Pour valoriser stages, projets et formation.', category: 'student', is_free: true, is_ats_compatible: true, display_order: 12, default_colors: DEFAULT_COLORS },
  { template_key: 'internship_ready', template_type: 'cv', name_fr: 'Stage Ready', description_fr: 'Préparé pour candidatures de stage et alternance.', category: 'student', is_free: true, is_ats_compatible: true, display_order: 13, default_colors: DEFAULT_COLORS },
  { template_key: 'international_cv', template_type: 'cv', name_fr: 'International', description_fr: 'Pour candidatures internationales et mobilité.', category: 'professional', is_free: false, is_ats_compatible: true, display_order: 14, default_colors: DEFAULT_COLORS },
  { template_key: 'qhse_professional', template_type: 'cv', name_fr: 'QHSE Professionnel', description_fr: 'Adapté QSE, HSE, RSE, ISO et conformité.', category: 'specialized', is_free: false, is_ats_compatible: true, display_order: 15, default_colors: DEFAULT_COLORS },
  { template_key: 'business_manager', template_type: 'cv', name_fr: 'Business Manager', description_fr: 'Pour management, business development et gestion.', category: 'professional', is_free: false, is_ats_compatible: true, display_order: 16, default_colors: DEFAULT_COLORS },
  { template_key: 'hospitality', template_type: 'cv', name_fr: 'Hospitality Premium', description_fr: 'Pour hôtellerie, restauration et service client.', category: 'specialized', is_free: false, is_ats_compatible: true, display_order: 17, default_colors: DEFAULT_COLORS },
  { template_key: 'academic_cv', template_type: 'cv', name_fr: 'Académique', description_fr: 'Pour recherche, enseignement et parcours académique.', category: 'specialized', is_free: false, is_ats_compatible: true, display_order: 18, default_colors: DEFAULT_COLORS },
  { template_key: 'freelancer', template_type: 'cv', name_fr: 'Freelancer Portfolio', description_fr: 'Pour freelances, consultants et portfolio projet.', category: 'creative', is_free: false, is_ats_compatible: false, display_order: 19, default_colors: DEFAULT_COLORS },
  { template_key: 'executive_one_page', template_type: 'cv', name_fr: 'Executive One Page', description_fr: 'CV premium compact pour profils expérimentés.', category: 'professional', is_free: false, is_ats_compatible: true, display_order: 20, default_colors: DEFAULT_COLORS },
];

export const LM_TEMPLATES_META: CareerTemplateMeta[] = [
  { template_key: 'lm_classic_pro', template_type: 'lm', name_fr: 'Classique Pro', description_fr: 'Lettre professionnelle, sobre et complète.', category: 'classic_lm', is_free: true, is_ats_compatible: true, display_order: 1, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_modern_student', template_type: 'lm', name_fr: 'Étudiant Moderne', description_fr: 'Lettre dynamique pour stage et alternance.', category: 'classic_lm', is_free: true, is_ats_compatible: true, display_order: 2, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_corporate_blue', template_type: 'lm', name_fr: 'Corporate Bleu', description_fr: 'Lettre corporate pour banques, cabinets et grandes entreprises.', category: 'classic_lm', is_free: true, is_ats_compatible: true, display_order: 3, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_minimal_luxe', template_type: 'lm', name_fr: 'Minimal Luxe', description_fr: 'Lettre élégante et premium.', category: 'classic_lm', is_free: false, is_ats_compatible: true, display_order: 4, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_africa_gold', template_type: 'lm', name_fr: 'Africa Gold', description_fr: 'Lettre assortie au style bleu et or Omnia.', category: 'classic_lm', is_free: false, is_ats_compatible: true, display_order: 5, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_tech_future', template_type: 'lm', name_fr: 'Tech Future', description_fr: 'Pour développeurs, data et métiers tech.', category: 'classic_lm', is_free: false, is_ats_compatible: true, display_order: 6, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_cyber_security', template_type: 'lm', name_fr: 'Cyber Security', description_fr: 'Pour cybersécurité, audit, conformité et risk.', category: 'classic_lm', is_free: false, is_ats_compatible: true, display_order: 7, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_data_analyst', template_type: 'lm', name_fr: 'Data Analyst', description_fr: 'Pour data, BI, reporting et analyse.', category: 'classic_lm', is_free: false, is_ats_compatible: true, display_order: 8, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_creative_digital', template_type: 'lm', name_fr: 'Créatif Digital', description_fr: 'Pour marketing, communication et design.', category: 'classic_lm', is_free: false, is_ats_compatible: false, display_order: 9, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_no_photo_ats', template_type: 'lm', name_fr: 'ATS Simple', description_fr: 'Lettre simple et compatible ATS.', category: 'classic_lm', is_free: true, is_ats_compatible: true, display_order: 10, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_photo_elegant', template_type: 'lm', name_fr: 'Photo Élégant', description_fr: 'Lettre assortie au modèle photo élégant.', category: 'matched_lm', is_free: false, is_ats_compatible: false, display_order: 11, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_young_graduate', template_type: 'lm', name_fr: 'Jeune Diplômé', description_fr: 'Lettre pour premier poste et jeune profil.', category: 'quick_lm', is_free: true, is_ats_compatible: true, display_order: 12, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_internship_ready', template_type: 'lm', name_fr: 'Stage Ready', description_fr: 'Lettre dédiée aux stages et alternances.', category: 'quick_lm', is_free: true, is_ats_compatible: true, display_order: 13, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_international', template_type: 'lm', name_fr: 'International', description_fr: 'Lettre pour candidatures internationales.', category: 'matched_lm', is_free: false, is_ats_compatible: true, display_order: 14, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_qhse', template_type: 'lm', name_fr: 'QHSE', description_fr: 'Lettre QSE, HSE, RSE et conformité.', category: 'quick_lm', is_free: false, is_ats_compatible: true, display_order: 15, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_business_manager', template_type: 'lm', name_fr: 'Business Manager', description_fr: 'Lettre business, management et projets.', category: 'matched_lm', is_free: false, is_ats_compatible: true, display_order: 16, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_hospitality', template_type: 'lm', name_fr: 'Hospitality', description_fr: 'Lettre hôtellerie, restauration et service.', category: 'quick_lm', is_free: false, is_ats_compatible: true, display_order: 17, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_academic', template_type: 'lm', name_fr: 'Académique', description_fr: 'Lettre enseignement, recherche et académique.', category: 'matched_lm', is_free: false, is_ats_compatible: true, display_order: 18, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_freelancer', template_type: 'lm', name_fr: 'Freelancer', description_fr: 'Lettre missions, freelance et consulting.', category: 'matched_lm', is_free: false, is_ats_compatible: false, display_order: 19, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_executive', template_type: 'lm', name_fr: 'Executive', description_fr: 'Lettre premium pour profils confirmés.', category: 'matched_lm', is_free: false, is_ats_compatible: true, display_order: 20, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_stage_simple', template_type: 'lm', name_fr: 'Stage Simple', description_fr: 'Lettre simple pour stages.', category: 'quick_lm', is_free: true, is_ats_compatible: true, display_order: 21, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_premier_emploi', template_type: 'lm', name_fr: 'Premier Emploi', description_fr: 'Lettre pour début de carrière.', category: 'quick_lm', is_free: true, is_ats_compatible: true, display_order: 22, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_alternance', template_type: 'lm', name_fr: 'Alternance', description_fr: 'Lettre pour alternance et apprentissage.', category: 'quick_lm', is_free: true, is_ats_compatible: true, display_order: 23, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_spontanee', template_type: 'lm', name_fr: 'Candidature spontanée', description_fr: 'Lettre sans offre précise.', category: 'quick_lm', is_free: true, is_ats_compatible: true, display_order: 24, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_qhse_rse', template_type: 'lm', name_fr: 'QHSE & RSE', description_fr: 'Lettre spécialisée QHSE/RSE.', category: 'quick_lm', is_free: false, is_ats_compatible: true, display_order: 25, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_tech_data', template_type: 'lm', name_fr: 'Tech & Data', description_fr: 'Lettre tech, data, IA et développement.', category: 'quick_lm', is_free: false, is_ats_compatible: true, display_order: 26, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_hotellerie', template_type: 'lm', name_fr: 'Hôtellerie', description_fr: 'Lettre hospitality, Marriott et service.', category: 'quick_lm', is_free: false, is_ats_compatible: true, display_order: 27, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_administration', template_type: 'lm', name_fr: 'Administration', description_fr: 'Lettre administrative et coordination.', category: 'quick_lm', is_free: true, is_ats_compatible: true, display_order: 28, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_finance_banque', template_type: 'lm', name_fr: 'Finance & Banque', description_fr: 'Lettre banque, finance et risk.', category: 'quick_lm', is_free: false, is_ats_compatible: true, display_order: 29, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_internationale', template_type: 'lm', name_fr: 'Internationale Plus', description_fr: 'Lettre mobilité et organisations internationales.', category: 'quick_lm', is_free: false, is_ats_compatible: true, display_order: 30, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_courte_premium', template_type: 'lm', name_fr: 'Courte Premium', description_fr: 'Lettre courte, directe et premium.', category: 'quick_lm', is_free: false, is_ats_compatible: true, display_order: 31, default_colors: DEFAULT_COLORS },
  { template_key: 'lm_pro_classique', template_type: 'lm', name_fr: 'Professionnelle Classique', description_fr: 'Lettre classique tous secteurs.', category: 'quick_lm', is_free: true, is_ats_compatible: true, display_order: 32, default_colors: DEFAULT_COLORS },
];

export const CAREER_TEMPLATES_META = [...CV_TEMPLATES_META, ...LM_TEMPLATES_META];

export const CAREER_PALETTES = [
  { key: 'omnia', name: 'Omnia', colors: DEFAULT_COLORS },
  { key: 'green', name: 'Vert', colors: { ...DEFAULT_COLORS, primary: '#064E3B', accent: '#16A34A', sidebar: '#ECFDF5' } },
  { key: 'charcoal', name: 'Charbon', colors: { ...DEFAULT_COLORS, primary: '#1F2937', accent: '#6B7280', sidebar: '#F3F4F6' } },
  { key: 'purple', name: 'Violet', colors: { ...DEFAULT_COLORS, primary: '#4C1D95', accent: '#7C3AED', sidebar: '#F5F3FF' } },
  { key: 'red', name: 'Bordeaux', colors: { ...DEFAULT_COLORS, primary: '#7F1D1D', accent: '#B91C1C', sidebar: '#FEF2F2' } },
];

export function getCareerTemplates(docType: CareerDocType) {
  return (docType === 'cv' ? CV_TEMPLATES_META : LM_TEMPLATES_META).sort((a, b) => a.display_order - b.display_order);
}

export function getTemplateMeta(docType: CareerDocType, templateKey?: string) {
  const list = getCareerTemplates(docType);
  return list.find(t => t.template_key === templateKey) || list[0];
}

export function getDefaultDocTitle(docType: CareerDocType) {
  return docType === 'cv' ? 'Mon CV' : 'Ma lettre de motivation';
}

export function getDefaultTemplateKey(docType: CareerDocType) {
  return docType === 'cv' ? 'classic_pro' : 'lm_classic_pro';
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
  if (docType === 'lm') {
    const lm = data as LmData;
    const fields = [lm.sender?.name, lm.sender?.email, lm.recipient?.company, lm.subject, lm.intro, lm.motivation, lm.skills_paragraph, lm.closing];
    return Math.min(98, Math.round((fields.filter(Boolean).length / fields.length) * 100));
  }

  const cv = data as DocData;
  let score = 0;
  if (cv.name) score += 10;
  if (cv.title) score += 10;
  if (cv.summary?.length > 80) score += 15;
  if (cv.contact?.email) score += 8;
  if (cv.contact?.phone) score += 7;
  if (cv.experiences?.length) score += 18;
  if (cv.education?.length) score += 10;
  if (cv.skills?.length >= 4) score += 12;
  if (cv.languages?.length) score += 5;
  if (cv.certifications_external?.length || cv.omnia_formations?.length) score += 5;
  return Math.min(98, score);
}
