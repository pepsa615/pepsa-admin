import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, type Session } from '../core/api.js';

interface AuthState {
  session?: Session;
  loading: boolean;
  login(email: string, password: string): Promise<{ enrollment?: { secret: string; uri: string } }>;
  verifyMfa(code: string, recovery?: boolean): Promise<string[]>;
  completeMfaEnrollment(): Promise<void>;
  stepUp(code: string): Promise<void>;
  logout(): Promise<void>;
  can(permission: string): boolean;
}
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .session()
      .then(async (value) => {
        setSession(value);
        await api.csrf();
      })
      .catch((error) => {
        if (!(error instanceof ApiError) || error.status !== 401) console.error(error);
      })
      .finally(() => setLoading(false));
  }, []);
  const login = useCallback(
    async (email: string, password: string) => api.login(email, password),
    [],
  );
  const verifyMfa = useCallback(async (code: string, recovery = false) => {
    const result = recovery ? await api.recoverMfa(code) : await api.verifyMfa(code);
    if (!result.recoveryCodes.length) setSession(await api.session());
    return result.recoveryCodes;
  }, []);
  const completeMfaEnrollment = useCallback(async () => setSession(await api.session()), []);
  const stepUp = useCallback(async (code: string) => api.stepUp(code), []);
  const logout = useCallback(async () => {
    await api.logout();
    setSession(undefined);
  }, []);
  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      login,
      verifyMfa,
      completeMfaEnrollment,
      stepUp,
      logout,
      can: (permission) =>
        Boolean(
          session?.permissions.includes(permission) || session?.permissions.includes('admin.super'),
        ),
    }),
    [session, loading, login, verifyMfa, completeMfaEnrollment, stepUp, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
};
