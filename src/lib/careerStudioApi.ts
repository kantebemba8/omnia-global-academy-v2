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
  calculateBasicScore,
  cacheCareerTemplates,
} from './careerStudioData';

import { edgeAuthHeaders } from './edgeAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const FUNCTIONS_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '';

function sessionToken() {
  return localStorage.getItem('omnia_session_token') || '';
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
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const data = createDefaultData(docType);
  return {
    id,
    title: getDefaultDocTitle(docType),
    doc_type: docType,
    template_key: normalizeTemplateKey(docType, templateKey || getDefaultTemplateKey(docType)),
    language: 'fr',
    status: 'draft',
    ats_score: calculateBasicScore(docType, data),
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

export async function listCareerDocuments(docType: CareerDocType): Promise<{
  documents: CareerDocumentSummary[];
  templates: ReturnType<typeof getCareerTemplates>;
  tokens: number;
  remote: boolean;
}> {
  try {
    const data = await functionPost<{
      documents?: CareerDocumentSummary[];
      templates?: ReturnType<typeof getCareerTemplates>;
      user?: { cv_tokens?: number };
    }>('career-studio-manage?action=list', { doc_type: docType });

    if (data.templates?.length) cacheCareerTemplates(data.templates as any);
    return {
      documents: data.documents || [],
      templates: getCareerTemplates(docType),
      tokens: data.user?.cv_tokens ?? 0,
      remote: true,
    };
  } catch {
    const docs = readLocal(docType);
    return {
      documents: docs.map(({ doc_data, design_options, ...summary }) => summary),
      templates: getCareerTemplates(docType),
      tokens: Number(localStorage.getItem('omnia_career_tokens') || 0),
      remote: false,
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
      return { document: { ...data.document, template_key: normalizeTemplateKey(data.document.doc_type, data.document.template_key) }, remote: true };
    } catch {
      // fallback below
    }
  }

  let docs = readLocal(docType);
  const existing = documentId && documentId !== 'new' ? docs.find(d => d.id === documentId) : undefined;
  if (existing) return { document: { ...existing, template_key: normalizeTemplateKey(existing.doc_type, existing.template_key) }, remote: false };

  // A new document exists only in memory until the learner explicitly saves it.
  const created = createLocalDocument(docType, templateKey || undefined);
  return { document: created, remote: false };
}

export async function saveCareerDocument(document: CareerDocumentFull): Promise<{ document: CareerDocumentFull; remote: boolean }> {
  const score = calculateBasicScore(document.doc_type, document.doc_data);
  const payload = {
    action: 'save',
    document_id: document.id.startsWith('local_') ? undefined : document.id,
    doc_type: document.doc_type,
    title: document.title || getDefaultDocTitle(document.doc_type),
    template_key: normalizeTemplateKey(document.doc_type, document.template_key || getDefaultTemplateKey(document.doc_type)),
    language: document.language || 'fr',
    doc_data: document.doc_data,
    design_options: document.design_options,
    target_job: document.target_job,
    application_type: document.application_type,
    ats_score: score,
    status: document.status || 'draft',
    is_primary: document.is_primary ?? true,
  };

  try {
    const data = await functionPost<{ document: { id: string; title: string; content_hash?: string } }>('career-studio-manage?action=save', payload);
    const saved: CareerDocumentFull = {
      ...document,
      id: data.document.id,
      template_key: normalizeTemplateKey(document.doc_type, document.template_key),
      ats_score: score,
      updated_at: nowIso(),
    };
    return { document: saved, remote: true };
  } catch {
    const docType = document.doc_type;
    const docs = readLocal(docType);
    const id = document.id || `local_${Date.now()}`;
    const saved: CareerDocumentFull = {
      ...document,
      id,
      template_key: normalizeTemplateKey(document.doc_type, document.template_key),
      ats_score: score,
      updated_at: nowIso(),
      created_at: document.created_at || nowIso(),
    };
    const next = [saved, ...docs.filter(d => d.id !== id)].map(d => ({ ...d, is_primary: d.id === id ? saved.is_primary : d.is_primary }));
    writeLocal(docType, next);
    return { document: saved, remote: false };
  }
}

export async function deleteCareerDocument(docType: CareerDocType, documentId: string) {
  try {
    if (!documentId.startsWith('local_')) {
      await functionPost('career-studio-manage?action=save', { action: 'delete', document_id: documentId });
      return;
    }
  } catch {
    // fallback local delete
  }
  writeLocal(docType, readLocal(docType).filter(d => d.id !== documentId));
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
    return localResult;
  }
}

export async function getCareerTokenHistory(): Promise<{ transactions: unknown[]; balance: number; remote: boolean }> {
  try {
    const data = await functionPost<{ transactions?: unknown[]; balance?: number }>('career-token-manage', { action: 'get_history' });
    return { transactions: data.transactions || [], balance: data.balance ?? 0, remote: true };
  } catch {
    return { transactions: [], balance: Number(localStorage.getItem('omnia_career_tokens') || 0), remote: false };
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
    result = JSON.stringify({
      lisibilite: 82,
      structure: 86,
      orthographe: 90,
      compatibilite_ats: 84,
      longueur: 78,
      mots_cles: 76,
      professionnalisme: 88,
      score_global: 84,
      conseils: ['Ajoutez plus de mots-clés métier.', 'Quantifiez vos résultats.', 'Gardez des intitulés de sections standards.', 'Évitez les paragraphes trop longs.', 'Adaptez le titre au poste ciblé.']
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
    return fallbackAiResult(payload);
  }
}
