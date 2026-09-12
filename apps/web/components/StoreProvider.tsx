'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { emptyStore, type HirayaDatabase } from '@hiraya/types';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { getToken } from '@/lib/session';
import { isCloudToken, isDemoToken, readLocalStore, writeLocalStore } from '@/lib/enrollment';

type StoreState = {
  store: HirayaDatabase;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  save: (next: HirayaDatabase) => Promise<void>;
};

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [store, setStore] = useState<HirayaDatabase>(emptyStore());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (isDemoToken(token) && !isCloudToken(token)) {
        setStore(readLocalStore());
        return;
      }
      setStore(await api.getStore());
    } catch (err) {
      setStore(readLocalStore());
      setError(err instanceof Error ? err.message : 'Could not load center data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const save = useCallback(async (next: HirayaDatabase) => {
    const token = getToken();
    if (isDemoToken(token) && !isCloudToken(token)) {
      writeLocalStore(next);
      setStore(next);
      return;
    }
    try {
      const saved = await api.putStore(next);
      setStore(saved);
    } catch {
      writeLocalStore(next);
      setStore(next);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <StoreContext.Provider value={{ store, loading, error, refresh, save }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
