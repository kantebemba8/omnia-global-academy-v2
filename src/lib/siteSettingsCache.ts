import { ENDPOINTS } from './config';

export type PublicSiteSettings = Record<string, any>;

type CacheEntry = {
  data: PublicSiteSettings;
  fetchedAt: number;
};

const STORAGE_KEY = 'omnia_public_site_settings_v1';
const DEFAULT_MAX_AGE_MS = 45_000;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let memoryCache: CacheEntry | null = null;
let inFlight: Promise<PublicSiteSettings> | null = null;

function readSessionCache(): CacheEntry | null {
  if (memoryCache) return memoryCache;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed.fetchedAt !== 'number' || typeof parsed.data !== 'object') return null;
    memoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: PublicSiteSettings) {
  const entry: CacheEntry = { data, fetchedAt: Date.now() };
  memoryCache = entry;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Le cache mémoire suffit si le stockage de session est indisponible.
  }
}

export async function getPublicSiteSettings(options: { force?: boolean; maxAgeMs?: number } = {}) {
  const { force = false, maxAgeMs = DEFAULT_MAX_AGE_MS } = options;
  const cached = readSessionCache();

  if (!force && cached && Date.now() - cached.fetchedAt <= maxAgeMs) {
    return cached.data;
  }

  if (inFlight) return inFlight;

  inFlight = fetch(ENDPOINTS.siteSettings, {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
  })
    .then(async response => {
      if (!response.ok) throw new Error(`site-settings-public: ${response.status}`);
      const data = await response.json();
      const normalized = data && typeof data === 'object' ? data : {};
      writeCache(normalized);
      return normalized;
    })
    .catch(error => {
      // En cas de coupure momentanée, une valeur publique déjà chargée reste préférable
      // à plusieurs écrans vides ou à des requêtes répétées.
      if (cached) return cached.data;
      throw error;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function invalidatePublicSiteSettingsCache() {
  memoryCache = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Aucun traitement nécessaire.
  }
}
