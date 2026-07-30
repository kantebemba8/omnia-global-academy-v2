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
      <span>🔧 Mode aperçu Super-admin —</span>
      <span>La plateforme est en maintenance pour le public</span>
    </div>
  );
}

export function RootGate() {
  const { loading, maintenanceActive, maintenanceMessage, maintenanceEndTime } = useSiteMode();
  const { isSuperAdmin } = getSuperAdminState();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#002050' }}>
        <div className="flex flex-col items-center gap-4">
          <img src="/omnia-sidebar-logo.png" alt="Omnia" className="h-12 object-contain opacity-90"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#BF8813', borderTopColor: 'transparent' }} />
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
