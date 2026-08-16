import { Capacitor } from '@capacitor/core';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';

const SESSION_KEY = 'omnia_session_token';
const USER_KEY = 'omnia_user';
const ACTIVE_ROLE_KEY = 'omnia_active_role';
const SECURE_STORAGE_PREFIX = 'omnia_session_';
let nativeSessionToken: string | null = null;
let sessionStorageInitialized = false;
function notifySessionChanged(authenticated: boolean): void {
  window.dispatchEvent(new CustomEvent('omnia:session-changed', { detail: { authenticated } }));
}


/**
 * Roles used by the navigation and access-control UI.
 *
 * Only these canonical values represent current Omnia spaces. Historical and
 * technical database values are normalized below and are never presented as
 * additional user-facing roles.
 */
export type InternalSystemRole = 'super_admin';

export type PrimaryPlatformRole =
  | 'moderateur'
  | 'structure'
  | 'organisateur'
  | 'recruteur'
  | 'professeur'
  | 'coach'
  | 'apprenant';

/**
 * Accès délégués rattachés à une organisation.
 * Ces valeurs techniques ne constituent jamais des rôles publics autonomes.
 */
export type DelegatedPlatformAccess = 'gestionnaire_structure';

export type CanonicalPlatformRole = InternalSystemRole | PrimaryPlatformRole | DelegatedPlatformAccess;

export const PRIMARY_PLATFORM_ROLES: readonly PrimaryPlatformRole[] = [
  'moderateur',
  'structure',
  'organisateur',
  'recruteur',
  'professeur',
  'coach',
  'apprenant',
] as const;

export function isPrimaryPlatformRole(role: CanonicalPlatformRole): role is PrimaryPlatformRole {
  return (PRIMARY_PLATFORM_ROLES as readonly CanonicalPlatformRole[]).includes(role);
}

export function primaryPlatformRoles(roles: readonly string[] | null | undefined): PrimaryPlatformRole[] {
  return normalizePlatformRoles(roles).filter(isPrimaryPlatformRole);
}

export function isInternalSystemRole(role: CanonicalPlatformRole): role is InternalSystemRole {
  return role === 'super_admin';
}

const ROLE_REDIRECT_PRIORITY: ReadonlyArray<readonly [CanonicalPlatformRole, string]> = [
  ['super_admin', '/admin/dashboard'],
  ['moderateur', '/home?role=moderateur'],
  ['structure', '/home?role=structure'],
  ['gestionnaire_structure', '/home?role=structure'],
  ['organisateur', '/home?role=organisateur'],
  ['recruteur', '/home?role=recruteur'],
  ['professeur', '/home?role=professeur'],
  ['coach', '/home?role=coach'],
  ['apprenant', '/home?role=apprenant'],
];

const CANONICAL_ROLE_BY_STORED_ROLE: Readonly<Record<string, CanonicalPlatformRole>> = {
  super_admin: 'super_admin',
  moderateur: 'moderateur',
  structure: 'structure',
  responsable_structure: 'structure',
  gestionnaire_structure: 'gestionnaire_structure',
  organisateur: 'organisateur',
  organizer: 'organisateur',
  recruteur: 'recruteur',
  recruteur_independant: 'recruteur',
  professeur: 'professeur',
  coach: 'coach',
  apprenant: 'apprenant',

  // Compatibilité temporaire avec d'anciens identifiants techniques.
  // Ils ne constituent pas de nouveaux rôles visibles dans la plateforme.
  gestionnaire_partenaire: 'gestionnaire_structure',
  structure_admin: 'gestionnaire_structure',
  directeur: 'structure',
  etablissement_directeur: 'structure',
  formateur: 'professeur',
  enseignant: 'professeur',
  etablissement_enseignant: 'professeur',
};

export function normalizePlatformRoles(roles: readonly string[] | null | undefined): CanonicalPlatformRole[] {
  if (!Array.isArray(roles)) return [];

  const normalized = new Set<CanonicalPlatformRole>();
  for (const storedRole of roles) {
    const canonicalRole = CANONICAL_ROLE_BY_STORED_ROLE[storedRole];
    if (canonicalRole) normalized.add(canonicalRole);
  }
  return [...normalized];
}

