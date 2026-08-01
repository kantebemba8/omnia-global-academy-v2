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
  name: '',
  title: '',
  objective: '',
  summary: '',
  photo_url: '',
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
  salutation: '',
  intro: '',
  motivation: '',
  skills_paragraph: '',
  company_link: '',
  availability: '',
  closing: '',
  signature: '',
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

export const CAREER_PALETTES = [
  { key: 'omnia', name: 'Omnia', colors: DEFAULT_COLORS },
  { key: 'green', name: 'Vert', colors: { ...DEFAULT_COLORS, primary: '#064E3B', accent: '#16A34A', sidebar: '#ECFDF5' } },
  { key: 'charcoal', name: 'Charbon', colors: { ...DEFAULT_COLORS, primary: '#1F2937', accent: '#6B7280', sidebar: '#F3F4F6' } },
  { key: 'purple', name: 'Violet', colors: { ...DEFAULT_COLORS, primary: '#4C1D95', accent: '#7C3AED', sidebar: '#F5F3FF' } },
  { key: 'red', name: 'Bordeaux', colors: { ...DEFAULT_COLORS, primary: '#7F1D1D', accent: '#B91C1C', sidebar: '#FEF2F2' } },
];

function getCachedCustomTemplates(docType: CareerDocType): CareerTemplateMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem('omnia_career_custom_templates') || '[]');
    return Array.isArray(parsed) ? parsed.filter((t: CareerTemplateMeta) => t.template_type === docType) : [];
  } catch { return []; }
}

export function cacheCareerTemplates(templates: CareerTemplateMeta[]) {
  if (typeof window === 'undefined') return;
  const custom = templates.filter(t => t.is_custom || t.layout_config);
  localStorage.setItem('omnia_career_custom_templates', JSON.stringify(custom));
}

export function getCareerTemplates(docType: CareerDocType) {
  const builtins = docType === 'cv' ? CV_TEMPLATES_META : LM_TEMPLATES_META;
  const merged = [...builtins, ...getCachedCustomTemplates(docType).filter(c => !builtins.some(b => b.template_key === c.template_key))];
  return merged.sort((a, b) => a.display_order - b.display_order);
}

export function normalizeTemplateKey(docType: CareerDocType, templateKey?: string | null) {
  const key = String(templateKey || '').trim();
  const cvAliases: Record<string, string> = {
    modern: 'cv_horizon',
    professional: 'cv_atlas',
    creative: 'cv_baobab',
    classic: 'cv_horizon',
    simple: 'cv_atlas',
    student: 'cv_nile',
    qhse: 'cv_qhse',
    hospitality_premium: 'cv_hospitality',
    cyber_security_cv: 'cv_digital',
    data_analyst_cv: 'cv_digital',
  };
  const lmAliases: Record<string, string> = {
    classic_lm: 'lm_horizon',
    dynamic_lm: 'lm_kora',
    academic_lm: 'lm_atlas',
    modern_lm: 'lm_horizon',
    professional_lm: 'lm_horizon',
    creative_lm: 'lm_kora',
    simple_lm: 'lm_atlas',
  };

  const mapped = docType === 'cv' ? (cvAliases[key] || key) : (lmAliases[key] || key);
  const exists = getCareerTemplates(docType).some(t => t.template_key === mapped);
  return exists ? mapped : getDefaultTemplateKey(docType);
}

export function getTemplateMeta(docType: CareerDocType, templateKey?: string | null) {
  const list = getCareerTemplates(docType);
  const normalizedKey = normalizeTemplateKey(docType, templateKey);
  return list.find(t => t.template_key === normalizedKey) || list[0];
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
