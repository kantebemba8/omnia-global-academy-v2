import { isNativeApp } from '../lib/mobile';
import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' | string }>;
};

const DISMISS_KEY = 'omnia_pwa_install_dismissed';

export function PwaInstallBanner() {
  const nativeApp = isNativeApp();
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      if (sessionStorage.getItem(DISMISS_KEY) === 'true') return;
      setDeferredPrompt(event as InstallPromptEvent);
      setVisible(true);
    };
    const handleInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (nativeApp || !visible || !deferredPrompt) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setVisible(false);
    setDeferredPrompt(null);
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, 'true');
    setVisible(false);
  }

  return (
    <aside
      aria-label="Installer l’application Omnia Global Academy"
      aria-describedby="pwa-install-description"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:hidden"
      style={{
        backgroundColor: '#002050',
        borderTop: '2px solid #BF8813',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <img src="/icons/omnia-192.png" className="h-10 w-10 flex-shrink-0 rounded-lg object-contain" alt="Logo Omnia Global Academy" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Installer Omnia Global Academy</p>
          <p id="pwa-install-description" className="text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>
            Accédez plus rapidement à la plateforme depuis votre écran d’accueil.
          </p>
        </div>
        <button
          type="button"
          onClick={handleInstall}
          className="flex-shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-white sm:px-4"
          style={{ backgroundColor: '#BF8813' }}
        >
          Installer
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ color: 'rgba(255,255,255,0.78)' }}
          aria-label="Fermer la proposition d’installation"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
