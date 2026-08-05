import type { DocData, DesignOptions } from '../components/career/CvTemplates';
import type { LmData, LmDesign } from '../components/career/LmTemplates';
import type { CareerDocType, CareerDocumentFull } from './careerStudioData';
import { getPairedLmTemplateKey } from './careerStudioData';

export type CareerEvidenceStatus = 'verified' | 'declared' | 'pending' | 'missing';
export type CareerEvidenceType = 'experience' | 'project' | 'formation' | 'certificate' | 'badge' | 'recommendation' | 'document';

export type CareerEvidence = {
  id: string;
  title: string;
  type: CareerEvidenceType;
  issuer?: string;
  issued_at?: string;
  verification_url?: string;
  credential_id?: string;
  skills?: string[];
  status: CareerEvidenceStatus;
  selected: boolean;
};

export type CareerTarget = {
  job_title: string;
  company: string;
  recruiter_name: string;
  recruiter_role: string;
  location: string;
  country: string;
  contract_type: string;
  application_type: string;
  source_url: string;
  reference: string;
  job_description: string;
  required_keywords: string[];
  preferred_keywords: string[];
  language: string;
};

export type CareerDocumentMeta = {
  schema_version: 2;
  target: CareerTarget;
  evidence: CareerEvidence[];
  section_visibility: Record<string, boolean>;
  section_order: string[];
  custom_sections: Array<{ id: string; title: string; content: string; visible: boolean }>;
  application_package_id?: string;
  source_cv_id?: string;
  source_lm_id?: string;
  consent: {
    ai_verified: boolean;
    last_verified_at?: string;
  };
};

export type CareerSourceProfile = {
  user?: {
    id?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    location?: string;
    profile_completion?: number;
  };
  completed_formations?: Array<{
    course_id?: string;
    completed_at?: string;
    courses?: { title?: string; category?: string } | null;
  }>;
  certificates?: Array<{
    id?: string;
    course_id?: string;
    omnia_certificate_id?: string;
    issued_at?: string;
    verification_url?: string;
    courses?: { title?: string } | null;
  }>;
  partner_link?: Record<string, unknown> | null;
};

export type CareerQualitySeverity = 'critical' | 'warning' | 'info' | 'success';
export type CareerQualityIssue = {
  id: string;
  severity: CareerQualitySeverity;
  category: 'content' | 'ats' | 'target' | 'visual' | 'evidence' | 'language';
  title: string;
  detail: string;
};

export type CareerKeywordMatch = {
  keyword: string;
  status: 'proved' | 'declared' | 'missing';
};

export type CareerQualityReport = {
  overall: number;
  content: number;
  ats: number;
  target: number;
  visual: number;
  evidence: number;
  issues: CareerQualityIssue[];
  keywordMatches: CareerKeywordMatch[];
  metrics: {
    wordCount: number;
    quantifiedAchievements: number;
    actionVerbBullets: number;
    evidenceSelected: number;
  };
};

export type CareerVersionSnapshot = {
  id: string;
  label: string;
  created_at: string;
  document: CareerDocumentFull;
};

export const DEFAULT_TARGET: CareerTarget = {
  job_title: '',
  company: '',
  recruiter_name: '',
  recruiter_role: '',
  location: '',
  country: '',
  contract_type: '',
  application_type: 'emploi',
  source_url: '',
  reference: '',
  job_description: '',
  required_keywords: [],
  preferred_keywords: [],
  language: 'fr',
};

const DEFAULT_SECTION_ORDER = [
  'profile', 'summary', 'skills', 'experiences', 'education', 'certifications', 'languages', 'projects', 'interests',
];

export function createDefaultCareerMeta(docType: CareerDocType): CareerDocumentMeta {
  return {
    schema_version: 2,
    target: { ...DEFAULT_TARGET, application_type: docType === 'lm' ? 'emploi' : 'cv' },
    evidence: [],
    section_visibility: {},
    section_order: [...DEFAULT_SECTION_ORDER],
    custom_sections: [],
    consent: { ai_verified: false },
  };
}

