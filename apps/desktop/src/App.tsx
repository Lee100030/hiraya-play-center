import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@hiraya/ui';
import { emptyStore, type HirayaDatabase, type HirayaUser } from '@hiraya/types';
import { Shell } from './components/Shell';
import { TitleBar } from './components/TitleBar';
import { DashboardPage } from './pages/DashboardPage';
import {
  ParentsPage,
  ProfilePage,
  StudentsPage,
  TeacherWorkspace,
  TeachersPage,
} from './pages/PeoplePages';
import {
  AnnouncementsPage,
  AttendancePage,
  CalendarPage,
  ClassesPage,
  EnrollmentPage,
  ModulesPage,
  NotificationsPage,
  PaymentsPage,
  ProgramsPage,
  ProgressPage,
  ReportsPage,
  SchedulesPage,
  SettingsPage,
} from './pages/RecordsPages';
import { api, USER_STORAGE_KEY } from './lib/api';
import type { ViewId } from './lib/views';
import { SESSION_STORAGE_KEY, brand } from '@hiraya/config';

export default function App() {
  const [user, setUser] = useState<HirayaUser | null>(null);
  const [store, setStore] = useState<HirayaDatabase>(emptyStore());
  const [view, setView] = useState<ViewId>('dashboard');
  const [teacher, setTeacher] = useState<HirayaUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStore(await api.getStore());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to the local API. Check that the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = brand.windowTitle;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(SESSION_STORAGE_KEY);
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (token && raw) {
      try {
        setUser(JSON.parse(raw) as HirayaUser);
      } catch {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  async function save(next: HirayaDatabase) {
    await api.putStore(next);
    setStore(await api.getStore());
  }

  if (!user) {
    return (
      <div className="desk-app">
        <TitleBar />
        <main className="login-stage">
          <form
            className="login-glass"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const session = await api.login(login, password);
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.user));
                setUser(session.user);
                setPassword('');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Sign-in failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            <img src="./images/hiraya-crest.png" alt="HIRAYA Learning Center crest" width={80} height={80} />
            <p className="hlc-kicker">Staff entrance</p>
            <h1>HIRAYA Desktop</h1>
            <p className="login-sublabel">Learning Center</p>
            <p>Windows operations client for administrators, teachers, and staff. Passwords stay on the local hub.</p>
            {error ? <Alert>{error}</Alert> : null}
            <label>
              Username or email
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="login-gradient" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Continue'}
            </button>
            <p className="login-hint">Local Super Admin: admin · Admin123</p>
          </form>
        </main>
      </div>
    );
  }

  return (
    <Shell
      user={user}
      view={view}
      error={error}
      onRetry={() => void refresh()}
      onView={(id) => {
        setView(id);
        if (id !== 'teacher-workspace') setTeacher(null);
      }}
      onLogout={async () => {
        await api.logout();
        setUser(null);
        setStore(emptyStore());
      }}
    >
      {view === 'dashboard' ? (
        <DashboardPage user={user} store={store} loading={loading} error={error} onRetry={() => void refresh()} />
      ) : null}
      {view === 'students' ? <StudentsPage store={store} loading={loading} onSave={save} /> : null}
      {view === 'parents' ? <ParentsPage store={store} loading={loading} onSave={save} /> : null}
      {view === 'staff' ? (
        <TeachersPage
          store={store}
          loading={loading}
          onOpen={(row) => {
            setTeacher(row);
            setView('teacher-workspace');
          }}
        />
      ) : null}
      {view === 'teacher-workspace' && teacher ? (
        <TeacherWorkspace store={store} teacher={teacher} onBack={() => setView('staff')} />
      ) : null}
      {view === 'programs' ? <ProgramsPage store={store} loading={loading} /> : null}
      {view === 'classes' ? <ClassesPage store={store} loading={loading} /> : null}
      {view === 'enrollment' ? <EnrollmentPage store={store} loading={loading} /> : null}
      {view === 'attendance' ? <AttendancePage store={store} loading={loading} /> : null}
      {view === 'progress' ? <ProgressPage store={store} loading={loading} /> : null}
      {view === 'payments' ? <PaymentsPage store={store} loading={loading} /> : null}
      {view === 'schedules' ? <SchedulesPage store={store} loading={loading} /> : null}
      {view === 'calendar' ? <CalendarPage store={store} loading={loading} /> : null}
      {view === 'notifications' ? <NotificationsPage store={store} loading={loading} /> : null}
      {view === 'announcements' ? <AnnouncementsPage store={store} loading={loading} /> : null}
      {view === 'modules' ? <ModulesPage store={store} loading={loading} /> : null}
      {view === 'reports' ? <ReportsPage store={store} loading={loading} /> : null}
      {view === 'settings' ? <SettingsPage store={store} loading={loading} /> : null}
      {view === 'profile' ? <ProfilePage user={user} onView={setView} /> : null}
    </Shell>
  );
}
