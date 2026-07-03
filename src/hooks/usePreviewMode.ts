export function usePreviewMode(): boolean {
  const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  let isSuperAdmin = false;
  try {
    isSuperAdmin = JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false;
  } catch { /* ignore */ }
  return isPreview && isSuperAdmin;
}
