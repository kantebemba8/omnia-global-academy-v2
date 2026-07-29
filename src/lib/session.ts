const SESSION_KEY = 'omnia_session_token';
const USER_KEY = 'omnia_user';

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

export function redirectByRoles(roles: string[], redirectUrl?: string): void {
  if (redirectUrl) { window.location.href = redirectUrl; return; }
  if (roles.includes('super_admin')) { window.location.href = '/admin/dashboard'; return; }
  if (roles.includes('moderateur')) { window.location.href = '/moderator/dashboard'; return; }
  if (roles.includes('etablissement_directeur')) { window.location.href = '/structure/dashboard'; return; }
  if (roles.includes('etablissement_enseignant') || roles.includes('enseignant')) { window.location.href = '/professeur/dashboard'; return; }
  if (roles.includes('recruteur_independant') || roles.includes('recruteur')) { window.location.href = '/talent/recruteur/dashboard'; return; }
  if (roles.includes('recruteur_structure')) { window.location.href = '/structure/recrutement/dashboard'; return; }
  if (roles.includes('professeur')) { window.location.href = '/professeur/dashboard'; return; }
  if (roles.includes('coach')) { window.location.href = '/coach/dashboard'; return; }
  window.location.href = '/dashboard';
}
