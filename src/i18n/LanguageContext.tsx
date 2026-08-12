import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getPreferredLanguage, persistPreferredLanguage, translateUiBatch, type UiLanguage } from '../lib/i18nApi';
import { STATIC_TRANSLATIONS, type StaticCatalogLanguage } from './staticCatalog';

export type PlatformLanguage = UiLanguage;

export const PLATFORM_LANGUAGES: ReadonlyArray<{
  code: PlatformLanguage;
  shortLabel: string;
  label: string;
  locale: string;
  direction: 'ltr' | 'rtl';
}> = [
  { code: 'fr', shortLabel: 'FR', label: 'Français', locale: 'fr-FR', direction: 'ltr' },
  { code: 'en', shortLabel: 'EN', label: 'English', locale: 'en-GB', direction: 'ltr' },
  { code: 'es', shortLabel: 'ES', label: 'Español', locale: 'es-ES', direction: 'ltr' },
  { code: 'pt', shortLabel: 'PT', label: 'Português', locale: 'pt-PT', direction: 'ltr' },
  { code: 'ar', shortLabel: 'AR', label: 'العربية', locale: 'ar', direction: 'rtl' },
  { code: 'zh', shortLabel: 'ZH', label: '中文', locale: 'zh-CN', direction: 'ltr' },
  { code: 'ru', shortLabel: 'RU', label: 'Русский', locale: 'ru-RU', direction: 'ltr' },
  { code: 'de', shortLabel: 'DE', label: 'Deutsch', locale: 'de-DE', direction: 'ltr' },
];

type LanguageContextValue = {
  language: PlatformLanguage;
  locale: string;
  direction: 'ltr' | 'rtl';
  setLanguage: (language: PlatformLanguage) => void;
  toggleLanguage: () => void;
  t: (french: string, english?: string) => string;
  translate: (source: string) => string;
  isTranslating: boolean;
  translationError: string | null;
  retryTranslation: () => void;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
};

const STORAGE_KEY = 'omnia_platform_language';
const CATALOG_STORAGE_PREFIX = 'omnia_i18n_runtime_catalog_v3_';
const CATALOG_MAX_ENTRIES = 3500;
const BATCH_SIZE = 25;
const MAX_SOURCE_LENGTH = 500;
const LANGUAGE_CODES = new Set<PlatformLanguage>(PLATFORM_LANGUAGES.map(item => item.code));
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'aria-description', 'alt'] as const;
const PROTECTED_ELEMENTS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA']);

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isPlatformLanguage(value: string | null | undefined): value is PlatformLanguage {
  return Boolean(value && LANGUAGE_CODES.has(value as PlatformLanguage));
}

function getLanguageDefinition(language: PlatformLanguage) {
  return PLATFORM_LANGUAGES.find(item => item.code === language) || PLATFORM_LANGUAGES[0];
}

function readStoredLanguage(): PlatformLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isPlatformLanguage(stored)) return stored;
    const rawUser = localStorage.getItem('omnia_user');
    if (rawUser) {
      const preferred = (JSON.parse(rawUser) as { preferred_language?: string }).preferred_language;
      if (isPlatformLanguage(preferred)) return preferred;
    }
  } catch {
    // Le français reste le repli sûr si le stockage est indisponible.
  }
  // La plateforme est française par défaut. La langue du navigateur ne doit jamais
  // sélectionner automatiquement une traduction (ex. navigateur configuré en espagnol).
  // Une autre langue n'est utilisée que si l'utilisateur l'a réellement enregistrée.
  return 'fr';
}

function readRuntimeCatalog(language: PlatformLanguage): Record<string, string> {
  if (language === 'fr') return {};
  try {
    const raw = localStorage.getItem(`${CATALOG_STORAGE_PREFIX}${language}`);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([source, translated]) => typeof source === 'string' && typeof translated === 'string' && source && translated)
        .slice(-CATALOG_MAX_ENTRIES),
    );
  } catch {
    return {};
  }
}

