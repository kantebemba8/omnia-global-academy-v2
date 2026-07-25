const PREVIEW_SESSION_KEY = 'omnia_admin_role_preview';

export function usePreviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  const queryPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  const storedPreview = sessionStorage.getItem(PREVIEW_SESSION_KEY) === 'apprenant';
  let isSuperAdmin = false;
  try {
    isSuperAdmin = JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false;
  } catch { /* ignore invalid local storage */ }
  return isSuperAdmin && window.location.pathname.startsWith('/dashboard') && (queryPreview || storedPreview);
}
