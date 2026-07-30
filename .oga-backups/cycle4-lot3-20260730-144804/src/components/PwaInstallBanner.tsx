import { useEffect, useState } from 'react';

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> });
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible || !deferredPrompt) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 p-4 z-50 md:hidden"
      style={{ backgroundColor: '#002050', borderTop: '2px solid #BF8813' }}
    >
      <div className="flex items-center gap-3">
        <img src="/IMG_0349.png" className="h-10 w-10 object-contain rounded-lg flex-shrink-0" alt="" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">Installer Omnia Academy</p>
          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Accès rapide depuis votre écran d'accueil
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="px-4 py-2 rounded-lg font-semibold text-sm text-white flex-shrink-0"
          style={{ backgroundColor: '#BF8813' }}
        >
          Installer
        </button>
        <button
          onClick={() => setVisible(false)}
          className="p-1 flex-shrink-0"
          style={{ color: 'rgba(255,255,255,0.5)' }}
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
