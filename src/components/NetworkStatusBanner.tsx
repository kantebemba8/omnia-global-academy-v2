import { useEffect, useRef, useState } from 'react';
import { useOmniaNetworkStatus } from '../hooks/useOmniaNetwork';

type BannerState = 'online' | 'offline' | 'restored';

export function NetworkStatusBanner() {
  const network = useOmniaNetworkStatus();
  const [bannerState, setBannerState] = useState<BannerState>(() => network.connected ? 'online' : 'offline');
  const previousConnectedRef = useRef(network.connected);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    clearHideTimer();
    const wasConnected = previousConnectedRef.current;
    previousConnectedRef.current = network.connected;

    if (!network.connected) {
      setBannerState('offline');
      return clearHideTimer;
    }

    if (!wasConnected) {
      setBannerState('restored');
      hideTimerRef.current = window.setTimeout(() => {
        setBannerState('online');
        hideTimerRef.current = null;
      }, 4000);
    } else {
      setBannerState('online');
    }

    return clearHideTimer;
  }, [network.connected]);

  if (bannerState === 'online') return null;

  const restored = bannerState === 'restored';
  const connectionLabel = network.connectionType === 'cellular'
    ? ' via le réseau mobile'
    : network.connectionType === 'wifi'
      ? ' en Wi-Fi'
      : '';

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
            ? `Connexion rétablie${connectionLabel}. La synchronisation reprend automatiquement.`
            : 'Connexion interrompue. Les contenus conservés restent accessibles et la progression sera synchronisée au retour du réseau.'}
        </span>
      </div>
    </aside>
  );
}
