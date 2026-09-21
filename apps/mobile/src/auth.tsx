import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createHirayaApi } from '@hiraya/api';
import { resolveApiBaseUrl } from '@hiraya/config';
import type { HirayaUser } from '@hiraya/types';

const TOKEN_KEY = 'hiraya.session';
const USER_KEY = 'hiraya.user';

async function readSecret(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function writeSecret(key: string, value: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (value) globalThis.localStorage?.setItem(key, value);
      else globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore quota */
    }
    return;
  }
  if (value) await SecureStore.setItemAsync(key, value);
  else await SecureStore.deleteItemAsync(key);
}

type AuthValue = {
  user: HirayaUser | null;
  ready: boolean;
  login: (login: string, password: string) => Promise<HirayaUser>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

export const api = createHirayaApi(
  {
    getToken: () => readSecret(TOKEN_KEY),
    setToken: (token) => writeSecret(TOKEN_KEY, token),
  },
  resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL),
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<HirayaUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    readSecret(USER_KEY).then((raw) => {
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
        await writeSecret(USER_KEY, JSON.stringify(session.user));
        setUser(session.user);
        return session.user;
      },
      logout: async () => {
        await api.logout();
        await writeSecret(USER_KEY, null);
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
