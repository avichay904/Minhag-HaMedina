import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getAdminToken, setAdminToken, clearAdminToken, adminApi, ApiRequestError } from './apiClient';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(getAdminToken);

  // On mount, verify stored token is still valid
  useEffect(() => {
    const stored = getAdminToken();
    if (!stored) return;
    adminApi.validateToken().catch(() => {
      clearAdminToken();
      setToken(null);
    });
  }, []);

  const login = useCallback(async (rawToken: string) => {
    setAdminToken(rawToken);
    try {
      await adminApi.validateToken();
      setToken(rawToken);
    } catch (err) {
      clearAdminToken();
      if (err instanceof ApiRequestError) {
        throw err;
      }
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    clearAdminToken();
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
