const RECOVERY_KEY = 'omnia_chunk_recovery_attempt_v1';
const RECOVERY_WINDOW_MS = 2 * 60 * 1000;

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk [\w-]+ failed/i,
  /chunkloaderror/i,
  /css_chunk_load_failed/i,
];

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error ?? '');
}

export function isRecoverableChunkError(error: unknown): boolean {
  const message = errorMessage(error);
  return CHUNK_ERROR_PATTERNS.some(pattern => pattern.test(message));
}

function recentlyAttemptedRecovery(): boolean {
  try {
    const raw = sessionStorage.getItem(RECOVERY_KEY);
    if (!raw) return false;
    const attemptedAt = Number(raw);
    return Number.isFinite(attemptedAt) && Date.now() - attemptedAt < RECOVERY_WINDOW_MS;
  } catch {
    return false;
  }
}

function markRecoveryAttempt(): void {
  try {
    sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
  } catch {
    // Le rechargement reste possible lorsque le stockage de session est indisponible.
  }
}

async function refreshServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.update().catch(() => undefined)));
  } catch {
    // Une erreur de mise à jour du service worker ne doit pas bloquer la récupération.
  }
}

async function clearStaleApplicationCaches(): Promise<void> {
  if (!('caches' in window)) return;

  try {
    const cacheNames = await caches.keys();
    const staleCacheNames = cacheNames.filter(name =>
      name.startsWith('workbox-precache') ||
      name === 'omnia-static-assets'
    );
    await Promise.all(staleCacheNames.map(name => caches.delete(name)));
  } catch {
    // Le navigateur peut refuser l'accès au cache en navigation privée.
  }
}

/**
 * Tente une seule récupération automatique lorsqu'un ancien cache PWA pointe
 * vers un fichier JavaScript qui n'existe plus après un déploiement.
 */
export async function recoverFromChunkError(): Promise<boolean> {
  if (!navigator.onLine || recentlyAttemptedRecovery()) return false;

  markRecoveryAttempt();
  await Promise.all([refreshServiceWorker(), clearStaleApplicationCaches()]);
  window.location.reload();
  return true;
}
