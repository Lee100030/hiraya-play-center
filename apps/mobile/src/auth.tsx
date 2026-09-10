import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { createHirayaApi } from '@hiraya/api';
import { resolveApiBaseUrl } from '@hiraya/config';
import type { HirayaUser } from '@hiraya/types';

const TOKEN_KEY = 'hiraya.session';
const USER_KEY = 'hiraya.user';

type AuthValue = {
  user: HirayaUser | null;
  ready: boolean;
  login: (login: string, password: string) => Promise<HirayaUser>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

export const api = createHirayaApi(
  {
    getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
    setToken: async (token) => {
      if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    },
  },
  resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL),
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<HirayaUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(USER_KEY).then((raw) => {
      if (raw) setUser(JSON.parse(raw) as HirayaUser);
      setReady(true);
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      login: async (login, password) => {
        const session = await api.login(login, password);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user));
        setUser(session.user);
        return session.user;
      },
      logout: async () => {
        await api.logout();
        await SecureStore.deleteItemAsync(USER_KEY);
        setUser(null);
      },
    }),
    [user, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('Auth missing');
  return ctx;
}
