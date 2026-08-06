import { ENDPOINTS } from './config';
import { edgeAuthHeaders } from './edgeAuth';

export type UiLanguage = 'fr' | 'en' | 'es' | 'pt' | 'ar' | 'zh' | 'ru' | 'de';

export type UiTranslationBatchResult = {
  success: boolean;
  language: UiLanguage;
  translations: Record<string, string>;
  missing?: string[];
  generated?: number;
  cached?: number;
  error?: string;
};

export type TranslationCoverage = {
  translated: number;
  reviewed: number;
  percentage: number;
};

export type TranslationOverview = {
  total: number;
  languages: Record<Exclude<UiLanguage, 'fr'>, TranslationCoverage>;
  ai_enabled: boolean;
  updated_at?: string | null;
};

export type TranslationRow = {
  source_hash: string;
  source_text: string;
  translation: string | null;
  reviewed: boolean;
  machine_generated: boolean;
  hit_count: number;
  updated_at: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || payload.error) {
    const error = new Error(String(payload.message || payload.error || `HTTP_${response.status}`));
    (error as Error & { code?: string }).code = String(payload.error || 'REQUEST_FAILED');
    throw error;
  }
  return payload as T;
}

export async function translateUiBatch(language: UiLanguage, texts: string[]): Promise<UiTranslationBatchResult> {
  const normalized = [...new Set(texts.map(value => value.trim()).filter(Boolean))].slice(0, 25);
  if (language === 'fr' || normalized.length === 0) {
    return { success: true, language, translations: Object.fromEntries(normalized.map(value => [value, value])) };
  }

  const response = await fetch(ENDPOINTS.siteSettings, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action: 'translate_ui_batch', language, texts: normalized }),
  });
  return parseJson<UiTranslationBatchResult>(response);
}

async function adminTranslationRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(ENDPOINTS.adminCmsUpdate, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  return parseJson<T>(response);
}

export function getTranslationOverview(): Promise<{ success: true; overview: TranslationOverview }> {
  return adminTranslationRequest('translation_overview');
}

export function listTranslations(payload: {
  language: Exclude<UiLanguage, 'fr'>;
  query?: string;
  status?: 'all' | 'missing' | 'reviewed' | 'automatic';
  page?: number;
  page_size?: number;
}): Promise<{ success: true; rows: TranslationRow[]; total: number; page: number; page_size: number }> {
  return adminTranslationRequest('translation_list', payload);
}

export function saveTranslation(payload: {
  source_hash: string;
  language: Exclude<UiLanguage, 'fr'>;
  translation: string;
}): Promise<{ success: true; row: TranslationRow }> {
  return adminTranslationRequest('translation_save', payload);
}

export function generateTranslationBatch(payload: {
  language: Exclude<UiLanguage, 'fr'>;
  limit?: number;
}): Promise<{ success: true; generated: number; remaining: number }> {
  return adminTranslationRequest('translation_generate_missing', payload);
}

export async function persistPreferredLanguage(language: UiLanguage): Promise<void> {
  const response = await fetch(ENDPOINTS.authUpdateProfile, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action: 'set_preferred_language', language }),
  });
  if (response.status === 401) return;
  await parseJson(response);
}
export async function getPreferredLanguage(): Promise<UiLanguage | null> {
  const response = await fetch(ENDPOINTS.authUpdateProfile, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action: 'get_profile' }),
  });
  if (response.status === 401) return null;
  const payload = await parseJson<{ profile?: { preferred_language?: string } }>(response);
  const language = payload.profile?.preferred_language;
  return ['fr', 'en', 'es', 'pt', 'ar', 'zh', 'ru', 'de'].includes(String(language))
    ? language as UiLanguage
    : null;
}
