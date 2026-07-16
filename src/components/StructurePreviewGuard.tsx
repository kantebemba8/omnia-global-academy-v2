import type { ReactNode } from 'react';
import StructurePreviewPage from '../pages/structure/StructurePreviewPage';

export function StructurePreviewGuard({ children }: { children: ReactNode }) {
  const params = new URLSearchParams(window.location.search);
  const preview = params.get('preview') === 'true';
  let superAdmin = false;
  try {
    superAdmin = JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false;
  } catch { /* ignore */ }

  if (preview && superAdmin) return <StructurePreviewPage />;
  return <>{children}</>;
}
