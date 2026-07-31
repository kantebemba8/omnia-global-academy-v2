import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import {
  LandingExperience,
  type LandingExperienceData,
  type LandingPublicPartner,
  type LandingStats,
  type LandingStatsVisibility,
} from '../components/landing/LandingExperience';
import type { CourseCardData } from '../components/CourseCard';
import { ENDPOINTS } from '../lib/config';
import {
  createDefaultLandingPage,
  normalizeLandingPage,
  type LandingPageConfig,
  type MobileAppItem,
  type SocialNetworkItem,
} from '../types/landingCms';

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const EMPTY_STATS: LandingStats = {
  formations: null,
  apprenants: null,
  pays: null,
  formateurs: null,
  etablissements: null,
};

const HIDDEN_STATS: LandingStatsVisibility = {
  formations: false,
  apprenants: false,
  pays: false,
  formateurs: false,
  etablissements: false,
};

type LandingDataResponse = {
  landing_page?: LandingPageConfig;
  featured_courses?: CourseCardData[];
  stats?: Partial<LandingStats>;
  stats_visibility?: Partial<LandingStatsVisibility>;
  public_partners?: LandingPublicPartner[];
  social_networks_v2?: SocialNetworkItem[];
  mobile_apps_v2?: MobileAppItem[];
  social_networks?: Record<string, string | null>;
  app_downloads?: { google_play?: string | null; app_store?: string | null };
  follow_us_label_fr?: string;
};

const DEFAULT_DATA: LandingDataResponse = {
  landing_page: createDefaultLandingPage(),
  featured_courses: [],
  stats: EMPTY_STATS,
  stats_visibility: HIDDEN_STATS,
  public_partners: [],
  social_networks_v2: [],
  mobile_apps_v2: [],
  social_networks: {},
  app_downloads: {},
  follow_us_label_fr: 'Suivez-nous',
};

function mergeStats(value: Partial<LandingStats> | undefined): LandingStats {
  return { ...EMPTY_STATS, ...(value || {}) };
}

function mergeVisibility(value: Partial<LandingStatsVisibility> | undefined): LandingStatsVisibility {
  return { ...HIDDEN_STATS, ...(value || {}) };
}

export function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [rawData, setRawData] = useState<LandingDataResponse>(DEFAULT_DATA);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    fetch(ENDPOINTS.landingData, {
      headers: { Authorization: `Bearer ${ANON_KEY}` },
      signal: controller.signal,
    })
      .then(response => {
        if (!response.ok) throw new Error(`Landing data HTTP ${response.status}`);
        return response.json() as Promise<LandingDataResponse>;
      })
      .then(payload => {
        setRawData({
          ...DEFAULT_DATA,
          ...payload,
          featured_courses: Array.isArray(payload.featured_courses) ? payload.featured_courses : [],
          public_partners: Array.isArray(payload.public_partners) ? payload.public_partners : [],
          social_networks_v2: Array.isArray(payload.social_networks_v2) ? payload.social_networks_v2 : [],
          mobile_apps_v2: Array.isArray(payload.mobile_apps_v2) ? payload.mobile_apps_v2 : [],
        });
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Impossible de charger les données publiques de la page d’accueil.', error);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [location.hash, rawData.landing_page]);

  const experienceData = useMemo<LandingExperienceData>(() => ({
    landingPage: normalizeLandingPage(rawData.landing_page),
    featuredCourses: rawData.featured_courses || [],
    stats: mergeStats(rawData.stats),
    statsVisibility: mergeVisibility(rawData.stats_visibility),
    partners: rawData.public_partners || [],
    mobileApps: rawData.mobile_apps_v2 || [],
    socialNetworks: rawData.social_networks_v2 || [],
  }), [rawData]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = searchQuery.trim();
    if (value) navigate(`/catalogue?q=${encodeURIComponent(value)}`);
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <Navbar />
      <LandingExperience
        data={experienceData}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearch={handleSearch}
      />
      <PageFooter
        socialNetworks={rawData.social_networks || {}}
        socialNetworksV2={experienceData.socialNetworks}
        appDownloads={rawData.app_downloads || {}}
        mobileAppsV2={experienceData.mobileApps}
        partners={experienceData.partners}
        followUsLabel={rawData.follow_us_label_fr || 'Suivez-nous'}
      />
    </div>
  );
}
