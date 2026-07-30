import * as Sentry from '@sentry/react';

export function initSentry() {
  if (!import.meta.env.PROD) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || dsn.includes('[') || dsn.includes(']') || !dsn.startsWith('https://')) {
    console.warn('Sentry DSN invalide ou absent');
    return;
  }

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
}

export function setSentryUser(user: { id: string; email: string; roles: string[] }) {
  Sentry.setUser({ id: user.id, email: user.email });
  Sentry.setTag('user_roles', user.roles.join(','));
}

export function clearSentryUser() {
  Sentry.setUser(null);
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}

export { Sentry };
