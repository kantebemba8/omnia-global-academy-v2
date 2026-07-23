const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

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
  const token = localStorage.getItem('omnia_session_token') || '';
  const search = new URLSearchParams({ action });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') search.set(key, String(value));
  });
  const res = await fetch(`${SUPABASE_URL}/functions/v1/omnia-live?${search.toString()}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
