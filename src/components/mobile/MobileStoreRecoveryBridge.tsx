import { useEffect } from 'react';
import { getSessionToken } from '../../lib/session';
import { isAndroidApp } from '../../lib/mobile/platform';
import { reconcileNativeStorePurchases } from '../../lib/mobile/storeBilling';

const MIN_RECONCILIATION_INTERVAL_MS = 15 * 60 * 1000;
let lastAttemptAt = 0;
let reconciliationPromise: Promise<void> | null = null;

async function reconcileSilently(): Promise<void> {
  if (!isAndroidApp() || !getSessionToken()) return;
  const now = Date.now();
  if (reconciliationPromise || now - lastAttemptAt < MIN_RECONCILIATION_INTERVAL_MS) return;
  lastAttemptAt = now;
  reconciliationPromise = reconcileNativeStorePurchases()
    .then(result => {
      if (result.restored > 0) {
        window.dispatchEvent(new CustomEvent('omnia:store-purchases-restored', { detail: result }));
      }
    })
    .catch(error => {
      console.info('[Omnia] Réconciliation silencieuse des achats reportée.', error);
    })
    .finally(() => {
      reconciliationPromise = null;
    });
  await reconciliationPromise;
}

export function MobileStoreRecoveryBridge() {
  useEffect(() => {
    if (!isAndroidApp()) return;

    const initialTimer = window.setTimeout(() => {
      void reconcileSilently();
    }, 2500);

    const onSessionChanged = (event: Event) => {
      const authenticated = Boolean((event as CustomEvent<{ authenticated?: boolean }>).detail?.authenticated);
      if (authenticated) {
        lastAttemptAt = 0;
        void reconcileSilently();
      }
    };
    const onAppState = (event: Event) => {
      const isActive = Boolean((event as CustomEvent<{ isActive?: boolean }>).detail?.isActive);
      if (isActive) void reconcileSilently();
    };

    window.addEventListener('omnia:session-changed', onSessionChanged);
    window.addEventListener('omnia:app-state', onAppState);
    return () => {
      window.clearTimeout(initialTimer);
      window.removeEventListener('omnia:session-changed', onSessionChanged);
      window.removeEventListener('omnia:app-state', onAppState);
    };
  }, []);

  return null;
}
