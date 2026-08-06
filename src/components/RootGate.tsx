import { lazy } from 'react';
import { useSiteMode } from '../context/SiteModeContext';
const LandingPage = lazy(() => import('../pages/LandingPage').then((module) => ({ default: module.LandingPage })));
const MaintenancePage = lazy(() => import('../pages/MaintenancePage').then((module) => ({ default: module.MaintenancePage })));

function getSuperAdminState(): { isSuperAdmin: boolean } {
  try {
    const stored = localStorage.getItem('omnia_user');
    const user = stored ? JSON.parse(stored) : null;
    return { isSuperAdmin: user?.roles?.includes('super_admin') ?? false };
  } catch {
    return { isSuperAdmin: false };
  }
}

export function SuperAdminPreviewBadge() {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white"
      style={{ backgroundColor: '#F59E0B' }}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M14.7 6.3a4 4 0 0 0-5-5L7 4l3 3-2 2-3-3-2.7 2.7a4 4 0 0 0 5 5L17 23l6-6-8.3-10.7Z" />
      </svg>
      <span>Mode aperçu administratif — la plateforme est en maintenance pour le public</span>
    </div>
  );
}

export function RootGate() {
  const { loading, maintenanceActive, maintenanceMessage, maintenanceEndTime } = useSiteMode();
  const { isSuperAdmin } = getSuperAdminState();

  if (loading) {
    return (
      <div role="status" aria-live="polite" aria-label="Chargement de la plateforme" className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#002050' }}>
        <div className="flex flex-col items-center gap-4">
          <img src="/omnia-sidebar-logo.png" alt="Omnia" className="h-12 object-contain opacity-90"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div aria-hidden="true" className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#BF8813', borderTopColor: 'transparent' }} />
          <span className="sr-only">Chargement de la plateforme…</span>
        </div>
      </div>
    );
  }

  if (maintenanceActive) {
    if (isSuperAdmin) {
      return (
        <>
          <SuperAdminPreviewBadge />
          <div style={{ paddingTop: '40px' }}><LandingPage /></div>
        </>
      );
    }
    return (
      <MaintenancePage
        maintenanceMessage={maintenanceMessage}
        maintenanceEndTime={maintenanceEndTime ?? undefined}
      />
    );
  }

  return <LandingPage />;
}
