import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ApiError, createHirayaApi } from '@hiraya/api';
import type { HirayaUser } from '@hiraya/types';
import { resolveMobileApiUrl } from './apiUrl';
import { canUseMobileApp, MOBILE_LOGIN_BLOCKED } from './rbac';

const TOKEN_KEY = 'hiraya.session';
const USER_KEY = 'hiraya.user';

let sessionNotice = '';

export function queueSessionNotice(message: string) {
  sessionNotice = message;
}

export function consumeSessionNotice() {
  const message = sessionNotice;
  sessionNotice = '';
  return message;
}

type AuthValue = {
  user: HirayaUser | null;
  ready: boolean;
  login: (login: string, password: string, remember?: boolean) => Promise<HirayaUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<HirayaUser | null>;
  setSessionUser: (next: HirayaUser) => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);
let memoryToken: string | null = null;

export function currentSessionToken() {
  return memoryToken || '';
}
let persistSession = true;

function mobileLoginIds(login: string, password: string) {
  const trimmed = login.trim();
  return { login: trimmed, password };
}

export const apiBaseUrl = resolveMobileApiUrl();

export const api = createHirayaApi(
  {
    getToken: async () => {
      if (memoryToken) return memoryToken;
      try {
        return await SecureStore.getItemAsync(TOKEN_KEY);
      } catch {
        return null;
      }
    },
    setToken: async (token) => {
      memoryToken = token;
      try {
        if (token && persistSession) await SecureStore.setItemAsync(TOKEN_KEY, token);
        else await SecureStore.deleteItemAsync(TOKEN_KEY);
      } catch {
        /* Expo Go may deny SecureStore until the app is fully loaded */
      }
    },
  },
  apiBaseUrl,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<HirayaUser | null>(null);
  const [ready, setReady] = useState(false);
  const persist = useRef(true);

  async function writeUser(next: HirayaUser | null) {
    setUser(next);
    try {
      if (next && persist.current) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(next));
      else if (!next) await SecureStore.deleteItemAsync(USER_KEY);
    } catch {
      /* Expo Go may deny SecureStore */
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) memoryToken = token;
        const raw = await SecureStore.getItemAsync(USER_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as HirayaUser;
          if (canUseMobileApp(parsed.role)) {
            setUser(parsed);
            try {
              const live = await api.me();
              if (canUseMobileApp(live.role)) {
                setUser(live);
                await SecureStore.setItemAsync(USER_KEY, JSON.stringify(live));
              }
            } catch (err) {
              if (err instanceof ApiError && err.status === 401) {
                memoryToken = null;
                queueSessionNotice('Your session expired. Sign in again.');
                try {
                  await SecureStore.deleteItemAsync(TOKEN_KEY);
                  await SecureStore.deleteItemAsync(USER_KEY);
                } catch {
                  /* Expo Go may deny SecureStore */
                }
                setUser(null);
              }
            }
          } else {
            memoryToken = null;
            await SecureStore.deleteItemAsync(USER_KEY);
            await SecureStore.deleteItemAsync(TOKEN_KEY);
          }
        }
      } catch {
        /* Expo Go without native store, or corrupt JSON */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      login: async (login, password, remember = true) => {
        persist.current = remember;
        persistSession = remember;
        const ids = mobileLoginIds(login, password);
        const session = await api.login(ids.login, ids.password);
        if (!canUseMobileApp(session.user.role)) {
          await api.logout();
          throw new Error(MOBILE_LOGIN_BLOCKED);
        }
        let next = session.user;
        try {
          next = await api.me();
        } catch {
          /* login payload is enough to enter the app */
        }
        await writeUser(next);
        return next;
      },
      logout: async () => {
        try {
          await api.logout();
        } catch {
          /* Still clear this device if the API is unreachable. */
        }
        memoryToken = null;
        persistSession = true;
        persist.current = true;
        try {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(USER_KEY);
        } catch {
          /* Expo Go may deny SecureStore */
        }
        await writeUser(null);
      },
      refreshUser: async () => {
        try {
          const live = await api.me();
          await writeUser(live);
          return live;
        } catch {
          return user;
        }
      },
      setSessionUser: async (next) => {
        await writeUser(next);
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
