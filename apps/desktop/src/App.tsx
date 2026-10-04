import { emptyStore, type HirayaDatabase, type HirayaUser } from '@hiraya/types';
import { SESSION_STORAGE_KEY } from '@hiraya/config';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { Shell } from './components/Shell';
import { api, USER_STORAGE_KEY } from './lib/api';
import { type ViewId } from './lib/views';
import { DashboardPage } from './pages/DashboardPage';
import { WorkspacePages } from './pages/WorkspacePages';
import { displayName, isManagementLaneView, resolveLoginPassword, type ManagementLaneId } from '@hiraya/utils';

export default function App() {
  const [user, setUser] = useState<HirayaUser | null>(null);
  const [store, setStore] = useState<HirayaDatabase>(emptyStore());
  const [view, setView] = useState<ViewId>('dashboard');
  const [peopleLane, setPeopleLane] = useState<ManagementLaneId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [login, setLogin] = useState('admin');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('hiraya.sidebar') === '1');

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setStore(await api.getStore());
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Could not load records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'HIRAYA | Desktop';
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      void api.getStore().then(setStore).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem(SESSION_STORAGE_KEY);
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!token || !raw) {
      setLoading(false);
      return;
    }
    try {
      setUser(JSON.parse(raw) as HirayaUser);
    } catch {
      localStorage.removeItem(USER_STORAGE_KEY);
      return;
    }
    void (async () => {
      try {
        const live = await api.me();
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(live));
        setUser(live);
      } catch {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
        return;
      }
      await refresh();
    })();
  }, [refresh]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session = await api.login(login, resolveLoginPassword(login, password));
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.user));
      setUser(session.user);
      setStore(await api.getStore());
      setView('dashboard');
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Sign-in failed';
      const offline =
        /failed to fetch|networkerror|load failed|aborted|timeout/i.test(raw) ||
        (err instanceof Error && err.name === 'AbortError');
      setError(
        offline
          ? import.meta.env.DEV
            ? 'HIRAYA API is not running on port 5188. Start Hiraya.Api, then sign in again.'
            : 'The center is waking up. Wait a moment and try again.'
          : raw,
      );
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await api.logout();
    setUser(null);
    setStore(emptyStore());
    setPassword('');
  }

  async function saveStore(next: HirayaDatabase) {
    setLoadError(null);
    try {
      setStore(await api.saveChanges(store, next));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save records';
      setLoadError(message);
      throw err;
    }
  }

  async function onMarkRead(id: string) {
    const now = new Date().toISOString();
    let next: HirayaDatabase | null = null;
    setStore((current) => {
      next = {
        ...current,
        alerts: current.alerts.map((alert) =>
          alert.alertId === id ? { ...alert, read: true, status: 'read', readAt: now } : alert,
        ),
      };
      return next;
    });
    if (!next) return;
    try {
      await saveStore(next);
    } catch {
      /* loadError is set by saveStore */
    }
  }

  if (!user) {
    return (
      <LoginScreen
        login={login}
        password={password}
        error={error}
        busy={busy}
        onLogin={setLogin}
        onPassword={setPassword}
        onSubmit={onSubmit}
      />
    );
  }

  return (
    <Shell
      user={user}
      store={store}
      view={view}
      peopleLane={peopleLane}
      collapsed={collapsed}
      loading={loading && store.students.length === 0 && store.enrollmentApplications.length === 0}
      loadError={loadError}
      onView={(id, lane) => {
        setView(id);
        setPeopleLane(isManagementLaneView(id) || id === 'payments' || id === 'feedback' ? lane ?? null : null);
      }}
      onCollapse={() => {
        const next = !collapsed;
        setCollapsed(next);
        localStorage.setItem('hiraya.sidebar', next ? '1' : '0');
      }}
      onLogout={() => void onLogout()}
      onRefresh={() => void refresh()}
      onMarkRead={onMarkRead}
      onStore={setStore}
      saveStore={saveStore}
    >
      {view === 'dashboard' ? (
        <DashboardPage
          store={store}
          name={displayName(user)}
          role={user.role}
          onView={(id) => {
            setView(id);
            setPeopleLane(null);
          }}
        />
      ) : (
        <WorkspacePages
          view={view}
          peopleLane={peopleLane}
          store={store}
          user={user}
          onStore={setStore}
          saveStore={saveStore}
          onRefresh={refresh}
          onUser={(next) => {
            setUser(next);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next));
          }}
        />
      )}
    </Shell>
  );
}
