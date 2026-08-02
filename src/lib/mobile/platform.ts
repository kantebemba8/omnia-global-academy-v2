import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export type OmniaPlatform = 'web' | 'android' | 'ios';

export const OMNIA_WEB_ORIGIN = 'https://omniaglobalacademy.com';

export function getOmniaPlatform(): OmniaPlatform {
  const platform = Capacitor.getPlatform();
  if (platform === 'android' || platform === 'ios') return platform;
  return 'web';
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function isAndroidApp(): boolean {
  return getOmniaPlatform() === 'android';
}

export function isIosApp(): boolean {
  return getOmniaPlatform() === 'ios';
}

export function isTrustedOmniaUrl(value: string): boolean {
  try {
    const url = new URL(value, OMNIA_WEB_ORIGIN);
    return url.origin === OMNIA_WEB_ORIGIN || url.origin === 'https://www.omniaglobalacademy.com';
  } catch {
    return false;
  }
}

export function openInternalPreviewUrl(url: string): void {
  if (!url) return;

  if (isNativeApp()) {
    const parsed = new URL(url, OMNIA_WEB_ORIGIN);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;

  if (isNativeApp() && /^https?:\/\//i.test(url)) {
    await Browser.open({
      url,
      toolbarColor: '#002050',
      presentationStyle: 'fullscreen',
    });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

export class NativePaymentUnavailableError extends Error {
  constructor() {
    super(
      "Les achats dans l’application mobile seront disponibles après l’intégration de la facturation Google Play et Apple. Aucun paiement n’a été lancé.",
    );
    this.name = 'NativePaymentUnavailableError';
  }
}

export function assertNativePaymentAvailable(): void {
  if (isNativeApp()) throw new NativePaymentUnavailableError();
}

export function redirectToWebPayment(url: string): void {
  assertNativePaymentAvailable();
  window.location.assign(url);
}
