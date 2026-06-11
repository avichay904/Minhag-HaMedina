import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { api, getToken, setToken, clearToken } from '../../lib/apiClient';
import type { RespondentProfile } from '@mhm/contracts';

export interface AuthContextValue {
  token: string | null;
  profile: RespondentProfile | null;
  isLoading: boolean;
  loginSocial: (provider: 'GOOGLE' | 'APPLE', token: string) => Promise<void>;
  loginAnonymous: () => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [profile, setProfile] = useState<RespondentProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!getToken());

  const loadProfile = useCallback(async () => {
    try {
      const p = await api.profile();
      setProfile(p);
    } catch {
      // If profile fails, token might be invalid — clear it
      clearToken();
      setTokenState(null);
      setProfile(null);
    }
  }, []);

  // On mount, load profile if token exists
  useEffect(() => {
    if (token) {
      setIsLoading(true);
      loadProfile().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token, loadProfile]);

  const loginSocial = useCallback(
    async (provider: 'GOOGLE' | 'APPLE', socialToken: string) => {
      const res = await api.socialLogin({ provider, token: socialToken });
      setToken(res.token);
      setTokenState(res.token);
      setProfile(res.respondent);
    },
    [],
  );

  const loginAnonymous = useCallback(async () => {
    const res = await api.anonymousLogin({});
    setToken(res.token);
    setTokenState(res.token);
    setProfile(res.respondent);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (token) {
      await loadProfile();
    }
  }, [token, loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        token,
        profile,
        isLoading,
        loginSocial,
        loginAnonymous,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