export function getCareerMeta(data: DocData | LmData, docType: CareerDocType): CareerDocumentMeta {
  const current = (data as DocData & { career_meta?: Partial<CareerDocumentMeta> }).career_meta;
  const fallback = createDefaultCareerMeta(docType);
  return {
    ...fallback,
    ...(current || {}),
    target: { ...fallback.target, ...(current?.target || {}) },
    evidence: Array.isArray(current?.evidence) ? current!.evidence as CareerEvidence[] : [],
    section_visibility: { ...fallback.section_visibility, ...(current?.section_visibility || {}) },
    section_order: Array.isArray(current?.section_order) && current!.section_order!.length ? current!.section_order! : fallback.section_order,
    custom_sections: Array.isArray(current?.custom_sections) ? current!.custom_sections! : [],
    consent: { ...fallback.consent, ...(current?.consent || {}) },
  };
}

export function withCareerMeta<T extends DocData | LmData>(data: T, docType: CareerDocType, next: CareerDocumentMeta): T {
  return { ...data, career_meta: { ...next, schema_version: 2 } } as T;
}

export function normalizeCareerDocument(document: CareerDocumentFull): CareerDocumentFull {
  const meta = getCareerMeta(document.doc_data, document.doc_type);
  return {
    ...document,
    target_job: document.target_job || meta.target.job_title || null,
    target_country: document.target_country || meta.target.country || null,
    application_type: document.application_type || meta.target.application_type || document.doc_type,
    doc_data: withCareerMeta(document.doc_data, document.doc_type, meta),
  };
}

export function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'avec','pour','dans','des','les','une','un','sur','par','vous','nous','votre','notre','leur','leurs','aux','du','de','la','le','et','ou','en','au','ce','ces','est','sont','sera','etre','faire','afin','plus','moins','poste','profil','candidat','candidate','entreprise','mission','missions','responsable','experience','experiences','competence','competences','formation','niveau','annee','annees','the','and','for','with','from','your','you','our','this','that','are','is','be','job','role','team','work','skills','experience','required','preferred','candidate','company','recherche','recherchons','recherchez','recrute','recrutons','maitrise','maitrisant','souhaite','souhaitons','attendu','attendue','missions','principales','notamment','idealement','capable','capacite',
]);

const SKILL_PHRASES = [
  'gestion de projet','analyse de donnees','service client','controle interne','gestion des risques','audit interne','audit externe','sante securite','qualite hygiene securite environnement','ressources humaines','communication digitale','marketing digital','developpement commercial','gestion budgetaire','comptabilite generale','comptabilite analytique','power bi','excel avance','microsoft excel','sql','python','javascript','typescript','react','supabase','gestion du changement','leadership','travail en equipe','resolution de problemes','anglais','francais','allemand','luxembourgeois','gestion documentaire','conformite','rse','qhse','hse','iso 9001','iso 14001','iso 45001','aml','kyc','rgpd','gdpr','crm','erp','sap',
];

export function extractJobKeywords(text: string, limit = 24): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const phraseHits = SKILL_PHRASES.filter(phrase => normalized.includes(normalizeText(phrase)));
  const frequency = new Map<string, number>();
  for (const rawToken of normalized.split(' ')) {
    const token = rawToken.replace(/^[.+#-]+|[.+#-]+$/g, '');
    if (token.length < 3 || STOP_WORDS.has(token) || /^\d+$/.test(token)) continue;
    frequency.set(token, (frequency.get(token) || 0) + 1);
  }
  const phraseParts = new Set(phraseHits.flatMap(phrase => normalizeText(phrase).split(' ')));
  const words = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([word]) => word)
    .filter(word => !phraseParts.has(word));
  return [...new Set([...phraseHits, ...words])].slice(0, limit);
}

