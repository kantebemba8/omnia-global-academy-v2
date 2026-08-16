import { getSessionToken } from './session';
import {
  CareerDocType,
  CareerDocumentFull,
  CareerDocumentSummary,
  createDefaultData,
  createDefaultDesign,
  getDefaultDocTitle,
  getDefaultTemplateKey,
  getCareerTemplates,
  normalizeTemplateKey,
  cacheCareerTemplates,
  mergeCareerTemplateCatalog,
} from './careerStudioData';

import { edgeAuthHeaders, edgeGatewayHeaders } from './edgeAuth';
import { analyzeCareerDocument, hasCareerQualityStarted, normalizeCareerDocument, type CareerSourceProfile } from './careerBuilderV2';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const FUNCTIONS_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '';

function sessionToken() {
  return getSessionToken() || '';
}

function nowIso() {
  return new Date().toISOString();
}

function localKey(docType: CareerDocType) {
  const token = sessionToken() || 'public-dev';
  return `omnia_career_${docType}_${token.slice(0, 18)}`;
}

function readLocal(docType: CareerDocType): CareerDocumentFull[] {
  try {
    return JSON.parse(localStorage.getItem(localKey(docType)) || '[]') as CareerDocumentFull[];
  } catch {
    return [];
  }
}

function writeLocal(docType: CareerDocType, docs: CareerDocumentFull[]) {
  localStorage.setItem(localKey(docType), JSON.stringify(docs));
}

function createLocalDocument(docType: CareerDocType, templateKey?: string): CareerDocumentFull {
  const explicitTemplate = String(templateKey || '').trim();
  if (!explicitTemplate) throw new Error('TEMPLATE_SELECTION_REQUIRED');
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const data = createDefaultData(docType);
  return {
    id,
    title: getDefaultDocTitle(docType),
    doc_type: docType,
    template_key: normalizeTemplateKey(docType, explicitTemplate),
    language: 'fr',
    status: 'draft',
    ats_score: 0,
    target_job: null,
    application_type: docType === 'cv' ? 'cv' : 'lm',
    is_primary: true,
    created_at: nowIso(),
    updated_at: nowIso(),
    doc_data: data,
    design_options: createDefaultDesign(docType),
  };
}

async function safeJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text || '{}') as T;
  } catch {
    throw new Error(text || `Erreur serveur (${res.status})`);
  }
}

