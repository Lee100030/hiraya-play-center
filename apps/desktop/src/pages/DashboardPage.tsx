import { Button, Card, Loading, NetworkError, PageHeader, RolePlaybook, StatCard, StatusBadge } from '@hiraya/ui';
import {
  ADMIN_ROLE_PLAYBOOK,
  adminHomeStats,
  dayGreeting,
  displayName,
  emptyCell,
  roleLabel,
} from '@hiraya/utils';
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

  const stats = adminHomeStats(store);
  const kpis: { label: string; value: number; hint: string; view: ViewId }[] = [
    { label: 'Active students', value: stats.activeStudents, hint: 'Open students', view: 'students' },
    { label: 'Pending enrollments', value: stats.pendingEnrollments, hint: 'Review applications', view: 'enrollment' },
    { label: 'Sessions today', value: stats.sessionsToday, hint: 'Open schedules', view: 'schedules' },
    { label: 'Tasks due', value: stats.tasksDue, hint: 'Teacher workspace', view: 'staff' },
    { label: 'Unread alerts', value: stats.unreadAnnouncements, hint: 'Open inbox', view: 'notifications' },
    { label: 'Open payments', value: stats.openPayments, hint: 'Open payments', view: 'payments' },
  ];

  return (
    <>
      <PageHeader
        crumb="Dashboard"
        kicker="HKLC operations"
        title={`${dayGreeting()}, ${displayName(user)}`}
        description={`${roleLabel(user.role)} · live counts from the local hub.`}
        actions={
          onView ? (
            <div className="hlc-toolbar">
              <Button type="button" onClick={() => onView('students')}>
                + Student
              </Button>
              <Button type="button" onClick={() => onView('enrollment')}>
                + Enrollment
              </Button>
              <Button type="button" onClick={() => onView('announcements')}>
                + Announcement
              </Button>
            </div>
          ) : null
        }
      />

      <div className="hlc-stat-grid">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            onClick={onView ? () => onView(kpi.view) : undefined}
          />
        ))}
      </div>

      <div className="hlc-section-head">
        <h2>Workbook roles</h2>
        <p className="hlc-section-note">
          Reference only — duties follow the Hiraya Kids Learning Center workbook. These lines are not links.
        </p>
      </div>
      <RolePlaybook roles={ADMIN_ROLE_PLAYBOOK} />

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
