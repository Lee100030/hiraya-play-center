'use client';

import { useStore } from '@/components/StoreProvider';
import { useAuth } from '@/components/AuthProvider';
import { Card, Loading, StatusBadge } from '@hiraya/ui';
import { roleLabel } from '@hiraya/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  const { store, loading, error } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Dashboard</h1>
      <p>
        Signed in as {user?.fullname} · {roleLabel(user?.role)}
      </p>
      {error ? <p>{error}</p> : null}
      <div className="grid-cards">
        <Card title="Students">{store.students.length}</Card>
        <Card title="Teachers / staff">
          {store.users.filter((u) => u.role === 'teacher' || u.role === 'staff').length}
        </Card>
        <Card title="Open enrollments">
          {store.enrollmentApplications.filter((a) => a.status === 'pending_review').length}
        </Card>
        <Card title="Open payments">
          {store.payments.filter((p) => ['pending', 'partial', 'overdue'].includes(p.paymentStatus)).length}
        </Card>
        <Card title="Today attendance">
          {store.attendance.filter((a) => a.attendanceDate.slice(0, 10) === new Date().toISOString().slice(0, 10)).length}
        </Card>
        <Card title="Unread alerts">{store.alerts.filter((a) => !a.read).length}</Card>
        <Card title="Make-up queue">{(store.makeupRequests || []).filter((r) => r.status === 'pending').length}</Card>
        <Card title="Certificates in process">
          {(store.certificateRequests || []).filter((r) => r.status !== 'ready' && r.status !== 'downloaded').length}
        </Card>
      </div>
      <section style={{ marginTop: 24 }}>
        <h2>Latest announcements</h2>
        {store.news.slice(0, 5).map((item) => (
          <article key={item.newsId} className="hlc-card" style={{ marginBottom: 12 }}>
            <strong>{item.title}</strong>
            <StatusBadge status={item.status} />
            <p>{item.body}</p>
          </article>
        ))}
      </section>
    </>
  );
}
