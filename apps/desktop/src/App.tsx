import { emptyStore, type HirayaDatabase, type HirayaUser } from '@hiraya/types';
import { SESSION_STORAGE_KEY } from '@hiraya/config';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { Shell } from './components/Shell';
import { api, USER_STORAGE_KEY } from './lib/api';
import { type ViewId } from './lib/views';
import { DashboardPage } from './pages/DashboardPage';
import { WorkspacePages } from './pages/WorkspacePages';
import { isAdminLoginChallenge } from '@hiraya/api';
import { displayName, isManagementLaneView, collapseDuplicateStaffTasks, resolveLoginPassword, type ManagementLaneId } from '@hiraya/utils';

export default function App() {
  const [user, setUser] = useState<HirayaUser | null>(null);
  const [store, setStore] = useState<HirayaDatabase>(emptyStore());
  const [view, setView] = useState<ViewId>('dashboard');
  const [peopleLane, setPeopleLane] = useState<ManagementLaneId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [login, setLogin] = useState('admin');
  const [password, setPassword] = useState('');
  const [otpChallenge, setOtpChallenge] = useState<string | null>(null);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('hiraya.sidebar') === '1');

  const storeRef = useRef(store);
  const epoch = useRef(0);
  const taskScrub = useRef(false);
  storeRef.current = store;

  function publish(next: HirayaDatabase) {
    storeRef.current = next;
    setStore(next);
  }

  const refresh = useCallback(async () => {
    const seen = epoch.current;
    setLoading(true);
    setLoadError(null);
    try {
      const next = await api.getStore();
      if (seen !== epoch.current) return;
      storeRef.current = next;
      setStore(next);
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
    if (!user || taskScrub.current) return;
    const tasks = store.staffTasks || [];
    if (!tasks.length) return;
    const nextTasks = collapseDuplicateStaffTasks(tasks);
    if (nextTasks.length === tasks.length) {
      taskScrub.current = true;
      return;
    }
    taskScrub.current = true;
    void saveStore({ ...store, staffTasks: nextTasks }).catch(() => {
      taskScrub.current = false;
    });
  }, [user, store]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      const seen = epoch.current;
      void api
        .getStore()
        .then((next) => {
          if (seen !== epoch.current) return;
          storeRef.current = next;
          setStore(next);
        })
        .catch(() => undefined);
    }, 10000);
    function onFocus() {
      const seen = epoch.current;
      void api
        .getStore()
        .then((next) => {
          if (seen !== epoch.current) return;
          storeRef.current = next;
          setStore(next);
        })
        .catch(() => undefined);
    }
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
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
      if (otpChallenge) {
        const trimmed = otpCode.trim();
        if (!/^\d{6}$/.test(trimmed)) {
          setError('Enter the 6-digit code from the email.');
          return;
        }
        const session = await api.confirmAdminLogin(otpChallenge, trimmed);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.user));
        setUser(session.user);
        setOtpChallenge(null);
        setOtpSentTo(null);
        setOtpCode('');
        setStore(await api.getStore());
        setView('dashboard');
        return;
      }
      const result = await api.login(login, resolveLoginPassword(login, password));
      if (isAdminLoginChallenge(result)) {
        setOtpChallenge(result.challenge);
        setOtpSentTo(result.sentTo);
        setOtpCode('');
        return;
      }
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user));
      setUser(result.user);
      setStore(await api.getStore());
      setView('dashboard');
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Sign-in failed';
      const offline =
        /failed to fetch|networkerror|load failed|aborted|timeout/i.test(raw) ||
        (err instanceof Error && err.name === 'AbortError');
      if (!offline) {
        setError(raw);
        return;
      }
      const configured = String(import.meta.env.VITE_API_URL || '');
      const localApi = !configured || /localhost|127\.0\.0\.1/.test(configured);
      if (import.meta.env.DEV && localApi) {
        setError('HIRAYA API is not running on port 5188. Start Hiraya.Api, then sign in again.');
        return;
      }
      try {
        const health = await api.health();
        if (health?.status === 'ok') {
          setError('The center is online, but sign-in did not go through. Try again.');
          return;
        }
      } catch {
        /* Health failed too — treat as a cold start. */
      }
      setError('The center is waking up. Wait a moment and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    epoch.current += 1;
    await api.logout();
    setUser(null);
    publish(emptyStore());
    setPassword('');
  }

  function onStore(next: HirayaDatabase) {
    epoch.current += 1;
    publish(next);
  }

  async function saveStore(next: HirayaDatabase) {
    const base = storeRef.current;
    const ticket = ++epoch.current;
    setLoadError(null);
    try {
      const saved = await api.saveChanges(base, next);
      if (ticket !== epoch.current) return;
      publish(saved);
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
        otpSentTo={otpSentTo}
        otpCode={otpCode}
        onOtpCode={setOtpCode}
        onResendOtp={() => {
          if (!otpChallenge) return;
          setError(null);
          setBusy(true);
          void api
            .resendAdminLogin(otpChallenge)
            .then((next) => {
              setOtpChallenge(next.challenge);
              setOtpSentTo(next.sentTo);
              setOtpCode('');
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'The code could not be sent again.'))
            .finally(() => setBusy(false));
        }}
        onClearOtp={() => {
          setOtpChallenge(null);
          setOtpSentTo(null);
          setOtpCode('');
          setError(null);
        }}
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
      onStore={onStore}
      saveStore={saveStore}
    >
      {view === 'dashboard' ? (
        <DashboardPage
          store={store}
          name={displayName(user)}
          role={user.role}
          saveStore={saveStore}
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
          onStore={onStore}
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
