import { useSiteMode } from '../context/SiteModeContext';
import { ComingSoon } from '../pages/ComingSoon';
import { LandingPage } from '../pages/LandingPage';
import { MaintenancePage } from '../pages/MaintenancePage';

function getSuperAdminState(): { isSuperAdmin: boolean; modeLabel: string | null } {
  try {
    const stored = localStorage.getItem('omnia_user');
    const user = stored ? JSON.parse(stored) : null;
    const isSuperAdmin = user?.roles?.includes('super_admin') ?? false;
    return { isSuperAdmin, modeLabel: null };
  } catch {
    return { isSuperAdmin: false, modeLabel: null };
  }
}

export function SuperAdminPreviewBadge({ mode }: { mode: 'coming_soon' | 'maintenance' }) {
  const label = mode === 'coming_soon'
    ? 'Le site est en mode Coming Soon pour le public'
    : 'Le site est en Maintenance pour le public';
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white"
      style={{ backgroundColor: '#F59E0B' }}>
      <span>🔧 Mode aperçu Super-admin —</span>
      <span>{label}</span>
    </div>
  );
}

export function RootGate() {
  const { comingSoon, loading, maintenanceEnabled, maintenanceMessage, maintenanceEndTime } =
    useSiteMode();

  const { isSuperAdmin } = getSuperAdminState();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#002050' }}>
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.png" alt="Omnia" className="h-12 object-contain opacity-90"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#BF8813', borderTopColor: 'transparent' }} />
        </div>
      </div>
    );
  }

  if (maintenanceEnabled) {
    if (isSuperAdmin) {
      return (
        <>
          <SuperAdminPreviewBadge mode="maintenance" />
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

  if (comingSoon) {
    if (isSuperAdmin) {
      return (
        <>
          <SuperAdminPreviewBadge mode="coming_soon" />
          <div style={{ paddingTop: '40px' }}><LandingPage /></div>
        </>
      );
    }
    return <ComingSoon />;
  }

  return <LandingPage />;
}
