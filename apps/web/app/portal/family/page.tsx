'use client';

import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Card, Loading } from '@hiraya/ui';

export default function FamilyPortalPage() {
  const { user } = useAuth();
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Family portal</h1>
      <p>Welcome {user?.fullname}.</p>
      <div className="grid-cards">
        <Card title="Alerts">{store.alerts.filter((a) => !a.read).length}</Card>
        <Card title="Payments">{store.payments.length}</Card>
        <Card title="Schedules">{store.schedules.length}</Card>
      </div>
    </>
  );
}
