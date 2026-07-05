import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ENDPOINTS } from '../lib/config';

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface SiteMode {
  comingSoon: boolean;
  loading: boolean;
  launchDate: string | null;
  waitlistCount: number;
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
  maintenanceEndTime: string | null;
}

const SiteModeContext = createContext<SiteMode>({
  comingSoon: true,
  loading: true,
  launchDate: null,
  waitlistCount: 0,
  maintenanceEnabled: false,
  maintenanceMessage: '',
  maintenanceEndTime: null,
});

export function useSiteMode() {
  return useContext(SiteModeContext);
}

export function SiteModeProvider({ children }: { children: ReactNode }) {
  const [comingSoon, setComingSoon] = useState(true);
  const [loading, setLoading] = useState(true);
  const [launchDate, setLaunchDate] = useState<string | null>(null);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceEndTime, setMaintenanceEndTime] = useState<string | null>(null);

  async function fetchSiteMode() {
    try {
      const r = await fetch(ENDPOINTS.siteSettings, {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
      });
      const data = await r.json();
      setComingSoon(data.coming_soon_enabled !== false);
      setLaunchDate(data.launch_date ?? null);
      setWaitlistCount(data.waitlist_count ?? 0);
      setMaintenanceEnabled(data.maintenance_enabled === true || data.maintenance_enabled === 'true');
      setMaintenanceMessage(data.maintenance_message_fr ?? '');
      setMaintenanceEndTime(data.maintenance_end_time ?? null);

      // Favicon dynamique
      if (data.favicon_url) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
        if (link) {
          link.href = data.favicon_url;
        } else {
          const newLink = document.createElement('link');
          newLink.rel = 'icon';
          newLink.href = data.favicon_url;
          document.head.appendChild(newLink);
        }
      }
    } catch {
      // keep current state on error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSiteMode();
    const interval = setInterval(fetchSiteMode, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SiteModeContext.Provider
      value={{
        comingSoon,
        loading,
        launchDate,
        waitlistCount,
        maintenanceEnabled,
        maintenanceMessage,
        maintenanceEndTime,
      }}
    >
      {children}
    </SiteModeContext.Provider>
  );
}
