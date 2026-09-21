import { Card, Loading, NetworkError, PageHeader, StatusBadge } from '@hiraya/ui';
import { displayName, emptyCell, roleLabel, todayIsoDate } from '@hiraya/utils';
import type { HirayaDatabase, HirayaUser } from '@hiraya/types';

export function DashboardPage({
  user,
  store,
  loading,
  error,
  onRetry,
}: {
  user: HirayaUser;
  store: HirayaDatabase;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading && !store.students.length && !store.users.length) return <Loading />;
  if (error && !store.students.length && !store.users.length) {
    return <NetworkError onRetry={onRetry} message={error} />;
  }

  const today = todayIsoDate();
  const teachers = store.users.filter((row) => row.role === 'teacher' && row.status === 'active');
  const parents = store.users.filter((row) => row.role === 'parent');
  const pending = store.enrollmentApplications.filter((row) =>
    ['pending', 'pending_review'].includes(row.status),
  );
  const todayClasses = store.schedules.filter((row) => (row.startAt || '').slice(0, 10) === today);
  const unread = store.alerts.filter((row) => !row.read);

  const metrics = [
    ['Students', store.students.filter((s) => s.status !== 'archived').length],
    ['Active teachers', teachers.length],
    ['Parents', parents.length],
    ['Classes', store.classes.length],
    ['Pending enrollments', pending.length],
    ["Today's sessions", todayClasses.length],
    ['Unread alerts', unread.length],
  ] as const;

  return (
    <>
      <PageHeader
        kicker="Overview"
        title={`Good day, ${displayName(user)}`}
        description={`${roleLabel(user.role)} · live counts from the local hub.`}
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