async function functionPost<T>(slug: string, body: unknown): Promise<T> {
  if (!FUNCTIONS_BASE || !sessionToken()) throw new Error('NO_REMOTE_SESSION');
  const res = await fetch(`${FUNCTIONS_BASE}/${slug}`, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await safeJson<T & { error?: string; message?: string }>(res);
  if (!res.ok || (data as { error?: string }).error) {
    const err = new Error((data as { message?: string; error?: string }).message || (data as { error?: string }).error || 'SERVER_ERROR');
    (err as Error & { status?: number; code?: string }).status = res.status;
    (err as Error & { status?: number; code?: string }).code = (data as { error?: string }).error || 'SERVER_ERROR';
    throw err;
  }
  return data as T;
}



export type CareerTokenPolicy = {
  config_key: string;
  label_fr: string;
  description_fr?: string | null;
  rule_type: 'earn' | 'spend';
  config_value: number;
  repeat_policy?: string | null;
  free_uses_per_month?: number | null;
  is_active: boolean;
  global_enabled?: boolean;
};

type CareerTokenActionResult = {
  success: boolean;
  applied?: boolean;
  free_use?: boolean;
  amount?: number;
  tokens_remaining?: number;
  error?: string;
  message?: string;
};

const TOKEN_POLICY_CACHE_KEY = 'omnia_career_token_policy_v2';
let tokenPolicyMemory: CareerTokenPolicy[] | null = null;

function readCachedTokenPolicy(): CareerTokenPolicy[] {
  if (tokenPolicyMemory) return tokenPolicyMemory;
  try {
    const parsed = JSON.parse(localStorage.getItem(TOKEN_POLICY_CACHE_KEY) || '[]');
    tokenPolicyMemory = Array.isArray(parsed) ? parsed : [];
  } catch {
    tokenPolicyMemory = [];
  }
  return tokenPolicyMemory;
}

function writeCachedTokenPolicy(policies: CareerTokenPolicy[]) {
  tokenPolicyMemory = policies;
  try {
    localStorage.setItem(TOKEN_POLICY_CACHE_KEY, JSON.stringify(policies));
  } catch {
    // Le cache est facultatif.
  }
}

export async function fetchCareerTokenPolicies(): Promise<CareerTokenPolicy[]> {
  if (!SUPABASE_URL) return readCachedTokenPolicy();

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/career_public_token_policy`, {
      method: 'POST',
      headers: edgeGatewayHeaders(),
      body: '{}',
    });
    const data = await safeJson<CareerTokenPolicy[] | { message?: string; error?: string }>(res);
    if (!res.ok || !Array.isArray(data)) throw new Error((data as { message?: string; error?: string }).message || 'TOKEN_POLICY_UNAVAILABLE');
    const normalized = data.map(policy => ({
      ...policy,
      config_value: Number(policy.config_value || 0),
      free_uses_per_month: Number(policy.free_uses_per_month || 0),
      is_active: Boolean(policy.is_active),
      global_enabled: policy.global_enabled !== false,
    }));
    writeCachedTokenPolicy(normalized);
    return normalized;
  } catch {
    return readCachedTokenPolicy();
  }
}

export async function getCareerTokenPolicy(ruleKey: string): Promise<CareerTokenPolicy | null> {
  const policies = await fetchCareerTokenPolicies();
  return policies.find(policy => policy.config_key === ruleKey) || null;
}

export async function consumeCareerTokenAction(
  ruleKey: string,
  referenceKey?: string | null,
  metadata: Record<string, unknown> = {},
): Promise<CareerTokenActionResult> {
  const policy = await getCareerTokenPolicy(ruleKey);
  if (!policy || !policy.is_active || policy.global_enabled === false || Number(policy.config_value || 0) <= 0) {
    return { success: true, applied: false, amount: 0 };
  }

  const token = sessionToken();
  if (!token || !SUPABASE_URL) {
    const err = new Error(`Cette action nécessite ${policy.config_value} jeton(s), mais la vérification du solde est indisponible.`);
    (err as Error & { code?: string }).code = 'TOKEN_CHECK_UNAVAILABLE';
    throw err;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/career_consume_token_action`, {
    method: 'POST',
    headers: edgeGatewayHeaders(),
    body: JSON.stringify({
      p_session_token: token,
      p_rule_key: ruleKey,
      p_reference_key: referenceKey || null,
      p_request_id: crypto.randomUUID(),
      p_metadata: metadata,
    }),
  });
  const data = await safeJson<CareerTokenActionResult>(res);
  if (!res.ok || data.success !== true) {
    const err = new Error(data.message || data.error || `Impossible d'appliquer la règle ${ruleKey}.`);
    (err as Error & { code?: string; status?: number }).code = data.error || 'TOKEN_ACTION_FAILED';
    (err as Error & { code?: string; status?: number }).status = res.status;
    throw err;
  }
  return data;
}

