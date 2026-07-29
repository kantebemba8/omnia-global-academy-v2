const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Headers used only to pass through the Supabase Edge gateway.
 * Public endpoints receive the anonymous JWT but no Omnia user session.
 */
export function edgeGatewayHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(ANON_KEY ? { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY } : {}),
    ...extra,
  };
}

/**
 * The platform uses opaque session tokens stored in user_sessions, not Supabase Auth JWTs.
 * Supabase's Edge gateway receives the anonymous JWT in Authorization and the real Omnia
 * session is sent separately in x-omnia-session-token.
 */
export function edgeAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const sessionToken = localStorage.getItem('omnia_session_token') || '';
  return {
    ...edgeGatewayHeaders(),
    ...(sessionToken ? { 'x-omnia-session-token': sessionToken } : {}),
    ...extra,
  };
}
