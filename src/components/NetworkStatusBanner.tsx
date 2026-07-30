import { useEffect, useRef, useState } from 'react';

type NetworkState = 'online' | 'offline' | 'restored';

export function NetworkStatusBanner() {
  const [networkState, setNetworkState] = useState<NetworkState>(() =>
    navigator.onLine ? 'online' : 'offline'
  );
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const handleOffline = () => {
      clearHideTimer();
      setNetworkState('offline');
    };

    const handleOnline = () => {
      clearHideTimer();
      setNetworkState('restored');
      hideTimerRef.current = window.setTimeout(() => {
        setNetworkState('online');
        hideTimerRef.current = null;
      }, 4000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      clearHideTimer();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (networkState === 'online') return null;

  const restored = networkState === 'restored';

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-[10000] border-t px-4 py-3 shadow-lg"
      style={{
        backgroundColor: restored ? '#ECFDF5' : '#FFF8E8',
        borderColor: restored ? '#059669' : '#BF8813',
        color: '#002050',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-3 text-center text-sm font-medium">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {restored ? (
            <path d="m5 12 4 4L19 6" />
          ) : (
            <>
              <path d="M1 1l22 22" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <path d="M12 20h.01" />
            </>
          )}
        </svg>
        <span>
          {restored
            ? 'Connexion rétablie. Vous pouvez continuer.'
            : 'Connexion interrompue. Les actions en ligne reprendront automatiquement dès le retour du réseau.'}
        </span>
      </div>
    </aside>
  );
}
