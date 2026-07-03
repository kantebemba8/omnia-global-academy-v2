import { useSiteMode } from '../context/SiteModeContext';
import { ComingSoon } from '../pages/ComingSoon';
import { LandingPage } from '../pages/LandingPage';
import { MaintenancePage } from '../pages/MaintenancePage';

export function RootGate() {
  const { comingSoon, loading, maintenanceEnabled, maintenanceMessage, maintenanceEndTime } =
    useSiteMode();

  let isSuperAdmin = false;
  try {
    const stored = localStorage.getItem('omnia_user');
    isSuperAdmin = stored ? JSON.parse(stored)?.roles?.includes('super_admin') : false;
  } catch {
    // If parsing fails, isSuperAdmin remains false
  }

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

  if (maintenanceEnabled && !isSuperAdmin) {
    return (
      <MaintenancePage
        maintenanceMessage={maintenanceMessage}
        maintenanceEndTime={maintenanceEndTime ?? undefined}
      />
    );
  }

  return comingSoon ? <ComingSoon /> : <LandingPage />;
}
