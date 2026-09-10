'use client';

import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, StatusBadge } from '@hiraya/ui';

export default function AnnouncementsPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Announcements</h1>
      {store.news.length === 0 ? (
        <EmptyState title="No announcements" />
      ) : (
        store.news.map((item) => (
          <article key={item.newsId} className="hlc-card" style={{ marginBottom: 12 }}>
            <h2>{item.title}</h2>
            <StatusBadge status={item.status} />
            <p>{item.body}</p>
          </article>
        ))
      )}
    </>
  );
}
