import { edgeGatewayHeaders } from './edgeAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '/api';

async function parseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`Erreur serveur (${res.status})`);
  }
}

/**
 * Public authentication endpoints are passed through the Supabase Edge gateway
 * with the project anonymous key. Omnia opaque sessions remain in the request
 * body and are never used as gateway JWTs.
 */
export async function authFetch<T>(slug: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${slug}`, {
      method: 'POST',
      headers: edgeGatewayHeaders(),
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Erreur réseau. Vérifiez votre connexion.');
  }
  return parseJson<T>(res);
}

/** GET /auth-me — the Omnia session travels in its dedicated header. */
export async function authGetMe<T>(sessionToken: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/auth-me`, {
      method: 'GET',
      headers: edgeGatewayHeaders({ 'x-omnia-session-token': sessionToken }),
    });
  } catch {
    throw new Error('Erreur réseau. Vérifiez votre connexion.');
  }
  return parseJson<T>(res);
}
