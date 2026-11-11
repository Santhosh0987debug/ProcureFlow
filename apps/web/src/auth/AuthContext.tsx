import type { Permission } from '@procureflow/shared';
import type {
  AuthSession,
  AuthWorkspace,
  LoginRequest,
  RegisterRequest,
} from '@procureflow/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiRequest } from '../lib/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

const ACTIVE_WORKSPACE_KEY = 'procureflow:active-workspace';

function readActiveWorkspaceId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

function persistActiveWorkspaceId(workspaceId: string | null): void {
  try {
    if (workspaceId) {
      window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    } else {
      window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
  } catch {
    // Workspace selection is a convenience; the first available workspace is a safe fallback.
  }
}

interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  activeWorkspace: AuthWorkspace | null;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: readonly Permission[]) => boolean;
  setActiveWorkspace: (workspaceId: string) => void;
  applySession: (nextSession: AuthSession) => void;
  refreshSession: () => Promise<AuthSession>;
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    readActiveWorkspaceId,
  );

  const activeWorkspace = useMemo<AuthWorkspace | null>(() => {
    if (!session || session.workspaces.length === 0) {
      return null;
    }

    return (
      session.workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
      session.workspaces[0] ??
      null
    );
  }, [session, selectedWorkspaceId]);

  useEffect(() => {
    if (activeWorkspace && activeWorkspace.id !== selectedWorkspaceId) {
      setSelectedWorkspaceId(activeWorkspace.id);
      persistActiveWorkspaceId(activeWorkspace.id);
    }
  }, [activeWorkspace, selectedWorkspaceId]);

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

  const applySession = useCallback((nextSession: AuthSession) => {
    setSession(nextSession);
    setStatus('authenticated');
  }, []);

  const refreshSession = useCallback(async () => {
    const nextSession = await apiRequest<AuthSession>('/api/auth/me');
    applySession(nextSession);
    return nextSession;
  }, [applySession]);

  const setActiveWorkspace = useCallback((workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    persistActiveWorkspaceId(workspaceId);
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) => activeWorkspace?.permissions.includes(permission) ?? false,
    [activeWorkspace],
  );

  const hasAnyPermission = useCallback(
    (permissions: readonly Permission[]) =>
      permissions.some((permission) => activeWorkspace?.permissions.includes(permission) ?? false),
    [activeWorkspace],
  );

  const login = useCallback(
    async (input: LoginRequest) => {
      const nextSession = await apiRequest<AuthSession>('/api/auth/login', {
        method: 'POST',
        body: input,
      });

      applySession(nextSession);
    },
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterRequest) => {
      const nextSession = await apiRequest<AuthSession>('/api/auth/register', {
        method: 'POST',
        body: input,
      });

      applySession(nextSession);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>('/api/auth/logout', { method: 'POST' });
    } finally {
      setSession(null);
      setStatus('unauthenticated');
      setSelectedWorkspaceId(null);
      persistActiveWorkspaceId(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      activeWorkspace,
      hasPermission,
      hasAnyPermission,
      setActiveWorkspace,
      applySession,
      refreshSession,
      login,
      register,
      logout,
    }),
    [
      status,
      session,
      activeWorkspace,
      hasPermission,
      hasAnyPermission,
      setActiveWorkspace,
      applySession,
      refreshSession,
      login,
      register,
      logout,
    ],
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
