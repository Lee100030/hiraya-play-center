'use client';

import { useStore } from '@/components/StoreProvider';
import { Card, Loading } from '@hiraya/ui';

export default function StaffPortalPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Staff portal</h1>
      <div className="grid-cards">
        <Card title="Attendance today">
          {store.attendance.filter((a) => a.attendanceDate.slice(0, 10) === new Date().toISOString().slice(0, 10)).length}
        </Card>
        <Card title="Open payments">
          {store.payments.filter((p) => ['pending', 'partial', 'overdue'].includes(p.paymentStatus)).length}
        </Card>
      </div>
    </>
  );
}
