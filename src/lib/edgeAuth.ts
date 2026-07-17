const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * The platform uses opaque session tokens stored in user_sessions, not Supabase Auth JWTs.
 * Supabase's Edge gateway still expects a valid JWT in Authorization, so the anonymous key
 * is used for gateway admission and the real Omnia session is sent separately.
 */
export function edgeAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const sessionToken = localStorage.getItem('omnia_session_token') || '';
  return {
    'Content-Type': 'application/json',
    ...(ANON_KEY ? { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY } : {}),
    ...(sessionToken ? { 'x-omnia-session-token': sessionToken } : {}),
    ...extra,
  };
}
