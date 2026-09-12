'use client';

import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { enrollmentStatusLabel } from '@/lib/enrollment';
import { Card, Loading } from '@hiraya/ui';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { store, loading, error } = useStore();
  if (loading) return <Loading />;

  const apps = store.enrollmentApplications;
  const pending = apps.filter((row) => row.status === 'pending_review' || row.status === 'pending').length;
  const approved = apps.filter((row) => row.status === 'approved').length;

  return (
    <>
      <h1>Dashboard</h1>
      <p>{user?.fullname ? `Welcome back, ${user.fullname}.` : 'Welcome back.'}</p>
      {error ? <p>{error}</p> : null}
      <div className="grid-cards">
        <Card title="Total enrollments">{apps.length}</Card>
        <Card title="Pending enrollments">{pending}</Card>
        <Card title="Approved enrollments">{approved}</Card>
        <Card title="Total students">{store.students.length}</Card>
      </div>
      <section style={{ marginTop: 28 }}>
        <div className="toolbar">
          <h2>Latest applications</h2>
          <Link href="/admin/enrollments">View all</Link>
        </div>
        {apps.slice(0, 5).length === 0 ? (
          <p>No enrollment applications yet.</p>
        ) : (
          <ul className="admin-recent">
            {apps.slice(0, 5).map((row) => (
              <li key={row.applicationId}>
                <strong>{row.studentFullname}</strong>
                <span>{row.preferredProgram}</span>
                <span>{enrollmentStatusLabel(row.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
