import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '@hiraya/api';
import { emptyStore, type HirayaDatabase, type Student } from '@hiraya/types';
import { isMobileParent } from './rbac';
import { api, queueSessionNotice, useAuth } from './auth';
import { familyStudents, friendlyError } from './selectors';

type StoreValue = {
  store: HirayaDatabase;
  loading: boolean;
  error: string | null;
  selected?: Student;
  setSelectedId: (id: string) => void;
  children: Student[];
  refresh: () => Promise<void>;
};

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, setSessionUser, logout } = useAuth();
  const [store, setStore] = useState<HirayaDatabase>(emptyStore());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');

  const refresh = useCallback(async () => {
    if (!user) {
      setStore(emptyStore());
      setLoading(false);
      return;
    }
    if (user.notes === 'mobile-preview') {
      setStore(emptyStore());
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await api.getStore();
      setStore(next);
      const live = next.users.find((item) => item.userId === user.userId);
      if (
        live &&
        (live.profileImagePath || '') !== (user.profileImagePath || '')
      ) {
        await setSessionUser({ ...user, profileImagePath: live.profileImagePath, updatedAt: live.updatedAt });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        queueSessionNotice('Your session expired. Sign in again.');
        await logout();
        return;
      }
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [logout, setSessionUser, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const kids = useMemo(() => familyStudents(store, user), [store, user]);

  useEffect(() => {
    if (!kids.length) {
      setSelectedId('');
      return;
    }
    if (!kids.some((item) => item.studentId === selectedId)) {
      setSelectedId(kids[0].studentId);
    }
  }, [kids, selectedId]);

  const value = useMemo<StoreValue>(
    () => ({
      store,
      loading,
      error,
      selected: kids.find((item) => item.studentId === selectedId) || kids[0],
      setSelectedId,
      children: kids,
      refresh,
    }),
    [store, loading, error, kids, selectedId, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCenter(): StoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('Store missing');
  return ctx;
}

export function useIsFamily() {
  const { user } = useAuth();
  return isMobileParent(user?.role);
}
