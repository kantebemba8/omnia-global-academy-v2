const SESSION_KEY = 'omnia_session_token';
const USER_KEY = 'omnia_user';

/**
 * Roles used by the navigation and access-control UI.
 *
 * Only these canonical values represent current Omnia spaces. Historical and
 * technical database values are normalized below and are never presented as
 * additional user-facing roles.
 */
export type CanonicalPlatformRole =
  | 'super_admin'
  | 'moderateur'
  | 'structure'
  | 'recruteur_structure'
  | 'organisateur'
  | 'recruteur'
  | 'professeur'
  | 'coach'
  | 'apprenant';

const ROLE_REDIRECT_PRIORITY: ReadonlyArray<readonly [CanonicalPlatformRole, string]> = [
  ['super_admin', '/admin/dashboard'],
  ['moderateur', '/moderateur/dashboard'],
  ['structure', '/structure/dashboard'],
  ['recruteur_structure', '/structure/recrutement/dashboard'],
  ['organisateur', '/omnia-live/organisateur'],
  ['recruteur', '/talent/recruteur/dashboard'],
  ['professeur', '/professeur/dashboard'],
  ['coach', '/coach/dashboard'],
  ['apprenant', '/dashboard'],
];

const CANONICAL_ROLE_BY_STORED_ROLE: Readonly<Record<string, CanonicalPlatformRole>> = {
  super_admin: 'super_admin',
  moderateur: 'moderateur',
  structure: 'structure',
  responsable_structure: 'structure',
  recruteur_structure: 'recruteur_structure',
  organisateur: 'organisateur',
  organizer: 'organisateur',
  recruteur: 'recruteur',
  recruteur_independant: 'recruteur',
  professeur: 'professeur',
  coach: 'coach',
  apprenant: 'apprenant',

  // Compatibilité temporaire avec d'anciens identifiants techniques.
  // Ils ne constituent pas de nouveaux rôles visibles dans la plateforme.
  gestionnaire_partenaire: 'structure',
  structure_admin: 'structure',
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

export function saveSession(token: string, user: unknown): void {
  localStorage.setItem(SESSION_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
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
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getDashboardPathForRoles(roles: readonly string[]): string {
  const canonicalRoles = normalizePlatformRoles(roles);
  for (const [role, path] of ROLE_REDIRECT_PRIORITY) {
    if (canonicalRoles.includes(role)) return path;
  }
  return '/accueil';
}

export function redirectByRoles(roles: string[], redirectUrl?: string): void {
  window.location.href = redirectUrl || getDashboardPathForRoles(roles);
}
