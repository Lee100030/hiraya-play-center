import { useMemo, useState } from 'react';
import { createHirayaApi } from '@hiraya/api';
import { resolveApiBaseUrl, SESSION_STORAGE_KEY } from '@hiraya/config';
import { emptyStore, type HirayaDatabase, type HirayaUser } from '@hiraya/types';
import { Alert, Button, Card, Field, Input, StatusBadge, Table } from '@hiraya/ui';
import { displayName, roleLabel, studentDisplay } from '@hiraya/utils';

const api = createHirayaApi(
  {
    getToken: () => localStorage.getItem(SESSION_STORAGE_KEY),
    setToken: (token) => {
      if (token) localStorage.setItem(SESSION_STORAGE_KEY, token);
      else localStorage.removeItem(SESSION_STORAGE_KEY);
    },
  },
  resolveApiBaseUrl(import.meta.env.VITE_API_URL),
);

type View = 'dashboard' | 'students' | 'attendance' | 'payments' | 'enrollment' | 'reports';

export default function App() {
  const [user, setUser] = useState<HirayaUser | null>(null);
  const [store, setStore] = useState<HirayaDatabase>(emptyStore());
  const [view, setView] = useState<View>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState('admin');
  const [password, setPassword] = useState('');

  const nav = useMemo(
    () =>
      [
        ['dashboard', 'Dashboard'],
        ['students', 'Students'],
        ['enrollment', 'Enrollment'],
        ['attendance', 'Attendance'],
        ['payments', 'Payments'],
        ['reports', 'Reports'],
      ] as const,
    [],
  );

  if (!user) {
    return (
      <form
        className="desk-login hlc-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            const session = await api.login(login, password);
            setUser(session.user);
            setStore(await api.getStore());
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign-in failed');
          }
        }}
      >
        <h1>HIRAYA Desktop</h1>
        <p>Windows operations client for administrators, teachers, and staff.</p>
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Username">
          <Input value={login} onChange={(e) => setLogin(e.target.value)} />
        </Field>
        <div style={{ height: 12 }} />
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div style={{ marginTop: 16 }}>
          <Button type="submit">Open workspace</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="desk-shell">
      <aside className="desk-nav">
        <h2 style={{ color: '#e8c547' }}>HIRAYA</h2>
        <p>
          {displayName(user)}
          <br />
          {roleLabel(user.role)}
        </p>
        {nav.map(([id, label]) => (
          <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
        <button
          onClick={async () => {
            await api.logout();
            setUser(null);
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="desk-main">
        {view === 'dashboard' && (
          <>
            <h1>Operations desk</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <Card title="Students">{store.students.length}</Card>
              <Card title="Open payments">
                {store.payments.filter((p) => ['pending', 'partial', 'overdue'].includes(p.paymentStatus)).length}
              </Card>
              <Card title="Applications">{store.enrollmentApplications.length}</Card>
            </div>
          </>
        )}
        {view === 'students' && (
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Program</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {store.students.map((s) => (
                <tr key={s.studentId}>
                  <td>{studentDisplay(s)}</td>
                  <td>{s.program}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {view === 'attendance' && (
          <Table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Student</th>
              </tr>
            </thead>
            <tbody>
              {store.attendance.slice(0, 40).map((row) => (
                <tr key={row.attendanceId}>
                  <td>{row.attendanceDate}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>{row.studentId}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {view === 'payments' && (
          <Table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {store.payments.map((row) => (
                <tr key={row.paymentId}>
                  <td>{row.studentId}</td>
                  <td>{row.amount}</td>
                  <td>
                    <StatusBadge status={row.paymentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {view === 'enrollment' && (
          <Table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Parent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {store.enrollmentApplications.map((row) => (
                <tr key={row.applicationId}>
                  <td>{row.studentFullname}</td>
                  <td>{row.parentFullname}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {view === 'reports' && (
          <Card title="Snapshot">
            Attendance {store.attendance.length} · Progress {store.reports.length} · Audit {store.auditLogs.length}
          </Card>
        )}
      </main>
    </div>
  );
}