function writeRuntimeCatalog(language: PlatformLanguage, catalog: Record<string, string>) {
  if (language === 'fr') return;
  try {
    const entries = Object.entries(catalog).slice(-CATALOG_MAX_ENTRIES);
    localStorage.setItem(`${CATALOG_STORAGE_PREFIX}${language}`, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Le cache mémoire continue de fonctionner si le quota local est atteint.
  }
}

function normalizeSource(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/[\t\r\n ]+/g, ' ').trim();
}

function looksLikePrivateOrDynamicValue(value: string) {
  if (/https?:\/\/|mailto:|tel:/i.test(value)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true;
  if (/^[+\d][\d\s()./-]{7,}$/.test(value)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value)) return true;
  if (/^[A-Za-z0-9_-]{24,}$/.test(value)) return true;
  return false;
}

function shouldTranslateSource(value: string) {
  const source = normalizeSource(value);
  if (source.length < 2 || source.length > MAX_SOURCE_LENGTH) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(source)) return false;
  if (looksLikePrivateOrDynamicValue(source)) return false;
  if (/^(Omnia|OGA|CPD|QR|PDF|DOCX|XLSX|CSV|SCORM|API|URL|IA|AI)$/i.test(source)) return false;
  if (/[{}<>]|=>|className=|data-testid=|@context/i.test(source)) return false;
  return true;
}

function preserveOuterWhitespace(original: string, translated: string) {
  const start = original.match(/^\s*/)?.[0] || '';
  const end = original.match(/\s*$/)?.[0] || '';
  return `${start}${translated}${end}`;
}

function staticTranslation(language: PlatformLanguage, source: string) {
  if (language === 'fr') return source;
  return STATIC_TRANSLATIONS[language as StaticCatalogLanguage]?.[source];
}

function translatedValue(
  original: string,
  language: PlatformLanguage,
  runtimeCatalog: Record<string, string>,
  englishOverride?: string,
) {
  if (language === 'fr') return original;
  const source = normalizeSource(original);
  if (!source) return original;
  if (language === 'en' && englishOverride) return preserveOuterWhitespace(original, englishOverride);
  const translated = runtimeCatalog[source] || staticTranslation(language, source);
  return translated ? preserveOuterWhitespace(original, translated) : original;
}

function isRenderedTranslation(
  original: string,
  current: string,
  runtimeCatalogs: Partial<Record<PlatformLanguage, Record<string, string>>>,
) {
  if (current === original) return true;
  const normalizedOriginal = normalizeSource(original);
  const normalizedCurrent = normalizeSource(current);
  return PLATFORM_LANGUAGES.some(({ code }) => {
    if (code === 'fr') return normalizedOriginal === normalizedCurrent;
    const candidate = runtimeCatalogs[code]?.[normalizedOriginal] || staticTranslation(code, normalizedOriginal);
    return candidate === normalizedCurrent;
  });
}

