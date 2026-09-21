'use client';

import { useRouter } from 'next/navigation';
import { Breadcrumb, Card, Loading, RolePlaybook, StatCard, StatusBadge } from '@hiraya/ui';
import { ADMIN_ROLE_PLAYBOOK, adminHomeStats, dayGreeting, displayName, roleLabel } from '@hiraya/utils';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { store, loading, error } = useStore();
  if (loading) return <Loading />;

  const stats = adminHomeStats(store);
  const kpis = [
    { label: 'Active students', value: stats.activeStudents, hint: 'Open students', href: '/app/students' },
    { label: 'Pending enrollments', value: stats.pendingEnrollments, hint: 'Review applications', href: '/app/enrollment' },
    { label: 'Sessions today', value: stats.sessionsToday, hint: 'Open schedules', href: '/app/schedules' },
    { label: 'Tasks due', value: stats.tasksDue, hint: 'Open teachers', href: '/app/staff' },
    { label: 'Unread alerts', value: stats.unreadAnnouncements, hint: 'Open inbox', href: '/app/notifications' },
    { label: 'Open payments', value: stats.openPayments, hint: 'Open payments', href: '/app/payments' },
  ];

  return (
    <>
      <header className="hlc-page-header">
        <div>
          <Breadcrumb trail={['HIRAYA', 'Dashboard']} />
          <span className="hlc-workspace-chip">HKLC operations</span>
          <h1>
            {dayGreeting()}, {displayName(user)}
          </h1>
          <p className="hlc-muted">
            {roleLabel(user?.role)} · live counts from the local hub.
          </p>
        </div>
      </header>
      {error ? <p>{error}</p> : null}

      <div className="hlc-stat-grid">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            onClick={() => router.push(kpi.href)}
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

      <section style={{ marginTop: 8 }}>
        <h2>Latest announcements</h2>
        {store.news.slice(0, 5).map((item) => (
          <article key={item.newsId} className="hlc-card" style={{ marginBottom: 12 }}>
            <strong>{item.title}</strong>
            <StatusBadge status={item.status} />
            <p>{item.body}</p>
          </article>
        ))}
        {store.news.length === 0 ? (
          <Card>
            <p className="hlc-muted">No records found.</p>
          </Card>
        ) : null}
      </section>
    </>
  );
}
