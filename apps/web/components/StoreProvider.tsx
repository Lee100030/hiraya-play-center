'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { emptyStore, type HirayaDatabase } from '@hiraya/types';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';

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
  const storeRef = useRef(store);
  storeRef.current = store;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setStore(await api.getStore());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load center data from the HIRAYA API');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const save = useCallback(async (next: HirayaDatabase) => {
    try {
      const saved = await api.saveChanges(storeRef.current, next);
      setStore(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save to the HIRAYA API');
      throw err;
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
