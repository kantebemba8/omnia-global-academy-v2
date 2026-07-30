import { edgeAuthHeaders } from '../../lib/edgeAuth';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

const ORGANIZER_PREVIEW_SESSION_KEY = 'omnia_admin_role_preview';
const ORGANIZER_PREVIEW_READ_ACTIONS = new Set([
  'categories',
  'get',
  'studio_get',
  'organizer_profile_me',
  'organizer_dashboard',
  'organizer_events',
  'organizer_participants',
  'organizer_media',
  'organizer_cancellations',
  'organizer_access_codes',
  'organizer_analytics',
  'organizer_ledger_mine',
  'payout_requests_mine',
  'analytics_event_kpis',
  'analytics_event_history',
  'communication_campaigns_list',
  'automation_rules_list',
  'report_exports_list',
]);

function isOrganizerCreatorPath(pathname: string): boolean {
  return pathname === '/omnia-live/revenus'
    || pathname === '/omnia-live/proposer'
    || pathname.startsWith('/omnia-live/organisateur')
    || pathname.startsWith('/omnia-live/studio/')
    || /^\/omnia-live\/[^/]+\/(organiser|presence|statistiques)$/.test(pathname);
}

export function isOrganizerPreviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  const previewRequested = new URLSearchParams(window.location.search).get('preview') === 'true';
  const storedPreview = sessionStorage.getItem(ORGANIZER_PREVIEW_SESSION_KEY) === 'organisateur';
  let isSuperAdmin = false;
  try {
    const user = JSON.parse(localStorage.getItem('omnia_user') || '{}');
    isSuperAdmin = Array.isArray(user?.roles) && user.roles.includes('super_admin');
  } catch {
    isSuperAdmin = false;
  }
  return isSuperAdmin
    && isOrganizerCreatorPath(window.location.pathname)
    && (previewRequested || storedPreview);
}

export type LiveItem = {
  id: string;
  title: string;
  slug?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  event_type?: string | null;
  delivery_type?: string | null;
  status?: string | null;
  starts_at?: string | null;
  timezone?: string | null;
  duration_minutes?: number | null;
  max_participants?: number | null;
  price_amount?: number | null;
  currency?: string | null;
  cover_url?: string | null;
  language?: string | null;
  level?: string | null;
  replay_enabled?: boolean | null;
  organizer_display_name?: string | null;
};

export async function liveApi(
  action: string,
  options: RequestInit = {},
  params: Record<string, string | number | undefined | null> = {},
) {
  if (!SUPABASE_URL) throw new Error('Configuration Supabase manquante');
  const previewMode = isOrganizerPreviewMode();
  if (previewMode && !ORGANIZER_PREVIEW_READ_ACTIONS.has(action)) {
    throw new Error('Cette action est désactivée dans la prévisualisation Organisateur.');
  }
  const search = new URLSearchParams({ action });
  if (previewMode) search.set('preview_role', 'organisateur');
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') search.set(key, String(value));
  });
  const res = await fetch(`${SUPABASE_URL}/functions/v1/omnia-live?${search.toString()}`, {
    ...options,
    headers: {
      ...edgeAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const values = [data?.message, data?.error_description, data?.error, data?.details, data?.hint, data?.code]
      .filter((value) => typeof value === 'string' && value.trim() && value.trim() !== '[object Object]');
    const message = values.length ? Array.from(new Set(values)).join(' — ') : 'Erreur Omnia Live';
    throw new Error(message);
  }
  return data;
}
