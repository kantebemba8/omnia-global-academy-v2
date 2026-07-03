import { useState, useEffect } from 'react';
import { authGetMe, authFetch } from '../lib/authApi';
import { saveSession, getSessionToken, getStoredUser, clearSession } from '../lib/session';

export type AuthUser = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  roles: string[];
  force_password_change?: boolean;
};

type AuthMeResponse = {
  success: boolean;
  user?: AuthUser;
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authGetMe<AuthMeResponse>(token)
      .then((data) => {
        if (data.success && data.user) {
          setUser(data.user);
          setSessionToken(token);
          // Keep localStorage in sync with server-returned user
          saveSession(token, data.user);
        } else {
          clearSession();
          setUser(null);
          setSessionToken(null);
        }
      })
      .catch(() => {
        // Network error: trust cached localStorage as fallback
        const cached = getStoredUser<AuthUser>();
        if (cached) {
          setUser(cached);
          setSessionToken(token);
        } else {
          setUser(null);
          setSessionToken(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (token: string, userData: AuthUser): void => {
    saveSession(token, userData);
    setSessionToken(token);
    setUser(userData);
  };

  const logout = async (): Promise<void> => {
    const token = sessionToken;
    clearSession();
    setUser(null);
    setSessionToken(null);
    if (token) {
      try {
        await authFetch<{ success: boolean }>('auth-logout', { session_token: token });
      } catch {
        // Logout is best-effort: session already cleared client-side
      }
    }
  };

  const hasRole = (role: string): boolean =>
    user?.roles?.includes(role) ?? false;

  return { user, sessionToken, loading, login, logout, hasRole };
}
