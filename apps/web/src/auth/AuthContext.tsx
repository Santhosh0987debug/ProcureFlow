import type { AuthSession, LoginRequest, RegisterRequest } from '@procureflow/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiRequest } from '../lib/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    apiRequest<AuthSession>('/api/auth/me', { signal: controller.signal })
      .then((nextSession) => {
        if (!active) {
          return;
        }

        setSession(nextSession);
        setStatus('authenticated');
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }

        setSession(null);
        setStatus('unauthenticated');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const login = useCallback(async (input: LoginRequest) => {
    const nextSession = await apiRequest<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: input,
    });

    setSession(nextSession);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (input: RegisterRequest) => {
    const nextSession = await apiRequest<AuthSession>('/api/auth/register', {
      method: 'POST',
      body: input,
    });

    setSession(nextSession);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>('/api/auth/logout', { method: 'POST' });
    } finally {
      setSession(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, login, register, logout }),
    [status, session, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }

  return context;
}
