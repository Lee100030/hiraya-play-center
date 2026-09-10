'use client';

import { useStore } from '@/components/StoreProvider';
import { Card, Loading } from '@hiraya/ui';

export default function SettingsPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  const s = store.settings;
  return (
    <>
      <h1>System settings</h1>
      <Card title={s.centerName}>
        <p>{s.address}</p>
        <p>{s.phone}</p>
        <p>{s.email}</p>
        <p>{s.businessHours}</p>
        <p>{s.timeZone}</p>
      </Card>
    </>
  );
}
