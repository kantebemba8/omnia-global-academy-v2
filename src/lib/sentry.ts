import { Capacitor } from '@capacitor/core';

type SentryModule = typeof import('@sentry/react');
type SentryRuntime = {
  module: SentryModule;
  initialize: (options: any) => Promise<void>;
  runtimeTag: string;
};

const dsn = import.meta.env.VITE_SENTRY_DSN || '';
const sentryEnabled =
  import.meta.env.PROD &&
  dsn.startsWith('https://') &&
  !dsn.includes('[') &&
  !dsn.includes(']');

let runtimePromise: Promise<SentryRuntime | null> | null = null;
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

async function loadSentryRuntime(): Promise<SentryRuntime | null> {
  if (!sentryEnabled) return null;

  if (!runtimePromise) {
    runtimePromise = (async () => {
      const ReactSentry = await import('@sentry/react');

      if (Capacitor.isNativePlatform()) {
        const CapacitorSentry = await import('@sentry/capacitor');
        return {
          // @sentry/capacitor réexporte les APIs de scope/capture compatibles
          // avec le SDK JavaScript frère. Le cast reste local à ce pont runtime.
          module: CapacitorSentry as unknown as SentryModule,
          initialize: async (options: Parameters<typeof ReactSentry.init>[0]) => {
            await CapacitorSentry.init(options, ReactSentry.init);
          },
          runtimeTag: `capacitor-native:${Capacitor.getPlatform()}`,
        };
      }

      return {
        module: ReactSentry,
        initialize: async (options: Parameters<typeof ReactSentry.init>[0]) => {
          ReactSentry.init(options);
        },
        runtimeTag: 'web',
      };
    })().catch((error) => {
      console.warn('Sentry n’a pas pu être chargé', error);
      return null;
    });
  }

  return runtimePromise;
}

export function initSentry(): Promise<void> {
  if (!sentryEnabled) return Promise.resolve();
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    const runtime = await loadSentryRuntime();
    if (!runtime) return;

    const release = import.meta.env.VITE_APP_RELEASE || import.meta.env.VITE_GIT_SHA || undefined;
    const dist = import.meta.env.VITE_APP_BUILD || undefined;

    await runtime.initialize({
      dsn,
      environment: import.meta.env.MODE,
      release,
      dist,

      // Diagnostic d’erreurs uniquement : aucune PII par défaut, aucun replay,
      // aucun profiling et aucune collecte automatique de performance.
      sendDefaultPii: false,
      tracesSampleRate: 0,

      beforeBreadcrumb(breadcrumb: any) {
        return sanitizeBreadcrumb(breadcrumb);
      },

      beforeSend(event: any) {
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

    runtime.module.setTag('runtime', runtime.runtimeTag);
    runtime.module.setTag('capacitor_platform', Capacitor.getPlatform());
  })();

  return initializationPromise;
}

async function withSentry(action: (Sentry: SentryModule) => void): Promise<void> {
  if (!sentryEnabled) return;

  await initSentry();
  const runtime = await loadSentryRuntime();
  if (runtime) action(runtime.module);
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
