import { isTrustedOmniaUrl, OMNIA_WEB_ORIGIN } from './platform';

const SAFE_PATH = /^\/[a-zA-Z0-9À-ÿ._~!$&'()*+,;=:@%/-]*(?:\?[^#]*)?(?:#.*)?$/;

export function routeFromOmniaUrl(rawUrl: string): string | null {
  const value = String(rawUrl || '').trim();
  if (!value) return null;

  try {
    const url = new URL(value, OMNIA_WEB_ORIGIN);

    if (url.protocol === 'omnia:') {
      const hostPart = url.host ? `/${url.host}` : '';
      const pathname = `${hostPart}${url.pathname}`.replace(/\/{2,}/g, '/');
      const route = `${pathname || '/accueil'}${url.search}${url.hash}`;
      return SAFE_PATH.test(route) ? route : null;
    }

    if (!isTrustedOmniaUrl(url.href)) return null;
    const route = `${url.pathname || '/accueil'}${url.search}${url.hash}`;
    return SAFE_PATH.test(route) ? route : null;
  } catch {
    return null;
  }
}

export function routeFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const source = data as Record<string, unknown>;
  for (const key of ['action_url', 'actionUrl', 'route', 'path', 'link', 'url']) {
    const value = source[key];
    if (typeof value === 'string') {
      const route = routeFromOmniaUrl(value);
      if (route) return route;
    }
  }
  return null;
}

export function navigateInsideOmnia(pathOrUrl: string): boolean {
  const path = routeFromOmniaUrl(pathOrUrl);
  if (!path) return false;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === path) return true;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  return true;
}