function elementIsProtected(element: Element | null) {
  if (!element) return false;
  if (PROTECTED_ELEMENTS.has(element.tagName)) return true;
  if (element.closest('[data-no-auto-translate="true"]')) return true;
  if (element.closest('[contenteditable="true"]')) return true;
  return false;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<PlatformLanguage>(readStoredLanguage);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const languageRef = useRef(language);
  const runtimeCatalogs = useRef<Partial<Record<PlatformLanguage, Record<string, string>>>>({
    [language]: readRuntimeCatalog(language),
  });
  const originals = useRef(new WeakMap<Node, string>());
  const attributeOriginals = useRef(new WeakMap<Element, Map<string, string>>());
  const queued = useRef(new Set<string>());
  const requestedAt = useRef(new Map<string, number>());
  const flushTimer = useRef<number | null>(null);
  const runBatchRef = useRef<() => Promise<void>>(async () => undefined);

  languageRef.current = language;

  const ensureCatalog = useCallback((code: PlatformLanguage) => {
    if (!runtimeCatalogs.current[code]) runtimeCatalogs.current[code] = readRuntimeCatalog(code);
    return runtimeCatalogs.current[code] || {};
  }, []);

  const mergeRuntimeTranslations = useCallback((code: PlatformLanguage, values: Record<string, string>) => {
    if (code === 'fr' || Object.keys(values).length === 0) return;
    const current = ensureCatalog(code);
    const next = { ...current, ...values };
    runtimeCatalogs.current[code] = next;
    writeRuntimeCatalog(code, next);
    setCatalogVersion(value => value + 1);
  }, [ensureCatalog]);

  const scheduleBatch = useCallback(() => {
    if (flushTimer.current != null) return;
    flushTimer.current = window.setTimeout(() => {
      flushTimer.current = null;
      void runBatchRef.current();
    }, 140);
  }, []);

  const queueMissing = useCallback((value: string) => {
    const currentLanguage = languageRef.current;
    if (currentLanguage === 'fr') return;
    const source = normalizeSource(value);
    if (!shouldTranslateSource(source)) return;
    const catalog = ensureCatalog(currentLanguage);
    if (catalog[source] || staticTranslation(currentLanguage, source)) return;
    const lastRequest = requestedAt.current.get(`${currentLanguage}:${source}`) || 0;
    if (Date.now() - lastRequest < 30_000) return;
    queued.current.add(source);
    scheduleBatch();
  }, [ensureCatalog, scheduleBatch]);

  const runBatch = useCallback(async () => {
    const currentLanguage = languageRef.current;
    if (currentLanguage === 'fr' || queued.current.size === 0) return;
    const batch = [...queued.current].slice(0, BATCH_SIZE);
    batch.forEach(source => {
      queued.current.delete(source);
      requestedAt.current.set(`${currentLanguage}:${source}`, Date.now());
    });
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const result = await translateUiBatch(currentLanguage, batch);
      if (languageRef.current === currentLanguage) mergeRuntimeTranslations(currentLanguage, result.translations || {});
      if (result.missing?.length) {
        result.missing.forEach(source => requestedAt.current.set(`${currentLanguage}:${source}`, Date.now() + 120_000));
      }
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : 'TRANSLATION_UNAVAILABLE');
      batch.forEach(source => requestedAt.current.set(`${currentLanguage}:${source}`, Date.now() + 15_000));
    } finally {
      setIsTranslating(false);
      if (queued.current.size > 0) scheduleBatch();
    }
  }, [mergeRuntimeTranslations, scheduleBatch]);
  runBatchRef.current = runBatch;

  const setLanguage = useCallback((next: PlatformLanguage) => {
    if (!isPlatformLanguage(next)) return;
    localStorage.setItem(STORAGE_KEY, next);
    ensureCatalog(next);
    queued.current.clear();
    requestedAt.current.clear();
    setTranslationError(null);
    setLanguageState(next);
    window.dispatchEvent(new CustomEvent('omnia:language-changed', { detail: { language: next } }));
    void persistPreferredLanguage(next).catch(() => undefined);
  }, [ensureCatalog]);

  const toggleLanguage = useCallback(() => {
    setLanguage(languageRef.current === 'fr' ? 'en' : 'fr');
  }, [setLanguage]);

  const translate = useCallback((source: string) => {
    const currentLanguage = languageRef.current;
    const catalog = ensureCatalog(currentLanguage);
    const result = translatedValue(source, currentLanguage, catalog);
    if (result === source) queueMissing(source);
    return result;
  }, [ensureCatalog, queueMissing]);

  const t = useCallback((french: string, english?: string) => {
    const currentLanguage = languageRef.current;
    const catalog = ensureCatalog(currentLanguage);
    const result = translatedValue(french, currentLanguage, catalog, english);
    if (result === french && currentLanguage !== 'fr') queueMissing(french);
    return result;
  }, [ensureCatalog, queueMissing]);

  const retryTranslation = useCallback(() => {
    requestedAt.current.clear();
    setTranslationError(null);
    const root = document.getElementById('root');
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      if (!elementIsProtected(node.parentElement)) queueMissing(originals.current.get(node) || node.textContent || '');
      node = walker.nextNode();
    }
    scheduleBatch();
  }, [queueMissing, scheduleBatch]);

  useEffect(() => {
    const definition = getLanguageDefinition(language);
    document.documentElement.lang = definition.locale;
    document.documentElement.dir = definition.direction;
    document.body.dataset.omniaLanguage = language;

    const applyNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (elementIsProtected(parent)) return;
        const current = node.textContent || '';
        const knownOriginal = originals.current.get(node);
        if (!knownOriginal || !isRenderedTranslation(knownOriginal, current, runtimeCatalogs.current)) {
          originals.current.set(node, current);
        }
        const original = originals.current.get(node) || current;
        const catalog = ensureCatalog(language);
        const next = translatedValue(original, language, catalog);
        if (next === original && language !== 'fr') queueMissing(original);
        if (current !== next) node.textContent = next;
        return;
      }

      if (!(node instanceof Element) || elementIsProtected(node)) return;
      let stored = attributeOriginals.current.get(node);
      if (!stored) {
        stored = new Map<string, string>();
        attributeOriginals.current.set(node, stored);
      }
      for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        const current = node.getAttribute(attribute);
        if (current == null) continue;
        const knownOriginal = stored.get(attribute);
        if (!knownOriginal || !isRenderedTranslation(knownOriginal, current, runtimeCatalogs.current)) {
          stored.set(attribute, current);
        }
        const original = stored.get(attribute) || current;
        const catalog = ensureCatalog(language);
        const next = translatedValue(original, language, catalog);
        if (next === original && language !== 'fr') queueMissing(original);
        if (current !== next) node.setAttribute(attribute, next);
      }
      if (node instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(node.type)) {
        const current = node.value;
        const key = 'value';
        const knownOriginal = stored.get(key);
        if (!knownOriginal || !isRenderedTranslation(knownOriginal, current, runtimeCatalogs.current)) stored.set(key, current);
        const original = stored.get(key) || current;
        const next = translatedValue(original, language, ensureCatalog(language));
        if (next === original && language !== 'fr') queueMissing(original);
        if (current !== next) node.value = next;
      }
      Array.from(node.childNodes).forEach(applyNode);
    };

    const root = document.getElementById('root');
    if (!root) return;
    applyNode(root);

    const observer = new MutationObserver(mutations => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') applyNode(mutation.target);
        if (mutation.type === 'attributes') applyNode(mutation.target);
        Array.from(mutation.addedNodes).forEach(applyNode);
      }
      observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
      });
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });
    return () => observer.disconnect();
  }, [catalogVersion, ensureCatalog, language, queueMissing]);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    let active = true;
    void getPreferredLanguage().then(preferred => {
      if (!active || !preferred || preferred === languageRef.current) return;
      localStorage.setItem(STORAGE_KEY, preferred);
      ensureCatalog(preferred);
      setLanguageState(preferred);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [ensureCatalog]);

  useEffect(() => () => {
    if (flushTimer.current != null) window.clearTimeout(flushTimer.current);
  }, []);

  const definition = getLanguageDefinition(language);
  const value = useMemo<LanguageContextValue>(() => ({
    language,
    locale: definition.locale,
    direction: definition.direction,
    setLanguage,
    toggleLanguage,
    t,
    translate,
    isTranslating,
    translationError,
    retryTranslation,
    formatNumber: (number, options) => new Intl.NumberFormat(definition.locale, options).format(number),
    formatDate: (date, options) => new Intl.DateTimeFormat(definition.locale, options).format(new Date(date)),
  }), [definition.direction, definition.locale, isTranslating, language, retryTranslation, setLanguage, t, toggleLanguage, translate, translationError]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
      {language !== 'fr' && (isTranslating || translationError) && (
        <div
          className="fixed bottom-3 left-1/2 z-[10000] -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur"
          role="status"
          aria-live="polite"
        >
          {isTranslating ? t('Traduction de l’interface…') : (
            <button type="button" onClick={retryTranslation} className="font-semibold text-amber-800">
              {t('Traduction temporairement indisponible')} · {t('Réessayer la traduction')}
            </button>
          )}
        </div>
      )}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