export function setActivePlatformRole(role: CanonicalPlatformRole | null): void {
  if (!role) {
    localStorage.removeItem(ACTIVE_ROLE_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_ROLE_KEY, role);
}

export function getActivePlatformRole(roles: readonly string[] | null | undefined): CanonicalPlatformRole | null {
  const owned = normalizePlatformRoles(roles);
  const stored = localStorage.getItem(ACTIVE_ROLE_KEY) as CanonicalPlatformRole | null;
  return stored && owned.includes(stored) ? stored : null;
}

function isNativeSessionStorage(): boolean {
  return Capacitor.isNativePlatform();
}

async function configureSecureStorage(): Promise<void> {
  await SecureStorage.setKeyPrefix(SECURE_STORAGE_PREFIX);
  await SecureStorage.setSynchronize(false);
  await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
}

/**
 * Hydrates the synchronous session cache before React renders. On a native
 * device the opaque token is persisted only in iOS Keychain / Android
 * Keystore-backed storage. A legacy localStorage token is migrated once and
 * removed immediately.
 */
export async function initializeSessionStorage(): Promise<void> {
  if (sessionStorageInitialized) return;
  sessionStorageInitialized = true;

  if (!isNativeSessionStorage()) return;

  try {
    await configureSecureStorage();
    const secureToken = await SecureStorage.get(SESSION_KEY, false, false);
    nativeSessionToken = typeof secureToken === 'string' ? secureToken : null;

    const legacyToken = localStorage.getItem(SESSION_KEY);
    if (!nativeSessionToken && legacyToken) {
      nativeSessionToken = legacyToken;
      await SecureStorage.set(
        SESSION_KEY,
        legacyToken,
        false,
        false,
        KeychainAccess.whenUnlockedThisDeviceOnly,
      );
    }
  } catch (error) {
    console.error('[Omnia] Impossible d’initialiser le stockage sécurisé de session.', error);
    nativeSessionToken = null;
  } finally {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function saveSession(token: string, user: unknown, notify = true): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  const userRoles = normalizePlatformRoles((user as { roles?: string[] } | null)?.roles || []);
  const activeRole = localStorage.getItem(ACTIVE_ROLE_KEY) as CanonicalPlatformRole | null;
  if (activeRole && !userRoles.includes(activeRole)) localStorage.removeItem(ACTIVE_ROLE_KEY);

  if (!isNativeSessionStorage()) {
    localStorage.setItem(SESSION_KEY, token);
    if (notify) notifySessionChanged(true);
    return;
  }

  nativeSessionToken = token;
  localStorage.removeItem(SESSION_KEY);
  if (notify) notifySessionChanged(true);
  void configureSecureStorage()
    .then(() =>
      SecureStorage.set(
        SESSION_KEY,
        token,
        false,
        false,
        KeychainAccess.whenUnlockedThisDeviceOnly,
      ),
    )
    .catch(error => {
      console.error('[Omnia] Échec de l’enregistrement sécurisé de la session.', error);
    });
}

export function getSessionToken(): string | null {
  return isNativeSessionStorage() ? nativeSessionToken : localStorage.getItem(SESSION_KEY);
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  window.dispatchEvent(new CustomEvent('omnia:session-ending'));
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ACTIVE_ROLE_KEY);

  if (!isNativeSessionStorage()) {
    localStorage.removeItem(SESSION_KEY);
    notifySessionChanged(false);
    return;
  }

  nativeSessionToken = null;
  localStorage.removeItem(SESSION_KEY);
  notifySessionChanged(false);
  void configureSecureStorage()
    .then(() => SecureStorage.remove(SESSION_KEY, false))
    .catch(error => {
      console.error('[Omnia] Échec de la suppression sécurisée de la session.', error);
    });
}

export function getDashboardPathForRoles(roles: readonly string[]): string {
  const canonicalRoles = normalizePlatformRoles(roles);
  for (const [role, path] of ROLE_REDIRECT_PRIORITY) {
    if (canonicalRoles.includes(role)) return path;
  }
  return '/accueil';
}

/**
 * Landing path after authentication.
 * Every authenticated platform role enters through the connected home. The
 * home itself resolves the user's real role (or an explicitly owned role)
 * without changing permissions or stored roles.
 */
export function getPostLoginPathForRoles(roles: readonly string[]): string {
  return normalizePlatformRoles(roles).length > 0 ? '/home' : '/inscription?mode=add-role';
}

export function redirectByRoles(roles: string[], redirectUrl?: string): void {
  window.location.href = redirectUrl || getPostLoginPathForRoles(roles);
}
