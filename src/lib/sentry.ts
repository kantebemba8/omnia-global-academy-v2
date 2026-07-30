type SentryModule = typeof import('@sentry/react');

const dsn = import.meta.env.VITE_SENTRY_DSN || '';
const sentryEnabled =
  import.meta.env.PROD &&
  dsn.startsWith('https://') &&
  !dsn.includes('[') &&
  !dsn.includes(']');

let modulePromise: Promise<SentryModule | null> | null = null;
let initializationPromise: Promise<void> | null = null;

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
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: false,
        }),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers['Authorization'];
          delete event.request.headers['authorization'];
          delete event.request.headers['api-key'];
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
    Sentry.setUser({ id: user.id, email: user.email });
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
