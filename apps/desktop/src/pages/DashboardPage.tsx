import { Button, Card, Loading, NetworkError, PageHeader, StatusBadge } from '@hiraya/ui';
import { displayName, emptyCell, roleLabel, todayIsoDate } from '@hiraya/utils';
import type { HirayaDatabase, HirayaUser } from '@hiraya/types';
import type { ViewId } from '../lib/views';

export function DashboardPage({
  user,
  store,
  loading,
  error,
  onRetry,
  onView,
}: {
  user: HirayaUser;
  store: HirayaDatabase;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onView?: (id: ViewId) => void;
}) {
  if (loading && !store.students.length && !store.users.length) return <Loading />;
  if (error && !store.students.length && !store.users.length) {
    return <NetworkError onRetry={onRetry} message={error} />;
  }

  const today = todayIsoDate();
  const activeStudents = store.students.filter((s) => s.status === 'active');
  const inactiveStudents = store.students.filter((s) => s.status !== 'active');
  const todaySchedules = store.schedules.filter((row) => (row.startAt || '').slice(0, 10) === today);
  const abaToday = todaySchedules.filter((s) => /aba/i.test(`${s.title} ${s.notes}`)).length;
  const tutorialToday = todaySchedules.filter((s) => /tutorial/i.test(`${s.title} ${s.notes}`)).length;
  const pendingPay = store.payments.filter((p) => ['pending', 'partial', 'overdue'].includes(p.paymentStatus));
  const payTotal = pendingPay.reduce((n, p) => n + Number(p.amount) - Number(p.amountPaid || 0), 0);
  const pendingApps = store.enrollmentApplications.filter((row) =>
    ['pending', 'pending_review', 'inquiry', 'application', 'requirements'].includes(normalize(row.status)),
  );
  const makeupQueue = (store.makeupRequests || []).filter((r) => r.status === 'pending').length;
  const certQueue = (store.certificateRequests || []).filter((r) => r.status !== 'ready' && r.status !== 'downloaded').length;
  const concerns = store.alerts.filter((a) => a.kind === 'parent_feedback' || /concern/i.test(a.title)).length;

  const metrics = [
    ['Active students', activeStudents.length],
    ['Inactive students', inactiveStudents.length],
    ['Classes today', todaySchedules.length],
    ['ABA sessions', abaToday],
    ['Tutorial sessions', tutorialToday],
    ['Payments pending (₱)', Math.round(payTotal)],
    ['Enrollment applications', pendingApps.length],
    ['Make-up queue', makeupQueue],
    ['Certificates in process', certQueue],
    ['Parent concerns', concerns],
  ] as const;

  function normalize(status?: string) {
    return (status || '').toLowerCase();
  }

  return (
    <>
      <PageHeader
        kicker="Overview"
        title={`Good day, ${displayName(user)}`}
        description={`${roleLabel(user.role)} · live counts from the local hub.`}
        actions={
          onView ? (
            <div className="hlc-toolbar">
              <Button type="button" onClick={() => onView('students')}>
                + Student
              </Button>
              <Button type="button" onClick={() => onView('payments')}>
                + Payment
              </Button>
              <Button type="button" onClick={() => onView('attendance')}>
                + Attendance
              </Button>
              <Button type="button" onClick={() => onView('announcements')}>
                + Announcement
              </Button>
              <Button type="button" onClick={() => onView('schedules')}>
                + Schedule
              </Button>
              <Button type="button" onClick={() => onView('certificates')}>
                + Certificate
              </Button>
              <Button type="button" onClick={() => onView('makeup')}>
                Make-up queue
              </Button>
            </div>
          ) : null
        }
      />
      <div className="grid-cards">
        {metrics.map(([label, value]) => (
          <Card key={label} title={label}>
            <strong className="metric">{value}</strong>
          </Card>
        ))}
      </div>
      <section className="desk-split">
        <Card title="Recent activity">
          {store.auditLogs.length === 0 ? (
            <p className="hlc-muted">No records found. Activity appears after staff save changes.</p>
          ) : (
            <ul className="quiet-list">
              {store.auditLogs.slice(0, 8).map((row) => (
                <li key={row.auditId}>
                  <strong>{emptyCell(row.action)}</strong>
                  <span>{emptyCell(row.summary)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Announcements">
          {store.news.length === 0 ? (
            <p className="hlc-muted">No records found. + Add from Announcements.</p>
          ) : (
            store.news.slice(0, 5).map((item) => (
              <article key={item.newsId} className="stack-item">
                <strong>{item.title}</strong>
                <StatusBadge status={item.status} />
                <p>{emptyCell(item.body)}</p>
              </article>
            ))
          )}
        </Card>
      </section>
    </>
  );
}
