import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { PageFooter } from '../../components/PageFooter';
import {
  LandingExperience,
  type LandingExperienceData,
  type LandingPublicPartner,
  type LandingStats,
  type LandingStatsVisibility,
} from '../../components/landing/LandingExperience';
import type { CourseCardData } from '../../components/CourseCard';
import { ENDPOINTS } from '../../lib/config';
import {
  normalizeLandingPage,
  type MobileAppItem,
  type SocialNetworkItem,
} from '../../types/landingCms';

const EMPTY_STATS: LandingStats = { formations: null, apprenants: null, pays: null, formateurs: null, etablissements: null };
const HIDDEN_STATS: LandingStatsVisibility = { formations: false, apprenants: false, pays: false, formateurs: false, etablissements: false };

type PublicData = {
  featured_courses?: CourseCardData[];
  stats?: Partial<LandingStats>;
  stats_visibility?: Partial<LandingStatsVisibility>;
  public_partners?: LandingPublicPartner[];
  social_networks_v2?: SocialNetworkItem[];
  mobile_apps_v2?: MobileAppItem[];
};

export default function LandingDraftPreview() {
  const navigate = useNavigate();
  const [data, setData] = useState<LandingExperienceData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const previousRobots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content;
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex,nofollow,noarchive';
    return () => { if (robots) robots.content = previousRobots || 'index,follow'; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('omnia_session_token') || '';
    if (!token) { navigate('/connexion', { replace: true }); return; }
    Promise.all([
      fetch(ENDPOINTS.adminCmsUpdate, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }),
      fetch(ENDPOINTS.landingData, { signal: controller.signal }),
    ]).then(async ([adminResponse, publicResponse]) => {
      const adminData = await adminResponse.json().catch(() => ({}));
      const publicData = await publicResponse.json().catch(() => ({})) as PublicData;
      if (adminResponse.status === 401 || adminResponse.status === 403) { navigate('/connexion', { replace: true }); return; }
      if (!adminResponse.ok) throw new Error(adminData.message || adminData.error || 'Prévisualisation indisponible');
      if (!publicResponse.ok) throw new Error('Données publiques indisponibles');
      const cmsState = adminData.landing_cms && typeof adminData.landing_cms === 'object' ? adminData.landing_cms : {};
      const draft = normalizeLandingPage(cmsState.draft);
      setData({
        landingPage: draft,
        featuredCourses: Array.isArray(publicData.featured_courses) ? publicData.featured_courses : [],
        stats: { ...EMPTY_STATS, ...(publicData.stats || {}) },
        statsVisibility: { ...HIDDEN_STATS, ...(publicData.stats_visibility || {}) },
        partners: Array.isArray(publicData.public_partners) ? publicData.public_partners : [],
        mobileApps: Array.isArray(publicData.mobile_apps_v2) ? publicData.mobile_apps_v2 : [],
        socialNetworks: Array.isArray(publicData.social_networks_v2) ? publicData.social_networks_v2 : [],
      });
    }).catch(loadError => {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError(loadError instanceof Error ? loadError.message : 'Prévisualisation indisponible');
    });
    return () => controller.abort();
  }, [navigate]);

  const page = useMemo(() => data?.landingPage, [data]);
  const handleSearch = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); };

  if (!data) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="rounded-xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600">{error || <span className="inline-flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Chargement de la prévisualisation…</span>}</div></div>;

  return <div className="min-h-screen bg-white text-slate-900">
    <div className="fixed bottom-4 left-4 z-[70] flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-3 rounded-xl bg-[#BF8813] px-3 py-2 text-white shadow-xl">
      <p className="text-sm font-semibold">Brouillon privé</p>
      <button type="button" onClick={() => navigate('/admin/cms-branding')} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#002050]"><ArrowLeft className="h-4 w-4" />Retour au CMS</button>
    </div>
    <Navbar navigation={page?.navigation} />
    <LandingExperience data={data} searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} onSearch={handleSearch} />
    <PageFooter socialNetworksV2={data.socialNetworks} mobileAppsV2={data.mobileApps} partners={data.partners} footerConfig={page?.footer} managedOnly />
  </div>;
}
