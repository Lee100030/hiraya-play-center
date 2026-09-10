'use client';

import { useStore } from '@/components/StoreProvider';
import { Card, Loading } from '@hiraya/ui';

export default function ReportsPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  const present = store.attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const overdue = store.payments.filter((p) => p.paymentStatus === 'overdue').length;
  return (
    <>
      <h1>Operations reports</h1>
      <div className="grid-cards">
        <Card title="Attendance marks">{store.attendance.length}</Card>
        <Card title="Present / late">{present}</Card>
        <Card title="Progress reports">{store.reports.length}</Card>
        <Card title="Overdue payments">{overdue}</Card>
        <Card title="Active students">{store.students.filter((s) => s.status === 'active').length}</Card>
        <Card title="Pending applications">
          {store.enrollmentApplications.filter((a) => a.status === 'pending_review').length}
        </Card>
      </div>
    </>
  );
}
