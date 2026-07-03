const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '/api';

async function parseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`Erreur serveur (${res.status})`);
  }
}

export async function authFetch<T>(slug: string, body: unknown): Promise<T> {
  const token = localStorage.getItem('omnia_session_token');
  let res: Response;
  try {
    res = await fetch(`${BASE}/${slug}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ANON_KEY}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Erreur réseau. Vérifiez votre connexion.');
  }
  return parseJson<T>(res);
}

/** GET /auth-me — uses session_token (not ANON_KEY) as bearer */
export async function authGetMe<T>(sessionToken: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/auth-me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
  } catch {
    throw new Error('Erreur réseau. Vérifiez votre connexion.');
  }
  return parseJson<T>(res);
}