function docText(docType: CareerDocType, data: DocData | LmData): string {
  if (docType === 'lm') {
    const lm = data as LmData;
    return [
      lm.sender?.name, lm.recipient?.name, lm.recipient?.company, lm.subject, lm.salutation,
      lm.intro, lm.motivation, lm.skills_paragraph, lm.company_link, lm.availability, lm.closing, lm.signature,
    ].filter(Boolean).join('\n');
  }
  const cv = data as DocData;
  return [
    cv.name, cv.title, cv.objective, cv.summary,
    cv.experiences?.map(item => `${item.position} ${item.company} ${item.description}`).join('\n'),
    cv.education?.map(item => `${item.degree} ${item.school}`).join('\n'),
    cv.skills?.map(item => item.name).join(' '),
    cv.languages?.map(item => `${item.name} ${item.level}`).join(' '),
    cv.certifications_external?.map(item => `${item.name} ${item.issuer}`).join(' '),
    cv.projects?.map(item => `${item.name} ${item.description} ${item.technologies || ''}`).join('\n'),
  ].filter(Boolean).join('\n');
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function issue(
  id: string,
  severity: CareerQualitySeverity,
  category: CareerQualityIssue['category'],
  title: string,
  detail: string,
): CareerQualityIssue {
  return { id, severity, category, title, detail };
}

const ACTION_VERBS = [
  'analyse','ameliore','augmente','automatise','coordonne','cree','deploie','developpe','dirige','economise','elabore','forme','gere','identifie','implemente','lance','met en place','negocie','optimise','pilote','reduis','resous','structure','supervise','transforme','accompagne','conduit','delivered','managed','led','implemented','improved','increased','reduced','created','developed','optimized','coordinated',
];

export function analyzeCareerDocument(
  docType: CareerDocType,
  data: DocData | LmData,
  design: DesignOptions | LmDesign,
): CareerQualityReport {
  const meta = getCareerMeta(data, docType);
  const text = docText(docType, data);
  const normalized = normalizeText(text);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const issues: CareerQualityIssue[] = [];
  let content = 100;
  let ats = 100;
  let target = 100;
  let visual = 100;
  let evidenceScore = 100;
  let quantified = 0;
  let actionVerbBullets = 0;

  if (docType === 'cv') {
    const cv = data as DocData;
    if (!cv.name?.trim()) { content -= 15; issues.push(issue('cv-name','critical','content','Nom absent','Ajoutez votre nom complet.')); }
    if (!cv.title?.trim()) { content -= 12; target -= 8; issues.push(issue('cv-title','critical','target','Titre professionnel absent','Ajoutez un titre précis correspondant au poste visé.')); }
    if (!cv.contact?.email?.trim() && !cv.contact?.phone?.trim()) { content -= 15; ats -= 10; issues.push(issue('cv-contact','critical','ats','Coordonnées insuffisantes','Ajoutez au moins un email ou un numéro de téléphone lisible.')); }
    const summaryLength = (cv.summary || '').trim().split(/\s+/).filter(Boolean).length;
    if (summaryLength < 25) { content -= 10; issues.push(issue('cv-summary-short','warning','content','Résumé trop court','Visez environ 40 à 90 mots, adaptés au poste ciblé.')); }
    if (summaryLength > 130) { content -= 5; issues.push(issue('cv-summary-long','warning','content','Résumé trop long','Raccourcissez le résumé pour faciliter la lecture.')); }
    if (!cv.experiences?.length) { content -= 18; target -= 12; issues.push(issue('cv-experience','critical','content','Aucune expérience','Ajoutez une expérience, un stage, un projet ou une mission pertinente.')); }
    for (const exp of cv.experiences || []) {
      const expText = `${exp.position || ''} ${exp.description || ''}`;
      if (/\b\d+(?:[,.]\d+)?\s*(?:%|€|eur|fcfa|xaf|xof|personnes|clients|projets|jours|mois|ans|heures)?\b/i.test(expText)) quantified += 1;
      if (ACTION_VERBS.some(verb => normalizeText(exp.description || '').startsWith(normalizeText(verb)) || normalizeText(exp.description || '').includes(`${normalizeText(verb)} `))) actionVerbBullets += 1;
      if (!exp.start_date) { content -= 2; issues.push(issue(`exp-date-${exp.id}`,'warning','content','Date de début manquante',`Ajoutez la date de début pour ${exp.position || 'une expérience'}.`)); }
      if (!exp.current && !exp.end_date) { content -= 2; issues.push(issue(`exp-end-${exp.id}`,'warning','content','Date de fin manquante',`Précisez la fin de ${exp.position || 'cette expérience'} ou indiquez qu’elle est en cours.`)); }
      if ((exp.description || '').trim().length < 30) { content -= 2; issues.push(issue(`exp-detail-${exp.id}`,'info','content','Expérience peu détaillée',`Ajoutez missions, méthodes et résultats pour ${exp.position || 'cette expérience'}.`)); }
    }
    if ((cv.experiences || []).length && quantified === 0) { content -= 8; issues.push(issue('cv-results','warning','content','Aucun résultat quantifié','Ajoutez uniquement des chiffres que vous pouvez confirmer : volume, délai, économie, taux ou nombre de personnes.')); }
    if (!(cv.skills || []).some(skill => skill.name?.trim())) { content -= 8; target -= 12; issues.push(issue('cv-skills','warning','target','Compétences absentes','Ajoutez des compétences réellement maîtrisées et pertinentes pour le poste.')); }
    if (!(cv.education || []).length && !(cv.omnia_formations || []).length) { content -= 6; issues.push(issue('cv-education','info','content','Formation absente','Ajoutez vos études ou formations pertinentes.')); }
    if ((cv.contact?.linkedin || '').startsWith('http') === false && cv.contact?.linkedin) { ats -= 3; issues.push(issue('cv-linkedin','info','ats','Lien LinkedIn incomplet','Utilisez une URL complète commençant par https://.')); }
  } else {
    const lm = data as LmData;
    if (!lm.sender?.name?.trim() || !lm.sender?.email?.trim()) { content -= 15; issues.push(issue('lm-sender','critical','content','Coordonnées de l’expéditeur incomplètes','Ajoutez votre nom et votre email.')); }
    if (!lm.recipient?.company?.trim()) { target -= 15; issues.push(issue('lm-company','critical','target','Entreprise non ciblée','Précisez l’entreprise ou la structure destinataire.')); }
    if (!lm.subject?.trim()) { content -= 8; target -= 8; issues.push(issue('lm-subject','warning','target','Objet absent','Indiquez clairement le poste et, si disponible, la référence de l’offre.')); }
    if (!(lm.intro || '').trim()) { content -= 12; issues.push(issue('lm-intro','critical','content','Introduction absente','Présentez le poste visé et votre valeur principale.')); }
    if (!(lm.motivation || '').trim()) { content -= 12; target -= 10; issues.push(issue('lm-motivation','critical','target','Motivation absente','Expliquez pourquoi ce poste et cette organisation vous intéressent.')); }
    if (!(lm.skills_paragraph || '').trim()) { content -= 10; target -= 12; issues.push(issue('lm-skills','warning','target','Preuves professionnelles absentes','Reliez deux ou trois compétences à des exemples réels.')); }
    if (words < 180) { content -= 8; issues.push(issue('lm-short','warning','content','Lettre trop courte','Une lettre standard contient généralement 220 à 420 mots.')); }
    if (words > 520) { content -= 10; ats -= 5; issues.push(issue('lm-long','warning','content','Lettre trop longue','Conservez une lettre ciblée, idéalement sur une page.')); }
  }

  const designAny = design as DesignOptions & LmDesign & Record<string, unknown>;
  const bodySize = Number(designAny.font_size_body || 10);
  const lineSpacing = Number(designAny.line_spacing || 1.5);
  if (bodySize < 8) { visual -= 18; ats -= 8; issues.push(issue('font-small','critical','visual','Police trop petite','Utilisez au moins 8 pt, idéalement 9 à 11 pt.')); }
  if (bodySize > 14) { visual -= 8; issues.push(issue('font-large','warning','visual','Police très grande','Réduisez la taille pour garder une hiérarchie professionnelle.')); }
  if (lineSpacing < 1.15) { visual -= 10; issues.push(issue('line-tight','warning','visual','Interligne trop serré','Augmentez l’interligne pour améliorer la lisibilité.')); }
  if (lineSpacing > 2.1) { visual -= 6; issues.push(issue('line-wide','info','visual','Interligne très large','Réduisez l’interligne pour éviter les pages inutilement longues.')); }
  if (designAny.editor_mode === 'manual') { ats -= 12; issues.push(issue('manual-ats','warning','ats','Mise en page libre à vérifier','Les éléments positionnés librement peuvent être moins bien lus par certains ATS. Exportez aussi une version ATS stricte.')); }
  if (designAny.document_mode === 'creative') { ats -= 8; issues.push(issue('creative-ats','info','ats','Version créative','Conservez une seconde version ATS avec une structure simple et un ordre de lecture linéaire.')); }
  if (designAny.page_format === 'letter' && meta.target.country && !['usa','united states','canada'].includes(normalizeText(meta.target.country))) {
    visual -= 2;
    issues.push(issue('page-format','info','visual','Format Letter sélectionné','Le format A4 est généralement préférable hors Amérique du Nord.'));
  }

  const targetKeywords = [...new Set([
    ...meta.target.required_keywords,
    ...meta.target.preferred_keywords,
    ...extractJobKeywords(meta.target.job_description, 18),
  ].map(item => item.trim()).filter(Boolean))];
  const evidenceText = normalizeText(meta.evidence.filter(item => item.selected).map(item => `${item.title} ${(item.skills || []).join(' ')}`).join(' '));
  const keywordMatches: CareerKeywordMatch[] = targetKeywords.map(keyword => {
    const normalizedKeyword = normalizeText(keyword);
    const inDocument = normalized.includes(normalizedKeyword);
    const inEvidence = evidenceText.includes(normalizedKeyword);
    return { keyword, status: inEvidence ? 'proved' : inDocument ? 'declared' : 'missing' };
  });
  const missingKeywords = keywordMatches.filter(item => item.status === 'missing').length;
  const provedKeywords = keywordMatches.filter(item => item.status === 'proved').length;
  if (targetKeywords.length) {
    const matchRatio = (targetKeywords.length - missingKeywords) / targetKeywords.length;
    target = Math.min(target, 35 + matchRatio * 65);
    if (missingKeywords) issues.push(issue('target-missing','warning','target','Éléments du poste non couverts',`${missingKeywords} mot(s)-clé(s) important(s) ne sont pas encore démontrés dans le document.`));
  } else {
    target = Math.min(target, 62);
    issues.push(issue('target-empty','info','target','Offre non analysée','Ajoutez l’offre ou ses exigences pour obtenir un score de pertinence réel.'));
  }

  const selectedEvidence = meta.evidence.filter(item => item.selected);
  const verifiedEvidence = selectedEvidence.filter(item => item.status === 'verified');
  if (!selectedEvidence.length) {
    evidenceScore = 45;
    issues.push(issue('evidence-empty','info','evidence','Aucune preuve reliée','Ajoutez des certificats, formations, projets ou recommandations pour distinguer les éléments déclarés des preuves vérifiables.'));
  } else {
    evidenceScore = 55 + (verifiedEvidence.length / selectedEvidence.length) * 45;
  }
  if (provedKeywords > 0) {
    issues.push(issue('evidence-match','success','evidence','Compétences prouvées',`${provedKeywords} exigence(s) du poste sont reliées à une preuve sélectionnée.`));
  }

  content = clamp(content);
  ats = clamp(ats);
  target = clamp(target);
  visual = clamp(visual);
  evidenceScore = clamp(evidenceScore);
  const overall = clamp(content * 0.28 + ats * 0.23 + target * 0.24 + visual * 0.13 + evidenceScore * 0.12);

  if (!issues.some(item => item.severity === 'critical')) {
    issues.unshift(issue('no-critical','success','content','Structure exploitable','Aucun blocage majeur n’a été détecté. Vérifiez toujours l’exactitude avant l’envoi.'));
  }

  return {
    overall,
    content,
    ats,
    target,
    visual,
    evidence: evidenceScore,
    issues,
    keywordMatches,
    metrics: {
      wordCount: words,
      quantifiedAchievements: quantified,
      actionVerbBullets,
      evidenceSelected: selectedEvidence.length,
    },
  };
}

export function buildEvidenceFromSource(source: CareerSourceProfile): CareerEvidence[] {
  const formationEvidence = (source.completed_formations || []).map((item, index): CareerEvidence => ({
    id: `formation_${item.course_id || index}`,
    title: item.courses?.title || 'Formation Omnia',
    type: 'formation',
    issuer: 'Omnia Global Academy',
    issued_at: item.completed_at,
    skills: item.courses?.category ? [item.courses.category] : [],
    status: 'verified',
    selected: false,
  }));
  const certificateEvidence = (source.certificates || []).map((item, index): CareerEvidence => ({
    id: `certificate_${item.id || index}`,
    title: item.courses?.title || 'Certificat Omnia',
    type: 'certificate',
    issuer: 'Omnia Global Academy',
    issued_at: item.issued_at,
    verification_url: item.verification_url,
    credential_id: item.omnia_certificate_id || item.id,
    status: 'verified',
    selected: false,
  }));
  return [...formationEvidence, ...certificateEvidence];
}

export function mergeEvidence(current: CareerEvidence[], incoming: CareerEvidence[]): CareerEvidence[] {
  const byId = new Map(current.map(item => [item.id, item]));
  for (const item of incoming) {
    byId.set(item.id, { ...item, ...(byId.get(item.id) || {}) });
  }
  return [...byId.values()];
}

export function getPageDimensions(design: DesignOptions | LmDesign): { width: number; height: number } {
  const anyDesign = design as unknown as Record<string, unknown>;
  const format = anyDesign.page_format === 'letter' ? 'letter' : 'a4';
  const orientation = anyDesign.orientation === 'landscape' ? 'landscape' : 'portrait';
  const base = format === 'letter' ? { width: 816, height: 1056 } : { width: 794, height: 1123 };
  return orientation === 'landscape' ? { width: base.height, height: base.width } : base;
}

export function sanitizeRichText(html: string): string {
  const raw = String(html || '');
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return raw
      .replace(/<(script|style|iframe|object|embed|svg|math)[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
      .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
      .replace(/javascript\s*:/gi, '');
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(`<div>${raw}</div>`, 'text/html');
  const allowed = new Set(['DIV', 'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'SPAN']);
  const forbidden = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON']);

  const clean = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const element = child as HTMLElement;
      if (forbidden.has(element.tagName)) {
        element.remove();
        continue;
      }
      clean(element);
      if (!allowed.has(element.tagName)) {
        element.replaceWith(...Array.from(element.childNodes));
        continue;
      }
      for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
    }
  };

  clean(document.body);
  return document.body.firstElementChild?.innerHTML || '';
}

function versionKey(documentId: string) {
  return `omnia_career_versions_${documentId || 'new'}`;
}

export function listCareerVersions(documentId: string): CareerVersionSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(versionKey(documentId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCareerVersion(document: CareerDocumentFull, label: string): CareerVersionSnapshot[] {
  if (typeof window === 'undefined') return [];
  const snapshot: CareerVersionSnapshot = {
    id: `version_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: label.trim() || 'Version enregistrée',
    created_at: new Date().toISOString(),
    document: JSON.parse(JSON.stringify(document)),
  };
  const versions = [snapshot, ...listCareerVersions(document.id)].slice(0, 15);
  localStorage.setItem(versionKey(document.id), JSON.stringify(versions));
  return versions;
}

export function deleteCareerVersion(documentId: string, versionId: string): CareerVersionSnapshot[] {
  if (typeof window === 'undefined') return [];
  const versions = listCareerVersions(documentId).filter(item => item.id !== versionId);
  localStorage.setItem(versionKey(documentId), JSON.stringify(versions));
  return versions;
}

export function createLinkedLetterFromCv(document: CareerDocumentFull): CareerDocumentFull {
  const cv = document.doc_data as DocData;
  const meta = getCareerMeta(cv, 'cv');
  const now = new Date().toISOString();
  const lmData: LmData = {
    sender: {
      name: cv.name || '',
      address: cv.contact?.location || '',
      phone: cv.contact?.phone || '',
      email: cv.contact?.email || '',
      city: cv.contact?.location || '',
      date: now.slice(0, 10),
    },
    recipient: {
      name: meta.target.recruiter_name || '',
      company: meta.target.company || '',
      address: meta.target.location || '',
    },
    subject: meta.target.job_title ? `Candidature au poste de ${meta.target.job_title}` : 'Candidature',
    salutation: meta.target.recruiter_name ? `Madame, Monsieur ${meta.target.recruiter_name},` : 'Madame, Monsieur,',
    intro: '',
    motivation: '',
    skills_paragraph: '',
    company_link: '',
    availability: '',
    closing: '',
    signature: cv.name || '',
    career_meta: {
      ...createDefaultCareerMeta('lm'),
      target: { ...meta.target },
      evidence: meta.evidence.map(item => ({ ...item })),
      source_cv_id: document.id,
      application_package_id: meta.application_package_id || `package_${Date.now()}`,
    },
  } as LmData;
  return {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: meta.target.company ? `Lettre - ${meta.target.company}` : 'Ma lettre de motivation',
    doc_type: 'lm',
    template_key: getPairedLmTemplateKey(document.template_key),
    language: document.language || 'fr',
    status: 'draft',
    ats_score: 0,
    target_job: meta.target.job_title || document.target_job || null,
    target_country: meta.target.country || document.target_country || null,
    application_type: meta.target.application_type || 'emploi',
    is_primary: false,
    created_at: now,
    updated_at: now,
    doc_data: lmData,
    design_options: {
      ...(document.design_options as unknown as Record<string, unknown>),
      editor_mode: 'template',
    } as LmDesign,
  };
}
