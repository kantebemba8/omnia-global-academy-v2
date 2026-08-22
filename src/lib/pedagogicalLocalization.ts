export type PedagogicalAmountNature = 'real' | 'pedagogical';

export type PedagogicalAmount = {
  key: string;
  nature: PedagogicalAmountNature;
  reference_value: number;
  reference_currency: string;
  localize?: boolean;
  variants?: Record<string, number>;
};

export type PedagogicalLocalizationSettings = {
  amounts?: PedagogicalAmount[];
};

export function amountMarker(key: string) {
  return `{{oga_amount:${String(key || '').trim()}}}`;
}

export function getPedagogicalLocalization(settings: Record<string, any> | undefined | null): PedagogicalLocalizationSettings {
  const raw = settings?.pedagogical_localization;
  return raw && typeof raw === 'object' ? raw : {};
}

export function localizedCurrencies(settings: Record<string, any> | undefined | null): string[] {
  const loc = getPedagogicalLocalization(settings);
  const set = new Set<string>();
  for (const amount of loc.amounts || []) {
    const reference = String(amount?.reference_currency || '').toUpperCase();
    if (reference) set.add(reference);
    for (const code of Object.keys(amount?.variants || {})) {
      if (/^[A-Z]{3}$/.test(code.toUpperCase())) set.add(code.toUpperCase());
    }
  }
  return [...set];
}

export function formatPedagogicalMoney(value: number, currency: string, locale = 'fr-FR') {
  const code = String(currency || '').toUpperCase();
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: ['XOF','XAF','GNF','RWF','UGX'].includes(code) ? 0 : 2,
    }).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toLocaleString(locale)} ${code}`;
  }
}

export function resolvePedagogicalAmount(
  amount: PedagogicalAmount,
  currency?: string | null,
  locale = 'fr-FR',
) {
  const referenceCurrency = String(amount.reference_currency || '').toUpperCase();
  const selectedCurrency = String(currency || '').toUpperCase();
  if (amount.nature !== 'pedagogical' || amount.localize !== true) {
    return formatPedagogicalMoney(Number(amount.reference_value || 0), referenceCurrency, locale);
  }
  const variant = selectedCurrency && amount.variants && amount.variants[selectedCurrency];
  if (variant !== undefined && variant !== null && Number.isFinite(Number(variant))) {
    return formatPedagogicalMoney(Number(variant), selectedCurrency, locale);
  }
  return formatPedagogicalMoney(Number(amount.reference_value || 0), referenceCurrency, locale);
}

export function localizePedagogicalString(
  value: string,
  settings: Record<string, any> | undefined | null,
  currency?: string | null,
  locale = 'fr-FR',
) {
  const loc = getPedagogicalLocalization(settings);
  if (!Array.isArray(loc.amounts) || !loc.amounts.length || !String(value || '').includes('{{oga_amount:')) {
    return String(value ?? '');
  }
  const byKey = new Map((loc.amounts || []).map(item => [String(item?.key || ''), item] as const));
  return String(value ?? '').replace(/\{\{oga_amount:([A-Za-z0-9_-]+)\}\}/g, (full, key) => {
    const amount = byKey.get(String(key));
    return amount ? resolvePedagogicalAmount(amount, currency, locale) : full;
  });
}

export function applyPedagogicalLocalization(
  value: any,
  settings: Record<string, any> | undefined | null,
  currency?: string | null,
  locale = 'fr-FR',
): any {
  if (typeof value === 'string') return localizePedagogicalString(value, settings, currency, locale);
  if (Array.isArray(value)) return value.map(item => applyPedagogicalLocalization(item, settings, currency, locale));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, applyPedagogicalLocalization(nested, settings, currency, locale)]),
    );
  }
  return value;
}
