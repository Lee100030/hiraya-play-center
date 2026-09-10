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
import { readSession, writeSession } from '@/lib/session';

type AuthState = {
  user: HirayaUser | null;
  ready: boolean;
  login: (login: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<HirayaUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = readSession();
    setUser(session?.user ?? null);
    setReady(true);
  }, []);

  const login = useCallback(async (loginValue: string, password: string) => {
    const session = await api.login(loginValue, password);
    writeSession(session);
    setUser(session.user);
    return session;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