export async function fetchCareerTemplateCatalog(docType: CareerDocType): Promise<ReturnType<typeof getCareerTemplates>> {
  const localTemplates = getCareerTemplates(docType);
  if (!SUPABASE_URL) return localTemplates;

  try {
    const query = new URLSearchParams({
      select: '*',
      template_type: `eq.${docType}`,
      is_active: 'eq.true',
      order: 'display_order.asc',
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/career_templates?${query.toString()}`, {
      headers: edgeGatewayHeaders(),
    });
    const rows = await safeJson<Array<Record<string, unknown>>>(res);
    if (!res.ok || !Array.isArray(rows)) throw new Error('TEMPLATE_CATALOG_UNAVAILABLE');

    const catalog = mergeCareerTemplateCatalog(
      docType,
      rows as unknown as ReturnType<typeof getCareerTemplates>,
      { authoritative: true },
    );
    cacheCareerTemplates(catalog, docType);
    return catalog;
  } catch {
    return localTemplates;
  }
}

function tokenRuleForAiAction(action: CareerAiAction): string {
  if (action === 'generate_lm' || action === 'generate_cv_lm') return 'spend_ai_lm';
  if (action === 'adapt_to_offer') return 'spend_adapt_offer';
  if (action === 'ats_score') return 'spend_ats_analysis';
  if (action === 'translate') return 'spend_translation';
  return 'spend_ai_cv';
}

export type CareerTrackedApplication = {
  id: string;
  source: 'platform' | 'manual';
  source_id?: string;
  editable?: boolean;
  job_id?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  job_url?: string | null;
  location?: string | null;
  contract_type?: string | null;
  application_mode?: string | null;
  status?: string | null;
  tracking_status?: string | null;
  applied_at?: string | null;
  interview_at?: string | null;
  next_follow_up_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CareerJobContext = {
  id: string;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  contract_type?: string | null;
  category?: string | null;
  salary_range?: string | null;
  required_level?: string | null;
  skills_required?: string[] | string | null;
  recruiter_company?: string | null;
  recruiter_name?: string | null;
  deadline?: string | null;
  application_mode?: string | null;
  application_instructions?: string | null;
};


const CAREER_APPLICATIONS_LOCAL_KEY = 'omnia_manual_applications';

function readLocalApplications(): CareerTrackedApplication[] {
  try {
    return JSON.parse(localStorage.getItem(CAREER_APPLICATIONS_LOCAL_KEY) || '[]') as CareerTrackedApplication[];
  } catch {
    return [];
  }
}

function writeLocalApplications(applications: CareerTrackedApplication[]) {
  localStorage.setItem(CAREER_APPLICATIONS_LOCAL_KEY, JSON.stringify(applications));
}

function replaceLocalApplication(application: CareerTrackedApplication) {
  const current = readLocalApplications();
  const next = [
    application,
    ...current.filter(item => item.id !== application.id),
  ];
  writeLocalApplications(next);
  return next;
}

export async function getCareerJobContext(jobId: string): Promise<{
  job: CareerJobContext | null;
  tracked: CareerTrackedApplication | null;
}> {
  const normalized = String(jobId || '').trim();
  if (!normalized) return { job: null, tracked: null };
  const data = await functionPost<{ job?: CareerJobContext | null; tracked?: CareerTrackedApplication | null }>(
    'career-application-track',
    { action: 'get', job_id: normalized },
  );
  return { job: data.job || null, tracked: data.tracked || null };
}

export async function listCareerApplications(): Promise<{
  applications: CareerTrackedApplication[];
  remote: boolean;
}> {
  try {
    const data = await functionPost<{ applications?: CareerTrackedApplication[] }>(
      'career-application-track',
      { action: 'list' },
    );
    const applications = data.applications || [];
    writeLocalApplications(applications);
    return { applications, remote: true };
  } catch {
    return { applications: readLocalApplications(), remote: false };
  }
}

export async function createCareerManualApplication(input: {
  company_name: string;
  job_title: string;
  job_url?: string;
  location?: string;
  contract_type?: string;
  application_mode?: string;
  status?: string;
  notes?: string;
}): Promise<{ application: CareerTrackedApplication; remote: boolean }> {
  try {
    const data = await functionPost<{ application: CareerTrackedApplication }>(
      'career-application-track',
      { action: 'create_manual', ...input },
    );
    replaceLocalApplication(data.application);
    return { application: data.application, remote: true };
  } catch {
    const now = nowIso();
    const application: CareerTrackedApplication = {
      id: `manual-local-${Date.now()}`,
      source: 'manual',
      source_id: `local-${Date.now()}`,
      editable: true,
      company_name: input.company_name,
      job_title: input.job_title,
      job_url: input.job_url || null,
      location: input.location || null,
      contract_type: input.contract_type || null,
      application_mode: input.application_mode || 'external_link',
      status: input.status || 'draft',
      tracking_status: input.status || 'draft',
      notes: input.notes || null,
      created_at: now,
      updated_at: now,
    };
    replaceLocalApplication(application);
    return { application, remote: false };
  }
}

export async function updateCareerApplicationStatus(
  id: string,
  status: string,
): Promise<{ application: CareerTrackedApplication; remote: boolean }> {
  try {
    const data = await functionPost<{ application: CareerTrackedApplication }>(
      'career-application-track',
      { action: 'update_status', id, status },
    );
    replaceLocalApplication(data.application);
    return { application: data.application, remote: true };
  } catch {
    const current = readLocalApplications();
    const existing = current.find(item => item.id === id);
    if (!existing) throw new Error('APPLICATION_NOT_FOUND');

    const application: CareerTrackedApplication = {
      ...existing,
      status,
      tracking_status: status,
      updated_at: nowIso(),
    };
    replaceLocalApplication(application);
    return { application, remote: false };
  }
}

export async function listCareerDocuments(docType: CareerDocType): Promise<{
  documents: CareerDocumentSummary[];
  templates: ReturnType<typeof getCareerTemplates>;
  tokens: number;
  remote: boolean;
  sourceProfile: CareerSourceProfile;
}> {
  const publicTemplates = await fetchCareerTemplateCatalog(docType);

  try {
    const data = await functionPost<{
      documents?: CareerDocumentSummary[];
      templates?: ReturnType<typeof getCareerTemplates>;
      user?: CareerSourceProfile['user'] & { cv_tokens?: number };
      completed_formations?: CareerSourceProfile['completed_formations'];
      certificates?: CareerSourceProfile['certificates'];
      partner_link?: CareerSourceProfile['partner_link'];
    }>('career-studio-manage?action=list', { doc_type: docType });

    const templates = mergeCareerTemplateCatalog(
      docType,
      data.templates ?? publicTemplates,
      { authoritative: true },
    );
    cacheCareerTemplates(templates, docType);
    return {
      documents: data.documents || [],
      templates,
      tokens: data.user?.cv_tokens ?? 0,
      remote: true,
      sourceProfile: {
        user: data.user,
        completed_formations: data.completed_formations || [],
        certificates: data.certificates || [],
        partner_link: data.partner_link || null,
      },
    };
  } catch {
    const docs = readLocal(docType);
    return {
      documents: docs.map(({ doc_data, design_options, ...summary }) => summary),
      templates: publicTemplates,
      tokens: 0,
      remote: false,
      sourceProfile: {},
    };
  }
}

export async function getCareerDocument(docType: CareerDocType, documentId?: string | null, templateKey?: string | null): Promise<{
  document: CareerDocumentFull;
  remote: boolean;
}> {
  if (documentId && documentId !== 'new' && !documentId.startsWith('local_')) {
    try {
      const data = await functionPost<{ document: CareerDocumentFull }>('career-studio-manage?action=save', {
        action: 'get',
        document_id: documentId,
      });
      return { document: normalizeCareerDocument({ ...data.document, template_key: normalizeTemplateKey(data.document.doc_type, data.document.template_key) }), remote: true };
    } catch {
      // fallback below
    }
  }

  let docs = readLocal(docType);
  const existing = documentId && documentId !== 'new' ? docs.find(d => d.id === documentId) : undefined;
  if (existing) return { document: normalizeCareerDocument({ ...existing, template_key: normalizeTemplateKey(existing.doc_type, existing.template_key) }), remote: false };

  // A new document exists only in memory until the learner explicitly saves it.
  const created = createLocalDocument(docType, templateKey || undefined);
  return { document: normalizeCareerDocument(created), remote: false };
}

export async function saveCareerDocument(document: CareerDocumentFull): Promise<{ document: CareerDocumentFull; remote: boolean }> {
  const normalizedDocument = normalizeCareerDocument(document);
  const qualityStarted = hasCareerQualityStarted(normalizedDocument.doc_data, normalizedDocument.doc_type);
  const score = qualityStarted
    ? analyzeCareerDocument(normalizedDocument.doc_type, normalizedDocument.doc_data, normalizedDocument.design_options).ats
    : 0;
  const payload = {
    action: 'save',
    document_id: document.id.startsWith('local_') ? undefined : document.id,
    doc_type: normalizedDocument.doc_type,
    title: normalizedDocument.title || getDefaultDocTitle(normalizedDocument.doc_type),
    template_key: normalizeTemplateKey(normalizedDocument.doc_type, normalizedDocument.template_key || getDefaultTemplateKey(normalizedDocument.doc_type)),
    language: normalizedDocument.language || 'fr',
    doc_data: normalizedDocument.doc_data,
    design_options: normalizedDocument.design_options,
    target_job: normalizedDocument.target_job,
    target_country: normalizedDocument.target_country,
    application_type: normalizedDocument.application_type,
    ats_score: score,
    status: normalizedDocument.status || 'draft',
    is_primary: normalizedDocument.is_primary ?? true,
  };

  try {
    const data = await functionPost<{ document: { id: string; title: string; content_hash?: string } }>('career-studio-manage?action=save', payload);
    const saved: CareerDocumentFull = {
      ...normalizedDocument,
      id: data.document.id,
      template_key: normalizeTemplateKey(normalizedDocument.doc_type, normalizedDocument.template_key),
      ats_score: score,
      updated_at: nowIso(),
    };
    return { document: saved, remote: true };
  } catch {
    const docType = normalizedDocument.doc_type;
    const docs = readLocal(docType);
    const id = document.id || `local_${Date.now()}`;
    const saved: CareerDocumentFull = {
      ...normalizedDocument,
      id,
      template_key: normalizeTemplateKey(normalizedDocument.doc_type, normalizedDocument.template_key),
      ats_score: score,
      updated_at: nowIso(),
      created_at: document.created_at || nowIso(),
    };
    const next = [saved, ...docs.filter(d => d.id !== id)].map(d => ({ ...d, is_primary: d.id === id ? saved.is_primary : d.is_primary }));
    writeLocal(docType, next);
    return { document: saved, remote: false };
  }
}

export async function deleteCareerDocument(docType: CareerDocType, documentId: string): Promise<{ success: true; remote: boolean }> {
  if (!documentId) throw new Error('DOCUMENT_ID_REQUIRED');

  if (documentId.startsWith('local_')) {
    writeLocal(docType, readLocal(docType).filter(d => d.id !== documentId));
    return { success: true, remote: false };
  }

  const data = await functionPost<{ success?: boolean; action?: string }>('career-studio-manage?action=save', {
    action: 'delete',
    document_id: documentId,
  });
  if (data.success !== true || data.action !== 'deleted') {
    throw new Error('DOCUMENT_DELETE_NOT_CONFIRMED');
  }
  return { success: true, remote: true };
}

export async function renameCareerDocument(
  docType: CareerDocType,
  documentId: string,
  title: string,
): Promise<{ success: true; title: string; remote: boolean }> {
  const cleanTitle = String(title || '').trim();
  if (!documentId) throw new Error('DOCUMENT_ID_REQUIRED');
  if (!cleanTitle) throw new Error('DOCUMENT_TITLE_REQUIRED');

  if (documentId.startsWith('local_')) {
    const docs = readLocal(docType);
    const next = docs.map(document => document.id === documentId
      ? { ...document, title: cleanTitle, updated_at: nowIso() }
      : document);
    writeLocal(docType, next);
    return { success: true, title: cleanTitle, remote: false };
  }

  const data = await functionPost<{
    success?: boolean;
    action?: string;
    document?: { id?: string; title?: string };
  }>('career-studio-manage?action=save', {
    action: 'rename',
    document_id: documentId,
    title: cleanTitle,
  });
  if (data.success !== true || data.action !== 'renamed' || data.document?.id !== documentId) {
    throw new Error('DOCUMENT_RENAME_NOT_CONFIRMED');
  }
  return { success: true, title: String(data.document.title || cleanTitle), remote: true };
}


export type CareerPdfExportResult = {
  success: boolean;
  export_id?: string;
  tokens_consumed: number;
  tokens_remaining?: number;
  remote: boolean;
  message?: string;
};

export async function prepareCareerPdfExport(document: CareerDocumentFull): Promise<CareerPdfExportResult> {
  const localResult: CareerPdfExportResult = {
    success: true,
    tokens_consumed: 0,
    remote: false,
    message: 'Mode local : aucun jeton consommé pendant le test.',
  };

  try {
    const data = await functionPost<{
      success: boolean;
      export_id?: string;
      tokens_consumed?: number;
      tokens_remaining?: number;
      message?: string;
    }>('career-studio-export', {
      action: 'prepare_pdf',
      document_id: document.id?.startsWith('local_') ? null : document.id,
      doc_type: document.doc_type,
      title: document.title,
      template_key: document.template_key,
      request_id: crypto.randomUUID(),
    });

    return {
      success: true,
      export_id: data.export_id,
      tokens_consumed: data.tokens_consumed ?? 0,
      tokens_remaining: data.tokens_remaining,
      remote: true,
      message: data.message,
    };
  } catch (err) {
    const e = err as Error & { code?: string; status?: number };
    if (e.code === 'INSUFFICIENT_TOKENS' || e.status === 402) {
      throw err;
    }

    const ruleKey = document.doc_type === 'cv' ? 'spend_pdf_cv' : 'spend_pdf_lm';
    const charge = await consumeCareerTokenAction(
      ruleKey,
      `${document.id || 'local'}:${document.template_key}`,
      { doc_type: document.doc_type, template_key: document.template_key, local_export: true },
    );

    return {
      ...localResult,
      tokens_consumed: Number(charge.amount || 0),
      tokens_remaining: charge.tokens_remaining,
      message: Number(charge.amount || 0) > 0
        ? `Export local préparé. ${charge.amount} jeton(s) consommé(s).`
        : localResult.message,
    };
  }
}

export async function getCareerTokenHistory(): Promise<{ transactions: unknown[]; balance: number; remote: boolean }> {
  try {
    const data = await functionPost<{ transactions?: unknown[]; balance?: number }>('career-token-manage', { action: 'get_history' });
    return { transactions: data.transactions || [], balance: data.balance ?? 0, remote: true };
  } catch {
    return { transactions: [], balance: 0, remote: false };
  }
}

export type CareerAiAction =
  | 'improve_summary'
  | 'fix_grammar'
  | 'shorten_text'
  | 'make_professional'
  | 'rewrite_experience'
  | 'improve_project'
  | 'suggest_title'
  | 'suggest_skills'
  | 'generate_cv'
  | 'generate_lm'
  | 'generate_cv_lm'
  | 'adapt_to_offer'
  | 'translate'
  | 'ats_score';

export type CareerAiPayload = {
  action: CareerAiAction;
  text?: string;
  doc_type?: CareerDocType;
  doc_data?: unknown;
  offer_text?: string;
  target_job?: string;
  target_country?: string;
  application_type?: string;
  language?: 'fr' | 'en';
};

export type CareerAiResult = {
  success: boolean;
  action: CareerAiAction;
  result: string;
  tokens_consumed: number;
  tokens_remaining?: number;
  remote: boolean;
  message?: string;
};

function fallbackAiResult(payload: CareerAiPayload): CareerAiResult {
  const text = (payload.text || '').trim();
  const cv = payload.doc_data as any;
  const targetJob = payload.target_job || cv?.title || 'le poste visé';

  let result = '';
  if (payload.action === 'improve_summary') {
    result = text
      ? `${text.replace(/\s+/g, ' ').trim()} Profil rigoureux, orienté résultats et capable de transformer les besoins métier en actions concrètes, avec une communication claire et une forte capacité d’adaptation.`
      : `Professionnel motivé, rigoureux et orienté résultats, avec une forte capacité d’apprentissage et une volonté de contribuer à des projets à impact.`;
  } else if (payload.action === 'rewrite_experience') {
    result = text
      ? `• ${text.replace(/\s+/g, ' ').replace(/\.$/, '')}.\n• Contribution à l’amélioration des processus, à la qualité des livrables et au suivi des objectifs.\n• Collaboration avec les équipes pour produire des résultats mesurables et fiables.`
      : `• Pilotage des activités confiées avec rigueur et sens de l’organisation.\n• Amélioration du suivi, de la communication et de la qualité des livrables.\n• Contribution active aux objectifs de l’équipe.`;
  } else if (payload.action === 'suggest_skills') {
    result = [
      'Gestion de projet', 'Communication professionnelle', 'Analyse de données', 'Résolution de problèmes', 'Organisation',
      'Excel avancé', 'Travail en équipe', 'Rédaction professionnelle', 'Suivi KPI', 'Adaptabilité',
    ].join('\n');
  } else if (payload.action === 'generate_lm') {
    result = `Madame, Monsieur,\n\nJe souhaite vous présenter ma candidature pour le poste de ${targetJob}. Mon parcours, mes compétences et ma motivation me permettent de contribuer efficacement à vos projets.\n\nAu cours de mes expériences et formations, j’ai développé des compétences solides en organisation, analyse, communication et suivi des objectifs. Je suis capable de m’adapter rapidement, de travailler avec rigueur et de produire des résultats fiables.\n\nVotre structure m’intéresse particulièrement pour son exigence, son dynamisme et les opportunités de contribution qu’elle offre. Je serais heureux(se) de mettre mes compétences au service de vos équipes.\n\nJe reste disponible pour un entretien afin de vous présenter plus en détail ma motivation et mon parcours.\n\nVeuillez agréer, Madame, Monsieur, l’expression de mes salutations distinguées.`;
  } else if (payload.action === 'adapt_to_offer') {
    result = JSON.stringify({
      score: 82,
      missing_keywords: ['Mots-clés spécifiques de l’offre', 'Résultats chiffrés', 'Outils techniques'],
      skills_to_add: ['Analyse', 'Gestion de projet', 'Communication', 'Suivi KPI'],
      recommendations: ['Ajoutez 2 résultats mesurables dans vos expériences.', 'Reprenez les mots-clés exacts de l’offre.', 'Adaptez le titre professionnel au poste visé.'],
      cover_letter: `Madame, Monsieur,\n\nVotre offre pour le poste de ${targetJob} a retenu toute mon attention. Mon profil correspond aux compétences recherchées et je souhaite mettre mon expérience au service de vos objectifs.\n\nJe serais ravi(e) d’échanger avec vous afin de vous présenter plus concrètement ma motivation.`
    }, null, 2);
  } else if (payload.action === 'ats_score') {
    const qualityStarted = payload.doc_data
      ? hasCareerQualityStarted(payload.doc_data as any, payload.doc_type || 'cv')
      : false;
    const report = qualityStarted && payload.doc_data
      ? analyzeCareerDocument(
          payload.doc_type || 'cv',
          payload.doc_data as any,
          createDefaultDesign(payload.doc_type || 'cv'),
        )
      : null;
    result = JSON.stringify(report ? {
      lisibilite: report.visual,
      structure: report.content,
      orthographe: report.content,
      compatibilite_ats: report.ats,
      longueur: report.content,
      mots_cles: report.target,
      professionnalisme: report.evidence,
      score_global: report.overall,
      conseils: report.issues.map(item => item.detail).slice(0, 5),
    } : {
      lisibilite: 0,
      structure: 0,
      orthographe: 0,
      compatibilite_ats: 0,
      longueur: 0,
      mots_cles: 0,
      professionnalisme: 0,
      score_global: 0,
      conseils: ['Commencez à personnaliser le document pour lancer le diagnostic Qualité et ATS.'],
    }, null, 2);
  } else {
    result = text
      ? `${text.replace(/\s+/g, ' ').trim()}\n\nVersion améliorée : formulation plus claire, plus professionnelle et plus orientée résultats.`
      : 'Proposition IA locale : ajoutez des informations précises sur vos réalisations, vos compétences et vos résultats mesurables.';
  }

  return {
    success: true,
    action: payload.action,
    result,
    tokens_consumed: 0,
    remote: false,
    message: 'Mode local : suggestion générée sans consommation de jeton.',
  };
}

export async function runCareerAiAction(payload: CareerAiPayload): Promise<CareerAiResult> {
  try {
    const data = await functionPost<{
      success: boolean;
      action: CareerAiAction;
      result: string;
      tokens_consumed?: number;
      tokens_remaining?: number;
      message?: string;
    }>('career-studio-manage?action=ai', payload);

    return {
      success: true,
      action: data.action || payload.action,
      result: data.result || '',
      tokens_consumed: data.tokens_consumed ?? 0,
      tokens_remaining: data.tokens_remaining,
      remote: true,
      message: data.message,
    };
  } catch (err) {
    const e = err as Error & { code?: string; status?: number };
    if (e.code === 'INSUFFICIENT_TOKENS' || e.status === 402 || e.code === 'AI_DISABLED') {
      throw err;
    }

    const ruleKey = tokenRuleForAiAction(payload.action);
    const charge = await consumeCareerTokenAction(ruleKey, null, {
      action: payload.action,
      doc_type: payload.doc_type,
      local_fallback: true,
    });
    const fallback = fallbackAiResult(payload);
    return {
      ...fallback,
      tokens_consumed: Number(charge.amount || 0),
      tokens_remaining: charge.tokens_remaining,
      message: Number(charge.amount || 0) > 0
        ? `Suggestion locale générée. ${charge.amount} jeton(s) consommé(s).`
        : fallback.message,
    };
  }
}
