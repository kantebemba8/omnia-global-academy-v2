import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { getOmniaPlatform, isNativeApp, isTrustedOmniaUrl, OMNIA_WEB_ORIGIN, openExternalUrl } from './platform';

let initialized = false;

function nativeRouteFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);

    if (url.protocol === 'omnia:') {
      const hostPart = url.host ? `/${url.host}` : '';
      const pathname = `${hostPart}${url.pathname}`.replace(/\/{2,}/g, '/');
      return `${pathname || '/accueil'}${url.search}${url.hash}`;
    }

    if (!isTrustedOmniaUrl(rawUrl)) return null;
    return `${url.pathname || '/accueil'}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function navigateInsideApp(path: string): void {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function installExternalLinkInterceptor(): void {
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (anchor.hasAttribute('download')) return;

    const rawHref = anchor.getAttribute('href')?.trim();
    if (!rawHref || !/^https?:\/\//i.test(rawHref)) return;

    const url = new URL(rawHref, OMNIA_WEB_ORIGIN);
    event.preventDefault();

    if (isTrustedOmniaUrl(url.href)) {
      navigateInsideApp(`${url.pathname || '/accueil'}${url.search}${url.hash}`);
      return;
    }

    void openExternalUrl(url.href);
  });
}

export async function initializeNativeRuntime(): Promise<void> {
  if (initialized || !isNativeApp()) return;
  initialized = true;

  const platform = getOmniaPlatform();
  document.documentElement.classList.add('oga-native', `oga-${platform}`);
  document.body.classList.add('oga-native-body');

  installExternalLinkInterceptor();

  await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Dark }),
    StatusBar.show(),
  ]);

  await Keyboard.addListener('keyboardWillShow', info => {
    document.documentElement.classList.add('oga-keyboard-open');
    document.documentElement.style.setProperty('--oga-keyboard-height', `${info.keyboardHeight}px`);
  });

  await Keyboard.addListener('keyboardWillHide', () => {
    document.documentElement.classList.remove('oga-keyboard-open');
    document.documentElement.style.setProperty('--oga-keyboard-height', '0px');
  });

  await App.addListener('appUrlOpen', ({ url }) => {
    const path = nativeRouteFromUrl(url);
    if (path) navigateInsideApp(path);
  });

  await App.addListener('backButton', async ({ canGoBack }) => {
    const backEvent = new CustomEvent('omnia:native-back', { cancelable: true });
    if (!window.dispatchEvent(backEvent)) return;

    const rootPaths = new Set([
      '/accueil',
      '/dashboard',
      '/professeur/dashboard',
      '/structure/dashboard',
      '/structure/recrutement/dashboard',
      '/admin/dashboard',
      '/moderateur/dashboard',
      '/coach/dashboard',
      '/omnia-live/organisateur',
      '/talent/recruteur/dashboard',
    ]);

    if (canGoBack && !rootPaths.has(window.location.pathname)) {
      window.history.back();
      return;
    }

    await App.minimizeApp();
  });

  await App.addListener('appStateChange', ({ isActive }) => {
    window.dispatchEvent(new CustomEvent('omnia:app-state', { detail: { isActive } }));
  });

  const launch = await App.getLaunchUrl();
  const launchPath = launch?.url ? nativeRouteFromUrl(launch.url) : null;
  if (launchPath) navigateInsideApp(launchPath);

  await SplashScreen.hide();
}
