import {
  CareerDocType,
  CareerDocumentFull,
  CareerDocumentSummary,
  createDefaultData,
  createDefaultDesign,
  getDefaultDocTitle,
  getDefaultTemplateKey,
  getCareerTemplates,
  calculateBasicScore,
} from './careerStudioData';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
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
    template_key: templateKey || getDefaultTemplateKey(docType),
    language: 'fr',
    status: 'draft',
    ats_score: calculateBasicScore(docType, data),
    target_job: docType === 'cv' ? 'Développeur Full Stack' : 'Développeur Full Stack',
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken()}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await safeJson<T & { error?: string; message?: string }>(res);
  if (!res.ok || (data as { error?: string }).error) {
    throw new Error((data as { message?: string; error?: string }).message || (data as { error?: string }).error || 'SERVER_ERROR');
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
    }>('career-studio-list', { doc_type: docType });

    return {
      documents: data.documents || [],
      templates: data.templates?.length ? data.templates : getCareerTemplates(docType),
      tokens: data.user?.cv_tokens ?? 0,
      remote: true,
    };
  } catch {
    let docs = readLocal(docType);
    if (!docs.length) {
      const created = createLocalDocument(docType);
      docs = [created];
      writeLocal(docType, docs);
    }
    return {
      documents: docs.map(({ doc_data, design_options, ...summary }) => summary),
      templates: getCareerTemplates(docType),
      tokens: 1,
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
      const data = await functionPost<{ document: CareerDocumentFull }>('career-studio-save', {
        action: 'get',
        document_id: documentId,
      });
      return { document: data.document, remote: true };
    } catch {
      // fallback below
    }
  }

  let docs = readLocal(docType);
  const existing = documentId && documentId !== 'new' ? docs.find(d => d.id === documentId) : docs.find(d => d.is_primary);
  if (existing) return { document: existing, remote: false };

  const created = createLocalDocument(docType, templateKey || undefined);
  docs = [created, ...docs.map(d => ({ ...d, is_primary: false }))];
  writeLocal(docType, docs);
  return { document: created, remote: false };
}

export async function saveCareerDocument(document: CareerDocumentFull): Promise<{ document: CareerDocumentFull; remote: boolean }> {
  const score = calculateBasicScore(document.doc_type, document.doc_data);
  const payload = {
    action: 'save',
    document_id: document.id.startsWith('local_') ? undefined : document.id,
    doc_type: document.doc_type,
    title: document.title || getDefaultDocTitle(document.doc_type),
    template_key: document.template_key || getDefaultTemplateKey(document.doc_type),
    language: document.language || 'fr',
    doc_data: document.doc_data,
    design_options: document.design_options,
    target_job: document.target_job,
    application_type: document.application_type,
    ats_score: score,
    is_primary: document.is_primary ?? true,
  };

  try {
    const data = await functionPost<{ document: { id: string; title: string; content_hash?: string } }>('career-studio-save', payload);
    const saved: CareerDocumentFull = {
      ...document,
      id: data.document.id,
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
      await functionPost('career-studio-save', { action: 'delete', document_id: documentId });
      return;
    }
  } catch {
    // fallback local delete
  }
  writeLocal(docType, readLocal(docType).filter(d => d.id !== documentId));
}
