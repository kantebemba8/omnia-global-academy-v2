import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { LandingSeo } from '../components/landing/LandingSeo';
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
};

const DEFAULT_DATA: LandingDataResponse = {
  landing_page: createDefaultLandingPage(),
  featured_courses: [],
  stats: EMPTY_STATS,
  stats_visibility: HIDDEN_STATS,
  public_partners: [],
  social_networks_v2: [],
  mobile_apps_v2: [],
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setLoadError(false);

    fetch(ENDPOINTS.landingData, {
      headers: ANON_KEY ? { Authorization: `Bearer ${ANON_KEY}` } : undefined,
      signal: controller.signal,
    })
      .then(response => {
        if (!response.ok) throw new Error(`Landing data HTTP ${response.status}`);
        return response.json() as Promise<LandingDataResponse>;
      })
      .then(payload => {
        if (!active) return;
        setRawData({
          ...DEFAULT_DATA,
          ...payload,
          featured_courses: Array.isArray(payload.featured_courses) ? payload.featured_courses : [],
          public_partners: Array.isArray(payload.public_partners) ? payload.public_partners : [],
          social_networks_v2: Array.isArray(payload.social_networks_v2) ? payload.social_networks_v2 : [],
          mobile_apps_v2: Array.isArray(payload.mobile_apps_v2) ? payload.mobile_apps_v2 : [],
        });
        setLoadError(false);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Impossible de charger les données publiques de la page d’accueil.', error);
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const timer = window.setTimeout(() => {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      document.getElementById(id)?.scrollIntoView({ behavior, block: 'start' });
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
    <div className="oga-public-home-depth min-h-screen bg-white font-sans text-slate-900">
      <LandingSeo
        landingPage={experienceData.landingPage}
        featuredCourses={experienceData.featuredCourses}
        socialNetworks={experienceData.socialNetworks}
        partners={experienceData.partners}
      />
      <a href="#contenu-principal" className="oga-skip-link">Aller au contenu principal</a>
      <Navbar navigation={experienceData.landingPage.navigation} audienceLinks={Object.values(experienceData.landingPage.audience_pages).filter(page => page.enabled).map(page => ({ label: page.nav_label, href: page.route }))} showAudienceBar />
      {loadError && (
        <div role="status" aria-live="polite" className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,680px)] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 shadow-lg">
          Certaines données en temps réel sont temporairement indisponibles. Les sections concernées restent masquées.
        </div>
      )}
      <div aria-busy={loading}>
        <LandingExperience
          data={experienceData}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearch={handleSearch}
        />
      </div>
      <section className="border-b border-slate-200 bg-white px-5 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 rounded-2xl bg-[#002050] px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black">Une question, un besoin ou une proposition ?</h2>
            <p className="mt-1 text-sm text-white/70">Contactez directement Omnia Global Academy.</p>
          </div>
          <button type="button" onClick={() => navigate('/contact')} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#BF8813] px-5 py-3 text-sm font-black text-white transition hover:bg-[#A8730F]">
            Contactez-nous
          </button>
        </div>
      </section>
      <PageFooter
        socialNetworksV2={experienceData.socialNetworks}
        mobileAppsV2={experienceData.mobileApps}
        partners={experienceData.partners}
        footerConfig={experienceData.landingPage.footer}
        managedOnly
      />
    </div>
  );
}
