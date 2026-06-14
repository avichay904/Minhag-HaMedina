import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getAdminToken, setAdminToken, clearAdminToken, adminApi, ApiRequestError } from './apiClient';
import { registerLogoutHandler, unregisterLogoutHandler } from './authBus';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isValidating: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(getAdminToken);
  // Start validating only when there is a stored token to check.
  const [isValidating, setIsValidating] = useState<boolean>(() => !!getAdminToken());
  // Prevent double-run in StrictMode.
  const validatedRef = useRef(false);

  const logout = useCallback(() => {
    clearAdminToken();
    setToken(null);
  }, []);

  // Register the logout dispatcher so apiClient can call it on 401/403.
  useEffect(() => {
    registerLogoutHandler(logout);
    return () => {
      unregisterLogoutHandler();
    };
  }, [logout]);

  // On mount, verify stored token is still valid before rendering protected routes.
  useEffect(() => {
    if (validatedRef.current) return;
    const stored = getAdminToken();
    if (!stored) {
      setIsValidating(false);
      return;
    }
    validatedRef.current = true;
    // Safety timeout: never leave the app stuck on a blank screen if the
    // validation request hangs (no response). Resolve the gate after 8s.
    const timeout = setTimeout(() => setIsValidating(false), 8000);
    adminApi.validateToken().catch(() => {
      clearAdminToken();
      setToken(null);
    }).finally(() => {
      clearTimeout(timeout);
      setIsValidating(false);
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

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, isValidating, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
