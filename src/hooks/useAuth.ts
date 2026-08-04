import { useCallback, useEffect, useState } from 'react';
import { authGetMe, authFetch } from '../lib/authApi';
import { saveSession, getSessionToken, getStoredUser, clearSession } from '../lib/session';

export type AuthUser = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  roles: string[];
  avatar_url?: string | null;
  force_password_change?: boolean;
};

type AuthMeResponse = {
  success: boolean;
  user?: AuthUser;
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser<AuthUser>());
  const [sessionToken, setSessionToken] = useState<string | null>(() => getSessionToken());
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const token = getSessionToken();
    const cached = getStoredUser<AuthUser>();

    if (!token) {
      setUser(null);
      setSessionToken(null);
      setLoading(false);
      return;
    }

    if (cached) {
      setUser(cached);
      setSessionToken(token);
    }

    try {
      const data = await authGetMe<AuthMeResponse>(token);
      if (data.success && data.user) {
        setUser(data.user);
        setSessionToken(token);
        saveSession(token, data.user, false);
      } else {
        clearSession();
        setUser(null);
        setSessionToken(null);
      }
    } catch {
      if (!cached) {
        setUser(null);
        setSessionToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();

    const handleSessionChanged = () => void refreshSession();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'omnia_user' || event.key === 'omnia_session_token') void refreshSession();
    };

    window.addEventListener('omnia:session-changed', handleSessionChanged);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('omnia:session-changed', handleSessionChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refreshSession]);

  const login = (token: string, userData: AuthUser): void => {
    saveSession(token, userData);
    setSessionToken(token);
    setUser(userData);
  };

  const logout = async (): Promise<void> => {
    const token = sessionToken || getSessionToken();
    clearSession();
    setUser(null);
    setSessionToken(null);
    if (token) {
      try {
        await authFetch<{ success: boolean }>('auth-logout', { session_token: token });
      } catch {
        // Best effort: the local session is already cleared.
      }
    }
  };

  const hasRole = (role: string): boolean => user?.roles?.includes(role) ?? false;

  return { user, sessionToken, loading, login, logout, hasRole, refreshSession };
}
