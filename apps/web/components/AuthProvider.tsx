'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthSession, HirayaUser } from '@hiraya/types';
import { api } from '@/lib/api';
import { readSession, sessionPersists, writeSession } from '@/lib/session';
import { resolveLoginPassword } from '@hiraya/utils';

type AuthState = {
  user: HirayaUser | null;
  ready: boolean;
  login: (login: string, password: string, remember?: boolean) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<HirayaUser | null>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<HirayaUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const session = readSession();
    setUser(session?.user ?? null);
    setReady(true);
    if (!session) return;
    (async () => {
      try {
        const live = await api.me();
        if (cancelled) return;
        writeSession({ token: session.token, user: live }, sessionPersists());
        setUser(live);
      } catch {
        if (cancelled) return;
        writeSession(null);
        setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (loginValue: string, password: string, remember = true) => {
    const withTimeout = async (run: () => Promise<AuthSession>) => {
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('Sign-in timed out')), 60000);
      });
      return Promise.race([run(), timeout]);
    };

    const session = await withTimeout(() => api.login(loginValue, resolveLoginPassword(loginValue, password)));
    writeSession(session, remember);
    setUser(session.user);
    return session;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const session = readSession();
    if (!session) return null;
    const live = await api.me();
    writeSession({ token: session.token, user: live }, sessionPersists());
    setUser(live);
    return live;
  }, []);

  const value = useMemo(() => ({ user, ready, login, logout, refreshUser }), [user, ready, login, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
