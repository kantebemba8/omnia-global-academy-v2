type SentryModule = typeof import('@sentry/react');

const dsn = import.meta.env.VITE_SENTRY_DSN || '';
const sentryEnabled =
  import.meta.env.PROD &&
  dsn.startsWith('https://') &&
  !dsn.includes('[') &&
  !dsn.includes(']');

let modulePromise: Promise<SentryModule | null> | null = null;
let initializationPromise: Promise<void> | null = null;

const SENSITIVE_PATH_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\/assessment\/jury\/[^/?#]+/gi, '/assessment/jury/[masque]'],
  [/\/credentials\/clr\/[^/?#]+/gi, '/credentials/clr/[masque]'],
  [/\/credentials\/passports\/[^/?#]+/gi, '/credentials/passports/[masque]'],
  [/\/credentials\/pathways\/[^/?#]+/gi, '/credentials/pathways/[masque]'],
];

function sanitizeTelemetryUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;

  let sanitized = value.trim();

  try {
    const parsed = new URL(sanitized, window.location.origin);
    parsed.search = '';
    parsed.hash = '';
    sanitized = parsed.origin === window.location.origin
      ? parsed.pathname
      : `${parsed.origin}${parsed.pathname}`;
  } catch {
    sanitized = sanitized.split(/[?#]/, 1)[0];
  }

  for (const [pattern, replacement] of SENSITIVE_PATH_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
}

function sanitizeBreadcrumb<T extends { data?: Record<string, unknown> }>(breadcrumb: T): T {
  if (!breadcrumb.data) return breadcrumb;

  const data = { ...breadcrumb.data };
  for (const key of ['url', 'from', 'to']) {
    const sanitized = sanitizeTelemetryUrl(data[key]);
    if (sanitized) data[key] = sanitized;
  }

  return { ...breadcrumb, data };
}

function loadSentry(): Promise<SentryModule | null> {
  if (!sentryEnabled) return Promise.resolve(null);

  if (!modulePromise) {
    modulePromise = import('@sentry/react').catch((error) => {
      console.warn('Sentry n’a pas pu être chargé', error);
      return null;
    });
  }

  return modulePromise;
}

export function initSentry(): Promise<void> {
  if (!sentryEnabled) return Promise.resolve();
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    const Sentry = await loadSentry();
    if (!Sentry) return;

    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,

      // La bêta conserve uniquement le diagnostic d'erreurs. Les replays de
      // session et le suivi de performance automatique restent désactivés
      // jusqu'à l'intégration d'un consentement explicite.
      sendDefaultPii: false,
      tracesSampleRate: 0,

      beforeBreadcrumb(breadcrumb) {
        return sanitizeBreadcrumb(breadcrumb);
      },

      beforeSend(event) {
        if (event.request?.headers) {
          event.request.headers = {};
        }

        if (event.request?.url) {
          event.request.url = sanitizeTelemetryUrl(event.request.url);
        }

        if (event.transaction) {
          event.transaction = sanitizeTelemetryUrl(event.transaction) ?? event.transaction;
        }

        if (event.user) {
          event.user = event.user.id ? { id: event.user.id } : undefined;
        }

        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(sanitizeBreadcrumb);
        }

        return event;
      },
    });
  })();

  return initializationPromise;
}

async function withSentry(action: (Sentry: SentryModule) => void): Promise<void> {
  if (!sentryEnabled) return;

  await initSentry();
  const Sentry = await loadSentry();
  if (Sentry) action(Sentry);
}

export function setSentryUser(user: { id: string; email: string; roles: string[] }) {
  void withSentry((Sentry) => {
    Sentry.setUser({ id: user.id });
    Sentry.setTag('user_roles', user.roles.join(','));
  });
}

export function clearSentryUser() {
  void withSentry((Sentry) => {
    Sentry.setUser(null);
  });
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  void withSentry((Sentry) => {
    Sentry.captureException(error, { extra: context });
  });
}
