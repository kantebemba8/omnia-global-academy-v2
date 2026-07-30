import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getPublicSiteSettings, type PublicSiteSettings } from '../lib/siteSettingsCache';

export interface MaintenanceModules {
  omnia_live: boolean;
  career: boolean;
  talent: boolean;
  forum: boolean;
  payments: boolean;
  formations: boolean;
}

export interface MaintenanceSchedule {
  start: string | null;
  end: string | null;
}

interface SiteMode {
  loading: boolean;
  maintenanceActive: boolean;
  maintenanceMessage: string;
  maintenanceStartTime: string | null;
  maintenanceEndTime: string | null;
  maintenanceModules: MaintenanceModules;
  maintenanceModuleSchedules: Record<keyof MaintenanceModules, MaintenanceSchedule>;
  maintenanceNoticePlatform: boolean;
  maintenanceNoticeMessage: string;
  maintenanceNoticeAt: string | null;
}

const defaultModules: MaintenanceModules = {
  omnia_live: false,
  career: false,
  talent: false,
  forum: false,
  payments: false,
  formations: false,
};

const defaultSchedules: Record<keyof MaintenanceModules, MaintenanceSchedule> = {
  omnia_live: { start: null, end: null },
  career: { start: null, end: null },
  talent: { start: null, end: null },
  forum: { start: null, end: null },
  payments: { start: null, end: null },
  formations: { start: null, end: null },
};

const initialSiteMode: SiteMode = {
  loading: true,
  maintenanceActive: false,
  maintenanceMessage: '',
  maintenanceStartTime: null,
  maintenanceEndTime: null,
  maintenanceModules: defaultModules,
  maintenanceModuleSchedules: defaultSchedules,
  maintenanceNoticePlatform: false,
  maintenanceNoticeMessage: '',
  maintenanceNoticeAt: null,
};

const SiteModeContext = createContext<SiteMode>(initialSiteMode);

export function useSiteMode() {
  return useContext(SiteModeContext);
}

function asBool(value: unknown) {
  return value === true || value === 'true';
}

function buildSiteMode(data: PublicSiteSettings): SiteMode {
  const start = data.maintenance_start_time ? new Date(data.maintenance_start_time).getTime() : null;
  const end = data.maintenance_end_time ? new Date(data.maintenance_end_time).getTime() : null;
  const now = Date.now();
  const scheduledActive = !!start && now >= start && (!end || now < end);
  const manuallyActive = asBool(data.maintenance_enabled);

  return {
    loading: false,
    maintenanceActive: manuallyActive || scheduledActive,
    maintenanceMessage: data.maintenance_message_fr ?? '',
    maintenanceStartTime: data.maintenance_start_time ?? null,
    maintenanceEndTime: data.maintenance_end_time ?? null,
    maintenanceModules: {
      omnia_live: asBool(data.maintenance_module_omnia_live),
      career: asBool(data.maintenance_module_career),
      talent: asBool(data.maintenance_module_talent),
      forum: asBool(data.maintenance_module_forum),
      payments: asBool(data.maintenance_module_payments),
      formations: asBool(data.maintenance_module_formations),
    },
    maintenanceModuleSchedules: {
      omnia_live: { start: data.maintenance_module_omnia_live_start_time ?? null, end: data.maintenance_module_omnia_live_end_time ?? null },
      career: { start: data.maintenance_module_career_start_time ?? null, end: data.maintenance_module_career_end_time ?? null },
      talent: { start: data.maintenance_module_talent_start_time ?? null, end: data.maintenance_module_talent_end_time ?? null },
      forum: { start: data.maintenance_module_forum_start_time ?? null, end: data.maintenance_module_forum_end_time ?? null },
      payments: { start: data.maintenance_module_payments_start_time ?? null, end: data.maintenance_module_payments_end_time ?? null },
      formations: { start: data.maintenance_module_formations_start_time ?? null, end: data.maintenance_module_formations_end_time ?? null },
    },
    maintenanceNoticePlatform: asBool(data.maintenance_notice_platform),
    maintenanceNoticeMessage: data.maintenance_notice_message_fr ?? '',
    maintenanceNoticeAt: data.maintenance_notice_at ?? null,
  };
}

function applyFavicon(data: PublicSiteSettings) {
  if (!data.favicon_url) return;
  const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  if (link) {
    if (link.href !== data.favicon_url) link.href = data.favicon_url;
    return;
  }
  const newLink = document.createElement('link');
  newLink.rel = 'icon';
  newLink.href = data.favicon_url;
  document.head.appendChild(newLink);
}

export function SiteModeProvider({ children }: { children: ReactNode }) {
  const [siteMode, setSiteMode] = useState<SiteMode>(initialSiteMode);

  useEffect(() => {
    let active = true;

    const load = async (force = false) => {
      try {
        const data = await getPublicSiteSettings({ force, maxAgeMs: 45_000 });
        if (!active) return;
        setSiteMode(buildSiteMode(data));
        applyFavicon(data);
      } catch {
        if (active) setSiteMode(previous => ({ ...previous, loading: false }));
      }
    };

    const refreshWhenUseful = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void load(true);
      }
    };

    void load();
    const interval = window.setInterval(refreshWhenUseful, 60_000);
    document.addEventListener('visibilitychange', refreshWhenUseful);
    window.addEventListener('online', refreshWhenUseful);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenUseful);
      window.removeEventListener('online', refreshWhenUseful);
    };
  }, []);

  return <SiteModeContext.Provider value={siteMode}>{children}</SiteModeContext.Provider>;
}
