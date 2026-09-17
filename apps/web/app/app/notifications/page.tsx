'use client';

import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, StatusBadge } from '@hiraya/ui';

export default function NotificationsPage() {
  const { user } = useAuth();
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  const items = store.alerts.filter(
    (a) => !a.recipientId || a.recipientId === user?.userId || a.recipientId === 'everyone',
  );
  return (
    <>
      <h1>Notifications</h1>
      {items.length === 0 ? (
        <EmptyState title="No alerts" />
      ) : (
        items.map((item) => (
          <article key={item.alertId} className="hlc-card" style={{ marginBottom: 12 }}>
            <strong>{item.title}</strong> <StatusBadge status={item.status || 'unread'} />
            <p>{item.message}</p>
            <small>{item.createdAt}</small>
          </article>
        ))
      )}
    </>
  );
}
