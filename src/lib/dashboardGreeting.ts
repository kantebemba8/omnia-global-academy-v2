import { getStoredUser } from './session';

type StoredUser = {
  full_name?: string | null;
  first_name?: string | null;
  name?: string | null;
  display_name?: string | null;
  email?: string | null;
  roles?: string[];
};

function firstName(value: string | null | undefined): string {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const first = normalized.split(/\s+/)[0] || '';
  return first.charAt(0).toLocaleUpperCase('fr-FR') + first.slice(1);
}

function isSuperAdminPreview(user: StoredUser | null): boolean {
  if (typeof window === 'undefined' || !user?.roles?.includes('super_admin')) return false;
  const queryPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  const storedPreview = Boolean(sessionStorage.getItem('omnia_admin_role_preview'));
  return queryPreview || storedPreview;
}

export function dashboardGreeting(preferredName?: string | null): string {
  const user = getStoredUser<StoredUser>();
  if (isSuperAdminPreview(user)) return 'Bonjour';

  const name = firstName(
    preferredName
      || user?.first_name
      || user?.full_name
      || user?.display_name
      || user?.name
      || (user?.email ? user.email.split('@')[0] : ''),
  );

  return name ? `Bonjour, ${name}` : 'Bonjour';
}
