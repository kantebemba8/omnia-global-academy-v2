import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ENDPOINTS } from '../lib/config';

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface MaintenanceModules {
  omnia_live: boolean;
  career: boolean;
  talent: boolean;
  forum: boolean;
  payments: boolean;
  formations: boolean;
}

interface SiteMode {
  loading: boolean;
  maintenanceActive: boolean;
  maintenanceMessage: string;
  maintenanceStartTime: string | null;
  maintenanceEndTime: string | null;
  maintenanceModules: MaintenanceModules;
}

const defaultModules: MaintenanceModules = {
  omnia_live: false,
  career: false,
  talent: false,
  forum: false,
  payments: false,
  formations: false,
};

const SiteModeContext = createContext<SiteMode>({
  loading: true,
  maintenanceActive: false,
  maintenanceMessage: '',
  maintenanceStartTime: null,
  maintenanceEndTime: null,
  maintenanceModules: defaultModules,
});

export function useSiteMode() {
  return useContext(SiteModeContext);
}

function asBool(value: unknown) {
  return value === true || value === 'true';
}

export function SiteModeProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceStartTime, setMaintenanceStartTime] = useState<string | null>(null);
  const [maintenanceEndTime, setMaintenanceEndTime] = useState<string | null>(null);
  const [maintenanceModules, setMaintenanceModules] = useState<MaintenanceModules>(defaultModules);

  async function fetchSiteMode() {
    try {
      const r = await fetch(ENDPOINTS.siteSettings, {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
      });
      const data = await r.json();

      const start = data.maintenance_start_time ? new Date(data.maintenance_start_time).getTime() : null;
      const end = data.maintenance_end_time ? new Date(data.maintenance_end_time).getTime() : null;
      const now = Date.now();
      const scheduledActive = !!start && now >= start && (!end || now < end);
      const manuallyActive = asBool(data.maintenance_enabled);

      setMaintenanceActive(manuallyActive || scheduledActive);
      setMaintenanceMessage(data.maintenance_message_fr ?? '');
      setMaintenanceStartTime(data.maintenance_start_time ?? null);
      setMaintenanceEndTime(data.maintenance_end_time ?? null);
      setMaintenanceModules({
        omnia_live: asBool(data.maintenance_module_omnia_live),
        career: asBool(data.maintenance_module_career),
        talent: asBool(data.maintenance_module_talent),
        forum: asBool(data.maintenance_module_forum),
        payments: asBool(data.maintenance_module_payments),
        formations: asBool(data.maintenance_module_formations),
      });

      if (data.favicon_url) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
        if (link) link.href = data.favicon_url;
        else {
          const newLink = document.createElement('link');
          newLink.rel = 'icon';
          newLink.href = data.favicon_url;
          document.head.appendChild(newLink);
        }
      }
    } catch {
      // Conserver l'état courant en cas d'erreur réseau.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSiteMode();
    const interval = setInterval(fetchSiteMode, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SiteModeContext.Provider value={{
      loading,
      maintenanceActive,
      maintenanceMessage,
      maintenanceStartTime,
      maintenanceEndTime,
      maintenanceModules,
    }}>
      {children}
    </SiteModeContext.Provider>
  );
}
